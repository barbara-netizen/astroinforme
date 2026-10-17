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

// src/prompts.js
var IDIOMA = { es: "espa\xF1ol rioplatense, con voseo", de: "alem\xE1n, tuteando (du)", en: "ingl\xE9s" };
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

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
var PROMPT_INFORME = ({ idioma, lang, nombre, analisis, carta }) => `FASE B \u2014 REDACCI\xD3N DEL INFORME.
Redact\xE1 el informe natal completo siguiendo el protocolo, en ${idioma}, en segunda persona, a partir del an\xE1lisis estructural
y de la carta calculada. ${nombre}
Devolv\xE9 SOLO un objeto JSON v\xE1lido, sin texto antes ni despu\xE9s, con esta forma (contrato astroinforme.report/v1):
{
 "schema": "astroinforme.report/v1",
 "language": "${lang}",
 "title": "\u2026",
 "sections": [{"id": "opening|identity|emotional|central_conflict|saturn|desire|relationships|roots|vocation|neptune|shadow|transformation|resources|synthesis|myth", "heading": "\u2026", "body_markdown": "p\xE1rrafos separados por una l\xEDnea en blanco"}],
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
var PROMPT_CORRECCION = ({ problemas, informe, carta }) => `FASE C \u2014 CORRECCI\xD3N T\xC9CNICA.
La auditor\xEDa autom\xE1tica compar\xF3 las referencias t\xE9cnicas de tu informe con la carta calculada y encontr\xF3 estos problemas:
${problemas}

Correg\xED el informe: cambi\xE1 solo los pasajes que dependen de esos datos, para que digan lo que efectivamente figura en la carta
calculada, o quit\xE1 la afirmaci\xF3n si el dato no existe o no es fiable. Manten\xE9 el resto del texto. Actualiz\xE1
technical_references_used en consecuencia. Devolv\xE9 SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

// src/worker.js
var SERVICE_VERSION = "1.0";
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
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-astro-code", "access-control-max-age": "86400", vary: "origin" } : { vary: "origin" };
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
  return p && p.schema === "astroinforme.chart/v1" && p.chart && Array.isArray(p.chart.bodies) && p.chart.bodies.length >= 10 && Array.isArray(p.chart.aspects) && p.birth && typeof p.birth.time_precision === "string" && p.request && ["es", "de", "en"].includes(p.request.report_language);
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
async function interpret(env, payload, protocol) {
  const model = env.MODEL || DEFAULT_MODEL;
  const carta = JSON.stringify(chartForModel(payload));
  const lang = payload.request.report_language;
  const nombre = payload.person && payload.person.first_name ? `La persona se llama ${payload.person.first_name}; us\xE1 solo ese nombre de pila si hace falta.` : "";
  let usd = 0;
  const a = await callClaude(env, { system: protocol, user: PROMPT_ANALISIS(carta), maxTokens: 6e3 });
  usd += costUSD(a.usage, model);
  const analisis = extractJSON(a.text);
  const b = await callClaude(env, { system: protocol, user: PROMPT_INFORME({ idioma: IDIOMA[lang], lang, nombre, analisis: JSON.stringify(analisis), carta }), maxTokens: 16e3 });
  usd += costUSD(b.usage, model);
  let report = extractJSON(b.text);
  let audit = auditReport(report, payload);
  let corrected = false;
  if (!audit.ok) {
    const c = await callClaude(env, { system: protocol, user: PROMPT_CORRECCION({ problemas: describeIssues(audit), informe: JSON.stringify(report), carta }), maxTokens: 16e3 });
    usd += costUSD(c.usage, model);
    report = extractJSON(c.text);
    audit = auditReport(report, payload);
    corrected = true;
  }
  report.engine = { model, protocol_version: "ASTROINFORME", service: SERVICE_VERSION };
  report.audit = { all_references_present_in_chart: audit.ok, verified: audit.verified, total: audit.total, corrected };
  return { report, audit, usd };
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
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const protocolOk = !!(env.PROTOCOL || env.ASTRO_KV && await env.ASTRO_KV.get("protocol"));
      return json({
        service: "astroinforme",
        version: SERVICE_VERSION,
        model: env.MODEL || DEFAULT_MODEL,
        configured: { api_key: !!env.ANTHROPIC_API_KEY, protocol: protocolOk, kv: !!env.ASTRO_KV, codes: Object.keys(parseCodes(env.ACCESS_CODES)).length }
      }, 200, cors);
    }
    if (request.method !== "POST") return json({ error: "bad_request" }, 405, cors);
    if (!cors["access-control-allow-origin"] && request.headers.get("origin")) return json({ error: "forbidden_origin" }, 403, cors);
    const protocol = env.PROTOCOL || (env.ASTRO_KV ? await env.ASTRO_KV.get("protocol") : null);
    if (!env.ANTHROPIC_API_KEY || !protocol || !env.ASTRO_KV) return json({ error: "not_configured" }, 503, cors);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "bad_request" }, 413, cors);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return json({ error: "bad_request" }, 400, cors);
    }
    if (!validChart(payload)) return json({ error: "bad_request" }, 400, cors);
    const codes = parseCodes(env.ACCESS_CODES);
    const requireCode = env.REQUIRE_CODE !== "false";
    const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
    let limit = null, used = 0;
    if (requireCode) {
      if (!code) return json({ error: "code_required" }, 401, cors);
      if (!(code in codes)) return json({ error: "code_invalid" }, 403, cors);
      limit = codes[code];
      used = +await env.ASTRO_KV.get("used:" + code) || 0;
      if (used >= limit) return json({ error: "quota_exhausted", remaining: 0 }, 403, cors);
    }
    const mk = monthKey();
    const month = await kvGetJSON(env.ASTRO_KV, mk, { reports: 0, usd: 0, failed: 0 });
    const cap = +(env.MONTHLY_USD_LIMIT || 15);
    if (month.usd >= cap) return json({ error: "budget_exhausted" }, 429, cors);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const keep = setInterval(() => {
      writer.write(enc.encode(" ")).catch(() => {
      });
    }, KEEPALIVE_MS);
    const work = (async () => {
      let out;
      try {
        const { report, audit, usd } = await interpret(env, payload, protocol);
        const strict = env.AUDIT_STRICT !== "false";
        month.usd = +(month.usd + usd).toFixed(4);
        if (!audit.ok && strict) {
          month.failed += 1;
          out = { error: "audit_failed" };
        } else {
          month.reports += 1;
          if (requireCode) {
            used += 1;
            await env.ASTRO_KV.put("used:" + code, String(used));
          }
          out = { report, remaining: requireCode ? Math.max(0, limit - used) : null };
        }
        await env.ASTRO_KV.put(mk, JSON.stringify(month));
      } catch (e) {
        out = { error: "upstream" };
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
