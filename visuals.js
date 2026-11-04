// ASTROINFORME — capa visual: obra de Bárbara Gutiérrez («cartografía íntima»).
// Portado del registro del MVP (registry.json). Las ilustraciones nunca reemplazan datos, errores ni esperas:
// si una pieza falla, su marco desaparece y la interfaz sigue igual.

import { alt as altText } from "./i18n.js";

export const AUTHOR = "Bárbara Gutiérrez";
export const AUTHOR_URL = "https://barbaragutierrez.art";

const A = {
  hero_levitar: { type: "image", file: "assets/01-hero-levitar.jpg", title: "Levitar", size: [918, 918], fit: "contain", focal: "50% 50%" },
  intro_embroidery: { type: "video", file: "assets/01-portada-sone-que-bordaba.mp4", poster: "assets/01-portada-sone-que-bordaba-poster.jpg", title: "Soñé que bordaba", size: [720, 900], loop: true, fit: "cover", focal: "50% 45%" },
  analysis_neural: { type: "image", file: "assets/03-analisis-neuronales.jpg", title: "Neuronales", size: [728, 923], fit: "cover", focal: "55% 45%" },
  verification_eyes: { type: "video", file: "assets/04-verificacion-abre-los-ojos.mp4", poster: "assets/04-verificacion-abre-los-ojos-poster.jpg", title: "Abre los ojos", size: [500, 332], loop: false, fit: "contain", focal: "50% 50%" },
  report_reader: { type: "video", file: "assets/03-generacion-informe-lectora.mp4", poster: "assets/03-generacion-informe-lectora-poster.jpg", title: "Lectora", size: [960, 540], loop: true, fit: "contain", focal: "50% 50%" },
  opening_derivas: { type: "image", file: "assets/12-apertura-derivas.jpg", title: "Derivas", size: [905, 918], fit: "contain", focal: "50% 50%" },
  identity_future: { type: "image", file: "assets/13-identidad-in-richtung-zukunft.jpg", title: "In Richtung Zukunft", size: [941, 918], fit: "contain", focal: "50% 50%" },
  emotional_desmadre: { type: "image", file: "assets/14-emocional-desmadre.jpg", title: "Desmadre", size: [876, 919], fit: "contain", focal: "50% 50%" },
  desire_meadows: { type: "image", file: "assets/15-deseo-dia-de-saltar-por-las-praderas.jpg", title: "Día de saltar por las praderas", size: [1026, 919], fit: "contain", focal: "50% 50%" },
  relationships_years: { type: "image", file: "assets/16-vinculos-aquellos-anos.jpg", title: "Aquellos años", size: [1080, 752], fit: "cover", focal: "50% 50%" },
  roots_rabbit_year: { type: "image", file: "assets/17-raices-el-ano-del-conejo.jpg", title: "El año del Conejo", size: [1195, 919], fit: "contain", focal: "50% 50%" },
  closure_serendipity: { type: "image", file: "assets/18-cierre-serendipia-florida.jpg", title: "Serendipia florida", size: [638, 374], fit: "cover", focal: "50% 50%" },
  boundaries_wire: { type: "image", file: "assets/07-limites-glamur-alambre.jpg", title: "Glamur Atado con Alambre", size: [720, 556], fit: "cover", focal: "50% 50%" },
  brand_guardian: { type: "image", file: "assets/02-marca-guardian-del-universo.jpg", title: "Guardián del Universo", size: [604, 460], fit: "contain", focal: "50% 35%" },
  author_work: { type: "image", file: "assets/11-autoria-mary-playa-union.jpg", title: "Mary en Playa Unión", size: [1600, 798], fit: "contain", focal: "50% 50%" },
  pilot_rabbit: { type: "video", file: "assets/10-piloto-conejo-cuantico.mp4", poster: "assets/10-piloto-conejo-cuantico-poster.jpg", title: "Conejo cuántico", size: [360, 326], loop: true, fit: "cover", focal: "50% 50%" },
  emotional_swimmers: { type: "video", file: "assets/06-emocional-nadadoras.mp4", poster: "assets/06-emocional-nadadoras-poster.jpg", title: "Nadadoras", size: [720, 720], loop: true, fit: "cover", focal: "50% 60%" },
};

