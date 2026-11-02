// Pruebas 2.0: pedidos pagos, interfaz de proveedor y simulador de pagos y webhooks.
import assert from "node:assert/strict";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, ORIGIN, FakeNamespace, ledgerState } from "./helpers.mjs";
import { ReportJob, MAX_ATTEMPTS } from "../src/job.js";
import { OrderDO } from "../src/order.js";
import { simSign, SIM_SIGNATURE_HEADER } from "../src/payments/sim.js";
import { getProvider, toMinor } from "../src/payments/provider.js";
import worker from "../src/worker.js";

let n = 0; const group = () => { n++; };
const ok = informeOk();
const SECRET = "secreto-de-prueba";
const env = (over = {}) => {
  const e = baseEnv({ SERVICE_MODE: "paid", PAYMENTS_SIM: "true", SIM_WEBHOOK_SECRET: SECRET, PRICE_USD: "15.00", ADMIN_TOKEN: "admin-xyz", ...over });
  e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e;
  e.ORDERS = new FakeNamespace(OrderDO); e.ORDERS.env = e;
  return e;
};
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json().catch(() => null) }; };
const CONSENT = { accepted: true, terms_version: "2026-11-draft", disclaimer_version: "2026-11-02" };
let k = 0; const idem = () => "idem-" + String(++k).padStart(14, "0");
const createReq = (over = {}) => new Request("https://svc.example/orders", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN },
  body: JSON.stringify({ provider: "sim", product: "informe_completo", payload: carta(), consent: CONSENT, idempotency_key: idem(), ...over }) });
const getReq = (id, token) => new Request("https://svc.example/orders/" + id, { headers: { origin: ORIGIN, ...(token ? { "x-order-token": token } : {}) } });
async function webhook(e, payment, eventId = "ev-" + Math.random().toString(36).slice(2), secret = SECRET) {
  const raw = JSON.stringify({ event_id: eventId, payment });
  return call(new Request("https://svc.example/webhooks/sim", { method: "POST", headers: { [SIM_SIGNATURE_HEADER]: await simSign(secret, raw) }, body: raw }), e);
}
const paid = (id, over = {}) => ({ id: "simpay_" + id, order_id: id, status: "paid", amount_minor: 1500, currency: "USD", product: "informe_completo", ...over });
const order = (e, id) => e.ORDERS.obj(id).storage.get("o");
const runJob = (e, jobId) => e.REPORT_JOB.obj(jobId).alarm();

group("camino feliz: pedido → pago confirmado por webhook → generación desde el servidor → entrega");
{
  const e = env();
  const c = await call(createReq(), e);
  assert.equal(c.status, 201); assert.match(c.body.order_id, /^ord-[0-9a-f]{32}$/); assert.ok(c.body.token); assert.match(c.body.checkout_url, /\/sim\/checkout\//);
  const id = c.body.order_id;
  let g = await call(getReq(id, c.body.token), e);
  assert.equal(g.body.payment_status, "created"); assert.equal(g.body.generation_status, "none"); assert.equal(g.body.report, undefined);
  assert.equal(e.REPORT_JOB.objs.size, 0, "sin pago no hay trabajo");
  assert.equal((await webhook(e, paid(id))).status, 200);
  const o = await order(e, id);
  assert.equal(o.payment.status, "paid"); assert.equal(o.generation.status, "running"); assert.equal(o.payment.externalId, "simpay_" + id);
  mockClaude([ANALISIS, ok]);
  await runJob(e, id);
  g = await call(getReq(id, c.body.token), e);
  assert.equal(g.body.generation_status, "delivered"); assert.equal(g.body.report.schema, "astroinforme.report/v1");
  assert.equal(await e.ORDERS.obj(id).storage.get("payload"), undefined, "la carta se borra del pedido al entregar");
  assert.equal((await ledgerState(e, "ORDER:" + id)).used, 1);
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + id));
  assert.equal(gen.access, "order"); assert.equal(gen.ref, "order:" + id);
  // reenvío sin regeneración: volver a consultar no llama al modelo
  mockClaude([]);
  assert.ok((await call(getReq(id, c.body.token), e)).body.report); assert.equal(state.calls.length, 0);
}

group("sin la clave del pedido no se ve nada; con otra clave tampoco");
{
  const e = env();
  const c = await call(createReq(), e);
  assert.equal((await call(getReq(c.body.order_id), e)).status, 403);
  assert.equal((await call(getReq(c.body.order_id, "x".repeat(48)), e)).status, 403);
  assert.equal((await call(getReq("ord-" + "0".repeat(32), c.body.token), e)).status, 404);
}

