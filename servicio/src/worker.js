// ASTROINFORME — servicio interpretativo (Cloudflare Worker).
//
// Recibe una carta calculada (astroinforme.chart/v1), la interpreta con la API de Claude en dos fases
// (análisis estructural → redacción), audita las referencias técnicas contra la carta y devuelve
// un informe astroinforme.report/v1. Si la auditoría falla, pide una corrección; si sigue fallando,
// no entrega el informe (AUDIT_STRICT).
//
// Configuración (Cloudflare → Worker → Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY   secreto. Clave de la API del workspace «astroinforme».
//   ACCESS_CODES        texto. Códigos por persona con su límite: "ANA-7K2:3, PEDRO-9X4:2".
//   MODEL               opcional. Por defecto claude-opus-5-5.
//   MONTHLY_USD_LIMIT   opcional. Tope de gasto mensual del servicio en dólares (por defecto 15).
//   ALLOWED_ORIGINS     opcional. Orígenes permitidos, separados por coma (por defecto la app en GitHub Pages).
//   REQUIRE_CODE        opcional. "false" para no pedir código (no recomendado).
//   AUDIT_STRICT        opcional. "false" para entregar aunque la auditoría falle (con la auditoría adjunta).
//   PROTOCOL            opcional. Alternativa al KV si el protocolo cabe en 5 KB (no cabe: usar KV).
// Enlace KV (Settings → Bindings → KV namespace): nombre de variable ASTRO_KV.
//   Clave "protocol": texto completo del protocolo interpretativo.
//   El servicio guarda ahí "used:<CÓDIGO>" y "month:<AAAA-MM>".

import { auditReport } from "../../audit.js";
import { IDIOMA, PROMPT_ANALISIS, PROMPT_INFORME, PROMPT_CORRECCION } from "./prompts.js";

export const SERVICE_VERSION = "1.0";
const DEFAULT_MODEL = "claude-opus-5-5";
const DEFAULT_ORIGINS = "https://barbara-netizen.github.io";
// Precios por millón de tokens (USD), https://platform.claude.com/docs/en/about-claude/pricing (16-10-2026)
const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cache_write: 5, cache_read: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cache_write: 2.5, cache_read: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cache_write: 0.125, cache_read: 0.01 },
};
const MAX_BODY = 200_000;
const KEEPALIVE_MS = 10_000;

// ---------------------------------------------------------------- utilidades
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

export function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-astro-code", "access-control-max-age": "86400", vary: "origin" } : { vary: "origin" };
}

export function parseCodes(s) {
  const out = {};
  for (const part of String(s || "").split(/[,;\n]/)) {
    const m = part.trim().match(/^([A-Za-z0-9_-]{4,40})\s*:\s*(\d{1,4})$/);
    if (m) out[m[1].toUpperCase()] = +m[2];
  }
  return out;
}

const monthKey = (d = new Date()) => `month:${d.toISOString().slice(0, 7)}`;

export function costUSD(usage, model) {
  const p = PRICES[model] || PRICES[DEFAULT_MODEL];
  return ((usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out +
    (usage.cache_creation_input_tokens || 0) * p.cache_write + (usage.cache_read_input_tokens || 0) * p.cache_read) / 1e6;
}

export function extractJSON(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j < i) throw new Error("no_json");
  return JSON.parse(t.slice(i, j + 1));
}

export function validChart(p) {
  return p && p.schema === "astroinforme.chart/v1" && p.chart && Array.isArray(p.chart.bodies) && p.chart.bodies.length >= 10 &&
    Array.isArray(p.chart.aspects) && p.birth && typeof p.birth.time_precision === "string" && p.request &&
    ["es", "de", "en"].includes(p.request.report_language);
}

// Solo se envían a Claude los datos astrológicos y el nombre de pila: nunca fecha, hora ni lugar.
export function chartForModel(p) {
  return {
    schema: p.schema, engine: p.engine, request: p.request,
    birth: { time_precision: p.birth.time_precision, time_precision_label: p.birth.time_precision_label },
    // sin jd_ut: el día juliano revela el momento exacto del nacimiento
    chart: { ...p.chart, jd_ut: undefined }, warnings: (p.warnings || []).map((w) => ({ code: w.code })),
  };
}

function describeIssues(audit) {
  return audit.issues.map((i) => {
    const r = i.ref; const what = r.type === "aspect" ? `${r.a} ${r.aspect} ${r.b}` : r.type === "angle" ? `${r.angle} ${r.sign} ${r.deg}` : `${r.body} ${r.sign} ${r.deg}${r.house != null ? " casa " + r.house : ""}`;
    const probs = (i.problems || [i]).map((p) => p.field === "sign" || p.field === "deg" || p.field === "house" ? `${p.field}: informe ${p.report}, carta ${p.chart ?? "sin casas"}` : (p.note || p.kind));
    return `- ${what}: ${probs.join("; ")}`;
  }).join("\n");
}

