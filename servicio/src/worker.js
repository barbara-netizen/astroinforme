// ASTROINFORME — servicio interpretativo (Cloudflare Worker).
//
// Recibe una carta calculada (astroinforme.chart/v1), la interpreta con la API de Claude en dos fases
// (análisis estructural → redacción), audita las referencias técnicas contra la carta y devuelve
// un informe astroinforme.report/v1. Si la auditoría falla, pide una corrección; si sigue fallando,
// no entrega el informe (AUDIT_STRICT).
//
// Configuración (Cloudflare → Worker → Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY   secreto. Clave de la API del workspace «astroinforme».
//   ACCESS_CODES        secreto. Códigos por persona con su límite: "ANA-7K2:3, PEDRO-9X4:2".
//   MODEL               opcional. Por defecto claude-opus-5-5.
//   MONTHLY_USD_LIMIT   opcional. Tope de gasto mensual del servicio en dólares (por defecto 15).
//   ALLOWED_ORIGINS     opcional. Orígenes permitidos, separados por coma (por defecto la app en GitHub Pages).
//   REQUIRE_CODE        opcional. "false" = acceso público: cualquiera puede pedir un informe, con límite por visitante
//                       y por día (un código válido sigue funcionando con su propio cupo). Por defecto "true".
//   VISITOR_DAILY_LIMIT opcional. Informes por visitante por día en acceso público (por defecto 1).
//   DAILY_LIMIT         opcional. Informes por día para todo el servicio en acceso público (por defecto 8).
//   TURNSTILE_SECRET    secreto opcional. Si existe, exige la verificación anti-robots de Cloudflare Turnstile.
//   VISITOR_SALT        secreto opcional. Sal para anonimizar la IP del visitante (si falta, se usa la clave de la API).
//   AUDIT_STRICT        opcional. "false" para entregar aunque la auditoría falle (con la auditoría adjunta).
//   PROTOCOL            opcional. Alternativa al KV si el protocolo cabe en 5 KB (no cabe: usar KV).
// Enlace KV (Settings → Bindings → KV namespace): nombre de variable ASTRO_KV.
//   Clave "protocol": texto completo del protocolo interpretativo.
//   Clave "style" (opcional): guía de estilo; se agrega al final del protocolo.
//   El servicio guarda ahí "used:<CÓDIGO>", "month:<AAAA-MM>", "day:<AAAA-MM-DD>" y "v:<AAAA-MM-DD>:<hash>".
//   La IP del visitante nunca se guarda: solo un resumen criptográfico con sal, que vence a los dos días.

import { auditReport } from "../../audit.js";
import { styleCheck, describeStyle } from "./style.js";
import { IDIOMA, TRATAMIENTO, PROMPT_ANALISIS, PROMPT_INFORME, PROMPT_CORRECCION } from "./prompts.js";

export const SERVICE_VERSION = "1.4";
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
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-astro-code, x-turnstile-token", "access-control-max-age": "86400", vary: "origin" } : { vary: "origin" };
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
const dayKey = (d = new Date()) => `day:${d.toISOString().slice(0, 10)}`;
const GENDERS = ["FEMININE", "MASCULINE", "NEUTRAL", "UNSPECIFIED"];

