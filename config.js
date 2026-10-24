// Configuración de despliegue de ASTROINFORME.
// interpreterUrl: dirección del servicio interpretativo (POST astroinforme.chart/v1 -> astroinforme.report/v1).
//   Vacío = motor interpretativo no conectado. Ver CONTRATO_INTERPRETACION.md y servicio/LEEME.md.
// requireCode: true = cada persona necesita un código de acceso (encabezado x-astro-code).
//   false = acceso público con límite por visitante y por día en el servicio (REQUIRE_CODE="false" allí);
//   un código sigue siendo opcional y usa su propio cupo.
// turnstileSiteKey: clave de sitio de Cloudflare Turnstile (pública). Vacía = sin verificación anti-robots.
//   Si se completa, el servicio debe tener el secreto TURNSTILE_SECRET correspondiente.
// languages: idiomas de la interfaz y del informe. Con uno solo, se oculta el selector.
// donation: aportes voluntarios, separados del informe (el informe no depende del pago).
//   links: links de pago de Mercado Pago, cada uno con su monto fijo. Vacío = no se muestra el recuadro.
//   alias: alias para transferencia bancaria (opcional; muestra el nombre de la titular a quien transfiere).
export const CONFIG = {
  interpreterUrl: "https://astroinforme.gutierrez-barbarita.workers.dev/",
  requireCode: true,
  turnstileSiteKey: "",
  languages: ["es"],
  donation: {
    links: [
      // { amount: "$ 3.000", url: "https://mpago.la/..." },
    ],
    alias: "",
  },
};
