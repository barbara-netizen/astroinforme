// AsterOrbis — proveedor de pago simulado, para desarrollo y pruebas (servicio 2.0).
//
// Solo existe con PAYMENTS_SIM = "true" y SIM_WEBHOOK_SECRET configurados: en producción no debe estar activo.
// El «checkout» es una página del propio servicio (/sim/checkout/<pedido>) con dos botones: pagar o rechazar.
// Esa página envía al webhook /webhooks/sim un evento firmado con HMAC-SHA256 (cabecera x-sim-signature, hex).
// getTransaction no consulta a nadie: confía en el cuerpo firmado, que trae el estado, el importe y la moneda.

import { normalized, hmac, toHex, safeEqual } from "./provider.js";

export const SIM_SIGNATURE_HEADER = "x-sim-signature";

export async function simSign(secret, raw) { return toHex(await hmac(new TextEncoder().encode(secret), raw)); }

export const simProvider = {
  name: "sim",
  enabled: (env) => env.PAYMENTS_SIM === "true" && !!env.SIM_WEBHOOK_SECRET,

  async createCheckout(env, order, urls) {
    return { url: `${urls.serviceOrigin}/sim/checkout/${encodeURIComponent(order.id)}`, externalCheckoutId: "simck_" + order.id };
  },

  async verifyWebhook(env, request, raw) {
    const sig = request.headers.get(SIM_SIGNATURE_HEADER) || "";
    if (!safeEqual(sig, await simSign(env.SIM_WEBHOOK_SECRET, raw))) return { ok: false };
    let ev; try { ev = JSON.parse(raw); } catch (e) { return { ok: false }; }
    if (!ev || !ev.event_id || !ev.payment) return { ok: false };
    return { ok: true, eventId: String(ev.event_id), externalId: String(ev.payment.id), kind: "payment", hint: ev.payment };
  },

  async getTransaction(env, externalId, hint) {
    const p = hint || {};
    return normalized({ status: p.status, orderId: p.order_id, externalId, amountMinor: p.amount_minor, currency: p.currency, productRef: p.product });
  },

  async refund() { return { ok: true, status: "refunded" }; },
};

/** Página mínima del checkout simulado (solo con el simulador activo). */
export function simCheckoutPage(orderId, amountText) {
  const id = String(orderId).replace(/[^A-Za-z0-9-]/g, "");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout simulado</title><body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px">
<h1>Checkout simulado</h1><p>Pedido <code>${id}</code> · ${amountText}</p>
<p>Esto no cobra nada: envía un aviso de pago firmado al servicio, como haría un proveedor real.</p>
<form method="post" action="/sim/pay/${id}"><button name="result" value="paid">Pagar</button> <button name="result" value="failed">Rechazar</button></form>`;
}
