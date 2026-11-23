// Servicio 2.6: informe completo por correo para pedidos con código, enlace privado de 7 días, correo no guardado.
import assert from "node:assert/strict";
import { carta, informeOk, ANALISIS, env as baseEnv, state, ORIGIN, FakeNamespace } from "./helpers.mjs";
import { ReportJob } from "../src/job.js";
import { fullReportMail } from "../src/mail.js";
import worker from "../src/worker.js";

const ok = informeOk(), CODE = "LUZ-3M8Q";
const env = (over = {}) => { const e = baseEnv({ MAIL_API_KEY: "k", MAIL_FROM: "AsterOrbis <a@asterorbis.com>", ...over }); e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; return e; };
const mails = []; let seq = [], resend = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.resend.com")) {
    const body = JSON.parse(init.body); body.key = init.headers["idempotency-key"];
    const st = body.to[0] === "admin@example.com" ? 200 : (resend.length ? resend.shift() : 200);
    if (st === "net") throw new Error("red");
    if (st === 200) mails.push(body); else mails.push({ ...body, failed: st });
    return new Response("{}", { status: st });
  }
  state.calls.push(JSON.parse(init.body)); const text = JSON.stringify(seq.shift());
  return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn" }), { headers: { "content-type": "application/json" } });
};
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json().catch(() => null) }; };
const post = (id, extra = {}) => new Request("https://svc.example/jobs", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-astro-code": CODE }, body: JSON.stringify({ ...carta(), request_id: id, ...extra }) });
const get = (id) => new Request("https://svc.example/jobs/" + id, { headers: { origin: ORIGIN, "x-astro-code": CODE } });
const link = (id, key) => new Request("https://svc.example/links/" + id, { headers: { origin: ORIGIN, ...(key ? { "x-link-key": key } : {}) } });

// 1. el correo con el informe: título, secciones escapadas y enlace
{
  const m = fullReportMail("es", { title: "Uno <dos>", sections: [{ id: "a", heading: "H", body_markdown: "p1\n\np2" }] }, "https://asterorbis.com/?informe=x#k=y", 7);
  assert.match(m.subject, /Uno <dos>/); assert.match(m.html, /Uno &lt;dos&gt;/); assert.doesNotMatch(m.html, /<dos>/);
  assert.match(m.html, /<p style="margin:0 0 14px;">p1<\/p>/); assert.match(m.text, /p1\n\np2/); assert.match(m.text, /\?informe=x#k=y/);
}

// 2. pedido con código y correo: al terminar llega el informe completo; el enlace abre el informe; el correo no queda guardado
{
  const e = env(), ID = "mail-000000000000001";
  mails.length = 0;
  assert.equal((await call(post(ID, { notify_email: "ana@example.com" }), e)).status, 202);
  seq = [ANALISIS, ok]; state.calls = []; await e.REPORT_JOB.obj(ID).alarm();
  const st = (await call(get(ID), e)).body;
  assert.equal(st.status, "done"); assert.equal(st.mailed, true);
  assert.equal(mails.length, 1); const m = mails[0];
  assert.deepEqual(m.to, ["ana@example.com"]); assert.ok(m.html.includes(ok.title)); assert.ok(m.text.includes(ok.sections[0].heading.toUpperCase()));
  const [, lid, key] = m.text.match(/\?informe=([0-9a-f]{16})#k=([0-9a-f]{48})/);
  const r = await call(link(lid, key), e);
  assert.equal(r.status, 200); assert.equal(r.body.report.title, ok.title); assert.equal(r.body.chart.person.first_name, null);
  assert.equal((await call(link(lid, key.replace(/.$/, key.endsWith("0") ? "1" : "0")), e)).status, 404, "clave equivocada");
  assert.equal((await call(link(lid), e)).status, 404, "sin clave");
  // el correo no queda en el trabajo ni en el KV
  const meta = await e.REPORT_JOB.obj(ID).storage.get("meta");
  assert.equal(meta.job.notifyEmail, undefined);
  for (const [k2, v] of e.ASTRO_KV.m) assert.ok(!String(v).includes("ana@example.com"), "el correo no se guarda: " + k2);
  // el enlace vence a los 7 días
  assert.ok(e.ASTRO_KV.exp.has("lnk:" + lid));
}

// 3. sin correo, con un correo inválido o sin el servicio de correo configurado: no se manda nada y el informe llega igual
for (const [extra, over] of [[{}, {}], [{ notify_email: "no-es-correo" }, {}], [{ notify_email: "ana@example.com" }, { MAIL_API_KEY: "" }]]) {
  const e = env(over), ID = "mail-00000000000000" + (2 + Object.keys(extra).length + (over.MAIL_API_KEY === "" ? 5 : 0));
  mails.length = 0;
  await call(post(ID, extra), e);
  seq = [ANALISIS, ok]; await e.REPORT_JOB.obj(ID).alarm();
  const st = (await call(get(ID), e)).body;
  assert.equal(st.status, "done"); assert.ok(st.report); assert.equal(st.mailed, undefined); assert.equal(mails.length, 0);
}

// 4 a 6 (2.6.2): el registro anota si Resend aceptó el correo; las fallas pasajeras se reintentan con la misma clave;
// si no sale, llega un aviso a ADMIN_EMAIL sin la dirección de la persona ni el enlace
const gen = (e, ID) => JSON.parse(e.ASTRO_KV.m.get("gen:" + ID));
const run = async (ID, plan) => {
  const e = env({ MAIL_RETRY_FAST: "1", ADMIN_EMAIL: "admin@example.com" });
  mails.length = 0; resend = [...plan];
  await call(post(ID, { notify_email: "ana@example.com" }), e);
  seq = [ANALISIS, ok]; await e.REPORT_JOB.obj(ID).alarm();
  return { e, st: (await call(get(ID), e)).body, toAna: mails.filter((m) => m.to[0] === "ana@example.com"), toAdmin: mails.filter((m) => m.to[0] === "admin@example.com") };
};
{
  const ID = "mail-000000000000011", { e, st, toAna, toAdmin } = await run(ID, []);
  assert.equal(st.mailed, true); assert.equal(gen(e, ID).mail, "accepted"); assert.equal(gen(e, ID).mail_tries, 1); assert.equal(gen(e, ID).mail_http, undefined);
  assert.equal(toAna.length, 1); assert.equal(toAdmin.length, 0);
}
{
  const ID = "mail-000000000000012", { e, st, toAna, toAdmin } = await run(ID, [500, "net"]);
  assert.equal(st.mailed, true, "falla pasajera y después sale"); assert.equal(gen(e, ID).mail, "accepted"); assert.equal(gen(e, ID).mail_tries, 3);
  assert.equal(toAna.length, 2); assert.equal(new Set(toAna.map((m) => m.key)).size, 1, "misma clave de idempotencia en los reintentos");
  assert.equal(toAdmin.length, 0);
}
{
  const ID = "mail-000000000000013", { e, st, toAna, toAdmin } = await run(ID, [503, 503, 503]);
  assert.equal(st.status, "done"); assert.ok(st.report, "el informe llega igual"); assert.equal(st.mailed, false);
  const g = gen(e, ID); assert.equal(g.mail, "rejected"); assert.equal(g.mail_http, 503); assert.equal(g.mail_tries, 3);
  assert.equal(toAdmin.length, 1); const a = toAdmin[0];
  assert.match(a.subject, new RegExp(CODE)); assert.match(a.text, new RegExp("gen:" + ID)); assert.match(a.text, /503/);
  assert.ok(!a.text.includes("ana@example.com") && !/informe=/.test(a.text), "el aviso no lleva la dirección ni el enlace");
  for (const [k2, v] of e.ASTRO_KV.m) assert.ok(!String(v).includes("ana@example.com"), "el correo no se guarda: " + k2);
}
{
  const ID = "mail-000000000000014", { e, toAna, toAdmin } = await run(ID, [422]);
  assert.equal(toAna.length, 1, "un rechazo definitivo no se reintenta"); assert.equal(gen(e, ID).mail, "rejected"); assert.equal(gen(e, ID).mail_http, 422);
  assert.equal(toAdmin.length, 1);
}

console.log("OK — informe por correo 2.6.2: 7 grupos");
