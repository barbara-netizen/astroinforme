// ASTROINFORME — capa visual: obra de Bárbara Gutiérrez («cartografía íntima»).
// Portado del registro del MVP (registry.json). Las ilustraciones nunca reemplazan datos, errores ni esperas:
// si una pieza falla, su marco desaparece y la interfaz sigue igual.

export const AUTHOR = "Bárbara Gutiérrez";
export const AUTHOR_URL = "https://barbaragutierrez.art";

const A = {
  hero_levitar: { type: "image", file: "assets/01-hero-levitar.jpg", title: "Levitar", size: [918, 918], fit: "cover", focal: "50% 50%",
    alt: "Pintura de Bárbara Gutiérrez: pequeñas figuras humanas suspendidas en distintas posturas sobre un fondo negro." },
  intro_embroidery: { type: "video", file: "assets/01-portada-sone-que-bordaba.mp4", poster: "assets/01-portada-sone-que-bordaba-poster.jpg", title: "Soñé que bordaba", size: [720, 900], loop: true, fit: "cover", focal: "50% 45%",
    alt: "Animación: círculos bordados y dibujados sobre tela; figuras de mujeres aparecen y se desvanecen entre ellos." },
  analysis_neural: { type: "image", file: "assets/03-analisis-neuronales.jpg", title: "Neuronales", size: [728, 923], fit: "cover", focal: "55% 45%",
    alt: "Obra sobre pared blanca: un cerebro dibujado del que parte una red de hilos negros con pequeñas flores de colores en los nodos." },
  verification_eyes: { type: "video", file: "assets/04-verificacion-abre-los-ojos.mp4", poster: "assets/04-verificacion-abre-los-ojos-poster.jpg", title: "Abre los ojos", size: [500, 332], loop: false, fit: "contain", focal: "50% 50%",
    alt: "Animación: un rostro dibujado abre los ojos." },
  report_reader: { type: "video", file: "assets/03-generacion-informe-lectora.mp4", poster: "assets/03-generacion-informe-lectora-poster.jpg", title: "Lectora", size: [960, 540], loop: true, fit: "contain", focal: "50% 50%",
    alt: "Animación en blanco y negro: una mujer lee un libro sobre fondo negro." },
  closure_serendipity: { type: "image", file: "assets/08-cierre-serendipia-blanca.jpg", title: "Serendipia Blanca", size: [1134, 577], fit: "cover", focal: "60% 35%",
    alt: "Pintura: una mujer de vestido blanco vuela con los brazos extendidos sobre un cielo celeste con nubes." },
  identity_biographies: { type: "image", file: "assets/04-identidad-biografias.jpg", title: "Biografías", size: [966, 919], fit: "contain", focal: "50% 50%",
    alt: "Pintura cartográfica: dos rostros enlazados por un mapa rosado con recorridos, corazones y la inscripción «Y entremedio, la vida misma»." },
  emotional_dream: { type: "image", file: "assets/06-mundo-emocional-sueno-contigo.jpg", title: "Sueño Contigo", size: [1210, 894], fit: "cover", focal: "40% 55%",
    alt: "Pintura: una mujer dormida con la cabeza apoyada; sobre ella, un grupo de pequeñas figuras de pie." },
  boundaries_wire: { type: "image", file: "assets/07-limites-glamur-alambre.jpg", title: "Glamur Atado con Alambre", size: [720, 556], fit: "cover", focal: "50% 50%",
    alt: "Pintura de tonos claros: pequeñas figuras de mujeres con vestidos, unidas por líneas que trazan recorridos." },
  texture_purple: { type: "image", file: "assets/09-textura-moradotas.jpg", title: "Moradotas", size: [1210, 908], fit: "cover", focal: "50% 50%",
    alt: "Pintura de flores lilas de pétalos rayados sobre fondo amarillo." },
  brand_guardian: { type: "image", file: "assets/02-marca-guardian-del-universo.jpg", title: "Guardián del Universo", size: [604, 460], fit: "contain", focal: "50% 35%",
    alt: "Papel calado verde agua con una figura masculina tendida con los brazos abiertos; abajo, la inscripción «el guardián del universo»." },
  relationships_venus: { type: "video", file: "assets/05-vinculos-venus-angel.mp4", poster: "assets/05-vinculos-venus-angel-poster.jpg", title: "Venus Angel", size: [720, 720], loop: false, fit: "cover", focal: "50% 40%",
    alt: "Animación: una estatua alada se transforma en una figura femenina de cabello dorado con alas." },
  emotional_swimmers: { type: "video", file: "assets/06-emocional-nadadoras.mp4", poster: "assets/06-emocional-nadadoras-poster.jpg", title: "Nadadoras", size: [720, 720], loop: true, fit: "cover", focal: "50% 60%",
    alt: "Animación: figuras de nadadoras en tonos rosados y naranjas, con una textura de manchas en movimiento." },
};

// Ilustración temática por sección del informe (ids del contrato astroinforme.report/v1).
// Dentro del informe las animaciones se reproducen una vez y quedan en su fotograma fijo.
export const SECTION_ART = {
  identity: "identity_biographies", emotional: "emotional_dream", saturn: "boundaries_wire",
  relationships: "relationships_venus", roots: "texture_purple", neptune: "emotional_swimmers", myth: "brand_guardian",
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
  const a = A[v.dataset.asset];
  const img = makeImg(a.poster, a);
  v.replaceWith(img);
}

function makeImg(src, a) {
  const img = document.createElement("img");
  img.src = url(src); img.alt = a.alt; img.decoding = "async";
  img.width = a.size[0]; img.height = a.size[1];
  img.style.objectFit = a.fit; img.style.objectPosition = a.focal;
  return img;
}

function makeVideo(a, id, { loop }) {
  const v = document.createElement("video");
  v.dataset.asset = id;
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute("playsinline", "");
  v.loop = loop ?? a.loop; v.preload = "auto"; v.poster = url(a.poster);
  v.setAttribute("aria-label", a.alt); v.width = a.size[0]; v.height = a.size[1];
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
  const a = A[id]; if (!a) return;
  const media = a.type === "video" && !reduced.matches ? makeVideo(a, id, opts) : makeImg(a.type === "video" ? a.poster : a.file, a);
  if (a.type === "image") media.addEventListener("error", () => clear(fig), { once: true });
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

export const reducedMotion = () => reduced.matches;
export function onReducedMotionChange(fn) { reduced.addEventListener?.("change", fn); }
