// Pruebas 2.1: correo obligatorio, enlace privado de 7 días, disponibilidad antes de cobrar, control periódico y avisos.
import assert from "node:assert/strict";
import { carta, informeOk, ANALISIS, env as baseEnv, state, ORIGIN, FakeNamespace } from "./helpers.mjs";
import { ReportJob } from "../src/job.js";
import { OrderDO, RETAIN_MS } from "../src/order.js";
import { simSign, SIM_SIGNATURE_HEADER } from "../src/payments/sim.js";
import { runControls } from "../src/orders.js";
import { validEmail } from "../src/mail.js";
import worker from "../src/worker.js";

const ok = informeOk(), SECRET = "s";
const env = (over = {}) => {
  const e = baseEnv({ SERVICE_MODE: "paid", PAYMENTS_SIM: "true", SIM_WEBHOOK_SECRET: SECRET, PRICE_USD: "10.00", MAIL_API_KEY: "k", MAIL_FROM: "AsterOrbis <a@asterorbis.com>", ADMIN_EMAIL: "admin@example.com", ...over });
  e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; e.ORDERS = new FakeNamespace(OrderDO); e.ORDERS.env = e; return e;
};
const mails = []; let seq = [], mailOk = true;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.resend.com")) { const b = JSON.parse(init.body); if (mailOk) mails.push(b); return new Response("{}", { status: mailOk ? 200 : 500 }); }
  state.calls.push(JSON.parse(init.body)); const text = JSON.stringify(seq.shift());
  return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn" }), { headers: { "content-type": "application/json" } });
};
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json().catch(() => null) }; };
let k = 0;
const create = (e, over = {}) => call(new Request("https://svc.example/orders", { method: "POST", headers: { origin: ORIGIN }, body: JSON.stringify({ provider: "sim", product: "informe_completo", payload: carta(), email: "ana@example.com", consent: { accepted: true, terms_version: "2026-11-04" }, idempotency_key: "idem-entrega-" + String(++k).padStart(6, "0"), ...over }) }), e);
const view = (e, id, t) => call(new Request("https://svc.example/orders/" + id, { headers: { origin: ORIGIN, "x-order-token": t } }), e);
async function pay(e, id, ev = "ev" + Math.random()) {
  const raw = JSON.stringify({ event_id: ev, payment: { id: "p_" + id, order_id: id, status: "paid", amount_minor: 1000, currency: "USD", product: "informe_completo" } });
  return worker.fetch(new Request("https://svc.example/webhooks/sim", { method: "POST", headers: { [SIM_SIGNATURE_HEADER]: await (simSign(SECRET, raw)) }, body: raw }), e, {});
}
const run = async (e, jobId, s) => { seq = s; state.calls = []; await e.REPORT_JOB.obj(jobId).alarm(); };

