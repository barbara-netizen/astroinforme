// ASTROINFORME — control de estilo del informe.
// Detecta fórmulas que el protocolo pide evitar: el contraste retórico «no es X, sino Y» usado como recurso
// habitual, frases hechas y lenguaje de autoayuda o new age. No juzga la calidad: marca patrones concretos
// para pedir una corrección. Un falso positivo solo provoca una revisión; nunca bloquea la entrega.

// Contraste «no X, sino Y»: se tolera una aparición en todo el informe.
const CONTRAST = {
  es: [/\bno\s(?!(?:s[oó]lo|solamente|[uú]nicamente)\b)(?![^.;:!?]{0,80}\bsino\s+tambi[eé]n\b)[^.;:!?]{1,80}?\bsino\b/gi, /\besto no significa\b/gi],
  de: [/\bnicht\s(?!nur\b)(?![^.;:!?]{0,80}\bsondern\s+auch\b)[^.;:!?]{1,80}?\bsondern\b/gi, /\bdas bedeutet nicht\b/gi],
  en: [/\bnot\s(?!only\b|just\b|merely\b)[^.;:!?]{1,60}?,\s*but\b/gi, /\bisn['’]t about\b[^.;:!?]{1,60}?\bit['’]s about\b/gi, /\bthis doesn['’]t mean\b/gi],
};
const CONTRAST_MAX = 1;

// Frases hechas y lenguaje de horóscopo, autoayuda o new age: cualquier aparición se marca.
const CLICHES = {
  es: [
    /\ben un mundo (?:que|donde|en el que)\b/gi, /\bviaje (?:interior|del alma|de autodescubrimiento)\b/gi,
    /\btu (?:verdadero|aut[eé]ntico) (?:yo|ser)\b/gi, /\bni[ñn][oa] interior\b/gi, /\bel universo (?:te|nos)\b/gi,
    /\bdespertar espiritual\b/gi, /\bvibraci[oó]n(?:es)?\b/gi, /\benerg[ií]as? (?:c[oó]smicas?|positivas?|negativas?)\b/gi,
    /\bbrillar con luz propia\b/gi, /\bsin lugar a dudas\b/gi, /\blos astros (?:te |nos )?(?:dicen|indican|anuncian|predicen)\b/gi,
    /\bestá escrito\b/gi, /\btu destino\b/gi, /\babraz(?:ar|á|a) (?:tu|tus) (?:sombra|heridas?)\b/gi, /\btrastorno\b/gi,
  ],
  de: [
    /\bin einer welt,? in der\b/gi, /\binnere reise\b/gi, /\bdein wahres selbst\b/gi, /\binneres kind\b/gi,
    /\bdas universum\b/gi, /\bspirituelles erwachen\b/gi, /\bschwingung(?:en)?\b/gi, /\bkosmische energie\b/gi,
    /\bdein schicksal\b/gi, /\bdie sterne (?:sagen|zeigen)\b/gi, /\bst[öo]rung\b/gi,
  ],
  en: [
    /\bin a world (?:where|that)\b/gi, /\binner journey\b/gi, /\bjourney of self-discovery\b/gi, /\byour true self\b/gi,
    /\binner child\b/gi, /\bthe universe (?:is|wants|has)\b/gi, /\bspiritual awakening\b/gi, /\bvibrations?\b/gi,
    /\bcosmic energ(?:y|ies)\b/gi, /\byour destiny\b/gi, /\bthe stars (?:say|tell|show)\b/gi, /\bembrace your (?:shadow|wounds?)\b/gi, /\bdisorder\b/gi,
  ],
};

const snippet = (text, i, len) => text.slice(Math.max(0, i - 30), Math.min(text.length, i + len + 30)).replace(/\s+/g, " ").trim();

function findAll(text, regexes) {
  const hits = [];
  for (const re of regexes) { re.lastIndex = 0; let m; while ((m = re.exec(text))) hits.push({ i: m.index, s: m[0] }); }
  return hits.sort((a, b) => a.i - b.i);
}

/** Devuelve {ok, issues:[{kind, count, examples}]} para un informe astroinforme.report/v1. */
export function styleCheck(report) {
  const lang = CONTRAST[report && report.language] ? report.language : "es";
  const text = (report.sections || []).map((s) => `${s.heading || ""}\n${s.body_markdown || ""}`).join("\n\n");
  const issues = [];
  const contrast = findAll(text, CONTRAST[lang]);
  if (contrast.length > CONTRAST_MAX) issues.push({ kind: "contrast_formula", count: contrast.length, examples: contrast.slice(0, 6).map((h) => snippet(text, h.i, h.s.length)) });
  const cl = findAll(text, CLICHES[lang]);
  if (cl.length) issues.push({ kind: "cliche", count: cl.length, examples: cl.slice(0, 8).map((h) => snippet(text, h.i, h.s.length)) });
  return { ok: issues.length === 0, issues };
}

/** Texto para el pedido de corrección. */
export function describeStyle(style) {
  return style.issues.map((i) => i.kind === "contrast_formula"
    ? `- La fórmula de contraste «no X, sino Y» (o «esto no significa…») aparece ${i.count} veces; el protocolo pide no usarla como recurso habitual. Reescribí esos pasajes afirmando directamente la interpretación. Ejemplos:\n${i.examples.map((e) => `  «…${e}…»`).join("\n")}`
    : `- Frases hechas o lenguaje de horóscopo, autoayuda o diagnóstico (${i.count}). Reemplazalas por una formulación precisa y propia de esta carta. Ejemplos:\n${i.examples.map((e) => `  «…${e}…»`).join("\n")}`).join("\n");
}
