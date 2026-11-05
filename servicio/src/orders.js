// AsterOrbis — rutas de pedidos pagos, avisos de pago (webhooks), simulador y administración (servicio 2.0).
//
//   POST /orders                    crea un pedido y devuelve el enlace de pago (solo en modo "paid")
//   GET  /orders/<id>               estado del pedido; con el informe cuando está entregado (cabecera x-order-token)
//   POST /webhooks/<proveedor>      aviso de pago firmado; se confirma con la API del proveedor antes de actuar
//   GET  /sim/checkout/<id>, POST /sim/pay/<id>    checkout simulado (solo con PAYMENTS_SIM = "true")
//   GET  /admin/exceptions, POST /admin/orders/<id>/retry, POST /admin/orders/<id>/refund   (ADMIN_TOKEN)
//
// La carta viaja de la app al servicio al crear el pedido (como ya ocurre al pedir un informe con código) y queda
// guardada en el pedido hasta la entrega. Al proveedor de pagos solo le llegan el producto, el precio y el
// identificador opaco del pedido. La generación arranca únicamente desde el servidor, después de que el aviso de
// pago se verificó y el pago se confirmó con importe, moneda y producto correctos.

import { normalizePayload, normalizeRequestId } from "./validate.js";
import { getProvider, safeEqual } from "./payments/provider.js";
import { expectedPrice, PRODUCT_ID } from "./payments/catalog.js";
import { simProvider, simSign, simCheckoutPage, SIM_SIGNATURE_HEADER } from "./payments/sim.js";
import { sha256Hex } from "./order.js";
import { ledger } from "./ledger.js";
import { payloadFingerprint, serviceMode, monthKey, kvGetJSON, generationAvailable } from "./worker.js";
import { RETAIN_MS, MAX_MAIL_TRIES } from "./order.js";
import { sendMail, reportMail, mailEnabled, validEmail } from "./mail.js";

export const ORDER_CODE_PREFIX = "ORDER:";
export const TERMS_VERSIONS = ["2026-11-04", "2026-11-05"]; // versiones de términos aceptables; se actualiza al publicar los términos
const MAX_ORDER_BODY = 120_000;
const MAX_GENERATIONS = 3; // intentos automáticos por pedido pagado
const OPEN_TTL = 9 * 86400; // índice de pedidos abiertos para el control periódico
const HOUR = 3600 * 1000;

const json = (obj, status, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };
const orderStub = (env, id) => env.ORDERS.get(env.ORDERS.idFromName(id));
async function call(stub, op, body) {
  const r = await stub.fetch("https://order/" + op, { method: "POST", body: JSON.stringify(body || {}) });
  return { status: r.status, ...(await r.json()) };
}
const ORDER_ID_RE = /^ord-[0-9a-f]{32}$/;

/** Cola de excepciones: pedidos pagos que necesitan atención (sin datos del informe ni de la carta). */
async function flagException(env, orderId, reason) {
  if (env.ASTRO_KV) await env.ASTRO_KV.put("exc:" + orderId, JSON.stringify({ order_id: orderId, reason, at: new Date().toISOString() })).catch(() => { });
}
async function clearException(env, orderId) { if (env.ASTRO_KV) await env.ASTRO_KV.delete("exc:" + orderId).catch(() => { }); }

/** Arranca (una sola vez por jobId) la generación de un pedido pago, con el mismo trabajo y el mismo cierre que un código. */
export async function startOrderJob(env, orderId, jobId, payload, providerRef) {
  const code = ORDER_CODE_PREFIX + orderId;
  const res = await ledger(env, code).reserve(jobId, 1);
  if (res.error) {
    // en curso o ya entregado: no se genera otro; el pedido no queda en «starting» (sale de ahí y va a revisión;
    // si el trabajo anterior entrega, el aviso de entrega lo corrige)
    await call(orderStub(env, orderId), "generation", { jobId, outcome: "start_" + res.error });
    await flagException(env, orderId, "start_" + res.error);
    return { started: false, reason: res.error };
  }
  const job = { payload, fp: await payloadFingerprint(payload), token: res.token, codeKind: "order", orderId, order: providerRef || null,
    requestId: jobId, useCode: true, code, limit: 1, retainMs: RETAIN_MS, mk: monthKey(), vKey: null, vUsed: 0, dKey: null, dUsed: 0 };
  const stub = env.REPORT_JOB.get(env.REPORT_JOB.idFromName(jobId));
  await stub.fetch("https://job/start", { method: "POST", body: JSON.stringify(job) });
  await call(orderStub(env, orderId), "started", { jobId });
  return { started: true };
}