// ---------------------------------------------------------------- llamada a Claude
export async function callClaude(env, { system, user, maxTokens }) {
  const model = env.MODEL || DEFAULT_MODEL;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body) { const e = new Error("upstream"); e.status = r.status; e.detail = body && body.error ? body.error.type : null; throw e; }
  const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, usage: body.usage || {}, stop: body.stop_reason, model };
}

/** Flujo completo: análisis → redacción → auditoría → (corrección) → auditoría. */
export async function interpret(env, payload, protocol) {
  const model = env.MODEL || DEFAULT_MODEL;
  const carta = JSON.stringify(chartForModel(payload));
  const lang = payload.request.report_language;
  const nombre = payload.person && payload.person.first_name ? `La persona se llama ${payload.person.first_name}; usá solo ese nombre de pila si hace falta.` : "";
  let usd = 0;
  const a = await callClaude(env, { system: protocol, user: PROMPT_ANALISIS(carta), maxTokens: 6000 });
  usd += costUSD(a.usage, model);
  const analisis = extractJSON(a.text);
  const b = await callClaude(env, { system: protocol, user: PROMPT_INFORME({ idioma: IDIOMA[lang], lang, nombre, analisis: JSON.stringify(analisis), carta }), maxTokens: 16000 });
  usd += costUSD(b.usage, model);
  let report = extractJSON(b.text);
  let audit = auditReport(report, payload);
  let corrected = false;
  if (!audit.ok) {
    const c = await callClaude(env, { system: protocol, user: PROMPT_CORRECCION({ problemas: describeIssues(audit), informe: JSON.stringify(report), carta }), maxTokens: 16000 });
    usd += costUSD(c.usage, model);
    report = extractJSON(c.text);
    audit = auditReport(report, payload);
    corrected = true;
  }
  report.engine = { model, protocol_version: "ASTROINFORME", service: SERVICE_VERSION };
  report.audit = { all_references_present_in_chart: audit.ok, verified: audit.verified, total: audit.total, corrected };
  return { report, audit, usd };
}

// ---------------------------------------------------------------- handler
async function kvGetJSON(kv, key, fallback) { try { const v = await kv.get(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const protocolOk = !!(env.PROTOCOL || (env.ASTRO_KV && (await env.ASTRO_KV.get("protocol"))));
      return json({ service: "astroinforme", version: SERVICE_VERSION, model: env.MODEL || DEFAULT_MODEL,
        configured: { api_key: !!env.ANTHROPIC_API_KEY, protocol: protocolOk, kv: !!env.ASTRO_KV, codes: Object.keys(parseCodes(env.ACCESS_CODES)).length } }, 200, cors);
    }
    if (request.method !== "POST") return json({ error: "bad_request" }, 405, cors);
    if (!cors["access-control-allow-origin"] && request.headers.get("origin")) return json({ error: "forbidden_origin" }, 403, cors);

    // configuración mínima
    const protocol = env.PROTOCOL || (env.ASTRO_KV ? await env.ASTRO_KV.get("protocol") : null);
    if (!env.ANTHROPIC_API_KEY || !protocol || !env.ASTRO_KV) return json({ error: "not_configured" }, 503, cors);

    // datos
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "bad_request" }, 413, cors);
    let payload; try { payload = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
    if (!validChart(payload)) return json({ error: "bad_request" }, 400, cors);

    // código de acceso y cupo
    const codes = parseCodes(env.ACCESS_CODES);
    const requireCode = env.REQUIRE_CODE !== "false";
    const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
    let limit = null, used = 0;
    if (requireCode) {
      if (!code) return json({ error: "code_required" }, 401, cors);
      if (!(code in codes)) return json({ error: "code_invalid" }, 403, cors);
      limit = codes[code];
      used = +(await env.ASTRO_KV.get("used:" + code)) || 0;
      if (used >= limit) return json({ error: "quota_exhausted", remaining: 0 }, 403, cors);
    }
    const mk = monthKey();
    const month = await kvGetJSON(env.ASTRO_KV, mk, { reports: 0, usd: 0, failed: 0 });
    const cap = +(env.MONTHLY_USD_LIMIT || 15);
    if (month.usd >= cap) return json({ error: "budget_exhausted" }, 429, cors);

    // respuesta en flujo: espacios cada 10 s para que la conexión no se considere inactiva; al final, el JSON
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const keep = setInterval(() => { writer.write(enc.encode(" ")).catch(() => { }); }, KEEPALIVE_MS);
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
          if (requireCode) { used += 1; await env.ASTRO_KV.put("used:" + code, String(used)); }
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
  },
};
