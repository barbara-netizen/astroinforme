// ASTROINFORME — servicio interpretativo. Archivo generado desde servicio/src (npm run build). AGPL-3.0.

// ../audit.js
var SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
var toMin = (deg) => {
  const m = String(deg).match(/(\d+)°\s*(\d+)'/);
  return m ? +m[1] * 60 + +m[2] : null;
};
var lonToSignMin = (lon) => {
  const l = (lon % 360 + 360) % 360;
  return { sign: SIGNS[Math.floor(l / 30)], min: Math.floor(l % 30 * 60) };
};
function auditReport(report, payload) {
  const issues = [], checked = [];
  const bodies = Object.fromEntries(payload.chart.bodies.map((b) => [b.id, b]));
  const houses = payload.chart.houses;
  const timeKnown = payload.birth.time_precision !== "UNKNOWN";
  for (const r of report.technical_references_used || []) {
    if (r.type === "position") {
      const b = bodies[r.body];
      if (!b) {
        issues.push({ ref: r, kind: "missing", note: "El cuerpo no figura en la carta calculada." });
        continue;
      }
      const calc = { sign: b.sign, min: Math.floor(b.longitude % 30 * 60), house: b.house };
      const probs = [];
      if (r.sign && r.sign !== calc.sign) probs.push({ field: "sign", report: r.sign, chart: calc.sign });
      else if (r.deg && Math.abs(toMin(r.deg) - calc.min) > 1) probs.push({ field: "deg", report: r.deg, chart: b.position });
      if (r.house != null) {
        if (!timeKnown) probs.push({ field: "house", report: r.house, chart: null, note: "Hora desconocida: no hay casas." });
        else if (r.house !== calc.house) probs.push({ field: "house", report: r.house, chart: calc.house });
      }
      const unrel = (payload.chart.sensitivity?.unreliable || []).filter((u) => u.item === r.body);
      if (unrel.some((u) => u.field === "sign") || r.house != null && unrel.some((u) => u.field === "house"))
        probs.push({ field: "reliability", note: "Dato marcado como sensible a la precisi\xF3n horaria." });
      probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r);
    } else if (r.type === "angle") {
      if (!houses) {
        issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay \xE1ngulos." }] });
        continue;
      }
      const c = lonToSignMin(r.angle === "ASC" ? houses.asc : houses.mc);
      const probs = [];
      if (r.sign && r.sign !== c.sign) probs.push({ field: "sign", report: r.sign, chart: c.sign });
      else if (r.deg && Math.abs(toMin(r.deg) - c.min) > 1) probs.push({ field: "deg", report: r.deg, chart: `${Math.floor(c.min / 60)}\xB0${String(c.min % 60).padStart(2, "0")}'` });
      probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r);
    } else if (r.type === "aspect") {
      const a = payload.chart.aspects.find((x) => x.aspect === r.aspect && (x.a === r.a && x.b === r.b || x.a === r.b && x.b === r.a));
      if (!a) issues.push({ ref: r, problems: [{ field: "aspect", note: `No figura en la carta calculada con la pol\xEDtica ${payload.engine.aspect_policy}.` }] });
      else if (a.reliable === false) issues.push({ ref: r, problems: [{ field: "reliability", note: "Aspecto sensible a la precisi\xF3n horaria." }] });
      else checked.push({ ...r, orb: a.orb });
    }
  }
  return { ok: issues.length === 0, total: checked.length + issues.length, verified: checked.length, issues };
}