group("webhook repetido (mismo evento) y pagos duplicados (otro evento): una sola generación");
{
  const e = env();
  const c = await call(createReq(), e); const id = c.body.order_id;
  const w1 = await webhook(e, paid(id), "ev-A");
  const w2 = await webhook(e, paid(id), "ev-A");
  assert.equal(w2.body.duplicate, true);
  await webhook(e, paid(id), "ev-B");
  await Promise.all([webhook(e, paid(id), "ev-C"), webhook(e, paid(id), "ev-D")]);
  assert.equal(e.REPORT_JOB.objs.size, 1, "un solo trabajo");
  mockClaude([ANALISIS, ok]);
  await runJob(e, id);
  assert.equal(state.calls.length, 2, "una sola generación (fases A y B)");
  assert.equal((await ledgerState(e, "ORDER:" + id)).used, 1);
}

group("importe, moneda o producto incorrectos: no se genera y queda en la cola de excepciones");
{
  for (const [field, over] of [["amount", { amount_minor: 100 }], ["currency", { currency: "ARS" }], ["product", { product: "otro" }]]) {
    const e = env();
    const c = await call(createReq(), e); const id = c.body.order_id;
    await webhook(e, paid(id, over));
    const o = await order(e, id);
    assert.equal(o.payment.status, "mismatch", field); assert.deepEqual(o.payment.mismatch.fields, [field]);
    assert.equal(o.generation.status, "none"); assert.equal(e.REPORT_JOB.objs.size, 0);
    assert.equal(JSON.parse(await e.ASTRO_KV.get("exc:" + id)).reason, "payment_mismatch");
    // un pago correcto posterior no destraba un pedido marcado: requiere revisión
    await webhook(e, paid(id));
    assert.equal(e.REPORT_JOB.objs.size, 0);
  }
}

group("firma inválida: 401 y el pedido no cambia");
{
  const e = env();
  const c = await call(createReq(), e); const id = c.body.order_id;
  const r = await webhook(e, paid(id), "ev-X", "otro-secreto");
  assert.equal(r.status, 401);
  assert.equal((await order(e, id)).payment.status, "created");
}

group("pago pendiente, rechazado y reembolsado");
{
  const e = env();
  const c = await call(createReq(), e); const id = c.body.order_id;
  await webhook(e, paid(id, { status: "pending" }));
  assert.equal((await order(e, id)).payment.status, "pending");
  await webhook(e, paid(id, { status: "failed" }));
  assert.equal((await order(e, id)).payment.status, "failed");
  assert.equal(e.REPORT_JOB.objs.size, 0);
  const e2 = env();
  const c2 = await call(createReq(), e2); const id2 = c2.body.order_id;
  await webhook(e2, paid(id2, { status: "refunded" }));
  await webhook(e2, paid(id2));
  assert.equal((await order(e2, id2)).payment.status, "refunded", "un pago reembolsado no habilita la generación");
  assert.equal(e2.REPORT_JOB.objs.size, 0);
}

group("generación fallida: el pedido queda en excepciones; el reintento genera una sola vez y lo saca de la cola");
{
  const e = env();
  const c = await call(createReq(), e); const id = c.body.order_id;
  await webhook(e, paid(id));
  for (let i = 0; i < MAX_ATTEMPTS; i++) { mockClaude(i === 0 ? [ANALISIS, "500"] : ["500"]); await runJob(e, id); }
  let o = await order(e, id);
  assert.equal(o.generation.status, "failed"); assert.equal(JSON.parse(await e.ASTRO_KV.get("exc:" + id)).reason, "generation_failed");
  assert.ok(await e.ORDERS.obj(id).storage.get("payload"), "la carta sigue para poder reintentar");
  assert.equal((await ledgerState(e, "ORDER:" + id)).used, 0, "el fallo no consumió el informe");
  const admin = (path, token = "admin-xyz") => call(new Request("https://svc.example" + path, { method: path.endsWith("exceptions") ? "GET" : "POST", headers: { authorization: "Bearer " + token } }), e);
  assert.equal((await admin("/admin/exceptions", "mal")).status, 403);
  const ex = await admin("/admin/exceptions");
  assert.equal(ex.body.exceptions.length, 1); assert.ok(!JSON.stringify(ex.body).includes("Prueba"), "la administración no muestra datos de la carta");
  const r = await admin(`/admin/orders/${id}/retry`);
  assert.equal(r.body.ok, true);
  o = await order(e, id);
  assert.equal(o.generation.jobId, id + "-r1");
  mockClaude([ANALISIS, ok]);
  await runJob(e, id + "-r1");
  o = await order(e, id);
  assert.equal(o.generation.status, "delivered");
  assert.equal(await e.ASTRO_KV.get("exc:" + id), null);
  assert.equal((await ledgerState(e, "ORDER:" + id)).used, 1);
  assert.ok((await call(getReq(id, c.body.token), e)).body.report);
  // un segundo reintento sobre un pedido entregado no hace nada
  assert.equal((await admin(`/admin/orders/${id}/retry`)).status, 409);
}