/** Lo llama el cierre del trabajo (finalizeJob) para avisarle al pedido cómo terminó la generación. */
export async function notifyOrderGeneration(env, orderId, jobId, outcome) {
  if (!env.ORDERS || !orderId) return;
  const r = await call(orderStub(env, orderId), "generation", { jobId, outcome });
  if (r.exception) await flagException(env, orderId, r.exception);
  else if (outcome === "delivered") { await clearException(env, orderId); await deliverMail(env, orderId); }
}

/** Envía el enlace privado. Si el proveedor no lo acepta, el control periódico reintenta. */
export async function deliverMail(env, orderId) {
  const stub = orderStub(env, orderId), p = await call(stub, "mail-prepare", {});
  if (p.skip || !p.email) return false;
  const url = `${(env.APP_URL || "https://asterorbis.com").replace(/\/$/, "")}/?pedido=${orderId}#k=${p.token}`;
  const m = reportMail(p.lang, url, Math.round(RETAIN_MS / (24 * HOUR)));
  const sent = await sendMail(env, { to: p.email, subject: m.subject, text: m.text, key: `${orderId}-${p.tries}` });
  await call(stub, "mail-result", { ok: sent });
  return sent;
}

/** Aviso a Bárbara, una vez por pedido y motivo cada 24 h. Sin datos de la persona. */
export async function alertAdmin(env, orderId, reason) {
  if (!env.ADMIN_EMAIL || !env.ASTRO_KV) return;
  const key = `alerted:${orderId}:${reason}`;
  if (await env.ASTRO_KV.get(key)) return;
  const ok = await sendMail(env, { to: env.ADMIN_EMAIL, subject: `AsterOrbis: revisar pedido (${reason})`, text: `Pedido: ${orderId}\nMotivo: ${reason}\n\nVer /admin/exceptions.`, key });
  if (ok) await env.ASTRO_KV.put(key, "1", { expirationTtl: 86400 });
}

/** Busca en el proveedor un pago que no llegó por aviso y lo procesa igual que un aviso firmado. */
async function reconcile(env, id, st) {
  const provider = getProvider(env, st.provider);
  if (!provider || !provider.findPayment) return;
  let tx; try { tx = await provider.findPayment(env, id); } catch (e) { return; }
  if (!tx || tx.orderId !== id || tx.status !== "paid") return;
  await applyPayment(env, "recon:" + tx.externalId, tx, st.provider);
}

/** Control periódico (Cron): recupera pagos y entregas sin intervención; avisa solo lo que no pudo resolver. */
export async function runControls(env, now = Date.now()) {
  if (serviceMode(env) !== "paid" || !env.ORDERS || !env.ASTRO_KV) return { skipped: true };
  const list = await env.ASTRO_KV.list({ prefix: "open:" }), out = { checked: 0, retried: 0, mailed: 0, alerts: 0 };
  for (const { name } of list.keys) {
    const id = name.slice(5); if (!ORDER_ID_RE.test(id)) continue;
    let st = await call(orderStub(env, id), "check", {});
    if (st.status === 404) { await env.ASTRO_KV.delete(name); continue; }
    out.checked++;
    if (["created", "pending"].includes(st.order.payment_status)) { await reconcile(env, id, st); st = await call(orderStub(env, id), "check", {}); }
    const pay = st.order.payment_status, gen = st.order.generation_status;
    if (["cancelled", "failed", "refunded", "mismatch"].includes(pay)) { if (pay === "mismatch") { await alertAdmin(env, id, "payment_mismatch"); out.alerts++; } await env.ASTRO_KV.delete(name); continue; }
    if (pay !== "paid") continue;
    if (gen === "failed") {
      if (st.attempts < MAX_GENERATIONS) {
        const r = await call(orderStub(env, id), "retry", {});
        if (r.status === 200) { await startOrderJob(env, id, r.jobId, r.payload, null); await clearException(env, id); out.retried++; }
      } else { await alertAdmin(env, id, "generation_failed"); out.alerts++; }
    } else if (gen === "delivered") {
      if (st.mail && st.mail.status === "sent") { await env.ASTRO_KV.delete(name); continue; }
      if (mailEnabled(env) && (!st.mail || st.mail.tries < MAX_MAIL_TRIES)) { if (await deliverMail(env, id)) { out.mailed++; await env.ASTRO_KV.delete(name); } }
      else { await alertAdmin(env, id, "mail_failed"); out.alerts++; }
    } else if (st.paidAt && now - Date.parse(st.paidAt) > 3 * HOUR) { await alertAdmin(env, id, "paid_without_report"); out.alerts++; }
  }
  await dailySummary(env, now, list.keys.length);
  return out;
}