{ // correo inválido o faltante: no se crea el pedido
  assert.equal(validEmail("ana@example.com"), true); assert.equal(validEmail("ana@"), false); assert.equal(validEmail("a b@x.com"), false);
  const e = env(); const r = await create(e, { email: "no-es-correo" });
  assert.equal(r.status, 400); assert.equal(r.body.error, "email_invalid"); assert.equal(e.ORDERS.objs.size, 0);
}
{ // sin correo configurado, sin protocolo o con el tope agotado no se abre el pago
  assert.equal((await create(env({ MAIL_API_KEY: "" }))).body.error, "unavailable");
  const e = env({ MONTHLY_USD_LIMIT: "1" }); await e.ASTRO_KV.put("month:" + new Date().toISOString().slice(0, 7), JSON.stringify({ usd: 2 }));
  const r = await create(e); assert.equal(r.status, 503); assert.equal(r.body.error, "unavailable");
  const e2 = env(); await e2.ASTRO_KV.delete("protocol"); assert.equal((await create(e2)).status, 503);
}
{ // camino completo: un solo correo, sin carta ni informe, enlace que abre informe y carta en otro aparato
  mails.length = 0; const e = env(); const c = await create(e), id = c.body.order_id;
  await pay(e, id); await run(e, id, [ANALISIS, ok]);
  assert.equal(mails.length, 1);
  const m = mails[0]; assert.deepEqual(m.to, ["ana@example.com"]); assert.equal(m.reply_to, "admin@example.com");
  assert.ok(!m.text.includes("Prueba") && !m.text.includes(ok.sections[0].body_markdown.slice(0, 30)));
  const link = m.text.match(/https:\/\/asterorbis\.com\/\?pedido=(ord-[0-9a-f]{32})#k=([0-9a-f]{48})/);
  assert.ok(link); assert.equal(link[1], id);
  const g = await view(e, id, link[2]);
  assert.equal(g.status, 200); assert.equal(g.body.report.schema, "astroinforme.report/v1"); assert.equal(g.body.chart.schema, "astroinforme.chart/v1");
  assert.equal((await view(e, id, "clave-falsa")).status, 403);
  await pay(e, id); assert.equal(mails.length, 1, "un aviso repetido no reenvía");
  const st = e.ORDERS.obj(id).storage, o = await st.get("o");
  assert.ok(!JSON.stringify(o).includes("ana@example.com") && !JSON.stringify(o).includes(link[2]));
  // a los 7 días se borran carta y correo, y el enlace deja de abrir el informe
  assert.ok(o.retainUntil - Date.now() <= RETAIN_MS);
  o.retainUntil = Date.now() - 1; o.createdAt = new Date(Date.now() - 8 * 864e5).toISOString(); await st.put("o", o);
  await e.ORDERS.obj(id).alarm();
  assert.equal(await st.get("payload"), undefined); assert.equal(await st.get("email"), undefined);
  assert.equal((await view(e, id, link[2])).status, 403);
}
{ // el trabajo conserva el informe 7 días, no 48 h
  const e = env(); const c = await create(e), id = c.body.order_id; await pay(e, id); await run(e, id, [ANALISIS, ok]);
  const meta = await e.REPORT_JOB.obj(id).storage.get("meta");
  assert.ok(meta.cleanupAt - Date.now() > 6 * 864e5);
}
{ // el correo falla: el control lo reintenta y no vuelve a generar
  mails.length = 0; mailOk = false; const e = env(); const c = await create(e), id = c.body.order_id;
  await pay(e, id); await run(e, id, [ANALISIS, ok]); assert.equal(mails.length, 0);
  mailOk = true; const r = await runControls(e, Date.now());
  assert.equal(r.mailed, 1); assert.equal(mails.filter((m) => m.to[0] === "ana@example.com").length, 1); assert.equal(await e.ASTRO_KV.get("open:" + id), null);
}
{ // la generación falla: se reintenta sola; agotados los intentos, avisa una vez y sin datos personales
  mails.length = 0; const e = env(); const c = await create(e), id = c.body.order_id; await pay(e, id);
  await run(e, id, [ANALISIS, "roto", "roto"]);
  assert.equal((await e.ORDERS.obj(id).storage.get("o")).generation.status, "failed");
  await runControls(e); await run(e, id + "-r1", ["x", "x"].map(() => "roto"));
  await runControls(e); await run(e, id + "-r2", ["roto", "roto"]);
  await runControls(e); await runControls(e);
  const avisos = mails.filter((m) => m.to[0] === "admin@example.com" && m.subject.includes("generation_failed"));
  assert.equal(avisos.length, 1); assert.ok(!avisos[0].text.includes("ana@example.com"));
}
{ // reembolsado: el enlace ya no entrega el informe y no se manda correo
  mails.length = 0; const e = env(); const c = await create(e), id = c.body.order_id; await pay(e, id);
  const raw = JSON.stringify({ event_id: "r1", payment: { id: "p_" + id, order_id: id, status: "refunded", amount_minor: 1000, currency: "USD", product: "informe_completo" } });
  await worker.fetch(new Request("https://svc.example/webhooks/sim", { method: "POST", headers: { [SIM_SIGNATURE_HEADER]: await simSign(SECRET, raw) }, body: raw }), e, {});
  await run(e, id, [ANALISIS, ok]);
  assert.equal(mails.length, 0); const g = await view(e, id, c.body.token); assert.equal(g.body.report, undefined);
}
{ // resumen diario una vez, y fuera del modo pago el control no hace nada
  mails.length = 0; const e = env(); const t = Date.parse("2026-11-20T13:00:00Z");
  await runControls(e, t); await runControls(e, t);
  assert.equal(mails.filter((m) => m.subject.includes("resumen")).length, 1);
  assert.deepEqual(await runControls(env({ SERVICE_MODE: "pilot" })), { skipped: true });
}
{ // doble toque simultáneo: un solo pedido; con la misma clave vuelve el mismo enlace; ya pagado, no se vuelve a cobrar
  const e = env(); const K = { idempotency_key: "idem-doble-000000001" };
  const [a, b] = await Promise.all([create(e, K), create(e, K)]);
  const firstOk = [a, b].filter((x) => x.status === 201), other = [a, b].find((x) => x.status !== 201);
  assert.equal(firstOk.length, 1); assert.ok([200, 409].includes(other.status));
  assert.equal([...e.ORDERS.objs.keys()].filter((x) => x.startsWith("ord-")).length, 1);
  const again = await create(e, K);
  assert.equal(again.status, 200); assert.equal(again.body.order_id, firstOk[0].body.order_id); assert.equal(again.body.token, firstOk[0].body.token); assert.equal(again.body.checkout_url, firstOk[0].body.checkout_url);
  await pay(e, again.body.order_id);
  const paid = await create(e, K);
  assert.equal(paid.body.already_paid, true); assert.equal(paid.body.checkout_url, undefined);
  // si el proveedor falla al abrir el pago, se puede reintentar con la misma clave
  const e2 = env({ PRICE_USD: "10.00" }); const K2 = { idempotency_key: "idem-doble-000000002" };
  const sim = (await import("../src/payments/sim.js")).simProvider, real = sim.createCheckout;
  sim.createCheckout = async () => { throw new Error("caido"); };
  assert.equal((await create(e2, K2)).status, 502); sim.createCheckout = real;
  assert.equal((await create(e2, K2)).status, 201);
}
console.log("OK — entrega 2.1: 9 grupos");