/** Resumen anónimo del visitante: SHA-256 de la IP con sal, recortado. La IP no se guarda. */
export async function visitorId(ip, salt) {
  const data = new TextEncoder().encode(`${salt || "astroinforme"}|${ip || "?"}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData(); form.append("secret", secret); form.append("response", token); if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const b = await r.json(); return !!(b && b.success);
  } catch (e) { return false; }
}

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
    ["es", "de", "en"].includes(p.request.report_language) &&
    (p.request.address_gender == null || GENDERS.includes(p.request.address_gender));
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
    // en flujo: la API exige streaming para respuestas largas (el informe pide hasta 32.000 tokens)
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const e = new Error("upstream"); e.status = r.status; e.detail = body && body.error ? `${body.error.type}: ${body.error.message}` : null; throw e;
  }
  const ctype = r.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    // respuesta completa (la usan las pruebas con la API simulada)
    const body = await r.json().catch(() => null);
    if (!body) { const e = new Error("upstream"); e.status = r.status; throw e; }
    const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, usage: body.usage || {}, stop: body.stop_reason, model };
  }
  return readStream(r, model);
}

/** Lee la respuesta en flujo (server-sent events) y la arma completa. */
export async function readStream(r, model) {
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", usage = {}, stop = null;
  const handle = (data) => {
    let ev; try { ev = JSON.parse(data); } catch (e) { return; }
    if (ev.type === "message_start" && ev.message && ev.message.usage) usage = { ...ev.message.usage };
    else if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") text += ev.delta.text;
    else if (ev.type === "message_delta") { if (ev.usage) usage = { ...usage, ...ev.usage }; if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; }
    else if (ev.type === "error") { const e = new Error("upstream"); e.status = 200; e.detail = ev.error ? `${ev.error.type}: ${ev.error.message}` : "stream error"; throw e; }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (data) handle(data);
    }
    if (done) break;
  }
  if (!stop) { const e = new Error("upstream"); e.status = 200; e.detail = "stream ended without stop_reason"; throw e; }
  return { text, usage, stop, model };
}

/** Flujo completo: análisis → redacción → auditoría → (corrección) → auditoría. */
export async function interpret(env, payload, protocol, spent = { usd: 0 }) {
  const model = env.MODEL || DEFAULT_MODEL;
  const carta = JSON.stringify(chartForModel(payload));
  const lang = payload.request.report_language;
  const nombre = payload.person && payload.person.first_name ? `La persona se llama ${payload.person.first_name}; usá solo ese nombre de pila si hace falta.` : "";
  const tratamiento = TRATAMIENTO[payload.request.address_gender] || TRATAMIENTO.UNSPECIFIED;
  const a = await callClaude(env, { system: protocol, user: PROMPT_ANALISIS(carta), maxTokens: 16000 });
  spent.usd += costUSD(a.usage, model);
  const analisis = extractJSON(a.text);
  const b = await callClaude(env, { system: protocol, user: PROMPT_INFORME({ idioma: IDIOMA[lang], lang, nombre, tratamiento, analisis: JSON.stringify(analisis), carta }), maxTokens: 32000 });
  spent.usd += costUSD(b.usage, model);
  let report = extractJSON(b.text);
  let audit = auditReport(report, payload);
  let style = styleCheck(report);
  let corrected = false;
  // una sola corrección, que atiende a la vez los problemas técnicos y los de estilo
  if (!audit.ok || !style.ok) {
    const c = await callClaude(env, { system: protocol, user: PROMPT_CORRECCION({ problemas: audit.ok ? "" : describeIssues(audit), estilo: style.ok ? "" : describeStyle(style), informe: JSON.stringify(report), carta }), maxTokens: 32000 });
    spent.usd += costUSD(c.usage, model);
    const fixed = extractJSON(c.text);
    const fixedAudit = auditReport(fixed, payload);
    // si la corrección solo era de estilo y rompió la parte técnica, se conserva la versión anterior
    if (fixedAudit.ok || !audit.ok) { report = fixed; audit = fixedAudit; style = styleCheck(fixed); corrected = true; }
  }
  report.engine = { model, protocol_version: "ASTROINFORME", service: SERVICE_VERSION };
  report.audit = { all_references_present_in_chart: audit.ok, verified: audit.verified, total: audit.total, corrected, style_issues: style.issues.map((i) => ({ kind: i.kind, count: i.count })) };
  return { report, audit, usd: spent.usd };
}

// ---------------------------------------------------------------- comentarios
export const REPORT_TTL = 172800; // 48 horas
export const FEEDBACK_MIN = 200, FEEDBACK_MAX = 5000, FEEDBACK_PER_CODE = 3;
/** Guarda un comentario en KV («fb:<fecha>:<código>»). Pide un código válido cuando el acceso es con código. */
export async function handleFeedback(request, env, cors, requireCode) {
  if (!env.ASTRO_KV) return json({ error: "not_configured" }, 503, cors);
  const raw = await request.text();
  if (raw.length > FEEDBACK_MAX * 4) return json({ error: "bad_request" }, 413, cors);
  let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
  const text = String((body && body.text) || "").replace(/\s+\n/g, "\n").trim();
  if (text.length < FEEDBACK_MIN) return json({ error: "feedback_short", min: FEEDBACK_MIN }, 400, cors);
  if (text.length > FEEDBACK_MAX) return json({ error: "feedback_long", max: FEEDBACK_MAX }, 400, cors);
  const codes = parseCodes(env.ACCESS_CODES);
  let code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
  if (code && !(code in codes)) return json({ error: "code_invalid" }, 403, cors);
  if (!code && requireCode) return json({ error: "code_required" }, 401, cors);
  if (!code) code = "PUBLICO";
  const kv = env.ASTRO_KV, ck = "fbcount:" + code;
  const n = +(await kv.get(ck)) || 0;
  if (n >= FEEDBACK_PER_CODE) return json({ error: "feedback_limit" }, 429, cors);
  const at = new Date().toISOString();
  const title = String((body && body.report_title) || "").slice(0, 200);
  await kv.put(`fb:${at}:${code}`, JSON.stringify({ code, at, report_title: title, text }));
  await kv.put(ck, String(n + 1));
  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------- handler
async function kvGetJSON(kv, key, fallback) { try { const v = await kv.get(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const requireCode = env.REQUIRE_CODE !== "false";
    const cap = +(env.MONTHLY_USD_LIMIT || 15);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const protocolOk = !!(env.PROTOCOL || (env.ASTRO_KV && (await env.ASTRO_KV.get("protocol"))));
      const month = env.ASTRO_KV ? await kvGetJSON(env.ASTRO_KV, monthKey(), { usd: 0 }) : { usd: 0 };
      const day = env.ASTRO_KV ? +(await env.ASTRO_KV.get(dayKey())) || 0 : 0;
      const configured = !!(env.ANTHROPIC_API_KEY && protocolOk && env.ASTRO_KV);
      return json({ service: "astroinforme", version: SERVICE_VERSION, model: env.MODEL || DEFAULT_MODEL,
        access: requireCode ? "code" : "public", turnstile: !!env.TURNSTILE_SECRET,
        // «available»: si hoy se puede pedir un informe (sin revelar el gasto)
        available: configured && month.usd < cap && (requireCode || day < +(env.DAILY_LIMIT || 8)),
        configured: { api_key: !!env.ANTHROPIC_API_KEY, protocol: protocolOk, style: !!(env.ASTRO_KV && (await env.ASTRO_KV.get("style"))), kv: !!env.ASTRO_KV, codes: Object.keys(parseCodes(env.ACCESS_CODES)).length } }, 200, cors);
    }
    if (request.method !== "POST") return json({ error: "bad_request" }, 405, cors);
    if (!cors["access-control-allow-origin"] && request.headers.get("origin")) return json({ error: "forbidden_origin" }, 403, cors);

    // comentario de quien probó la app (después de leer su informe)
    if (url.pathname === "/feedback") return handleFeedback(request, env, cors, requireCode);

    // configuración mínima
    const base = env.PROTOCOL || (env.ASTRO_KV ? await env.ASTRO_KV.get("protocol") : null);
    if (!env.ANTHROPIC_API_KEY || !base || !env.ASTRO_KV) return json({ error: "not_configured" }, 503, cors);
    const style = await env.ASTRO_KV.get("style");
    const protocol = style ? `${base}\n\n${style}` : base;

    // datos
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "bad_request" }, 413, cors);
    let payload; try { payload = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
    if (!validChart(payload)) return json({ error: "bad_request" }, 400, cors);

    const kv = env.ASTRO_KV;
    const ip = request.headers.get("cf-connecting-ip") || "";

    // verificación anti-robots (si está configurada)
    if (env.TURNSTILE_SECRET && !(await verifyTurnstile(env.TURNSTILE_SECRET, request.headers.get("x-turnstile-token"), ip))) return json({ error: "bot_check" }, 403, cors);

    // código de acceso y cupo; en acceso público, un código válido usa su propio cupo
    const codes = parseCodes(env.ACCESS_CODES);
    const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
    const useCode = requireCode || !!code;
    let limit = null, used = 0;
    if (useCode) {
      if (!code) return json({ error: "code_required" }, 401, cors);
      if (!(code in codes)) return json({ error: "code_invalid" }, 403, cors);
      limit = codes[code];
      used = +(await kv.get("used:" + code)) || 0;
      if (used >= limit) {
        // si el informe de este código se perdió en el camino, se entrega otra vez el guardado (48 h), sin gastar
        const saved = await kvGetJSON(kv, "rep:" + code, null);
        if (saved) return json({ report: saved, remaining: 0, recovered: true }, 200, cors);
        return json({ error: "quota_exhausted", remaining: 0 }, 403, cors);
      }
    }
    const mk = monthKey();
    const month = await kvGetJSON(kv, mk, { reports: 0, usd: 0, failed: 0 });
    if (month.usd >= cap) return json({ error: "budget_exhausted" }, 429, cors);

    // acceso público: límite por visitante y por día; se reserva antes de llamar a Claude
    let vKey = null, vUsed = 0, dKey = null, dUsed = 0;
    if (!useCode) {
      dKey = dayKey(); dUsed = +(await kv.get(dKey)) || 0;
      if (dUsed >= +(env.DAILY_LIMIT || 8)) return json({ error: "daily_limit" }, 429, cors);
      // la sal es secreta: sin ella no se puede reconstruir la IP a partir del resumen
      vKey = `v:${dKey.slice(4)}:${await visitorId(ip, env.VISITOR_SALT || env.ANTHROPIC_API_KEY)}`; vUsed = +(await kv.get(vKey)) || 0;
      if (vUsed >= +(env.VISITOR_DAILY_LIMIT || 1)) return json({ error: "visitor_limit" }, 429, cors);
      await kv.put(vKey, String(vUsed + 1), { expirationTtl: 172800 });
      await kv.put(dKey, String(dUsed + 1), { expirationTtl: 172800 });
    }

    // respuesta en flujo: espacios cada 10 s para que la conexión no se considere inactiva; al final, el JSON
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const keep = setInterval(() => { writer.write(enc.encode(" ")).catch(() => { }); }, KEEPALIVE_MS);
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
            used += 1; await kv.put("used:" + code, String(used));
            // copia del último informe del código durante 48 h, para recuperarlo si no llegó a la pantalla
            await kv.put("rep:" + code, JSON.stringify(report), { expirationTtl: REPORT_TTL });
          }
          out = { report, remaining: useCode ? Math.max(0, limit - used) : null };
        }
        await kv.put(mk, JSON.stringify(month));
      } catch (e) {
        out = { error: "upstream" };
        // queda en los registros del Worker (Observability → Logs); no incluye datos de la carta
        console.log(JSON.stringify({ event: "upstream_error", status: e.status || null, detail: e.detail || String(e.message || e) }));
        // lo gastado antes del error también cuenta para el tope del mes
        if (spent.usd) { month.usd = +(month.usd + spent.usd).toFixed(4); month.failed += 1; await kv.put(mk, JSON.stringify(month)).catch(() => { }); }
        // si la API falló, el visitante puede volver a intentar
        if (vKey) { await kv.put(vKey, String(vUsed), { expirationTtl: 172800 }).catch(() => { }); await kv.put(dKey, String(dUsed), { expirationTtl: 172800 }).catch(() => { }); }
      }
      clearInterval(keep);
      await writer.write(enc.encode(JSON.stringify(out)));
      await writer.close();
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(work);
    return new Response(readable, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });
  },
};
