// AsterOrbis — adaptador de Mercado Pago, Checkout Pro (servicio 2.0). Pensado primero para modo de prueba.
//
// Variables de Cloudflare (secretos):
//   MP_ACCESS_TOKEN     token de acceso (de prueba: empieza con TEST-; de producción: APP_USR-)
//   MP_WEBHOOK_SECRET   «clave secreta» de la configuración de Webhooks de la aplicación
// Opcional:
//   MP_USE_SANDBOX_POINT = "true" para abrir sandbox_init_point en lugar de init_point
//
// Flujo: se crea una preferencia con external_reference = identificador del pedido. A Mercado Pago solo le llegan
// el producto, el precio y ese identificador opaco; nunca la carta ni los datos natales. El aviso de pago (webhook)
// se valida con la firma x-signature y después se consulta el pago en /v1/payments/{id}: esa consulta, no el aviso
// ni el regreso del navegador, es la fuente de verdad del estado, el importe y la moneda.
//
// Firma (documentación de Mercado Pago, «validar origen de la notificación»): plantilla
//   id:<data.id de la URL, en minúsculas si es alfanumérico>;request-id:<cabecera x-request-id>;ts:<ts de x-signature>;
// firmada con HMAC-SHA256 y la clave secreta, en hexadecimal, comparada con v1 de x-signature.
// PENDIENTE DE CONFIRMAR con un aviso real en modo de prueba (la página consultada no muestra el paso manual completo).

import { normalized, hmac, toHex, safeEqual, toMinor } from "./provider.js";
import { PRODUCT_TITLE } from "./catalog.js";

const API = "https://api.mercadopago.com";

const MP_STATUS = { approved: "paid", authorized: "pending", in_process: "pending", in_mediation: "pending", pending: "pending",
  rejected: "failed", cancelled: "cancelled", refunded: "refunded", charged_back: "refunded" };

async function mp(env, path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + env.MP_ACCESS_TOKEN, ...(init.headers || {}) } });
  const body = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error("mercadopago"); e.status = r.status; e.detail = body && (body.message || body.error); throw e; }
  return body;
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
    const pref = await mp(env, "/checkout/preferences", { method: "POST", headers: { "x-idempotency-key": order.id }, body: JSON.stringify({
      items: [{ id: order.product, title: PRODUCT_TITLE[order.lang] || PRODUCT_TITLE.es, quantity: 1, currency_id: order.currency, unit_price: order.amountMinor / 100 }],
      external_reference: order.id,
      metadata: { order_id: order.id },
      back_urls: { success: back("ok"), pending: back("pendiente"), failure: back("error") },
      auto_return: "approved",
      notification_url: `${urls.serviceOrigin}/webhooks/mercadopago`,
      statement_descriptor: "ASTERORBIS",
    }) });
    const url = env.MP_USE_SANDBOX_POINT === "true" ? pref.sandbox_init_point : pref.init_point;
    return { url, externalCheckoutId: pref.id };
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
    return { ok: true, eventId: `mp:${type}:${dataId}:${(body && body.action) || ""}:${(body && body.id) || reqId}`, externalId: String(dataId), kind: type === "payment" ? "payment" : "ignore" };
  },

  async getTransaction(env, externalId) {
    const p = await mp(env, "/v1/payments/" + encodeURIComponent(externalId));
    const item = p.additional_info && p.additional_info.items && p.additional_info.items[0];
    return normalized({ status: MP_STATUS[p.status] || "pending", orderId: p.external_reference, externalId: p.id,
      amountMinor: toMinor(p.transaction_amount), currency: p.currency_id, productRef: item ? item.id : null });
  },

  async refund(env, order) {
    const r = await mp(env, `/v1/payments/${encodeURIComponent(order.externalId)}/refunds`, { method: "POST", headers: { "x-idempotency-key": "refund-" + order.id }, body: "{}" });
    return { ok: true, status: r && r.status === "approved" ? "refunded" : "pending" };
  },
};
