// AsterOrbis — adaptador de Dodo Payments (servicio 2.0). ESTRUCTURA, NO ACTIVADA.
//
// No se conecta a producción hasta tener la aprobación escrita de Dodo para AsterOrbis (astrología + IA) y la
// confirmación del payout a una monotributista argentina. Ver servicio/PAGOS.md y el documento de preaprobación.
//
// Variables de Cloudflare:
//   DODO_API_KEY          clave de API (secreto)
//   DODO_WEBHOOK_SECRET   secreto del webhook, con prefijo whsec_ (secreto)
//   DODO_PRODUCT_ID       producto de pago único creado en Dodo
//   DODO_ENV              "test" (por defecto) o "live"
//
// Confirmado en la documentación de Dodo (2-nov-2026):
//   - checkout: POST {base}/checkouts con product_cart [{ product_id, quantity }], return_url y metadata;
//     responde session_id y checkout_url. Autenticación: Authorization: Bearer <clave>.
//   - webhooks con el estándar «Standard Webhooks»: cabeceras webhook-id, webhook-timestamp, webhook-signature;
//     se firma «id.timestamp.cuerpo» con HMAC-SHA256 y la clave (whsec_ en base64); la cabecera trae «v1,<base64>»;
//     tolerancia de 5 minutos. La entrega se hace ante payment.succeeded, no ante el regreso del navegador.
// PENDIENTE DE CONFIRMAR en el entorno de prueba de Dodo:
//   - la URL base de producción (se asume https://live.dodopayments.com);
//   - los nombres exactos de los campos de GET /payments/{id} (status, total_amount, tax, currency, metadata,
//     product_cart) y si total_amount incluye impuestos o precio en moneda local (precios adaptativos);
//   - el evento y el cuerpo de reembolso.

import { normalized, hmac, toB64, fromB64, safeEqual } from "./provider.js";

const base = (env) => (env.DODO_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");
const TOLERANCE_S = 300;
const DODO_STATUS = { succeeded: "paid", processing: "pending", requires_customer_action: "pending", requires_merchant_action: "pending",
  requires_payment_method: "pending", requires_confirmation: "pending", requires_capture: "pending", partially_captured: "pending",
  failed: "failed", cancelled: "cancelled" };

async function dodo(env, path, init = {}) {
  const r = await fetch(base(env) + path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + env.DODO_API_KEY, ...(init.headers || {}) } });
  const body = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error("dodo"); e.status = r.status; e.detail = body && (body.message || body.code); throw e; }
  return body;
}

/** Firma Standard Webhooks: base64(HMAC-SHA256(clave, "id.timestamp.cuerpo")). */
export async function standardWebhookSignature(secret, id, ts, raw) {
  const key = fromB64(String(secret).replace(/^whsec_/, ""));
  return toB64(await hmac(key, `${id}.${ts}.${raw}`));
}

export const dodoProvider = {
  name: "dodo",
  enabled: (env) => !!(env.DODO_API_KEY && env.DODO_WEBHOOK_SECRET && env.DODO_PRODUCT_ID),

  async createCheckout(env, order, urls) {
    const s = await dodo(env, "/checkouts", { method: "POST", body: JSON.stringify({
      product_cart: [{ product_id: env.DODO_PRODUCT_ID, quantity: 1 }],
      return_url: `${urls.appOrigin}/?pedido=${encodeURIComponent(order.id)}`,
      metadata: { order_id: order.id },
    }) });
    return { url: s.checkout_url, externalCheckoutId: s.session_id };
  },

  async verifyWebhook(env, request, raw, now = Date.now()) {
    const id = request.headers.get("webhook-id"), ts = request.headers.get("webhook-timestamp"), sigs = request.headers.get("webhook-signature") || "";
    if (!id || !ts || !/^\d+$/.test(ts) || Math.abs(now / 1000 - +ts) > TOLERANCE_S) return { ok: false };
    const expected = await standardWebhookSignature(env.DODO_WEBHOOK_SECRET, id, ts, raw);
    if (!sigs.split(" ").some((s) => s.startsWith("v1,") && safeEqual(s.slice(3), expected))) return { ok: false };
    let ev; try { ev = JSON.parse(raw); } catch (e) { return { ok: false }; }
    const type = String(ev.type || ""), data = ev.data || {};
    const kind = (type.startsWith("payment.") || type.startsWith("refund.")) && data.payment_id ? "payment" : "ignore";
    return { ok: true, eventId: "dodo:" + id, externalId: data.payment_id ? String(data.payment_id) : null, kind };
  },

  async getTransaction(env, externalId) {
    const p = await dodo(env, "/payments/" + encodeURIComponent(externalId));
    const refunded = Array.isArray(p.refunds) && p.refunds.some((r) => r.status === "succeeded");
    const item = Array.isArray(p.product_cart) ? p.product_cart[0] : null;
    const net = Number.isInteger(p.total_amount) ? p.total_amount - (Number.isInteger(p.tax) ? p.tax : 0) : null;
    return normalized({ status: refunded ? "refunded" : (DODO_STATUS[p.status] || "pending"), orderId: p.metadata && p.metadata.order_id,
      externalId: p.payment_id || externalId, amountMinor: net, currency: p.currency, productRef: item ? item.product_id : null });
  },

  async refund(env, order) {
    const r = await dodo(env, "/refunds", { method: "POST", body: JSON.stringify({ payment_id: order.externalId, reason: "AsterOrbis: informe no entregado" }) });
    return { ok: true, status: r && r.status === "succeeded" ? "refunded" : "pending" };
  },
};
