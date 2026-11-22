// AsterOrbis — auditoría de la prosa (versión 1, solo español).
//
// La auditoría técnica (audit.js) verifica lo que el informe DECLARA en technical_references_used. Este control lee
// el TEXTO: busca afirmaciones técnicas escritas en la prosa y las compara con la carta calculada, aunque el informe
// no las haya declarado. Además detecta cinco familias de problemas de redacción:
//   1. hechos biográficos afirmados sin modulación (padre, madre, infancia, trauma…);
//   2. densidad de jerga astrológica y párrafos que empiezan por el dato técnico en lugar de la experiencia;
//   3. modismos y muletillas propios de los textos generados (lista cerrada, ampliable);
//   4. enumeraciones acumulativas, palabras sobreusadas, aperturas de párrafo repetidas y frases repetidas
//      dentro del mismo informe;
//   5. repetición entre informes: frases de siete palabras ya usadas en informes recientes (huellas hasheadas,
//      sin texto ni datos de personas).
//
// Es determinista y no gasta crédito. No juzga la verdad psicológica de una interpretación. Un falso positivo solo
// provoca una revisión en la fase C; nunca bloquea la entrega. Solo marca para corregir lo que supera los umbrales
// de THRESHOLDS; el resto queda registrado.

export const PROSE_AUDIT_VERSION = "1";

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ------------------------------------------------------------------ vocabulario técnico
const PLANETS = { sol: "SUN", luna: "MOON", mercurio: "MERCURY", venus: "VENUS", marte: "MARS", jupiter: "JUPITER", saturno: "SATURN", urano: "URANUS", neptuno: "NEPTUNE", pluton: "PLUTO", quiron: "CHIRON", "nodo norte": "NORTH_NODE" };
const SIGNS = { aries: "ARIES", tauro: "TAURUS", geminis: "GEMINI", cancer: "CANCER", leo: "LEO", virgo: "VIRGO", libra: "LIBRA", escorpio: "SCORPIO", escorpion: "SCORPIO", sagitario: "SAGITTARIUS", capricornio: "CAPRICORN", acuario: "AQUARIUS", piscis: "PISCES" };
const ANGLES = { ascendente: "ASC", descendente: "DSC", "medio cielo": "MC", "fondo del cielo": "IC", "fondo de cielo": "IC" };
const ASPECTS = { conjuncion: "CONJUNCTION", oposicion: "OPPOSITION", cuadratura: "SQUARE", trigono: "TRINE", sextil: "SEXTILE", quincuncio: "QUINCUNX" };
const NUM = { uno: 1, una: 1, primera: 1, dos: 2, segunda: 2, tres: 3, tercera: 3, cuatro: 4, cuarta: 4, cinco: 5, quinta: 5, seis: 6, sexta: 6, siete: 7, septima: 7, setima: 7, ocho: 8, octava: 8, nueve: 9, novena: 9, diez: 10, decima: 10, once: 11, undecima: 11, doce: 12, duodecima: 12 };
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const OPPOSITE_ANGLE = { DSC: "ASC", IC: "MC" };

const alt = (o) => Object.keys(o).sort((a, b) => b.length - a.length).join("|");
const P = alt(PLANETS), S = alt(SIGNS), A = alt(ANGLES), X = alt(ASPECTS);
const PT = `(?:${P}|${A})`;
const HOUSE_NUM = `(\\d{1,2}|${alt(NUM)}|${alt(ROMAN)})`;
const toHouse = (s) => { const n = /^\d+$/.test(s) ? +s : NUM[s] ?? ROMAN[s]; return n >= 1 && n <= 12 ? n : null; };
const idOf = (w) => PLANETS[w] || ANGLES[w] || null;

const TECH_RE = new RegExp(`\\b(?:${P}|${S}|${A}|${X}|casas?|regente|regencia|stellium|retrogrado|orbe|aspecto|hemisferio|cuspide|nodo)\\b`, "g");
const techCount = (plain) => (plain.match(TECH_RE) || []).length;
const TECH_ONE = new RegExp(`^(?:${TECH_RE.source})$`);

