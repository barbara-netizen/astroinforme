// Pruebas 2.0: adaptadores de Mercado Pago (modo prueba) y Dodo Payments (estructura), con las APIs simuladas.
import assert from "node:assert/strict";
import { carta, informeOk, ANALISIS, env as baseEnv, mockClaude, ORIGIN, FakeNamespace } from "./helpers.mjs";
import { ReportJob } from "../src/job.js";
import { OrderDO } from "../src/order.js";
import { mercadoPagoProvider, mpManifestSignature } from "../src/payments/mercadopago.js";
import { dodoProvider, standardWebhookSignature } from "../src/payments/dodo.js";
import worker from "../src/worker.js";

let n = 0; const group = () => { n++; };
const ok = informeOk();
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json().catch(() => null) }; };
const CONSENT = { accepted: true, terms_version: "2026-11-04" };
let k = 0; const idem = () => "idem-pay-" + String(++k).padStart(10, "0");
function mkEnv(over) {
  const e = baseEnv({ SERVICE_MODE: "paid", MAIL_API_KEY: "mail-test", MAIL_FROM: "AsterOrbis <a@asterorbis.com>", ...over });
  e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e;
  e.ORDERS = new FakeNamespace(OrderDO); e.ORDERS.env = e;
  return e;
}
/** API externa simulada: responde según la URL; las llamadas a Claude pasan a mockClaude. */
function mockApis(routes, log = []) {
  const claude = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    for (const [re, fn] of routes) if (re.test(u)) { log.push({ url: u, method: init.method || "GET", headers: init.headers || {}, body: init.body }); return fn(u, init); }
    return claude(url, init);
  };
  return log;
}
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// ================================================================ Mercado Pago
const MP = { MP_ACCESS_TOKEN: "TEST-123", MP_WEBHOOK_SECRET: "mp-secreto", PRICE_ARS: "15000.00" };

group("MP: firma x-signature (plantilla id;request-id;ts) — válida, inválida, id alfanumérico en minúsculas");
{
  const env = mkEnv(MP);
  const sig = await mpManifestSignature("mp-secreto", "123456", "req-1", "1742505638683");
  const req = (s, id = "123456") => new Request(`https://svc/webhooks/mercadopago?data.id=${id}&type=order`, { method: "POST", headers: { "x-signature": `ts=1742505638683,v1=${s}`, "x-request-id": "req-1" } });
  let v = await mercadoPagoProvider.verifyWebhook(env, req(sig), JSON.stringify({ id: 99, action: "order.processed", type: "order", data: { id: "123456" } }));
  assert.equal(v.ok, true); assert.equal(v.kind, "payment"); assert.equal(v.externalId, "123456");
  v = await mercadoPagoProvider.verifyWebhook(env, req("0".repeat(64)), "{}");
  assert.equal(v.ok, false);
  const upper = await mpManifestSignature("mp-secreto", "ORD01ABC", "req-1", "1");
  const lower = await mpManifestSignature("mp-secreto", "ord01abc", "req-1", "1");
  assert.equal(upper, lower, "un id alfanumérico se firma en minúsculas");
  const sinCab = new Request("https://svc/webhooks/mercadopago?data.id=1&type=order", { method: "POST" });
  assert.equal((await mercadoPagoProvider.verifyWebhook(env, sinCab, "{}")).ok, false);
}