/** Resumen diario para Bárbara: confirma también que los avisos funcionan. Solo cifras. */
async function dailySummary(env, now, open) {
  const d = new Date(now), day = d.toISOString().slice(0, 10), key = "summary:" + day;
  if (!env.ADMIN_EMAIL || d.getUTCHours() < 12 || (await env.ASTRO_KV.get(key))) return;
  const month = await kvGetJSON(env.ASTRO_KV, monthKey(d), { reports: 0, usd: 0, failed: 0 });
  const exc = await env.ASTRO_KV.list({ prefix: "exc:" });
  const saleKeys = (await env.ASTRO_KV.list({ prefix: "sale:" })).keys, sales = [];
  for (const k of saleKeys) { const s = await kvGetJSON(env.ASTRO_KV, k.name, null); if (s) sales.push(`${s.at.slice(0, 10)} · ${s.currency} ${(s.minor / 100).toFixed(2)} · ${s.provider} · pago ${s.external}`); }
  const salesText = sales.length ? `\n\nVentas para facturar (${sales.length}):\n${sales.sort().join("\n")}` : "\n\nVentas para facturar: ninguna";
  const ok = await sendMail(env, { to: env.ADMIN_EMAIL, subject: `AsterOrbis: resumen ${day}`, text: `Pedidos abiertos: ${open}\nPedidos para revisar: ${exc.keys.length}\nMes: ${month.reports} informes, ${month.failed} fallidos, US$ ${month.usd}${salesText}`, key });
  if (ok) {
    await env.ASTRO_KV.put(key, "1", { expirationTtl: 3 * 86400 });
    for (const k of saleKeys) await env.ASTRO_KV.delete(k.name);
  }
}

// ---------------------------------------------------------------- POST /orders
async function createOrder(request, env, cors) {
  if (serviceMode(env) !== "paid") return json({ error: serviceMode(env) === "disabled" ? "disabled" : "not_available" }, serviceMode(env) === "disabled" ? 503 : 404, cors);
  if (!env.ORDERS || !env.REPORT_JOB || !env.CODE_LEDGER) return json({ error: "not_configured" }, 503, cors);
  const raw = await request.text();
  if (raw.length > MAX_ORDER_BODY) return json({ error: "bad_request" }, 413, cors);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
  const providerName = String((b && b.provider) || "");
  const provider = getProvider(env, providerName);
  if (!provider) return json({ error: "provider_unavailable" }, 400, cors);
  const product = String(b.product || PRODUCT_ID);
  const price = expectedPrice(env, providerName, product);
  if (!price) return json({ error: "price_not_configured" }, 503, cors);
  const c = b.consent || {};
  if (c.accepted !== true || !TERMS_VERSIONS.includes(c.terms_version)) return json({ error: "consent_required" }, 400, cors);
  if (!validEmail(b.email)) return json({ error: "email_invalid" }, 400, cors);
  if (!mailEnabled(env) || !(await generationAvailable(env))) return json({ error: "unavailable" }, 503, cors);
  const idem = normalizeRequestId(b.idempotency_key);
  if (!idem) return json({ error: "bad_request" }, 400, cors);
  const norm = normalizePayload(b.payload);
  if (!norm.ok) return json({ error: norm.error }, 400, cors);

  // idempotencia atómica: un objeto por clave reparte un solo pedido, aunque lleguen dos intentos a la vez
  const claimStub = env.ORDERS.get(env.ORDERS.idFromName("idem:" + idem));
  const claim = await call(claimStub, "claim", { id: "ord-" + randHex(16), token: randHex(24) });
  const id = claim.id, token = claim.token;
  if (!claim.first) {
    const v = await call(orderStub(env, id), "view", { token });
    if (v.order && v.order.payment_status === "paid") return json({ order_id: id, token, already_paid: true, existed: true }, 200, cors);
    if (claim.url) return json({ order_id: id, token, checkout_url: claim.url, existed: true }, 200, cors);
    return json({ error: "order_in_progress" }, 409, cors);
  }
  const order = { id, product, provider: providerName, amountMinor: price.amountMinor, currency: price.currency, productRef: price.productRef,
    lang: norm.payload.request.report_language, tokenHash: await sha256Hex(token), idemKey: idem,
    consent: { terms_version: c.terms_version, disclaimer_version: String(c.disclaimer_version || ""), at: new Date().toISOString() } };
  await call(orderStub(env, id), "create", { order, payload: norm.payload, email: b.email.trim() });
  if (env.ASTRO_KV) await env.ASTRO_KV.put("open:" + id, "1", { expirationTtl: OPEN_TTL });
  return checkout(id, token, 201);

  async function checkout(oid, tok, okStatus = 200) {
    const appOrigin = request.headers.get("origin");
    const serviceOrigin = new URL(request.url).origin;
    let ck;
    try { ck = await provider.createCheckout(env, { id: oid, product, amountMinor: price.amountMinor, currency: price.currency, lang: norm.payload.request.report_language }, { appOrigin, serviceOrigin }); }
    catch (e) { console.log(JSON.stringify({ event: "checkout_error", provider: providerName, status: e.status || null })); await call(claimStub, "claim-release", {}); return json({ error: "checkout_unavailable", order_id: oid }, 502, cors); }
    await call(orderStub(env, oid), "checkout", { externalCheckoutId: ck.externalCheckoutId });
    await call(claimStub, "claim-url", { url: ck.url });
    return json({ order_id: oid, token: tok, checkout_url: ck.url, ...(okStatus === 200 ? { existed: true } : {}) }, okStatus, cors);
  }
}

