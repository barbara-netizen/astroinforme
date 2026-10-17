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

let calls = [], turnstileOK = true, turnstileCalls = 0;
function mockClaude(sequence) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("challenges.cloudflare.com")) { turnstileCalls++; assert.equal(init.body.get("secret"), "ts-secret"); return new Response(JSON.stringify({ success: turnstileOK && init.body.get("response") === "tok-ok" })); }
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
const req = (body, code, origin = ORIGIN, extra = {}) => new Request("https://astro.example.workers.dev/", { method: "POST", headers: { "content-type": "application/json", origin, ...(code ? { "x-astro-code": code } : {}), ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
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
assert.equal(month.reports, 2); assert.equal(month.failed, 2); // el error de la API después del análisis también se registra assert.ok(month.usd > 0);
const e2 = env({ MONTHLY_USD_LIMIT: "0.01" }); await e2.ASTRO_KV.put("month:" + new Date().toISOString().slice(0, 7), JSON.stringify({ reports: 1, usd: 0.5, failed: 0 }));
assert.equal((await run(req(carta, "ANA-7K2"), e2)).body.error, "budget_exhausted");

// 8. salud y preflight
const h = await worker.fetch(new Request("https://x/health"), env(), {}); const hb = await h.json();
assert.deepEqual(hb.configured, { api_key: true, protocol: true, kv: true, codes: 2 });
assert.equal(hb.access, "code"); assert.equal(hb.available, true); assert.equal(hb.turnstile, false);
const o = await worker.fetch(new Request("https://x/", { method: "OPTIONS", headers: { origin: ORIGIN } }), env(), {});
assert.equal(o.status, 204); assert.match(o.headers.get("access-control-allow-headers"), /x-astro-code/);

// 9. tratamiento: la instrucción llega a la fase B; un valor inválido se rechaza
const conTrato = (g) => { const c = JSON.parse(JSON.stringify(carta)); if (g === undefined) delete c.request.address_gender; else c.request.address_gender = g; return c; };
mockClaude([ANALISIS, ok]);
await run(req(conTrato("FEMININE"), "ANA-7K2"), env());
assert.match(calls[1].messages[0].content, /usá el femenino/);
mockClaude([ANALISIS, ok]);
await run(req(conTrato(undefined), "ANA-7K2"), env());
assert.match(calls[1].messages[0].content, /No sabés el género/);
assert.equal((await run(req(conTrato("OTRO"), "ANA-7K2"), env())).body.error, "bad_request");

// 10. control de estilo: dos fórmulas de contraste → una corrección; si la corrección rompe lo técnico, se conserva la anterior
const conEstilo = JSON.parse(JSON.stringify(ok));
conEstilo.sections[0].body_markdown += "\n\nSaturno no es un castigo, sino una forma. Tu miedo no es debilidad, sino prudencia.";
mockClaude([ANALISIS, conEstilo, ok]);
r = await run(req(carta, "ANA-7K2"), env());
assert.equal(calls.length, 3); assert.match(calls[2].messages[0].content, /control de estilo/); assert.doesNotMatch(calls[2].messages[0].content, /auditoría técnica comparó/);
assert.equal(r.body.report.audit.corrected, true); assert.deepEqual(r.body.report.audit.style_issues, []);
mockClaude([ANALISIS, conEstilo, bad]);
r = await run(req(carta, "ANA-7K2"), env());
assert.equal(r.body.report.audit.all_references_present_in_chart, true); assert.equal(r.body.report.audit.corrected, false);
assert.equal(r.body.report.audit.style_issues[0].kind, "contrast_formula");

// 11. acceso público: límite por visitante y por día; un código válido usa su propio cupo
const pub = env({ REQUIRE_CODE: "false", DAILY_LIMIT: "3" });
const ipReq = (ip, code) => req(carta, code, ORIGIN, { "cf-connecting-ip": ip });
mockClaude([ANALISIS, ok, ANALISIS, ok, ANALISIS, ok]);
assert.equal((await run(ipReq("1.1.1.1"), pub)).body.report.schema, "astroinforme.report/v1");
assert.equal((await run(ipReq("1.1.1.1"), pub)).body.error, "visitor_limit");
assert.ok((await run(ipReq("2.2.2.2"), pub)).body.report);
assert.equal((await run(ipReq("3.3.3.3", "ANA-7K2"), pub)).body.remaining, 1); // con código no cuenta para el día
assert.ok([...pub.ASTRO_KV.m.keys()].every((k) => !k.includes("1.1.1.1")), "la IP no se guarda");
mockClaude([ANALISIS, "500"]);
assert.equal((await run(ipReq("4.4.4.4"), pub)).body.error, "upstream");
mockClaude([ANALISIS, ok]);
assert.ok((await run(ipReq("4.4.4.4"), pub)).body.report, "tras un error de la API se puede reintentar");
assert.equal((await run(ipReq("5.5.5.5"), pub)).body.error, "daily_limit");
const hp = await (await worker.fetch(new Request("https://x/health"), pub, {})).json();
assert.equal(hp.access, "public"); assert.equal(hp.available, false);

// 12. Turnstile
const ts = env({ REQUIRE_CODE: "false", TURNSTILE_SECRET: "ts-secret" });
mockClaude([ANALISIS, ok]);
assert.equal((await run(ipReq("6.6.6.6"), ts)).body.error, "bot_check");
assert.equal((await run(req(carta, null, ORIGIN, { "cf-connecting-ip": "6.6.6.6", "x-turnstile-token": "tok-malo" }), ts)).body.error, "bot_check");
assert.ok((await run(req(carta, null, ORIGIN, { "cf-connecting-ip": "6.6.6.6", "x-turnstile-token": "tok-ok" }), ts)).body.report);
assert.equal(turnstileCalls, 2);

// 13. la app envía una carta reducida, sin fecha, hora, lugar ni día juliano
const reducida = { schema: carta.schema, engine: carta.engine, person: { first_name: "Prueba" }, request: carta.request,
  birth: { time_precision: carta.birth.time_precision, time_precision_label: carta.birth.time_precision_label },
  chart: { ...carta.chart, jd_ut: undefined }, warnings: carta.warnings.map((w) => ({ code: w.code })) };
mockClaude([ANALISIS, ok]);
r = await run(req(reducida, "PEDRO-9X4"), env());
assert.equal(r.body.report.audit.all_references_present_in_chart, true);

console.log("OK — 13 grupos de pruebas; costo simulado del mes: US$", month.usd);
