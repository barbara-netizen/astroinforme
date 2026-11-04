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

const PW = 595.28, PH = 841.89, MX = 54, MT = 50, MB = 50, W = PW - 2 * MX, ART = 165;

// obra sin recortar en una columna fija, con su crédito debajo; al lado, el título y el primer párrafo
function band(art, images, right) {
  const [w, h] = art.size, scale = Math.min(ART / w, 190 / h);
  return { columns: [
    { width: ART, stack: [{ image: images[art.file], width: w * scale, height: h * scale, margin: [0, 3, 0, 4] }, { text: art.caption, style: "caption" }] },
    { width: "*", stack: right },
  ], columnGap: 18, margin: [0, 16, 0, 10], unbreakable: true };
}

const table = (head, rows, widths) => ({
  table: { headerRows: 1, widths, body: [head.map((text) => ({ text, color: MUTED, fontSize: 8 })), ...rows] },
  layout: { hLineWidth: (i, node) => (i === 1 ? 0.6 : i === node.table.body.length ? 0.6 : 0), vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 6, paddingTop: () => 1.6, paddingBottom: () => 1.6 },
  fontSize: 9, lineHeight: 1.1,
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
  const arts = [data.entry, ...data.sections.map((s) => s.art), data.closure, data.author.art].filter(Boolean);
  const files = [...new Set(arts.map((a) => a.file))];
  const images = {};
  await Promise.all(files.map(async (f) => { images[f] = await imageData(f); }));

  const content = [
    { text: "AsterOrbis", style: "brand" },
    { text: data.title, style: "title" },
    { text: data.meta, style: "meta", margin: [0, 0, 0, 4] },
    { text: data.kind, style: "meta", margin: [0, 0, 0, 6] },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 0.6, lineColor: LINE }], margin: [0, 2, 0, 2] },
  ];
  if (data.entry) {
    const [w, h] = data.entry.size, scale = W / w;
    content.push({ image: images[data.entry.file], width: W, height: h * scale, margin: [0, 8, 0, 4] }, { text: data.entry.caption, style: "caption" });
  }
  data.sections.forEach((s) => {
    if (s.art) {
      const [first, ...rest] = s.paragraphs;
      const right = [{ text: s.heading, style: "h2", margin: [0, 0, 0, 7] }];
      if (first) right.push({ text: first, style: "p" });
      content.push(band(s.art, images, right), ...rest.map((text) => ({ text, style: "p" })));
    } else {
      content.push({ text: s.heading, style: "h2", headlineLevel: 80 }, ...s.paragraphs.map((text) => ({ text, style: "p" })));
    }
  });
  if (data.closure) {
    const [w, h] = data.closure.size, scale = Math.min(300 / w, 180 / h);
    content.push({ stack: [{ image: images[data.closure.file], width: w * scale, height: h * scale, alignment: "center", margin: [0, 0, 0, 4] }, { text: data.closure.caption, style: "caption", alignment: "center" }], margin: [0, 16, 0, 0], unbreakable: true });
  }
  const who = [{ text: data.author.h, style: "h2", margin: [0, 0, 0, 7] }, { text: data.author.body, style: "p" }, { text: data.author.mother, style: "p" }, { text: data.author.dedication, font: "Display", italics: true, fontSize: 12 }];
  content.push(data.author.art ? band(data.author.art, images, who) : { stack: who });

  // datos técnicos, en una sola página
  const half = Math.ceil(data.tech.asp.length / 2), col = (rows) => table(data.tech.aspHead, rows, ["*", 30]);
  content.push({ text: data.tech.h, style: "h2", margin: [0, 0, 0, 10], pageBreak: "before" });
  content.push({ columns: [
    { width: 215, stack: [data.tech.wheel ? { image: await wheelImage(data.tech.wheel), width: 215 } : { text: "" }, { text: data.tech.legend || "", style: "caption", alignment: "center", margin: [0, 0, 0, 6] }, { text: data.tech.angles || "", style: "meta", alignment: "center" }] },
    { width: "*", stack: [table(data.tech.posHead, data.tech.pos, data.tech.posWidths)] },
  ], columnGap: 18, margin: [0, 0, 0, 14] });
  content.push({ text: data.tech.aspectsH, style: "h3" });
  content.push({ columns: [col(data.tech.asp.slice(0, half)), data.tech.asp.length > half ? col(data.tech.asp.slice(half)) : { text: "" }], columnGap: 18, margin: [0, 0, 0, 12] });
  if (data.tech.prov) content.push({ text: data.tech.prov, fontSize: 7.5, lineHeight: 1.25, color: MUTED, margin: [0, 0, 0, 5] });
  content.push({ text: data.disclaimer, fontSize: 7.5, lineHeight: 1.25, color: MUTED, margin: [0, 0, 0, 4] });
  if (data.credit) content.push({ text: data.credit, fontSize: 7.5, color: MUTED });

  const doc = {
    pageSize: "A4", pageMargins: [MX, MT, MX, MB], content,
    info: { title: data.title, author: "Bárbara Gutiérrez", creator: "AsterOrbis", producer: "AsterOrbis" },
    defaultStyle: { font: "Body", fontSize: 10.5, lineHeight: 1.36, color: INK },
    styles: {
      brand: { font: "Display", fontSize: 11, characterSpacing: 2.2, color: MUTED, margin: [0, 0, 0, 14] },
      title: { font: "Display", fontSize: 26, lineHeight: 1.12, margin: [0, 0, 0, 8] },
      meta: { fontSize: 9, lineHeight: 1.2, color: MUTED },
      h2: { font: "Display", fontSize: 16, lineHeight: 1.15, margin: [0, 14, 0, 6] },
      h3: { font: "Display", fontSize: 13, margin: [0, 0, 0, 6] },
      p: { margin: [0, 0, 0, 6] },
      caption: { font: "Display", italics: true, fontSize: 8.5, lineHeight: 1.2, color: MUTED },
    },
    // un título nunca queda solo al pie de una página
    pageBreakBefore: (node) => !!node.headlineLevel && node.startPosition.top + node.headlineLevel > PH - MB,
    footer: (page) => (page === 1 ? null : { text: String(page), alignment: "center", fontSize: 8.5, color: MUTED, margin: [0, 20, 0, 0] }),
  };
  return new Promise((ok, fail) => {
    try { window.pdfMake.createPdf(doc).getBlob(ok); } catch (e) { fail(e); }
  });
}