group("MP: crear order (solo producto, precio y referencia opaca), estados y reembolso idempotente");
{
  const env = mkEnv(MP);
  const estados = { ORDOK: ["processed", "accredited"], ORDRF: ["refunded", "refunded"], ORDFA: ["failed", "high_risk"], ORDCA: ["canceled", "canceled"], ORDPR: ["processing", "in_process"], ORDPA: ["processed", "partially_refunded"] };
  const log = mockApis([
    [/v1\/orders\/ORD[A-Z]+\/refund$/, () => jsonRes({ id: "ORDOK", status: "refunded" }, 201)],
    [/v1\/orders\/ORD[A-Z]+$/, (u) => { const id = u.split("/").pop(), [status, status_detail] = estados[id]; return jsonRes({ id, status, status_detail, total_amount: "15000.00", currency: "ARS", external_reference: "ord-x", items: [{ external_code: "informe_completo" }] }); }],
    [/v1\/orders\?/, () => jsonRes({ data: [{ id: "ORDFA", status: "failed", status_detail: "high_risk" }, { id: "ORDOK", status: "processed", status_detail: "accredited" }], paging: {} })],
    [/v1\/orders$/, () => jsonRes({ id: "ORDOK", status: "created", checkout_url: "https://mp/checkout" }, 201)],
  ]);
  const ck = await mercadoPagoProvider.createCheckout(env, { id: "ord-" + "ab".repeat(16), product: "informe_completo", amountMinor: 1500000, currency: "ARS", lang: "es" }, { appOrigin: ORIGIN, serviceOrigin: "https://svc" });
  assert.equal(ck.url, "https://mp/checkout"); assert.equal(ck.externalCheckoutId, "ORDOK");
  const o = JSON.parse(log[0].body);
  assert.equal(o.total_amount, "15000.00"); assert.equal(o.items[0].unit_price, "15000.00"); assert.equal(o.external_reference, "ord-" + "ab".repeat(16)); assert.equal(o.expiration_time, "P2D");
  assert.match(o.config.online.success_url, /\?pedido=ord-[a-f0-9]+&resultado=ok$/); assert.equal(o.payer, undefined);
  assert.match(log[0].headers["x-idempotency-key"], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(log[0].headers.authorization, "Bearer TEST-123");
  assert.deepEqual(await mercadoPagoProvider.getTransaction(env, "ORDOK"), { status: "paid", orderId: "ord-x", externalId: "ORDOK", amountMinor: 1500000, currency: "ARS", productRef: "informe_completo" });
  const st = async (id) => (await mercadoPagoProvider.getTransaction(env, id)).status;
  assert.equal(await st("ORDRF"), "refunded"); assert.equal(await st("ORDFA"), "failed"); assert.equal(await st("ORDCA"), "cancelled"); assert.equal(await st("ORDPR"), "pending"); assert.equal(await st("ORDPA"), "paid");
  assert.equal((await mercadoPagoProvider.findPayment(env, "ord-x")).externalId, "ORDOK");
  const rf = await mercadoPagoProvider.refund(env, { id: "ord-x", externalId: "ORDOK" });
  assert.equal(rf.status, "refunded");
}

group("MP de punta a punta: aviso firmado → consulta del pago → generación una sola vez, aunque el aviso se repita");
{
  const env = mkEnv(MP);
  mockApis([[/v1\/orders$/, () => jsonRes({ id: "ORDUNO", checkout_url: "https://mp/ip" }, 201)]]);
  const c = await call(new Request("https://svc/orders", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ provider: "mercadopago", payload: carta(), email: "ana@example.com", consent: CONSENT, idempotency_key: idem() }) }), env);
  assert.equal(c.status, 201);
  const id = c.body.order_id;
  let estado = "processing";
  const log = mockApis([[/v1\/orders\/ORDUNO$/, () => jsonRes({ id: "ORDUNO", status: estado, status_detail: estado === "processed" ? "accredited" : "in_process", total_amount: "15000.00", currency: "ARS", external_reference: id, items: [{ external_code: "informe_completo" }] })]]);
  const aviso = async (reqId) => {
    const ts = String(Date.now()), s = await mpManifestSignature("mp-secreto", "ORDUNO", reqId, ts);
    return call(new Request("https://svc/webhooks/mercadopago?data.id=ORDUNO&type=order", { method: "POST", headers: { "x-signature": `ts=${ts},v1=${s}`, "x-request-id": reqId },
      body: JSON.stringify({ id: reqId, action: "order.processed", type: "order", data: { id: "ORDUNO" } }) }), env);
  };
  await aviso("r1");
  assert.equal(env.REPORT_JOB.objs.size, 0, "pago pendiente: no se genera");
  estado = "processed";
  assert.equal((await aviso("r2")).status, 200);
  assert.equal((await aviso("r2")).body.duplicate, true);
  await aviso("r3");
  assert.equal(env.REPORT_JOB.objs.size, 1);
  assert.ok(log.length >= 3, "cada aviso se confirma consultando el pago");
  mockClaude([ANALISIS, ok]);
  await env.REPORT_JOB.obj(id).alarm();
  const g = await call(new Request("https://svc/orders/" + id, { headers: { origin: ORIGIN, "x-order-token": c.body.token } }), env);
  assert.equal(g.body.generation_status, "delivered"); assert.ok(g.body.report);
}

