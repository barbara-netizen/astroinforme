// AsterOrbis — catálogo de productos y precios esperados por proveedor (servicio 2.0).
//
// Los precios viven en variables de Cloudflare, nunca en la app: el navegador no puede elegir cuánto se cobra.
// Mientras falte el precio de un proveedor, ese proveedor no se ofrece.
//
//   PRICE_ARS          precio en pesos para Mercado Pago, p. ej. "15000.00"
//   PRICE_USD          precio en dólares para Dodo y para el simulador, p. ej. "15.00"
//   DODO_PRODUCT_ID    identificador del producto creado en Dodo (el precio se fija también allí)

import { toMinor } from "./provider.js";

export const PRODUCT_ID = "informe_completo";

/** Precio esperado de un producto con un proveedor: { amountMinor, currency, productRef } o null. */
export function expectedPrice(env, provider, product = PRODUCT_ID) {
  if (product !== PRODUCT_ID) return null;
  if (provider === "mercadopago") {
    const a = toMinor(env.PRICE_ARS);
    return a ? { amountMinor: a, currency: "ARS", productRef: PRODUCT_ID } : null;
  }
  if (provider === "dodo") {
    const a = toMinor(env.PRICE_USD);
    return a && env.DODO_PRODUCT_ID ? { amountMinor: a, currency: "USD", productRef: env.DODO_PRODUCT_ID } : null;
  }
  if (provider === "sim") {
    const a = toMinor(env.PRICE_USD || "15.00");
    return { amountMinor: a, currency: "USD", productRef: PRODUCT_ID };
  }
  return null;
}

export const PRODUCT_TITLE = {
  es: "AsterOrbis — informe digital personalizado de astrología psicológica",
  de: "AsterOrbis — personalisierter digitaler Bericht der psychologischen Astrologie",
  en: "AsterOrbis — personalised digital report in psychological astrology",
};
