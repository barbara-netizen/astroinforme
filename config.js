// Configuración de despliegue de ASTROINFORME.
// interpreterUrl: dirección del servicio interpretativo (POST astroinforme.chart/v1 -> astroinforme.report/v1).
//   Vacío = motor interpretativo no conectado. Ver CONTRATO_INTERPRETACION.md y servicio/LEEME.md.
// requireCode: pide un código de acceso por persona (encabezado x-astro-code).
export const CONFIG = {
  interpreterUrl: "",
  requireCode: true,
};