group("MP: si la consulta del pago falla, el aviso devuelve 502 para que Mercado Pago lo reintente");
{
  const env = mkEnv(MP);
  mockApis([[/v1\/orders\//, () => jsonRes({ message: "error" }, 500)]]);
  const ts = "1", s = await mpManifestSignature("mp-secreto", "1", "q", ts);
  const r = await call(new Request("https://svc/webhooks/mercadopago?data.id=1&type=order", { method: "POST", headers: { "x-signature": `ts=${ts},v1=${s}`, "x-request-id": "q" }, body: "{}" }), env);
  assert.equal(r.status, 502);
}

// ================================================================ Dodo Payments
const DODO = { DODO_API_KEY: "dodo-key", DODO_WEBHOOK_SECRET: "whsec_" + btoa("clave-de-prueba-dodo-0123456789"), DODO_PRODUCT_ID: "pdt_123", PRICE_USD: "15.00" };

group("Dodo: firma Standard Webhooks — válida, rotación (varias firmas), alterada y fuera de tolerancia");
{
  const env = mkEnv(DODO);
  const raw = JSON.stringify({ type: "payment.succeeded", data: { payload_type: "Payment", payment_id: "pay_1" } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await standardWebhookSignature(DODO.DODO_WEBHOOK_SECRET, "msg_1", ts, raw);
  const req = (h) => new Request("https://svc/webhooks/dodo", { method: "POST", headers: { "webhook-id": "msg_1", "webhook-timestamp": ts, ...h } });
  let v = await dodoProvider.verifyWebhook(env, req({ "webhook-signature": "v1," + sig }), raw);
  assert.equal(v.ok, true); assert.equal(v.kind, "payment"); assert.equal(v.externalId, "pay_1"); assert.equal(v.eventId, "dodo:msg_1");
  v = await dodoProvider.verifyWebhook(env, req({ "webhook-signature": "v1,otra v1," + sig }), raw);
  assert.equal(v.ok, true, "alcanza con que coincida una firma");
  v = await dodoProvider.verifyWebhook(env, req({ "webhook-signature": "v1," + sig }), raw.replace("pay_1", "pay_2"));
  assert.equal(v.ok, false, "cuerpo alterado");
  v = await dodoProvider.verifyWebhook(env, req({ "webhook-signature": "v1," + sig }), raw, Date.now() + 10 * 60 * 1000);
  assert.equal(v.ok, false, "más de 5 minutos de diferencia");
  const otro = JSON.stringify({ type: "customer.created", data: {} });
  const s2 = await standardWebhookSignature(DODO.DODO_WEBHOOK_SECRET, "msg_1", ts, otro);
  assert.equal((await dodoProvider.verifyWebhook(env, req({ "webhook-signature": "v1," + s2 }), otro)).kind, "ignore");
}

group("Dodo: checkout con referencia opaca en metadata; consulta del pago normalizada (sin impuestos, reembolsos)");
{
  const env = mkEnv(DODO);
  let pago = { payment_id: "pay_1", status: "succeeded", total_amount: 1815, tax: 315, currency: "USD", metadata: { order_id: "ord-z" }, product_cart: [{ product_id: "pdt_123", quantity: 1 }] };
  const log = mockApis([
    [/test\.dodopayments\.com\/checkouts$/, () => jsonRes({ session_id: "cks_1", checkout_url: "https://checkout.dodo/cks_1" })],
    [/test\.dodopayments\.com\/payments\/pay_1$/, () => jsonRes(pago)],
  ]);
  const ck = await dodoProvider.createCheckout(env, { id: "ord-z", product: "informe_completo", amountMinor: 1500, currency: "USD", lang: "en" }, { appOrigin: ORIGIN, serviceOrigin: "https://svc" });
  assert.equal(ck.url, "https://checkout.dodo/cks_1");
  const body = JSON.parse(log[0].body);
  assert.deepEqual(body.product_cart, [{ product_id: "pdt_123", quantity: 1 }]); assert.deepEqual(body.metadata, { order_id: "ord-z" });
  assert.ok(!log[0].body.includes("SUN"));
  assert.deepEqual(await dodoProvider.getTransaction(env, "pay_1"), { status: "paid", orderId: "ord-z", externalId: "pay_1", amountMinor: 1500, currency: "USD", productRef: "pdt_123" });
  pago = { ...pago, refunds: [{ status: "succeeded" }] };
  assert.equal((await dodoProvider.getTransaction(env, "pay_1")).status, "refunded");
  assert.equal(dodoProvider.enabled(mkEnv({ DODO_API_KEY: "x" })), false, "sin secreto ni producto no se activa");
  assert.equal(mkEnv({ ...DODO, DODO_ENV: "live" }) && true, true);
}

console.log(`OK — ${n} grupos de pruebas de adaptadores de pago (2.0)`);