// ---------------------------------------------------------------- GET /orders/<id>
async function getOrder(request, env, cors, id) {
  if (!ORDER_ID_RE.test(id) || !env.ORDERS) return json({ error: "not_found" }, 404, cors);
  const v = await call(orderStub(env, id), "view", { token: request.headers.get("x-order-token") || "" });
  if (v.status !== 200) return json({ error: v.error }, v.status, cors);
  const out = { ...v.order, chart: v.chart || undefined };
  if (out.generation_status === "delivered" && v.jobId) {
    const r = await env.REPORT_JOB.get(env.REPORT_JOB.idFromName(v.jobId)).fetch("https://job/status", { method: "POST", body: JSON.stringify({ code: ORDER_CODE_PREFIX + id }) });
    const body = await r.json().catch(() => ({}));
    if (body.report) out.report = body.report; else out.report_expired = true;
  }
  return json(out, 200, cors);
}

// ---------------------------------------------------------------- POST /webhooks/<proveedor>
export async function handleWebhook(request, env, name, rawOverride) {
  const provider = getProvider(env, name);
  if (!provider || !env.ORDERS) return json({ error: "not_found" }, 404);
  const raw = rawOverride != null ? rawOverride : await request.text();
  const v = await provider.verifyWebhook(env, request, raw);
  if (!v.ok) return json({ error: "bad_signature" }, 401);
  if (v.kind !== "payment" || !v.externalId) return json({ ok: true, ignored: true }, 200);
  let tx;
  try { tx = await provider.getTransaction(env, v.externalId, v.hint); }
  catch (e) { return json({ error: "provider_unavailable" }, 502); } // el proveedor reintenta
  if (!tx.orderId || !ORDER_ID_RE.test(tx.orderId)) return json({ ok: true, ignored: "no_order" }, 200);
  const r = await applyPayment(env, v.eventId, tx, name);
  if (r.status === 404) return json({ ok: true, ignored: "unknown_order" }, 200);
  return json({ ok: true, duplicate: !!r.duplicate }, 200);
}

/** Aplica una transacción confirmada con el proveedor, venga de un aviso o de la conciliación. */
async function applyPayment(env, eventId, tx, name) {
  const r = await call(orderStub(env, tx.orderId), "payment", { eventId, tx, provider: name });
  if (r.status === 404) return r;
  if (r.exception) await flagException(env, tx.orderId, r.exception);
  if (r.action === "start") {
    // venta para facturar: va en el próximo resumen diario, sin datos de la persona
    if (env.ASTRO_KV) await env.ASTRO_KV.put("sale:" + tx.orderId, JSON.stringify({ at: new Date().toISOString(), minor: tx.amountMinor, currency: tx.currency, provider: name, external: tx.externalId }), { expirationTtl: 60 * 86400 }).catch(() => { });
    try { await startOrderJob(env, tx.orderId, r.jobId, r.payload, r.internal && r.internal.externalId); }
    catch (e) { await call(orderStub(env, tx.orderId), "generation", { jobId: r.jobId, outcome: "start_error" }); await flagException(env, tx.orderId, "generation_failed"); }
  }
  return r;
}

