// AsterOrbis — interfaz común de proveedores de pago (servicio 2.0).
//
// La lógica de pedidos (orders.js, order.js) no conoce a ningún proveedor en particular: usa estas operaciones.
// Cada adaptador implementa:
//
//   enabled(env)                       → true si tiene la configuración mínima (claves en variables de Cloudflare)
//   createCheckout(env, order, urls)   → { url, externalCheckoutId }   (solo recibe datos de cobro, nunca la carta)
//   verifyWebhook(env, request, raw)   → { ok, eventId, externalId, kind }   kind: "payment" | "ignore"
//   getTransaction(env, externalId, hint) → transacción normalizada (ver normalized() abajo)
//   refund(env, order)                 → { ok, status }
//
// Una transacción normalizada tiene siempre la misma forma, sea cual sea el proveedor:
//   { status: "paid" | "pending" | "failed" | "refunded" | "cancelled",
//     orderId, externalId, amountMinor, currency, productRef }
// amountMinor es el importe en la unidad mínima de la moneda (centavos), como entero.

import { simProvider } from "./sim.js";
import { mercadoPagoProvider } from "./mercadopago.js";
import { dodoProvider } from "./dodo.js";

export const PAYMENT_STATUSES = ["paid", "pending", "failed", "refunded", "cancelled"];

const PROVIDERS = { sim: simProvider, mercadopago: mercadoPagoProvider, dodo: dodoProvider };

/** Adaptador por nombre, o null si no existe o no está configurado en este entorno. */
export function getProvider(env, name) {
  const p = PROVIDERS[name];
  return p && p.enabled(env) ? p : null;
}
export const providerNames = () => Object.keys(PROVIDERS);

/** Pasa un importe decimal ("15.00", 15, "15000,50") a unidades mínimas enteras; null si no es válido. */
export function toMinor(x) {
  if (x == null || x === "") return null;
  const s = String(x).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  return +i * 100 + +(d + "00").slice(0, 2);
}

export function normalized({ status, orderId, externalId, amountMinor, currency, productRef }) {
  return {
    status: PAYMENT_STATUSES.includes(status) ? status : "pending",
    orderId: orderId ? String(orderId) : null,
    externalId: externalId != null ? String(externalId) : null,
    amountMinor: Number.isInteger(amountMinor) ? amountMinor : null,
    currency: currency ? String(currency).toUpperCase() : null,
    productRef: productRef != null ? String(productRef) : null,
  };
}

// ---------------------------------------------------------------- utilidades criptográficas compartidas
export async function hmac(keyBytes, data, hash = "SHA-256") {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
export const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export const toB64 = (b) => btoa(String.fromCharCode(...b));
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** Comparación en tiempo constante de dos cadenas. */
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
