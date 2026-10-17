// Pruebas del servicio con la API de Claude simulada (sin red, sin costo).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { parseCodes, costUSD, chartForModel } from "../src/worker.js";

const carta = JSON.parse(readFileSync(new URL("./carta-prueba.json", import.meta.url)));
const ok = JSON.parse(readFileSync(new URL("./informe-ok.json", import.meta.url)));
const bad = JSON.parse(JSON.stringify(ok)); bad.technical_references_used.push({ type: "position", body: "SUN", sign: "LEO", deg: "9°29'" });

class KV { constructor(init = {}) { this.m = new Map(Object.entries(init)); } async get(k) { return this.m.has(k) ? this.m.get(k) : null; } async put(k, v) { this.m.set(k, String(v)); } }
const ORIGIN = "https://barbara-netizen.github.io";
const env = (over = {}) => ({ ANTHROPIC_API_KEY: "sk-test", ACCESS_CODES: "ANA-7K2:2, PEDRO-9X4:1", ASTRO_KV: new KV({ protocol: "PROTOCOLO DE PRUEBA" }), ...over });

let calls = [];
function mockClaude(sequence) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.headers["x-api-key"], "sk-test");
    assert.equal(body.system[0].cache_control.type, "ephemeral");
    const next = sequence.shift();
    if (next === "500") return new Response(JSON.stringify({ error: { type: "overloaded_error" } }), { status: 529 });
    return new Response(JSON.stringify({ content: [{ type: "text", text: typeof next === "string" ? next : JSON.stringify(next) }], usage: { input_tokens: 10000, output_tokens: 5000, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0 }, stop_reason: "end_turn" }));
  };
}
const ANALISIS = { tension_organizadora: "x", temas: [], contradicciones: [], datos_no_fiables: [], jerarquia_de_secciones: [], mito: { nombre: "Prometeo", por_que: "y" } };
const req = (body, code, origin = ORIGIN) => new Request("https://astro.example.workers.dev/", { method: "POST", headers: { "content-type": "application/json", origin, ...(code ? { "x-astro-code": code } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) });
async function run(r, e) { const res = await worker.fetch(r, e, { waitUntil() { } }); const text = await res.text(); return { status: res.status, body: JSON.parse(text.trim()), raw: text, headers: res.headers }; }

// utilidades
assert.deepEqual(parseCodes("ana-7k2:3, PEDRO-9X4 : 2;mal;X:1"), { "ANA-7K2": 3, "PEDRO-9X4": 2 });
assert.equal(+costUSD({ input_tokens: 1e6, output_tokens: 1e6 }, "claude-opus-5-5").toFixed(2), 24);
const priv = chartForModel(carta);
assert.equal(priv.birth.local_date, undefined); assert.equal(priv.birth.place, undefined); assert.equal(priv.person, undefined); assert.equal(priv.chart.jd_ut, undefined);

// 1. sin código / código inválido / origen ajeno / datos inválidos
let e = env();
assert.equal((await run(req(carta), e)).body.error, "code_required");
assert.equal((await run(req(carta, "NADA-0000"), e)).body.error, "code_invalid");
assert.equal((await run(req(carta, "ANA-7K2", "https://otro.sitio"), e)).body.error, "forbidden_origin");
assert.equal((await run(req({ hola: 1 }, "ANA-7K2"), e)).body.error, "bad_request");
assert.equal((await run(req(carta, "ANA-7K2"), env({ ANTHROPIC_API_KEY: "" }))).body.error, "not_configured");

// 2. informe correcto: dos llamadas, auditoría limpia, cupo descontado
mockClaude([ANALISIS, ok]);
let r = await run(req(carta, "ana-7k2"), e);
assert.equal(r.status, 200); assert.equal(r.body.report.schema, "astroinforme.report/v1");
assert.equal(r.body.report.audit.all_references_present_in_chart, true); assert.equal(r.body.remaining, 1); assert.equal(calls.length, 2);
assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
// a Claude no le llegan fecha, hora ni lugar
const sent = calls.map((c) => c.messages[0].content).join("\n");
assert.ok(!sent.includes("1990-07-14") && !sent.includes("Hamburg")); assert.ok(sent.includes("La persona se llama Prueba"));
assert.equal(calls[0].system[0].text, "PROTOCOLO DE PRUEBA"); assert.equal(calls[0].model, "claude-opus-5-5");

// 3. auditoría falla → corrección → entrega
mockClaude([ANALISIS, bad, ok]);
r = await run(req(carta, "ANA-7K2"), e);
assert.equal(r.body.report.audit.corrected, true); assert.equal(r.body.remaining, 0); assert.equal(calls.length, 3);
assert.ok(calls[2].messages[0].content.includes("FASE C"));

// 4. cupo agotado
assert.equal((await run(req(carta, "ANA-7K2"), e)).body.error, "quota_exhausted");

// 5. auditoría falla dos veces → no se entrega y no se descuenta cupo
mockClaude([ANALISIS, bad, bad]);
r = await run(req(carta, "PEDRO-9X4"), e);
assert.equal(r.body.error, "audit_failed"); assert.equal(await e.ASTRO_KV.get("used:PEDRO-9X4"), null);

// 6. error de la API → upstream
mockClaude([ANALISIS, "500"]);
assert.equal((await run(req(carta, "PEDRO-9X4"), e)).body.error, "upstream");

// 7. tope mensual
const month = JSON.parse(await e.ASTRO_KV.get("month:" + new Date().toISOString().slice(0, 7)));
assert.equal(month.reports, 2); assert.equal(month.failed, 1); assert.ok(month.usd > 0);
const e2 = env({ MONTHLY_USD_LIMIT: "0.01" }); await e2.ASTRO_KV.put("month:" + new Date().toISOString().slice(0, 7), JSON.stringify({ reports: 1, usd: 0.5, failed: 0 }));
assert.equal((await run(req(carta, "ANA-7K2"), e2)).body.error, "budget_exhausted");

// 8. salud y preflight
const h = await worker.fetch(new Request("https://x/health"), env(), {}); const hb = await h.json();
assert.deepEqual(hb.configured, { api_key: true, protocol: true, kv: true, codes: 2 });
const o = await worker.fetch(new Request("https://x/", { method: "OPTIONS", headers: { origin: ORIGIN } }), env(), {});
assert.equal(o.status, 204); assert.match(o.headers.get("access-control-allow-headers"), /x-astro-code/);

console.log("OK — 8 grupos de pruebas; costo simulado del mes: US$", month.usd);