// ---------------------------------------------------------------- simulador (solo PAYMENTS_SIM = "true")
async function simRoute(request, env, url) {
  if (!simProvider.enabled(env)) return json({ error: "not_found" }, 404);
  const m = url.pathname.match(/^\/sim\/(checkout|pay)\/(ord-[0-9a-f]{32})$/);
  if (!m) return json({ error: "not_found" }, 404);
  const id = m[2];
  const price = expectedPrice(env, "sim");
  if (m[1] === "checkout" && request.method === "GET")
    return new Response(simCheckoutPage(id, `${(price.amountMinor / 100).toFixed(2)} ${price.currency}`), { headers: { "content-type": "text/html; charset=utf-8" } });
  if (m[1] === "pay" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const result = form && form.get("result") === "paid" ? "paid" : "failed";
    const raw = JSON.stringify({ event_id: "simev_" + randHex(8), payment: { id: "simpay_" + id, order_id: id, status: result, amount_minor: price.amountMinor, currency: price.currency, product: PRODUCT_ID } });
    const req = new Request(url.origin + "/webhooks/sim", { method: "POST", headers: { [SIM_SIGNATURE_HEADER]: await simSign(env.SIM_WEBHOOK_SECRET, raw) } });
    await handleWebhook(req, env, "sim", raw);
    return new Response(`<!doctype html><meta charset="utf-8"><p>Pago simulado: ${result}. Volvé a AsterOrbis.</p>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return json({ error: "not_found" }, 404);
}

// ---------------------------------------------------------------- administración (ADMIN_TOKEN); nunca muestra informes
async function adminRoute(request, env, url) {
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || !auth || !safeEqual(auth, env.ADMIN_TOKEN)) return json({ error: "forbidden" }, 403);
  if (request.method === "GET" && url.pathname === "/admin/exceptions") {
    const list = env.ASTRO_KV && env.ASTRO_KV.list ? await env.ASTRO_KV.list({ prefix: "exc:" }) : { keys: [] };
    const items = [];
    for (const k of list.keys) items.push(await kvGetJSON(env.ASTRO_KV, k.name, null));
    return json({ exceptions: items.filter(Boolean) }, 200);
  }
  const m = url.pathname.match(/^\/admin\/orders\/(ord-[0-9a-f]{32})\/(retry|refund)$/);
  if (!m || request.method !== "POST") return json({ error: "not_found" }, 404);
  const [, id, op] = m;
  if (op === "retry") {
    const r = await call(orderStub(env, id), "retry", {});
    if (r.status !== 200) return json({ error: r.error, order: r.order }, r.status);
    const s = await startOrderJob(env, id, r.jobId, r.payload, null);
    return json({ ok: s.started, reason: s.reason || null, order: r.order }, 200);
  }
  const r = await call(orderStub(env, id), "refund", {});
  if (!r.refundable) return json({ error: "not_refundable", order: r.order }, 409);
  const provider = getProvider(env, r.internal.provider);
  if (!provider) return json({ error: "provider_unavailable" }, 503);
  const rr = await provider.refund(env, { id, externalId: r.internal.externalId });
  return json({ ok: rr.ok, status: rr.status, order: r.order }, 200); // el estado «refunded» llega luego por webhook
}

/** Punto de entrada desde el Worker. Devuelve una Response, o null si la ruta no es de pagos. */
export async function routePayments(request, env, cors, url) {
  if (url.pathname.startsWith("/webhooks/") && request.method === "POST") return handleWebhook(request, env, url.pathname.slice("/webhooks/".length));
  if (url.pathname.startsWith("/sim/")) return simRoute(request, env, url);
  if (url.pathname.startsWith("/admin/")) return adminRoute(request, env, url);
  return null;
}
export async function routeOrders(request, env, cors, url) {
  if (url.pathname === "/orders" && request.method === "POST") return createOrder(request, env, cors);
  const m = url.pathname.match(/^\/orders\/([^/]+)$/);
  if (m && request.method === "GET") return getOrder(request, env, cors, m[1]);
  return null;
}
