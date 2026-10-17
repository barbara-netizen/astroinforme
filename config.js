// Configuración de despliegue de ASTROINFORME.
// interpreterUrl: dirección del servicio interpretativo (POST astroinforme.chart/v1 -> astroinforme.report/v1).
//   Vacío = motor interpretativo no conectado. Ver CONTRATO_INTERPRETACION.md y servicio/LEEME.md.
// requireCode: true = cada persona necesita un código de acceso (encabezado x-astro-code).
//   false = acceso público con límite por visitante y por día en el servicio (REQUIRE_CODE="false" allí);
//   un código sigue siendo opcional y usa su propio cupo.
// turnstileSiteKey: clave de sitio de Cloudflare Turnstile (pública). Vacía = sin verificación anti-robots.
//   Si se completa, el servicio debe tener el secreto TURNSTILE_SECRET correspondiente.
export const CONFIG = {
  interpreterUrl: "",
  requireCode: true,
  turnstileSiteKey: "",
};
