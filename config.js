// Configuración de despliegue de ASTROINFORME.
// interpreterUrl: dirección del servicio interpretativo (POST astroinforme.chart/v1 -> astroinforme.report/v1).
//   Vacío = motor interpretativo no conectado. Ver CONTRATO_INTERPRETACION.md y servicio/LEEME.md.
// requireCode: true = cada persona necesita un código de acceso (encabezado x-astro-code).
//   false = acceso público con límite por visitante y por día en el servicio (REQUIRE_CODE="false" allí);
//   un código sigue siendo opcional y usa su propio cupo.
// turnstileSiteKey: clave de sitio de Cloudflare Turnstile (pública). Vacía = sin verificación anti-robots.
//   Si se completa, el servicio debe tener el secreto TURNSTILE_SECRET correspondiente.
// languages: idiomas de la interfaz y del informe. Con uno solo, se oculta el selector.
// reportUrl: solo para copias sin servicio (interpreterUrl vacío): dirección de la app pública donde se pide el informe.
// donation: aportes voluntarios, separados del informe (el informe no depende del pago).
//   links: links de pago de Mercado Pago, cada uno con su monto fijo. Vacío = no se muestra el recuadro.
//   alias: alias para transferencia bancaria (opcional; muestra el nombre de la titular a quien transfiere).
export const CONFIG = {
  interpreterUrl: "https://astroinforme.gutierrez-barbarita.workers.dev/",
  requireCode: true,
  turnstileSiteKey: "",
  languages: ["es", "de", "en"],
  // pilot: franja de «versión piloto» con el conejo y el recuadro de comentario al final del informe.
  pilot: true,
  // intro: animación del logo al abrir la app, una vez por sesión («?intro» la muestra siempre, para probarla).
  intro: false,
  // paid: el informe se cobra (muestra la frase sobre el pago en «Quién hace AsterOrbis»).
  paid: false,
  // sample: informe de muestra para una persona ficticia, visible antes de pedir uno propio (enlace «?muestra»).
  //   La carta se calcula en el navegador con estos datos; el informe es un archivo fijo generado por el servicio.
  //   file vacío = no se muestra el enlace.
  sample: {
    file: "muestra/informe-lucia.json",
    first: "Lucía", date: "1985-03-14", time: "15:20", precision: "EXACT",
    lat: "-31.4167", lon: "-64.1833", placeLabel: "Córdoba, Argentina", gender: "FEMININE",
  },
  donation: {
    links: [
      // { amount: "$ 3.000", url: "https://mpago.la/..." },
    ],
    alias: "",
  },
};