group("idempotencia al crear: el mismo intento devuelve el mismo pedido");
{
  const e = env();
  const key = idem();
  const a = await call(createReq({ idempotency_key: key }), e);
  const b = await call(createReq({ idempotency_key: key }), e);
  assert.equal(b.body.order_id, a.body.order_id); assert.equal(b.body.existed, true); assert.equal(b.body.token, undefined);
  assert.equal(e.ORDERS.objs.size, 1);
}

group("validaciones al crear: modo, proveedor, precio, consentimiento, carta");
{
  assert.equal((await call(createReq(), env({ SERVICE_MODE: "pilot" }))).body.error, "not_available");
  assert.equal((await call(createReq(), env({ SERVICE_MODE: "disabled" }))).status, 503);
  assert.equal((await call(createReq({ provider: "mercadopago" }), env())).body.error, "provider_unavailable");
  assert.equal((await call(createReq(), env({ PAYMENTS_SIM: "false" }))).body.error, "provider_unavailable");
  assert.equal((await call(createReq({ consent: { accepted: false, terms_version: "2026-11-draft" } }), env())).body.error, "consent_required");
  assert.equal((await call(createReq({ consent: { accepted: true, terms_version: "vieja" } }), env())).body.error, "consent_required");
  const bad = clone(carta()); bad.chart.bodies = [];
  assert.equal((await call(createReq({ payload: bad }), env())).body.error, "bad_request");
  const e = env(); const c = await call(createReq(), e);
  assert.equal((await order(e, c.body.order_id)).amountMinor, 1500, "el precio lo fija el servidor");
  const conPrecio = await call(createReq({ amount: 1 }), e);
  assert.equal((await order(e, conPrecio.body.order_id)).amountMinor, 1500, "un importe enviado por la app se ignora");
}

group("al proveedor de pagos no le llega la carta ni datos natales");
{
  const e = env({ PAYMENTS_SIM: "false", MP_ACCESS_TOKEN: "TEST-x", MP_WEBHOOK_SECRET: "s", PRICE_ARS: "15000.00" });
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: init && init.body }); return new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout/pref-1" }), { status: 201 }); };
  const c = await call(createReq({ provider: "mercadopago" }), e);
  assert.equal(c.status, 201); assert.equal(c.body.checkout_url, "https://mp/checkout/pref-1");
  assert.equal(sent.length, 1); assert.match(sent[0].url, /checkout\/preferences$/);
  const body = sent[0].body;
  for (const s of ["SUN", "MOON", "bodies", "houses", "aspects", "Prueba", "lon"]) assert.ok(!body.includes(s), "no envía " + s);
  const pref = JSON.parse(body);
  assert.equal(pref.external_reference, c.body.order_id); assert.equal(pref.items[0].unit_price, 15000); assert.equal(pref.items[0].currency_id, "ARS");
}

group("pedido sin pagar vence: se borra la carta y queda cancelado");
{
  const e = env();
  const c = await call(createReq(), e); const id = c.body.order_id;
  await e.ORDERS.obj(id).alarm();
  assert.equal(await e.ORDERS.obj(id).storage.get("payload"), undefined);
  assert.equal((await order(e, id)).payment.status, "cancelled");
  await webhook(e, paid(id));
  assert.equal(e.REPORT_JOB.objs.size, 0, "un pago tardío sobre un pedido vencido no genera: queda en excepciones");
}

group("simulador apagado: sus rutas no existen; health informa proveedores solo en modo paid");
{
  assert.equal((await call(new Request("https://svc.example/sim/checkout/ord-" + "0".repeat(32)), env({ PAYMENTS_SIM: "false" }))).status, 404);
  assert.deepEqual((await call(new Request("https://svc.example/health"), env())).body.payments, ["sim"]);
  assert.deepEqual((await call(new Request("https://svc.example/health"), env({ SERVICE_MODE: "pilot" }))).body.payments, []);
  assert.equal(toMinor("15000,50"), 1500050); assert.equal(toMinor("15"), 1500); assert.equal(toMinor("1.234"), null);
  assert.equal(getProvider(env({ PAYMENTS_SIM: "false" }), "sim"), null);
}

console.log(`OK — ${n} grupos de pruebas de pedidos pagos (2.0)`);
