// AsterOrbis — PDF del informe, armado en el navegador con pdfmake (MIT, vendor/).
// La biblioteca y las fuentes se cargan recién cuando alguien pide el PDF. El texto queda como texto: se puede buscar y copiar.

const base = new URL(".", import.meta.url);
const INK = "#1c2230", MUTED = "#5d6573", LINE = "#c9cdc6";
const FONTS = { "bodoni-500.ttf": 1, "bodoni-500-italic.ttf": 1, "source-sans-400.ttf": 1, "source-sans-600.ttf": 1 };

let ready = null;
function loadLib() {
  if (ready) return ready;
  ready = (async () => {
    if (!window.pdfMake) await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = new URL("vendor/pdfmake-0.2.20.min.js", base).href; s.onload = ok; s.onerror = () => fail(new Error("pdf_lib"));
      document.head.append(s);
    });
    const vfs = {};
    await Promise.all(Object.keys(FONTS).map(async (f) => {
      const r = await fetch(new URL("fonts/pdf/" + f, base)); if (!r.ok) throw new Error("pdf_font");
      vfs[f] = toBase64(new Uint8Array(await r.arrayBuffer()));
    }));
    window.pdfMake.vfs = vfs;
    window.pdfMake.fonts = {
      Body: { normal: "source-sans-400.ttf", bold: "source-sans-600.ttf", italics: "source-sans-400.ttf", bolditalics: "source-sans-600.ttf" },
      Display: { normal: "bodoni-500.ttf", bold: "bodoni-500.ttf", italics: "bodoni-500-italic.ttf", bolditalics: "bodoni-500-italic.ttf" },
    };
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

function toBase64(bytes) {
  let s = ""; const n = 0x8000;
  for (let i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, i + n));
  return btoa(s);
}

async function imageData(file) {
  const r = await fetch(new URL(file, base)); if (!r.ok) throw new Error("pdf_image");
  const type = r.headers.get("content-type") || "image/jpeg";
  return `data:${type.split(";")[0]};base64,${toBase64(new Uint8Array(await r.arrayBuffer()))}`;
}

const W = 595.28 - 2 * 62; // ancho útil de A4 con márgenes de 62 pt

function figure(art, images, maxH) {
  const [w, h] = art.size, scale = Math.min(W / w, maxH / h, 1.6);
  return [
    { image: images[art.file], width: w * scale, height: h * scale, alignment: "center", margin: [0, 14, 0, 4] },
    { text: art.caption, style: "caption", alignment: "center" },
  ];
}

const table = (head, rows, widths) => ({
  table: { headerRows: 1, widths, body: [head.map((text) => ({ text, bold: true, color: MUTED })), ...rows] },
  layout: { hLineWidth: (i) => (i === 1 ? 0.8 : 0.25), vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 2, paddingBottom: () => 2 },
  fontSize: 9.5, margin: [0, 4, 0, 14],
});

// La rueda se redibuja en un lienzo con los colores del tema claro y las fuentes de glifos ya cargadas en la página.
async function wheelImage(svg) {
  const size = 1500, [vx, vy, vw] = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = size / vw;
  const texts = [...svg.querySelectorAll("text")];
  const glyphs = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("");
  await Promise.all(texts.map((el) => { const cs = getComputedStyle(el); return document.fonts.load(`${cs.fontSize} ${cs.fontFamily}`, glyphs(el)).catch(() => []); }));
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, size, size);
  x.setTransform(k, 0, 0, k, -vx * k, -vy * k);
  const root = document.documentElement, theme = root.getAttribute("data-theme");
  root.setAttribute("data-theme", "light");
  try {
    for (const el of svg.querySelectorAll("circle, line, text")) {
      const cs = getComputedStyle(el), num = (a) => +el.getAttribute(a);
      x.globalAlpha = +cs.opacity;
      if (el.tagName === "text") {
        x.fillStyle = cs.fill; x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(glyphs(el), num("x"), num("y"));
        continue;
      }
      x.strokeStyle = cs.stroke; x.lineWidth = parseFloat(cs.strokeWidth) || 1;
      x.setLineDash(cs.strokeDasharray === "none" ? [] : cs.strokeDasharray.split(/[ ,]+/).map(parseFloat));
      x.beginPath();
      if (el.tagName === "circle") x.arc(num("cx"), num("cy"), num("r"), 0, 2 * Math.PI);
      else { x.moveTo(num("x1"), num("y1")); x.lineTo(num("x2"), num("y2")); }
      x.stroke();
    }
  } finally { if (theme === null) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme); }
  return c.toDataURL("image/jpeg", 0.92);
}