// ------------------------------------------------------------------ texto
function paragraphsOf(report) {
  const out = [];
  for (const s of report.sections || []) {
    const id = (s && s.id) || "";
    for (const p of String((s && s.body_markdown) || "").split(/\n\s*\n/)) if (p.trim()) out.push({ section: id, text: p.trim() });
  }
  return out;
}
const sentencesOf = (t) => t.split(/(?<=[.!?…])\s+(?=[«"¿¡A-ZÁÉÍÓÚÑ])/);
const short = (t, n = 140) => (t.length > n ? t.slice(0, n - 1) + "…" : t).replace(/\s+/g, " ");

// ------------------------------------------------------------------ 1. afirmaciones técnicas en la prosa
function chartIndex(payload) {
  const c = payload.chart || {};
  const bodies = Object.fromEntries((c.bodies || []).map((b) => [b.id, b]));
  const unreliable = new Set((c.sensitivity && c.sensitivity.unreliable || []).map((u) => `${u.item}|${u.field}`));
  const asp = new Map();
  for (const a of c.aspects || []) { asp.set(`${a.a}|${a.b}`, a); asp.set(`${a.b}|${a.a}`, a); }
  const angleSign = {};
  if (c.houses) {
    const sign = (lon) => ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"][Math.floor((((lon % 360) + 360) % 360) / 30)];
    angleSign.ASC = sign(c.houses.asc); angleSign.DSC = sign(c.houses.asc + 180); angleSign.MC = sign(c.houses.mc); angleSign.IC = sign(c.houses.mc + 180);
  }
  const angular = (c.derived && c.derived.angular) || [];
  return { bodies, asp, angleSign, angular, timeKnown: !!c.houses, unreliable };
}

function findAspect(ix, a, b, type) {
  const direct = ix.asp.get(`${a}|${b}`);
  if (direct && direct.aspect === type) return direct;
  // conjunción con DSC/IC = oposición con ASC/MC, y viceversa
  const flip = { CONJUNCTION: "OPPOSITION", OPPOSITION: "CONJUNCTION" }[type];
  for (const [p, q] of [[a, b], [b, a]]) if (OPPOSITE_ANGLE[q] && flip) {
    const r = ix.asp.get(`${p}|${OPPOSITE_ANGLE[q]}`);
    if (r && r.aspect === flip) return r;
  }
  if (type === "SQUARE") for (const [p, q] of [[a, b], [b, a]]) if (OPPOSITE_ANGLE[q]) {
    const r = ix.asp.get(`${p}|${OPPOSITE_ANGLE[q]}`); if (r && r.aspect === "SQUARE") return r;
  }
  return null;
}

function declaredSet(report) {
  const s = new Set();
  for (const r of report.technical_references_used || []) {
    if (!r) continue;
    if (r.type === "position") { s.add(`pos|${r.body}|${r.sign}`); if (r.house != null) s.add(`house|${r.body}|${r.house}`); }
    if (r.type === "angle") s.add(`angle|${r.angle}|${r.sign}`);
    if (r.type === "aspect") { s.add(`asp|${r.a}|${r.b}|${r.aspect}`); s.add(`asp|${r.b}|${r.a}|${r.aspect}`); }
  }
  return s;
}

const POS_RE = new RegExp(`\\b(${P})\\b(?:\\s+(?:natal|retrogrado|que esta|esta|estaba|queda|cae))?\\s+en\\s+(?:el\\s+signo\\s+de\\s+)?(${S})\\b`, "g");
const ANGLE_SIGN_RE = new RegExp(`\\b(${A})\\b(?:\\s+(?:esta|cae|queda))?\\s+en\\s+(${S})\\b`, "g");
const HOUSE_RE = new RegExp(`\\b(${P})\\b([^.;:!?]{0,60}?)\\b(?:en\\s+(?:la\\s+|tu\\s+)?)?casa\\s+${HOUSE_NUM}\\b`, "g");
const HOUSE_ORD_RE = new RegExp(`\\b(${P})\\b([^.;:!?]{0,60}?)\\ben\\s+(?:la\\s+|tu\\s+)?(${alt(NUM)})\\s+casa\\b`, "g");
const ASP1_RE = new RegExp(`\\b(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:entre|de|del|de\\s+la|con)\\s+(?:tu\\s+|el\\s+|la\\s+)?(${PT})\\s+(?:y|con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
const ASP2_RE = new RegExp(`\\b(${PT})\\b\\s+(?:esta\\s+|forma\\s+|hace\\s+|queda\\s+)?(?:en\\s+|una\\s+|un\\s+)?(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
const ASP3_RE = new RegExp(`\\b(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
const PT_ANY = new RegExp(`\\b(${PT})\\b`, "g");
const ANGULAR_RE = new RegExp(`\\b(${P})\\b[^.;:!?]{0,40}?\\b(?:junto\\s+al?|sobre\\s+el|pegad[oa]\\s+al?|cerca\\s+del?|encima\\s+del?)\\s+(${A})\\b`, "g");
const HOUSE_WORD_RE = /\bcasas?\b|\bascendente\b|\bmedio cielo\b|\bdescendente\b|\bfondo del cielo\b/;
const BETWEEN_OTHER = new RegExp(`\\b(?:${P})\\b`);

function claimCheck(report, payload) {
  const ix = chartIndex(payload);
  const declared = declaredSet(report);
  const errors = [], undeclared = [], doubtful = [];
  let checked = 0;
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const plain = strip(text);
    const add = (list, kind, detail, key) => list.push({ section, kind, detail, excerpt: key });
    if (!ix.timeKnown && HOUSE_WORD_RE.test(plain)) add(errors, "time_unknown", "con hora desconocida no hay casas ni ángulos", short(text));
    let m;
    POS_RE.lastIndex = 0;
    while ((m = POS_RE.exec(plain))) {
      const id = PLANETS[m[1]], sign = SIGNS[m[2]], b = ix.bodies[id]; checked++;
      if (!b) continue;
      if (b.sign !== sign) add(errors, "sign", `${m[1]} está en ${b.sign}, no en ${sign}`, m[0]);
      else { if (ix.unreliable.has(`${id}|sign`)) add(doubtful, "sign", `${m[1]}: signo sensible a la hora`, m[0]); if (!declared.has(`pos|${id}|${sign}`)) add(undeclared, "position", `${id} ${sign}`, m[0]); }
    }
    ANGLE_SIGN_RE.lastIndex = 0;
    while (ix.timeKnown && (m = ANGLE_SIGN_RE.exec(plain))) {
      const id = ANGLES[m[1]], sign = SIGNS[m[2]]; checked++;
      if (ix.angleSign[id] !== sign) add(errors, "angle", `${m[1]} está en ${ix.angleSign[id]}, no en ${sign}`, m[0]);
    }
    for (const re of [HOUSE_RE, HOUSE_ORD_RE]) {
      re.lastIndex = 0;
      while (ix.timeKnown && (m = re.exec(plain))) {
        if (BETWEEN_OTHER.test(m[2]) || /\bregente\b|\brige\b|\bgobierna\b|\bcuspide\b/.test(m[2])) continue; // la casa puede pertenecer a otro planeta o ser una regencia
        const id = PLANETS[m[1]], h = toHouse(m[3]), b = ix.bodies[id]; checked++;
        if (!b || h == null) continue;
        if (b.house !== h) add(errors, "house", `${m[1]} está en la casa ${b.house}, no en la ${h}`, m[0]);
        else { if (b.reliable === false || ix.unreliable.has(`${id}|house`)) add(doubtful, "house", `${m[1]}: casa sensible a la hora`, m[0]); if (!declared.has(`house|${id}|${h}`)) add(undeclared, "house", `${id} casa ${h}`, m[0]); }
      }
    }
    const used = new Set();
    const subjectBefore = (end) => { // sujeto probable: primer planeta o ángulo de la oración («Mercurio forma un trígono con Urano y un sextil con Júpiter»)
      const start = Math.max(plain.lastIndexOf(".", end), plain.lastIndexOf(";", end), plain.lastIndexOf("?", end), plain.lastIndexOf("!", end)) + 1;
      PT_ANY.lastIndex = 0; const mm = PT_ANY.exec(plain.slice(start, end));
      return mm ? mm[1] : null;
    };
    for (const re of [ASP1_RE, ASP2_RE, ASP3_RE]) {
      re.lastIndex = 0;
      while ((m = re.exec(plain))) {
        const word = re === ASP2_RE ? m[2] : m[1], at = m.index + m[0].indexOf(word, re === ASP2_RE ? m[1].length : 0);
        if (re === ASP3_RE && used.has(at)) continue;
        used.add(at);
        const [type, a, b] = re === ASP1_RE ? [ASPECTS[m[1]], idOf(m[2]), idOf(m[3])] : re === ASP2_RE ? [ASPECTS[m[2]], idOf(m[1]), idOf(m[3])] : [ASPECTS[m[1]], idOf(subjectBefore(m.index) || ""), idOf(m[2])];
        if (!a || !b || a === b) continue;
        if (!ix.timeKnown && (ANGLES[strip(a)] || ["ASC", "DSC", "MC", "IC"].includes(a) || ["ASC", "DSC", "MC", "IC"].includes(b))) continue; // ya marcado arriba
        checked++;
        const found = findAspect(ix, a, b, type);
        if (!found) add(errors, "aspect", `no hay ${type} calculado entre ${a} y ${b}`, m[0]);
        else { if (found.reliable === false) add(doubtful, "aspect", `${a}-${b}: aspecto sensible a la hora`, m[0]); if (!declared.has(`asp|${found.a}|${found.b}|${found.aspect}`)) add(undeclared, "aspect", `${a} ${type} ${b}`, m[0]); }
      }
    }
    ANGULAR_RE.lastIndex = 0;
    while (ix.timeKnown && (m = ANGULAR_RE.exec(plain))) {
      const id = PLANETS[m[1]], ang = ANGLES[m[2]]; checked++;
      const near = ix.angular.some((x) => x.body === id && x.angle === ang) || findAspect(ix, id, ang, "CONJUNCTION");
      if (!near) add(errors, "angular", `${m[1]} no está junto al ${m[2]} en la carta calculada`, m[0]);
    }
  }
  return { checked, errors, undeclared, doubtful };
}

// ------------------------------------------------------------------ 2. biografía afirmada como hecho
const BIO_RE = /\b(tu (?:padre|madre|papa|mama|abuel[oa]|herman[oa])|tus (?:padres|abuelos|hermanos)|tu infancia|tu ninez|de (?:chica|chico|nina|nino|pequen[oa])|cuando eras (?:chica|chico|nina|nino|pequen[oa])|en tu casa de origen|tu familia de origen|traumas?|traumatic[oa]s?|abus(?:o|aron)|te abandonaron|divorcio de tus padres|separacion de tus padres|duelo por)\b/;
const HEDGE_RE = /\b(puede|pueden|podria|podrian|pudo|pudieron|quiza|quizas|tal vez|acaso|posible|posiblemente|probablemente|parece|pareciera|si |preguntarte|pregunta|imagen|simbolic|vale preguntarse|solo vos|no lo sabe|no puede saber|depende de tu historia)\b|\?/;

function biographyCheck(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    for (const s of sentencesOf(text)) { const p = strip(s); if (BIO_RE.test(p) && !HEDGE_RE.test(p)) out.push({ section, excerpt: short(s) }); }
  }
  return out;
}

// ------------------------------------------------------------------ 3. jerga
function jargonCheck(report) {
  let words = 0, terms = 0;
  const dense = [], techOpenings = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const plain = strip(text);
    const w = plain.split(/\s+/).filter(Boolean).length, t = techCount(plain);
    words += w; terms += t;
    if (t >= THRESHOLDS.termsPerParagraph) dense.push({ section, terms: t, excerpt: short(text, 100) });
    const first = sentencesOf(text)[0] || "";
    if (techCount(strip(first.split(/\s+/).slice(0, 6).join(" "))) >= 1 && techCount(strip(first)) >= 2) techOpenings.push({ section, excerpt: short(first, 100) });
  }
  return { words, terms, per1000: words ? +(terms * 1000 / words).toFixed(1) : 0, dense, techOpenings };
}

// ------------------------------------------------------------------ 4. vicios de redacción
// Modismos y muletillas: cualquier aparición se registra; se pide corrección si superan THRESHOLDS.idioms.
const IDIOMS = [
  /\bno es (?:casual|casualidad|menor|poca cosa)\b/, /\bcabe (?:destacar|senalar|mencionar|preguntarse)\b/, /\b(?:es|resulta) (?:importante|fundamental|clave) (?:senalar|destacar|notar|entender|reconocer)\b/,
  /\bvale la pena (?:senalar|destacar|notar|detenerse)\b/, /\ben definitiva\b/, /\ben ultima instancia\b/, /\ba fin de cuentas\b/, /\bde alguna manera\b/, /\bde algun modo\b/,
  /\ben cierto sentido\b/, /\balgo asi como\b/, /\bpor asi decirlo\b/, /\bdicho de otro modo\b/, /\ben otras palabras\b/, /\ben esencia\b/, /\bsin duda\b/, /\bpor supuesto\b/,
  /\b(?:un|el) delicado equilibrio\b/, /\b(?:una|la) danza\b/, /\btapiz\b/, /\bnavegar\b/, /\bbrujula\b/, /\bfaro\b/, /\bmotor (?:interno|interior)\b/, /\btelon de fondo\b/,
  /\bla clave (?:esta|es|reside)\b/, /\bel (?:gran )?desafio (?:es|esta|consiste|sera)\b/, /\b(?:una|la) invitacion a\b/, /\bte invita a\b/, /\bpotencial (?:enorme|inmenso)\b/,
  /\bprofundamente\b/, /\bgenuin[oa]s?\b/, /\bautentic[oa]s?\b/, /\bresuen(?:a|an)\b/, /\bflorec(?:er|e|en)\b/, /\btransitar\b/, /\bespacio seguro\b/,
  /\blo que (?:verdaderamente|realmente) importa\b/, /\bni mas ni menos\b/, /\bal fin y al cabo\b/, /\bmas alla de\b/, /\bpoderos[oa]s?\b/, /\bfascinante\b/,
  /\bcomplej[oa] y ric[oa]\b/, /\bric[oa] y complej[oa]\b/, /\bmuy (?:especial|interesante|particular)\b/, /\bun viaje\b/, /\bun camino de\b/,
];
const NOT_ONLY = /\bno (?:solo|solamente)\b[^.;:!?]{1,80}\bsino (?:tambien|ademas)\b/g;
// Palabras vacías para el recuento de repeticiones.
const STOP = new Set("a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bajo bien cada casi como con contra cual cuales cuando cuanto de del desde donde dos el ella ellas ellos en entre era eres es esa esas ese eso esos esta estas este esto estos estar fue ha hace hacia han hasta hay la las le les lo los mas me mi mientras mis mismo muy nada ni no nos o otra otras otro otros para pero poco por porque puede pueden que quien se sea ser si sin sino sobre solo son su sus tambien tan tanto te tener tiene tienen toda todas todo todos tu tus un una unas uno unos vos y ya cuya cuyo ese esta parte forma vez lado modo manera".split(" "));

function enumerationCheck(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    // listas «a, b, c y d»: tres o más elementos cortos, separados por comas y cerrados con «y» u «o»
    const re = /((?:[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2},\s+){2,}[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2}\s+(?:y|o|ni)\s+[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2})/g;
    let m;
    while ((m = re.exec(text))) {
      const items = m[1].split(/,\s+|\s+(?:y|o|ni)\s+/).filter(Boolean);
      if (items.length < 3) continue;
      // solo listas de forma pareja: casi todos los elementos de una palabra, o todos (salvo el primero) con el mismo arranque
      const first = (x) => strip(x.split(/\s+/)[0]).replace(/^al$/, "a").replace(/^del$/, "de");
      const singles = items.filter((x) => !/\s/.test(x)).length;
      const starts = new Set(items.slice(1).map(first));
      if (singles >= items.length - 1 || (starts.size === 1 && !["y", "o", "ni", "que"].includes([...starts][0]))) out.push({ section, items: items.length, excerpt: short(m[1], 120) });
    }
  }
  return out;
}

function repetitionWithin(report) {
  const paras = paragraphsOf(report).filter((p) => p.section !== "myth");
  const tokens = paras.map((p) => strip(p.text).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean));
  const all = tokens.flat();
  // palabras de contenido sobreusadas (sin términos técnicos)
  const freq = new Map();
  for (const w of all) if (w.length >= 5 && !STOP.has(w) && !TECH_ONE.test(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const overused = [...freq].filter(([, n]) => n >= THRESHOLDS.overusedMin && n * 1000 / Math.max(all.length, 1) >= THRESHOLDS.overusedPer1000).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));
  // frases de cinco palabras que se repiten dentro del informe
  const grams = new Map();
  for (const t of tokens) for (let i = 0; i + 5 <= t.length; i++) {
    const g = t.slice(i, i + 5); if (g.filter((w) => !STOP.has(w)).length < 2) continue;
    const k = g.join(" "); grams.set(k, (grams.get(k) || 0) + 1);
  }
  const phrases = [...grams].filter(([, n]) => n >= 2).map(([phrase, count]) => ({ phrase, count })).slice(0, 10);
  // aperturas de párrafo repetidas (dos primeras palabras)
  const op = new Map();
  for (const t of tokens) if (t.length >= 2) { const k = t.slice(0, 2).join(" "); op.set(k, (op.get(k) || 0) + 1); }
  const openings = [...op].filter(([, n]) => n >= 3).map(([opening, count]) => ({ opening, count }));
  return { overused, phrases, openings };
}

function idiomCheck(report) {
  const hits = [];
  for (const { section, text } of paragraphsOf(report)) {
    const p = strip(text);
    for (const re of IDIOMS) { const m = p.match(re); if (m) hits.push({ section, idiom: m[0] }); }
    NOT_ONLY.lastIndex = 0; let m; while ((m = NOT_ONLY.exec(p))) hits.push({ section, idiom: "no solo… sino también" });
  }
  return hits;
}

// ------------------------------------------------------------------ 5. repetición entre informes
// Huella: hash de 32 bits de cada frase de siete palabras con al menos tres palabras de contenido y como mucho una
// palabra técnica (las frases técnicas se repiten con razón entre cartas parecidas). Se guarda una muestra (1 de 3).
const SHINGLE = 7;
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shingles(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const t = strip(text).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean);
    for (let i = 0; i + SHINGLE <= t.length; i++) {
      const g = t.slice(i, i + SHINGLE), k = g.join(" ");
      if (g.filter((w) => !STOP.has(w)).length < 3 || techCount(k) > 1 || /\d/.test(k)) continue; // las cifras no son frases
      out.push({ phrase: k, h: hash32(k) });
    }
  }
  return out;
}
export function fingerprint(report) {
  return [...new Set(shingles(report).map((s) => s.h).filter((h) => h % 3 === 0))];
}
/** recent = [[hash,…], …] de informes anteriores. Devuelve frases de este informe ya usadas en alguno. */
export function crossRepetition(report, recent) {
  const seen = new Map();
  (recent || []).forEach((fp) => { for (const h of fp || []) seen.set(h, (seen.get(h) || 0) + 1); });
  const shared = [], done = new Set();
  for (const s of shingles(report)) if (s.h % 3 === 0 && seen.has(s.h) && !done.has(s.h)) { done.add(s.h); shared.push({ phrase: s.phrase, reports: seen.get(s.h) }); }
  return shared;
}

// ------------------------------------------------------------------ mitos
const MYTH_STOP = new Set(["y", "e", "el", "la", "los", "las", "de", "del", "su", "sus", "en", "a", "con", "mito", "hermana", "hermano", "hijo", "hija", "padre", "madre"]);
const mythTokens = (name) => new Set(strip(String(name || "")).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !MYTH_STOP.has(w)));
/** Devuelve el mito reciente con el que coincide (por nombre propio compartido) o null. */
export function repeatedMyth(name, recent) {
  const a = mythTokens(name);
  if (!a.size) return null;
  for (const r of recent || []) for (const w of mythTokens(r)) if (a.has(w)) return r;
  return null;
}

// ------------------------------------------------------------------ resultado
// ------------------------------------------------------------------ 6. recuentos por elemento y modalidad (2.6.1)
// «casi todo en signos fijos», «solo un factor cardinal», «predominio del fuego»: se comparan con chart.derived.
// Se acepta la afirmación si es cierta contando solo planetas o planetas y ángulos.
const GROUP_TERMS = [
  ["MODALITY", "FIXED", /\bsignos? (?:fij[oa]s?|de (?:la )?constancia|de (?:la )?estabilidad)\b|\b(?:lo|la modalidad) fij[oa]\b/],
  ["MODALITY", "CARDINAL", /\bsignos? (?:cardinal(?:es)?|de (?:la )?iniciativa|que inician|de inicio)\b|\b(?:lo|la modalidad) cardinal\b/],
  ["MODALITY", "MUTABLE", /\bsignos? (?:mutables?|de (?:la )?adaptacion)\b|\b(?:lo|la modalidad) mutable\b/],
  ["ELEMENT", "FIRE", /\b(?:signos? de |el |del |poco |mucho |muy poco )fuego\b/],
  ["ELEMENT", "EARTH", /\b(?:signos? de |la |de la |poca |mucha |muy poca )tierra\b/],
  ["ELEMENT", "AIR", /\b(?:signos? de |el |del |poco |mucho |muy poco )aire\b/],
  ["ELEMENT", "WATER", /\b(?:signos? de |el |del |poca |mucha |muy poca )agua\b/],
];
const Q_MOST = /\b(casi tod[oa]s?|la mayoria|la mayor parte|predomin\w*|abunda\w*|domina\w*)\b/;
const Q_ONE = /\b(solo (?:un|una|uno)|un unico|una unica|uno solo|una sola|unico factor|unico planeta)\b/;
const Q_NONE = /\b(ningun\w*|no hay (?:planetas?|factores?|nada) en)\b/;
const Q_FEW = /\b(muy poc[oa]s?|escas[oa]s?|casi no hay|casi nada de)\b/;
const ANGLE_IDS = new Set(["ASC", "MC", "DSC", "IC"]);
function countClaims(report, payload) {
  const d = (payload.chart && payload.chart.derived) || {};
  const errors = [];
  let checked = 0;
  const counts = (group, key) => {
    const src = group === "ELEMENT" ? d.elements : d.modalities;
    if (!src) return null;
    const all = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.length]));
    const pl = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.filter((x) => !ANGLE_IDS.has(x)).length]));
    return [all, pl];
  };
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    for (const sent of sentencesOf(text)) {
      const p = strip(sent);
      const hits = GROUP_TERMS.filter(([, , re]) => re.test(p));
      if (hits.length !== 1) continue; // varias familias en la misma oración: ambiguo, no se juzga
      const [group, key] = hits[0];
      const c = counts(group, key); if (!c) continue;
      const kind = Q_ONE.test(p) ? "one" : Q_NONE.test(p) ? "none" : Q_MOST.test(p) ? "most" : Q_FEW.test(p) ? "few" : null;
      if (!kind) continue;
      checked++;
      const ok = c.some((m) => {
        const n = m[key] || 0, total = Object.values(m).reduce((a, b) => a + b, 0), max = Math.max(...Object.values(m));
        return kind === "one" ? n === 1 : kind === "none" ? n === 0 : kind === "few" ? n <= 2 : n > total / 2 || (/predomin|domina/.test(p) && n === max);
      });
      if (!ok) errors.push({ section, kind: "count", detail: `recuento: ${group === "ELEMENT" ? "elemento" : "modalidad"} ${key} = ${c[1][key] || 0} planetas (${c[0][key] || 0} con ángulos)`, excerpt: short(sent) });
    }
  }
  return { checked, errors };
}

// ------------------------------------------------------------------ 7. plantilla visible (2.6.1)
// El análisis previo pide mecanismo, defensa, costo, recurso y lectura alternativa; contarlos en cada sección deja la
// estructura a la vista. Se cuentan las marcas de esa plantilla en todo el informe (sin el mito).
const TEMPLATE = {
  questions: { max: 3, re: null },
  alternatives: { max: 2, re: /\b(otra lectura|admite (?:otra|una) lectura|lectura alternativa|lectura mas amable|tambien puede leerse|otra forma de leer)\b/g },
  defenses: { max: 2, re: /\bla defensa (?:mas )?(?:probable|tipica|natural|habitual|frecuente)\b/g },
  costs: { max: 2, re: /\bel costo (?:es|son|posible|puede|de esa|de esta)\b|\bsu costo\b/g },
  closers: { max: 2, re: /\b(?:sostiene (?:esta|esa) lectura|sostiene ese lado|es su fuente|condensa (?:esa|la|este|ese) \w+|une esas dos ideas|lo indica|lo sugiere(?:n)?)\b/g },
};
function templateCheck(report) {
  const out = { questions: 0, alternatives: 0, defenses: 0, costs: 0, closers: 0 };
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    out.questions += (text.match(/\?/g) || []).length;
    const p = strip(text);
    for (const k of ["alternatives", "defenses", "costs", "closers"]) out[k] += (p.match(TEMPLATE[k].re) || []).length;
  }
  out.over = Object.keys(out).filter((k) => TEMPLATE[k] && out[k] > TEMPLATE[k].max);
  return out;
}

export const THRESHOLDS = {
  termsPerParagraph: 5, // un párrafo con cinco o más términos técnicos es denso
  jargonPer1000: 20, // por encima, se pide bajar la jerga (la guía v4 dio 11,5 a 17,8)
  densePara: 3, techOpenings: 4,
  idioms: 3, notOnly: 1, enumerations: 5, overusedMin: 9, overusedPer1000: 3.5, repeatedPhrases: 2, repeatedOpenings: 1,
  crossShared: 3, // frases de siete palabras compartidas con informes recientes
};

/** Devuelve { ok, claims, biography, jargon, idioms, enumerations, within, cross, fix: [motivos que piden corrección] }. */
export function proseAudit(report, payload, recentPrints = []) {
  const claims = claimCheck(report, payload);
  const biography = biographyCheck(report);
  const jargon = jargonCheck(report);
  const idioms = idiomCheck(report);
  const enumerations = enumerationCheck(report);
  const within = repetitionWithin(report);
  const cross = crossRepetition(report, recentPrints);
  const counts = countClaims(report, payload);
  if (counts.errors.length) { claims.errors.push(...counts.errors); claims.checked += counts.checked; } else claims.checked += counts.checked;
  const template = templateCheck(report);
  const fix = [];
  if (claims.errors.length) fix.push("claims");
  if (biography.length) fix.push("biography");
  // la jerga se registra pero no dispara la reescritura completa (decisión del 22-nov: tiempo y costo); la redacción ya la limita
  const notes = [];
  if (jargon.per1000 > THRESHOLDS.jargonPer1000 || jargon.dense.length >= THRESHOLDS.densePara || jargon.techOpenings.length >= THRESHOLDS.techOpenings) notes.push("jargon");
  if (idioms.length >= THRESHOLDS.idioms || idioms.filter((i) => i.idiom.startsWith("no solo")).length > THRESHOLDS.notOnly) fix.push("idioms");
  if (enumerations.length >= THRESHOLDS.enumerations) fix.push("enumerations");
  if (within.phrases.length >= THRESHOLDS.repeatedPhrases || within.openings.length >= THRESHOLDS.repeatedOpenings || within.overused.length) fix.push("repetition");
  if (cross.length >= THRESHOLDS.crossShared) fix.push("cross_repetition");
  if (template.over.length) fix.push("template");
  return { version: PROSE_AUDIT_VERSION, ok: fix.length === 0, claims, biography, jargon, idioms, enumerations, within, cross, template, fix, notes };
}

/** Texto para la fase C: solo los motivos que superaron el umbral. */
export function describeProse(r) {
  const out = [], ex = (list, f, n = 5) => list.slice(0, n).map((x) => `  «${f(x)}»`).join("\n");
  if (r.fix.includes("claims")) out.push(`- El texto afirma datos técnicos que no coinciden con la carta calculada. Corregí o quitá cada uno:\n${r.claims.errors.slice(0, 8).map((e) => `  ${e.detail} — «${e.excerpt}»`).join("\n")}`);
  if (r.fix.includes("biography")) out.push(`- Estas oraciones presentan como hecho algo de la biografía que la carta no puede saber. Reformulalas como posibilidad o pregunta, o quitalas:\n${ex(r.biography, (b) => b.excerpt)}`);
  if (r.fix.includes("jargon")) out.push(`- Hay demasiada jerga astrológica (${r.jargon.per1000} términos cada mil palabras; objetivo: 15 o menos). En cada párrafo, primero la experiencia; el dato técnico, como mucho una vez y al final, solo si sostiene la idea. Párrafos más cargados:\n${ex(r.jargon.dense.concat(r.jargon.techOpenings), (d) => d.excerpt)}`);
  if (r.fix.includes("idioms")) out.push(`- Muletillas y modismos de texto genérico (${r.idioms.length}): ${[...new Set(r.idioms.map((i) => i.idiom))].slice(0, 10).join(", ")}. Reemplazalos por una formulación precisa o eliminalos sin sustituto.`);
  if (r.fix.includes("enumerations")) out.push(`- Hay ${r.enumerations.length} enumeraciones de tres o más elementos. Dejá solo las que nombran cosas distintas y concretas de esta carta; las demás, reducilas a lo que de verdad dice algo:\n${ex(r.enumerations, (e) => e.excerpt)}`);
  if (r.fix.includes("repetition")) {
    const parts = [];
    if (r.within.overused.length) parts.push(`palabras repetidas en exceso: ${r.within.overused.map((o) => `«${o.word}» (${o.count})`).join(", ")}`);
    if (r.within.phrases.length) parts.push(`frases repetidas: ${r.within.phrases.slice(0, 5).map((p) => `«${p.phrase}»`).join(", ")}`);
    if (r.within.openings.length) parts.push(`párrafos que empiezan igual: ${r.within.openings.map((o) => `«${o.opening}…» (${o.count})`).join(", ")}`);
    out.push(`- Repeticiones dentro del informe: ${parts.join("; ")}. Variá sin buscar sinónimos de adorno: si una idea ya se dijo, no la repitas.`);
  }
  if (r.fix.includes("template")) {
    const T = r.template, parts = [];
    if (T.questions > 3) parts.push(`${T.questions} preguntas (máximo 3 en todo el informe)`);
    if (T.alternatives > 2) parts.push(`${T.alternatives} «otra lectura» o equivalentes (máximo 2)`);
    if (T.defenses > 2) parts.push(`${T.defenses} «la defensa más probable/típica» (máximo 2)`);
    if (T.costs > 2) parts.push(`${T.costs} «el costo» (máximo 2)`);
    if (T.closers > 2) parts.push(`${T.closers} cierres del tipo «…sostiene esta lectura», «…es su fuente», «…condensa…» (máximo 2)`);
    out.push(`- La estructura del análisis quedó a la vista como plantilla: ${parts.join("; ")}. Integrá defensa, costo y alternativas en el relato solo donde importan, quitá preguntas hasta dejar las más necesarias y variá cómo nombrás el dato técnico (no siempre al final del párrafo).`);
  }
  if (r.fix.includes("cross_repetition")) out.push(`- Estas frases ya aparecieron en otros informes recientes. Reescribilas desde esta carta:\n${ex(r.cross, (c) => c.phrase, 8)}`);
  return out.join("\n");
}