// Ilustración temática por sección del informe (ids del contrato astroinforme.report/v1).
// Dentro del informe las animaciones se reproducen una vez y quedan en su fotograma fijo.
export const SECTION_ART = {
  opening: "opening_derivas", identity: "identity_future", emotional: "emotional_desmadre", saturn: "boundaries_wire",
  desire: "desire_meadows", relationships: "relationships_years", roots: "roots_rabbit_year", neptune: "emotional_swimmers",
  transformation: "hero_levitar", myth: "brand_guardian",
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const playing = new Set();
const base = new URL(".", import.meta.url);
const url = (f) => new URL(f, base).href;

document.addEventListener("visibilitychange", () => {
  for (const v of playing) { if (document.hidden) v.pause(); else v.play().catch(() => toPoster(v)); }
});

function toPoster(v) {
  playing.delete(v);
  const a = { ...A[v.dataset.asset], id: v.dataset.asset };
  const img = makeImg(a.poster, a);
  const fig = v.closest("figure"); if (fig) fig.querySelectorAll(".print-only").forEach((p) => p.remove()); // ya hay imagen fija
  v.replaceWith(img);
}

function makeImg(src, a) {
  const img = document.createElement("img");
  img.src = url(src); img.alt = altText(a.id); img.decoding = "async";
  img.width = a.size[0]; img.height = a.size[1];
  img.style.objectFit = a.fit; img.style.objectPosition = a.focal;
  return img;
}

function makeVideo(a, id, { loop }) {
  const v = document.createElement("video");
  v.dataset.asset = id;
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute("playsinline", "");
  v.loop = loop ?? a.loop; v.preload = "auto"; v.poster = url(a.poster);
  v.setAttribute("aria-label", altText(a.id)); v.width = a.size[0]; v.height = a.size[1];
  v.style.objectFit = a.fit; v.style.objectPosition = a.focal;
  // WebM (VP9) primero, MP4 (H.264) como alternativa; si ninguna se puede reproducir, queda el fotograma fijo
  for (const [src, type] of [[a.file.replace(/\.mp4$/, ".webm"), "video/webm"], [a.file, "video/mp4"]]) {
    const so = document.createElement("source"); so.src = url(src); so.type = type; v.append(so);
  }
  v.lastElementChild.addEventListener("error", () => toPoster(v), { once: true });
  v.addEventListener("ended", () => toPoster(v), { once: true }); // termina en el fotograma fijo (ojos abiertos)
  playing.add(v);
  v.play().catch(() => toPoster(v));
  return v;
}

/** Muestra una pieza en un <figure>. Con movimiento reducido, los videos se muestran como imagen fija. */
export function show(fig, id, opts = {}) {
  clear(fig);
  const a = A[id] && { ...A[id], id }; if (!a) return;
  const media = a.type === "video" && !reduced.matches ? makeVideo(a, id, opts) : makeImg(a.type === "video" ? a.poster : a.file, a);
  if (a.type === "image") media.addEventListener("error", () => clear(fig), { once: true });
  // fotograma fijo para la impresión (en pantalla queda oculto)
  if (a.type === "video") { const pi = makeImg(a.poster, a); pi.className = "print-only"; pi.alt = ""; pi.loading = "eager"; fig.append(pi); }
  const cap = document.createElement("figcaption");
  cap.textContent = `${AUTHOR}, «${a.title}»`;
  fig.append(media, cap);
  fig.dataset.asset = id;
  fig.hidden = false;
}

export function clear(fig) {
  fig.querySelectorAll("video").forEach((v) => { v.pause(); playing.delete(v); v.replaceChildren(); v.load(); });
  fig.replaceChildren();
  fig.hidden = true;
  delete fig.dataset.asset;
}

/** Actualiza los textos alternativos de las piezas ya visibles. */
export function setLang() {
  document.querySelectorAll("figure[data-asset]").forEach((fig) => {
    const id = fig.dataset.asset;
    fig.querySelectorAll("img").forEach((i) => { i.alt = altText(id); });
    fig.querySelectorAll("video").forEach((v) => v.setAttribute("aria-label", altText(id)));
  });
}

export const reducedMotion = () => reduced.matches;
export function onReducedMotionChange(fn) { reduced.addEventListener?.("change", fn); }
