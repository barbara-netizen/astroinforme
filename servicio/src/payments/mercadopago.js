// AsterOrbis — adaptador de Mercado Pago, Checkout Pro vía API de Orders (servicio 2.2).
//
// Variables de Cloudflare (secretos):
//   MP_ACCESS_TOKEN     token de acceso (de prueba: empieza con TEST-; de producción: APP_USR-)
//   MP_WEBHOOK_SECRET   «clave secreta» de la configuración de Webhooks de la aplicación
//
// Flujo: se crea una order con external_reference = identificador del pedido. A Mercado Pago solo le llegan el producto,
// el precio y ese identificador opaco; nunca la carta ni los datos natales. La URL del aviso se configura en el panel
// (evento Order). Después se consulta /v1/orders/{id}: esa consulta, no el aviso ni el regreso del navegador, es la
// fuente de verdad del estado, el importe y la moneda.
//
// Firma (documentación de Mercado Pago, «validar origen de la notificación»): plantilla
//   id:<data.id de la URL, en minúsculas si es alfanumérico>;request-id:<cabecera x-request-id>;ts:<ts de x-signature>;
// firmada con HMAC-SHA256 y la clave secreta, en hexadecimal, comparada con v1 de x-signature.
// PENDIENTE DE CONFIRMAR con un aviso real en modo de prueba (la página consultada no muestra el paso manual completo).

import { normalized, hmac, toHex, safeEqual, toMinor } from "./provider.js";
import { PRODUCT_TITLE } from "./catalog.js";

const API = "https://api.mercadopago.com";

/** Estado de una order. Un reembolso parcial no se ofrece, pero conserva la venta como pagada. */
function orderStatus(o) {
  if (o.status === "processed") return ["accredited", "partially_refunded"].includes(o.status_detail) ? "paid" : "pending";
  return { refunded: "refunded", canceled: "cancelled", failed: "failed" }[o.status] || "pending";
}
const money = (minor) => (minor / 100).toFixed(2);
/** La API pide un UUID único por intento: se deriva del pedido para que un reintento no duplique la order. */
const idempotencyUuid = (id) => { const h = String(id).replace(/[^0-9a-f]/g, "").padEnd(32, "0"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };

async function mp(env, path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + env.MP_ACCESS_TOKEN, ...(init.headers || {}) } });
  const body = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error("mercadopago"); e.status = r.status; e.detail = body && (body.message || body.error); throw e; }
  return body;
}

function fromOrder(o) {
  const item = Array.isArray(o.items) ? o.items[0] : null;
  return normalized({ status: orderStatus(o), orderId: o.external_reference, externalId: o.id, amountMinor: toMinor(o.total_amount), currency: o.currency, productRef: item ? item.external_code : null });
}

export async function mpManifestSignature(secret, dataId, requestId, ts) {
  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : String(dataId);
  return toHex(await hmac(new TextEncoder().encode(secret), `id:${id};request-id:${requestId};ts:${ts};`));
}

export const mercadoPagoProvider = {
  name: "mercadopago",
  enabled: (env) => !!(env.MP_ACCESS_TOKEN && env.MP_WEBHOOK_SECRET),

  async createCheckout(env, order, urls) {
    const back = (r) => `${urls.appOrigin}/?pedido=${encodeURIComponent(order.id)}&resultado=${r}`;
    const total = money(order.amountMinor);
    const o = await mp(env, "/v1/orders", { method: "POST", headers: { "x-idempotency-key": idempotencyUuid(order.id) }, body: JSON.stringify({
      type: "online", processing_mode: "manual", total_amount: total, external_reference: order.id,
      // el enlace vence antes que la carta guardada: no se puede pagar un pedido que ya no se puede generar
      expiration_time: "P2D",
      items: [{ external_code: order.product, title: PRODUCT_TITLE[order.lang] || PRODUCT_TITLE.es, quantity: 1, unit_price: total }],
      config: { statement_descriptor: "ASTERORBIS", online: { success_url: back("ok"), pending_url: back("pendiente"), failure_url: back("error"), auto_return: "approved" } },
    }) });
    return { url: o.checkout_url, externalCheckoutId: o.id };
  },

  async verifyWebhook(env, request, raw) {
    const u = new URL(request.url);
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { }
    const type = u.searchParams.get("type") || u.searchParams.get("topic") || (body && body.type) || "";
    const dataId = u.searchParams.get("data.id") || (body && body.data && body.data.id) || "";
    const reqId = request.headers.get("x-request-id") || "";
    const parts = Object.fromEntries((request.headers.get("x-signature") || "").split(",").map((kv) => kv.trim().split("=")));
    if (!dataId || !reqId || !parts.ts || !parts.v1) return { ok: false };
    if (!safeEqual(parts.v1, await mpManifestSignature(env.MP_WEBHOOK_SECRET, dataId, reqId, parts.ts))) return { ok: false };
    return { ok: true, eventId: `mp:${type}:${dataId}:${(body && body.action) || ""}:${(body && body.id) || reqId}`, externalId: String(dataId), kind: type === "order" ? "payment" : "ignore" };
  },

  async getTransaction(env, externalId) {
    return fromOrder(await mp(env, "/v1/orders/" + encodeURIComponent(externalId)));
  },

  /** Conciliación: busca la order por identificador del pedido, por si el aviso se perdió. */
  async findPayment(env, orderId) {
    const end = new Date(), begin = new Date(end.getTime() - 9 * 864e5);
    const q = new URLSearchParams({ begin_date: begin.toISOString(), end_date: end.toISOString(), external_reference: orderId });
    const r = await mp(env, "/v1/orders?" + q);
    const list = r.data || [], o = list.find((x) => orderStatus(x) === "paid") || list[0];
    return o ? fromOrder(await mp(env, "/v1/orders/" + encodeURIComponent(o.id))) : null;
  },

  async refund(env, order) {
    const r = await mp(env, `/v1/orders/${encodeURIComponent(order.externalId)}/refund`, { method: "POST", headers: { "x-idempotency-key": idempotencyUuid("f" + order.id) }, body: "{}" });
    return { ok: true, status: r && r.status === "refunded" ? "refunded" : "pending" };
  },
};
  },
};