/** data: ver savePdf en app.js. Devuelve un Blob. */
export async function makePdf(data) {
  await loadLib();
  const arts = [...data.sections.map((s) => s.art), data.closure, data.author.art].filter(Boolean);
  const files = [...new Set(arts.map((a) => a.file))];
  const images = {};
  await Promise.all(files.map(async (f) => { images[f] = await imageData(f); }));

  const content = [
    { text: "AsterOrbis", style: "brand" },
    { text: data.title, style: "title" },
    { text: data.meta, style: "meta" },
  ];
  data.sections.forEach((s) => {
    // imagen, título y primer párrafo van juntos: un título nunca queda solo al pie de una página
    const [first, ...rest] = s.paragraphs;
    const block = s.art ? figure(s.art, images, 300) : [];
    block.push({ text: s.heading, style: "h2" });
    if (first) block.push({ text: first, style: "p" });
    content.push({ stack: block, unbreakable: true }, ...rest.map((text) => ({ text, style: "p" })));
  });
  if (data.closure) content.push(...figure(data.closure, images, 260));

  content.push({ text: data.author.h, style: "h2", pageBreak: "before" });
  content.push({ text: data.author.body, style: "p" });
  if (data.author.art) content.push(...figure(data.author.art, images, 200));
  content.push({ text: data.author.mother, style: "p", margin: [0, 10, 0, 7] }, { text: data.author.dedication, italics: true, font: "Display", fontSize: 13, margin: [0, 2, 0, 12] });
  content.push({ text: data.disclaimer, fontSize: 9.5, color: MUTED, margin: [0, 8, 0, 8] });
  if (data.credit) content.push({ text: data.credit, fontSize: 9.5, color: MUTED });

  content.push({ text: data.tech.h, style: "h2", pageBreak: "before" });
  if (data.tech.wheel) {
    content.push({ image: await wheelImage(data.tech.wheel), width: 380, alignment: "center", margin: [0, 6, 0, 4] });
    if (data.tech.legend) content.push({ text: data.tech.legend, style: "caption", alignment: "center", margin: [0, 0, 0, 14] });
  }
  if (data.tech.angles) content.push({ text: data.tech.angles, style: "meta" });
  content.push(table(data.tech.posHead, data.tech.pos, data.tech.posWidths));
  content.push({ text: data.tech.aspectsH, style: "h3" });
  content.push(table(data.tech.aspHead, data.tech.asp, ["*", 60]));
  if (data.tech.prov) content.push({ text: data.tech.prov, fontSize: 9, color: MUTED });

  const doc = {
    pageSize: "A4", pageMargins: [62, 60, 62, 58], content,
    info: { title: data.title, author: "Bárbara Gutiérrez", creator: "AsterOrbis", producer: "AsterOrbis" },
    defaultStyle: { font: "Body", fontSize: 11.5, lineHeight: 1.32, color: INK },
    styles: {
      brand: { font: "Display", fontSize: 11, characterSpacing: 2, color: MUTED, margin: [0, 0, 0, 34] },
      title: { font: "Display", fontSize: 28, lineHeight: 1.12, margin: [0, 0, 0, 10] },
      meta: { fontSize: 10.5, color: MUTED, margin: [0, 0, 0, 14] },
      h2: { font: "Display", fontSize: 17, lineHeight: 1.15, margin: [0, 18, 0, 8] },
      h3: { font: "Display", fontSize: 13, margin: [0, 6, 0, 2] },
      p: { margin: [0, 0, 0, 7] },
      caption: { fontSize: 8.5, italics: true, color: MUTED, margin: [0, 0, 0, 4] },
    },
    footer: (page, pages) => ({ text: `AsterOrbis · ${page} / ${pages}`, alignment: "center", fontSize: 8.5, color: MUTED, margin: [0, 22, 0, 0] }),
  };
  return new Promise((ok, fail) => {
    try { window.pdfMake.createPdf(doc).getBlob(ok); } catch (e) { fail(e); }
  });
}