// src/style.js
var CONTRAST = {
  es: [/\bno\s(?!(?:s[oó]lo|solamente|[uú]nicamente)\b)(?![^.;:!?]{0,80}\bsino\s+tambi[eé]n\b)[^.;:!?]{1,80}?\bsino\b/gi, /\besto no significa\b/gi, /\bno significa\b[^.!?]{1,100}?[;:,]\s*significa\b/gi],
  de: [/\bnicht\s(?!nur\b)(?![^.;:!?]{0,80}\bsondern\s+auch\b)[^.;:!?]{1,80}?\bsondern\b/gi, /\bdas bedeutet nicht\b/gi],
  en: [/\bnot\s(?!only\b|just\b|merely\b)[^.;:!?]{1,60}?,\s*but\b/gi, /\bisn['’]t about\b[^.;:!?]{1,60}?\bit['’]s about\b/gi, /\bthis doesn['’]t mean\b/gi]
};
var CONTRAST_MAX = 1;
var CLICHES = {
  es: [
    /\ben un mundo (?:que|donde|en el que)\b/gi,
    /\bviaje (?:interior|del alma|de autodescubrimiento)\b/gi,
    /\btu (?:verdadero|aut[eé]ntico) (?:yo|ser)\b/gi,
    /\bni[ñn][oa] interior\b/gi,
    /\bel universo (?:te|nos)\b/gi,
    /\bdespertar espiritual\b/gi,
    /\bvibraci[oó]n(?:es)?\b/gi,
    /\benerg[ií]as? (?:c[oó]smicas?|positivas?|negativas?)\b/gi,
    /\bbrillar con luz propia\b/gi,
    /\bsin lugar a dudas\b/gi,
    /\blos astros (?:te |nos )?(?:dicen|indican|anuncian|predicen)\b/gi,
    /\bestá escrito\b/gi,
    /\btu destino\b/gi,
    /\babraz(?:ar|á|a) (?:tu|tus) (?:sombra|heridas?)\b/gi,
    /\btrastorno\b/gi
  ],
  de: [
    /\bin einer welt,? in der\b/gi,
    /\binnere reise\b/gi,
    /\bdein wahres selbst\b/gi,
    /\binneres kind\b/gi,
    /\bdas universum\b/gi,
    /\bspirituelles erwachen\b/gi,
    /\bschwingung(?:en)?\b/gi,
    /\bkosmische energie\b/gi,
    /\bdein schicksal\b/gi,
    /\bdie sterne (?:sagen|zeigen)\b/gi,
    /\bst[öo]rung\b/gi
  ],
  en: [
    /\bin a world (?:where|that)\b/gi,
    /\binner journey\b/gi,
    /\bjourney of self-discovery\b/gi,
    /\byour true self\b/gi,
    /\binner child\b/gi,
    /\bthe universe (?:is|wants|has)\b/gi,
    /\bspiritual awakening\b/gi,
    /\bvibrations?\b/gi,
    /\bcosmic energ(?:y|ies)\b/gi,
    /\byour destiny\b/gi,
    /\bthe stars (?:say|tell|show)\b/gi,
    /\bembrace your (?:shadow|wounds?)\b/gi,
    /\bdisorder\b/gi
  ]
};
var snippet = (text, i, len) => text.slice(Math.max(0, i - 30), Math.min(text.length, i + len + 30)).replace(/\s+/g, " ").trim();
function findAll(text, regexes) {
  const hits = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while (m = re.exec(text)) hits.push({ i: m.index, s: m[0] });
  }
  return hits.sort((a, b) => a.i - b.i);
}
function styleCheck(report) {
  const lang = CONTRAST[report && report.language] ? report.language : "es";
  const text = (report.sections || []).map((s) => `${s.heading || ""}
${s.body_markdown || ""}`).join("\n\n");
  const issues = [];
  const contrast = findAll(text, CONTRAST[lang]);
  if (contrast.length > CONTRAST_MAX) issues.push({ kind: "contrast_formula", count: contrast.length, examples: contrast.slice(0, 6).map((h) => snippet(text, h.i, h.s.length)) });
  const cl = findAll(text, CLICHES[lang]);
  if (cl.length) issues.push({ kind: "cliche", count: cl.length, examples: cl.slice(0, 8).map((h) => snippet(text, h.i, h.s.length)) });
  return { ok: issues.length === 0, issues };
}
function describeStyle(style) {
  return style.issues.map((i) => i.kind === "contrast_formula" ? `- La f\xF3rmula de contraste \xABno X, sino Y\xBB (o \xABesto no significa\u2026\xBB) aparece ${i.count} veces; el protocolo pide no usarla como recurso habitual. Reescrib\xED esos pasajes afirmando directamente la interpretaci\xF3n. Ejemplos:
${i.examples.map((e) => `  \xAB\u2026${e}\u2026\xBB`).join("\n")}` : `- Frases hechas o lenguaje de hor\xF3scopo, autoayuda o diagn\xF3stico (${i.count}). Reemplazalas por una formulaci\xF3n precisa y propia de esta carta. Ejemplos:
${i.examples.map((e) => `  \xAB\u2026${e}\u2026\xBB`).join("\n")}`).join("\n");
}

// src/prompts.js
var IDIOMA = { es: "espa\xF1ol rioplatense, con voseo", de: "alem\xE1n, tuteando (du)", en: "ingl\xE9s" };
var TRATAMIENTO = {
  FEMININE: "Cuando el idioma exija concordancia de g\xE9nero para referirse a la persona, us\xE1 el femenino.",
  MASCULINE: "Cuando el idioma exija concordancia de g\xE9nero para referirse a la persona, us\xE1 el masculino.",
  NEUTRAL: "La persona prefiere un tratamiento neutro: no uses marcas de g\xE9nero gramatical para referirte a ella. Eleg\xED construcciones que no las requieran (por ejemplo, \xABten\xE9s tendencia a\u2026\xBB en lugar de \xABsos propenso/propensa a\u2026\xBB). No uses \xABe\xBB, \xABx\xBB ni \xAB@\xBB como desinencias.",
  UNSPECIFIED: "No sab\xE9s el g\xE9nero de la persona: no uses marcas de g\xE9nero gramatical para referirte a ella. Eleg\xED construcciones que no las requieran (por ejemplo, \xABten\xE9s tendencia a\u2026\xBB en lugar de \xABsos propenso/propensa a\u2026\xBB). No uses \xABe\xBB, \xABx\xBB ni \xAB@\xBB como desinencias."
};
var PROMPT_ANALISIS = (carta) => `FASE A \u2014 AN\xC1LISIS ESTRUCTURAL (no es el informe).
Le\xE9 la carta calculada que sigue y devolv\xE9 SOLO un objeto JSON, sin texto antes ni despu\xE9s, con esta forma:
{
 "tension_organizadora": "una o dos oraciones",
 "temas": [{"tema": "\u2026", "indicadores": ["referencias t\xE9cnicas exactas tomadas del JSON"], "peso": "alto|medio|bajo"}],
 "contradicciones": ["\u2026"],
 "datos_no_fiables": ["elementos marcados reliable:false o en sensitivity.unreliable que no deben sostener conclusiones"],
 "jerarquia_de_secciones": ["ids de secci\xF3n en el orden que conviene"],
 "mito": {"nombre": "\u2026", "por_que": "\u2026"}
}
Us\xE1 exclusivamente los datos del JSON. Nada de memoria ni c\xE1lculos propios. Si la hora es desconocida, no uses casas ni \xE1ngulos.
Antes de elegir los temas, revis\xE1 chart.derived.configurations (cuadraturas en T, grandes cruces, yods, grandes tr\xEDgonos) y
chart.derived.angular: toda configuraci\xF3n calculada y todo planeta a menos de 3\xB0 de un \xE1ngulo debe figurar en "temas" o, si decid\xEDs
no desarrollarlo, en una nota breve dentro de "contradicciones" que explique por qu\xE9 pesa menos en esta carta.

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
var PROMPT_INFORME = ({ idioma, lang, nombre, tratamiento, analisis, carta }) => `FASE B \u2014 REDACCI\xD3N DEL INFORME.
Redact\xE1 el informe natal completo siguiendo el protocolo, en ${idioma}, en segunda persona, a partir del an\xE1lisis estructural
y de la carta calculada. ${nombre}
${tratamiento}
Devolv\xE9 SOLO un objeto JSON v\xE1lido, sin texto antes ni despu\xE9s, con esta forma (contrato astroinforme.report/v1):
{
 "schema": "astroinforme.report/v1",
 "language": "${lang}",
 "title": "\u2026",
 "sections": [{"id": "opening|identity|emotional|central_conflict|saturn|desire|relationships|roots|vocation|neptune|shadow|transformation|resources|synthesis|myth|dedication", "heading": "\u2026", "body_markdown": "p\xE1rrafos separados por una l\xEDnea en blanco"}],
 "technical_references_used": [
   {"type": "position", "body": "SUN", "sign": "AQUARIUS", "deg": "9\xB029'", "house": 4},
   {"type": "angle", "angle": "ASC", "sign": "SCORPIO", "deg": "5\xB042'"},
   {"type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "CONJUNCTION"}
 ]
}
Reglas para technical_references_used: inclu\xED cada posici\xF3n, \xE1ngulo y aspecto que el texto menciona, con los valores exactos del
JSON (deg = grados y minutos de "position"). Omit\xED "house" si no la mencion\xE1s o si la casa figura como no fiable. No incluyas
aspectos que no est\xE9n en chart.aspects. Con hora desconocida no hay casas ni \xE1ngulos.

AN\xC1LISIS ESTRUCTURAL (fase A):
${analisis}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
var PROMPT_CORRECCION = ({ problemas, estilo, informe, carta }) => `FASE C \u2014 CORRECCI\xD3N.
${problemas ? `La auditor\xEDa t\xE9cnica compar\xF3 las referencias de tu informe con la carta calculada y encontr\xF3 estos problemas:
${problemas}

Correg\xED esos pasajes para que digan lo que efectivamente figura en la carta calculada, o quit\xE1 la afirmaci\xF3n si el dato no
existe o no es fiable. Actualiz\xE1 technical_references_used en consecuencia.
` : ""}${estilo ? `
El control de estilo encontr\xF3 esto:
${estilo}
` : ""}
Cambi\xE1 solo los pasajes se\xF1alados y manten\xE9 el resto del texto. Devolv\xE9 SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

// src/worker.js
var SERVICE_VERSION = "1.1";
var DEFAULT_MODEL = "claude-opus-5-5";
var DEFAULT_ORIGINS = "https://barbara-netizen.github.io";
var PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cache_write: 5, cache_read: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cache_write: 2.5, cache_read: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cache_write: 0.125, cache_read: 0.01 }
};
var MAX_BODY = 2e5;
var KEEPALIVE_MS = 1e4;
var json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-astro-code, x-turnstile-token", "access-control-max-age": "86400", vary: "origin" } : { vary: "origin" };
}
function parseCodes(s) {
  const out = {};
  for (const part of String(s || "").split(/[,;\n]/)) {
    const m = part.trim().match(/^([A-Za-z0-9_-]{4,40})\s*:\s*(\d{1,4})$/);
    if (m) out[m[1].toUpperCase()] = +m[2];
  }
  return out;
}
var monthKey = (d = /* @__PURE__ */ new Date()) => `month:${d.toISOString().slice(0, 7)}`;
var dayKey = (d = /* @__PURE__ */ new Date()) => `day:${d.toISOString().slice(0, 10)}`;
var GENDERS = ["FEMININE", "MASCULINE", "NEUTRAL", "UNSPECIFIED"];
async function visitorId(ip, salt) {
  const data = new TextEncoder().encode(`${salt || "astroinforme"}|${ip || "?"}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const b = await r.json();
    return !!(b && b.success);
  } catch (e) {
    return false;
  }
}
function costUSD(usage, model) {
  const p = PRICES[model] || PRICES[DEFAULT_MODEL];
  return ((usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out + (usage.cache_creation_input_tokens || 0) * p.cache_write + (usage.cache_read_input_tokens || 0) * p.cache_read) / 1e6;
}
function extractJSON(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j < i) throw new Error("no_json");
  return JSON.parse(t.slice(i, j + 1));
}
function validChart(p) {
  return p && p.schema === "astroinforme.chart/v1" && p.chart && Array.isArray(p.chart.bodies) && p.chart.bodies.length >= 10 && Array.isArray(p.chart.aspects) && p.birth && typeof p.birth.time_precision === "string" && p.request && ["es", "de", "en"].includes(p.request.report_language) && (p.request.address_gender == null || GENDERS.includes(p.request.address_gender));
}
function chartForModel(p) {
  return {
    schema: p.schema,
    engine: p.engine,
    request: p.request,
    birth: { time_precision: p.birth.time_precision, time_precision_label: p.birth.time_precision_label },
    // sin jd_ut: el día juliano revela el momento exacto del nacimiento
    chart: { ...p.chart, jd_ut: void 0 },
    warnings: (p.warnings || []).map((w) => ({ code: w.code }))
  };
}
function describeIssues(audit) {
  return audit.issues.map((i) => {
    const r = i.ref;
    const what = r.type === "aspect" ? `${r.a} ${r.aspect} ${r.b}` : r.type === "angle" ? `${r.angle} ${r.sign} ${r.deg}` : `${r.body} ${r.sign} ${r.deg}${r.house != null ? " casa " + r.house : ""}`;
    const probs = (i.problems || [i]).map((p) => p.field === "sign" || p.field === "deg" || p.field === "house" ? `${p.field}: informe ${p.report}, carta ${p.chart ?? "sin casas"}` : p.note || p.kind);
    return `- ${what}: ${probs.join("; ")}`;
  }).join("\n");
}
async function callClaude(env, { system, user, maxTokens }) {
  const model = env.MODEL || DEFAULT_MODEL;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }]
    })
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body) {
    const e = new Error("upstream");
    e.status = r.status;
    e.detail = body && body.error ? body.error.type : null;
    throw e;
  }
  const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, usage: body.usage || {}, stop: body.stop_reason, model };
}
async function interpret(env, payload, protocol, spent = { usd: 0 }) {
  const model = env.MODEL || DEFAULT_MODEL;
  const carta = JSON.stringify(chartForModel(payload));
  const lang = payload.request.report_language;
  const nombre = payload.person && payload.person.first_name ? `La persona se llama ${payload.person.first_name}; us\xE1 solo ese nombre de pila si hace falta.` : "";
  const tratamiento = TRATAMIENTO[payload.request.address_gender] || TRATAMIENTO.UNSPECIFIED;
  const a = await callClaude(env, { system: protocol, user: PROMPT_ANALISIS(carta), maxTokens: 16e3 });
  spent.usd += costUSD(a.usage, model);
  const analisis = extractJSON(a.text);
  const b = await callClaude(env, { system: protocol, user: PROMPT_INFORME({ idioma: IDIOMA[lang], lang, nombre, tratamiento, analisis: JSON.stringify(analisis), carta }), maxTokens: 32e3 });
  spent.usd += costUSD(b.usage, model);
  let report = extractJSON(b.text);
  let audit = auditReport(report, payload);
  let style = styleCheck(report);
  let corrected = false;
  if (!audit.ok || !style.ok) {
    const c = await callClaude(env, { system: protocol, user: PROMPT_CORRECCION({ problemas: audit.ok ? "" : describeIssues(audit), estilo: style.ok ? "" : describeStyle(style), informe: JSON.stringify(report), carta }), maxTokens: 32e3 });
    spent.usd += costUSD(c.usage, model);
    const fixed = extractJSON(c.text);
    const fixedAudit = auditReport(fixed, payload);
    if (fixedAudit.ok || !audit.ok) {
      report = fixed;
      audit = fixedAudit;
      style = styleCheck(fixed);
      corrected = true;
    }
  }
  report.engine = { model, protocol_version: "ASTROINFORME", service: SERVICE_VERSION };
  report.audit = { all_references_present_in_chart: audit.ok, verified: audit.verified, total: audit.total, corrected, style_issues: style.issues.map((i) => ({ kind: i.kind, count: i.count })) };
  return { report, audit, usd: spent.usd };
}
async function kvGetJSON(kv, key, fallback) {
  try {
    const v = await kv.get(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
var worker_default = {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const requireCode = env.REQUIRE_CODE !== "false";
    const cap = +(env.MONTHLY_USD_LIMIT || 15);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const protocolOk = !!(env.PROTOCOL || env.ASTRO_KV && await env.ASTRO_KV.get("protocol"));
      const month2 = env.ASTRO_KV ? await kvGetJSON(env.ASTRO_KV, monthKey(), { usd: 0 }) : { usd: 0 };
      const day = env.ASTRO_KV ? +await env.ASTRO_KV.get(dayKey()) || 0 : 0;
      const configured = !!(env.ANTHROPIC_API_KEY && protocolOk && env.ASTRO_KV);
      return json({
        service: "astroinforme",
        version: SERVICE_VERSION,
        model: env.MODEL || DEFAULT_MODEL,
        access: requireCode ? "code" : "public",
        turnstile: !!env.TURNSTILE_SECRET,
        // «available»: si hoy se puede pedir un informe (sin revelar el gasto)
        available: configured && month2.usd < cap && (requireCode || day < +(env.DAILY_LIMIT || 8)),
        configured: { api_key: !!env.ANTHROPIC_API_KEY, protocol: protocolOk, style: !!(env.ASTRO_KV && await env.ASTRO_KV.get("style")), kv: !!env.ASTRO_KV, codes: Object.keys(parseCodes(env.ACCESS_CODES)).length }
      }, 200, cors);
    }
    if (request.method !== "POST") return json({ error: "bad_request" }, 405, cors);
    if (!cors["access-control-allow-origin"] && request.headers.get("origin")) return json({ error: "forbidden_origin" }, 403, cors);
    const base = env.PROTOCOL || (env.ASTRO_KV ? await env.ASTRO_KV.get("protocol") : null);
    if (!env.ANTHROPIC_API_KEY || !base || !env.ASTRO_KV) return json({ error: "not_configured" }, 503, cors);
    const style = await env.ASTRO_KV.get("style");
    const protocol = style ? `${base}

${style}` : base;
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "bad_request" }, 413, cors);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return json({ error: "bad_request" }, 400, cors);
    }
    if (!validChart(payload)) return json({ error: "bad_request" }, 400, cors);
    const kv = env.ASTRO_KV;
    const ip = request.headers.get("cf-connecting-ip") || "";
    if (env.TURNSTILE_SECRET && !await verifyTurnstile(env.TURNSTILE_SECRET, request.headers.get("x-turnstile-token"), ip)) return json({ error: "bot_check" }, 403, cors);
    const codes = parseCodes(env.ACCESS_CODES);
    const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
    const useCode = requireCode || !!code;
    let limit = null, used = 0;
    if (useCode) {
      if (!code) return json({ error: "code_required" }, 401, cors);
      if (!(code in codes)) return json({ error: "code_invalid" }, 403, cors);
      limit = codes[code];
      used = +await kv.get("used:" + code) || 0;
      if (used >= limit) return json({ error: "quota_exhausted", remaining: 0 }, 403, cors);
    }
    const mk = monthKey();
    const month = await kvGetJSON(kv, mk, { reports: 0, usd: 0, failed: 0 });
    if (month.usd >= cap) return json({ error: "budget_exhausted" }, 429, cors);
    let vKey = null, vUsed = 0, dKey = null, dUsed = 0;
    if (!useCode) {
      dKey = dayKey();
      dUsed = +await kv.get(dKey) || 0;
      if (dUsed >= +(env.DAILY_LIMIT || 8)) return json({ error: "daily_limit" }, 429, cors);
      vKey = `v:${dKey.slice(4)}:${await visitorId(ip, env.VISITOR_SALT || env.ANTHROPIC_API_KEY)}`;
      vUsed = +await kv.get(vKey) || 0;
      if (vUsed >= +(env.VISITOR_DAILY_LIMIT || 1)) return json({ error: "visitor_limit" }, 429, cors);
      await kv.put(vKey, String(vUsed + 1), { expirationTtl: 172800 });
      await kv.put(dKey, String(dUsed + 1), { expirationTtl: 172800 });
    }
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const keep = setInterval(() => {
      writer.write(enc.encode(" ")).catch(() => {
      });
    }, KEEPALIVE_MS);
    const work = (async () => {
      let out;
      const spent = { usd: 0 };
      try {
        const { report, audit, usd } = await interpret(env, payload, protocol, spent);
        const strict = env.AUDIT_STRICT !== "false";
        month.usd = +(month.usd + usd).toFixed(4);
        if (!audit.ok && strict) {
          month.failed += 1;
          out = { error: "audit_failed" };
        } else {
          month.reports += 1;
          if (useCode) {
            used += 1;
            await kv.put("used:" + code, String(used));
          }
          out = { report, remaining: useCode ? Math.max(0, limit - used) : null };
        }
        await kv.put(mk, JSON.stringify(month));
      } catch (e) {
        out = { error: "upstream" };
        if (spent.usd) {
          month.usd = +(month.usd + spent.usd).toFixed(4);
          month.failed += 1;
          await kv.put(mk, JSON.stringify(month)).catch(() => {
          });
        }
        if (vKey) {
          await kv.put(vKey, String(vUsed), { expirationTtl: 172800 }).catch(() => {
          });
          await kv.put(dKey, String(dUsed), { expirationTtl: 172800 }).catch(() => {
          });
        }
      }
      clearInterval(keep);
      await writer.write(enc.encode(JSON.stringify(out)));
      await writer.close();
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(work);
    return new Response(readable, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });
  }
};

// src/entry.js
var entry_default = worker_default;
export {
  entry_default as default
};
