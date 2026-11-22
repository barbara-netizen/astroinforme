// Servicio 2.6: informe completo por correo para pedidos con código, enlace privado de 7 días, correo no guardado.
import assert from "node:assert/strict";
import { carta, informeOk, ANALISIS, env as baseEnv, state, ORIGIN, FakeNamespace } from "./helpers.mjs";
import { ReportJob } from "../src/job.js";
import { fullReportMail } from "../src/mail.js";
import worker from "../src/worker.js";

const ok = informeOk(), CODE = "LUZ-3M8Q";
const env = (over = {}) => { const e = baseEnv({ MAIL_API_KEY: "k", MAIL_FROM: "AsterOrbis <a@asterorbis.com>", ...over }); e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; return e; };
const mails = []; let seq = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.resend.com")) { mails.push(JSON.parse(init.body)); return new Response("{}"); }
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

console.log("OK — informe por correo 2.6: 3 grupos");
