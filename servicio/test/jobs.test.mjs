// Pruebas 1.6: generación desacoplada (Durable Object con alarma), reanudación por fases y registro de costos.
import assert from "node:assert/strict";
import { ReportJob, MAX_ATTEMPTS } from "../src/job.js";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, req, run, ORIGIN, FakeNamespace, ledgerState } from "./helpers.mjs";
import worker, { streamErrorStatus, readStream, callClaude } from "../src/worker.js";

const ok = informeOk();
const bad = clone(ok); bad.technical_references_used.push({ type: "position", body: "SUN", sign: "LEO", deg: "9°29'" });
let n = 0; const group = () => { n++; };

const env = (over = {}) => { const e = baseEnv(over); e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; return e; };
const ID = "job-000000000000001", ID2 = "job-000000000000002";
const post = (id, code = "LUZ-3M8Q", c = carta()) => new Request("https://astro.example.workers.dev/jobs", {
  method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...(code ? { "x-astro-code": code } : {}) }, body: JSON.stringify({ ...c, request_id: id }) });
const get = (id, code = "LUZ-3M8Q") => new Request("https://astro.example.workers.dev/jobs/" + id, { headers: { origin: ORIGIN, ...(code ? { "x-astro-code": code } : {}) } });
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json() }; };

group("health anuncia el modo desacoplado");
{
  const h = await call(new Request("https://x/health"), env());
  assert.equal(h.body.version, "1.7.1"); assert.equal(h.body.jobs, true);
  const h2 = await call(new Request("https://x/health"), baseEnv());
  assert.equal(h2.body.jobs, false);
}

group("camino feliz: el pedido vuelve enseguida, la alarma genera y el estado entrega el informe");
{
  const e = env();
  mockClaude([]);
  let r = await call(post(ID), e);
  assert.equal(r.status, 202); assert.equal(r.body.status, "queued"); assert.equal(state.calls.length, 0, "no llama al modelo dentro del pedido");
  assert.ok(e.REPORT_JOB.obj(ID).storage.alarm != null, "programa la alarma");
  assert.equal((await ledgerState(e, "LUZ-3M8Q")).inflight.request_id, ID, "reserva el cupo");
  r = await call(get(ID), e);
  assert.equal(r.body.status, "queued");
  // la app se desconecta: la generación no depende de ella
  mockClaude([ANALISIS, ok]);
  await e.REPORT_JOB.obj(ID).alarm();
  r = await call(get(ID), e);
  assert.equal(r.body.status, "done"); assert.equal(r.body.report.schema, "astroinforme.report/v1"); assert.equal(r.body.remaining, 2);
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), "1");
  assert.equal((await ledgerState(e, "LUZ-3M8Q")).inflight, null);
  assert.equal(JSON.parse(await e.ASTRO_KV.get("rep:LUZ-3M8Q")).request_id, ID);
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + ID));
  assert.equal(gen.mode, "job"); assert.equal(gen.outcome, "delivered"); assert.ok(gen.usd > 0); assert.ok(gen.phases.a > 0 && gen.phases.b > 0);
  assert.equal(gen.corrected, false); assert.equal(gen.attempts, 1); assert.equal(gen.lang, "es");
  assert.ok(!JSON.stringify(gen).includes("Prueba"), "el registro no guarda el nombre");
  // se limpian las fases intermedias y queda programada la limpieza a 48 h
  const st = e.REPORT_JOB.obj(ID).storage;
  assert.equal(st.m.has("phase:analisis"), false); assert.ok(st.alarm > Date.now() + 47 * 3600 * 1000);

  group("reintento y recarga: el mismo request_id devuelve el estado, sin otro trabajo ni otro cobro");
  mockClaude([]);
  r = await call(post(ID), e);
  assert.equal(r.body.status, "done"); assert.ok(r.body.report); assert.equal(state.calls.length, 0);
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), "1");

  group("el estado de un pedido con código solo se ve con ese código");
  assert.equal((await call(get(ID, "ANA-7K2"), e)).status, 403);
  assert.equal((await call(get(ID, null), e)).status, 403);
  assert.equal((await call(get("job-999999999999999"), e)).status, 404);
  assert.equal((await call(get("corto"), e)).status, 400);

  group("limpieza a las 48 h");
  const meta = await st.get("meta"); meta.cleanupAt = 0; await st.put("meta", meta);
  await e.REPORT_JOB.obj(ID).alarm();
  assert.equal(st.m.size, 0);
  assert.equal((await call(get(ID), e)).status, 404);
}

group("mientras un trabajo sigue, otro pedido con el mismo código recibe in_progress");
{
  const e = env();
  await call(post(ID), e);
  const r = await call(post(ID2), e);
  assert.equal(r.status, 409); assert.equal(r.body.error, "in_progress");
}

group("error transitorio: se reintenta desde la última fase guardada, sin volver a pagar la fase A");
{
  const e = env();
  await call(post(ID), e);
  mockClaude([ANALISIS, "500"]);
  await e.REPORT_JOB.obj(ID).alarm();
  let r = await call(get(ID), e);
  assert.equal(r.body.status, "queued", "vuelve a la cola");
  assert.ok(e.REPORT_JOB.obj(ID).storage.m.has("phase:analisis"));
  mockClaude([ok]);
  await e.REPORT_JOB.obj(ID).alarm();
  assert.equal(state.calls.length, 1, "solo se llama a la fase B");
  r = await call(get(ID), e);
  assert.equal(r.body.status, "done");
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + ID));
  assert.equal(gen.attempts, 2); assert.ok(gen.phases.a > 0 && gen.phases.b > 0, "el gasto de la fase A de la primera ejecución se conserva");
}

group("errores persistentes: se agotan los intentos y el pedido falla sin descontar cupo");
{
  const e = env();
  await call(post(ID), e);
  for (let i = 0; i < MAX_ATTEMPTS; i++) { mockClaude(i === 0 ? [ANALISIS, "500"] : ["500"]); await e.REPORT_JOB.obj(ID).alarm(); }
  const r = await call(get(ID), e);
  assert.equal(r.body.status, "failed"); assert.equal(r.body.error, "upstream");
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), null);
  assert.equal((await ledgerState(e, "LUZ-3M8Q")).inflight, null, "libera la reserva para reintentar");
  const month = JSON.parse(await e.ASTRO_KV.get("month:" + new Date().toISOString().slice(0, 7)));
  assert.ok(month.usd > 0 && month.failed === 1, "el gasto parcial cuenta para el tope");
}

group("ejecución cortada sin aviso (p. ej. límite de 15 min): la siguiente alarma no supera el máximo de intentos");
{
  const e = env();
  await call(post(ID), e);
  const st = e.REPORT_JOB.obj(ID).storage;
  const meta = await st.get("meta"); meta.attempts = MAX_ATTEMPTS; meta.status = "running"; await st.put("meta", meta);
  mockClaude([]);
  await e.REPORT_JOB.obj(ID).alarm();
  assert.equal(state.calls.length, 0);
  assert.equal((await call(get(ID), e)).body.status, "failed");
}

group("auditoría fallida: el pedido falla, no descuenta cupo y queda registrado");
{
  const e = env();
  await call(post(ID), e);
  mockClaude([ANALISIS, bad, bad]);
  await e.REPORT_JOB.obj(ID).alarm();
  const r = await call(get(ID), e);
  assert.equal(r.body.status, "failed"); assert.equal(r.body.error, "audit_failed");
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), null);
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + ID));
  assert.equal(gen.outcome, "audit_failed"); assert.equal(gen.corrected, true); assert.ok(gen.phases.c > 0);
}

group("acceso público: el trabajo usa el límite por visitante y lo devuelve si la API falla");
{
  const e = env({ REQUIRE_CODE: "false" });
  const pub = (id) => new Request("https://astro.example.workers.dev/jobs", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": "9.9.9.9" }, body: JSON.stringify({ ...carta(), request_id: id }) });
  assert.equal((await call(pub(ID), e)).status, 202);
  assert.equal((await call(pub(ID2), e)).body.error, "visitor_limit");
  for (let i = 0; i < MAX_ATTEMPTS; i++) { mockClaude(["500"]); await e.REPORT_JOB.obj(ID).alarm(); }
  assert.equal((await call(get(ID, null), e)).body.status, "failed", "sin código, el estado se ve sin código");
  assert.equal((await call(pub(ID2), e)).status, 202, "tras el fallo, el visitante puede volver a pedir");
}

group("modo en flujo (app anterior): sigue funcionando y también deja registro de costos");
{
  const e = env();
  mockClaude([ANALISIS, ok]);
  const r = await run(req({ ...carta(), request_id: ID }, "LUZ-3M8Q"), e);
  assert.ok(r.body.report);
  assert.equal(JSON.parse(await e.ASTRO_KV.get("gen:" + ID)).mode, "stream");
}

group("código agotado: un pedido nuevo en modo desacoplado recibe el informe guardado, sin generar");
{
  const e = env();
  mockClaude([ANALISIS, ok]);
  await call(post(ID, "PEDRO-9X4"), e);
  await e.REPORT_JOB.obj(ID).alarm();
  mockClaude([]);
  const r = await call(post(ID2, "PEDRO-9X4"), e);
  assert.equal(r.body.recovered, true); assert.ok(r.body.report); assert.equal(state.calls.length, 0);
}

group("código agotado: para otra carta no se entrega el informe guardado");
{
  const e = env();
  mockClaude([ANALISIS, ok]);
  await call(post(ID, "PEDRO-9X4"), e);
  await e.REPORT_JOB.obj(ID).alarm();
  assert.ok(JSON.parse(await e.ASTRO_KV.get("rep:PEDRO-9X4")).fp, "la copia guarda la huella de los datos");
  mockClaude([]);
  const otra = clone(carta()); otra.person.first_name = "Otra";
  const r = await call(post(ID2, "PEDRO-9X4", otra), e);
  assert.equal(r.status, 403); assert.equal(r.body.error, "quota_exhausted"); assert.equal(r.body.report, undefined);
  assert.equal(state.calls.length, 0);
  // copia anterior a la huella (servicio 1.6): se acepta hasta que venza
  const rep = JSON.parse(await e.ASTRO_KV.get("rep:PEDRO-9X4")); delete rep.fp;
  await e.ASTRO_KV.put("rep:PEDRO-9X4", JSON.stringify(rep));
  assert.equal((await call(post("job-000000000000003", "PEDRO-9X4", otra), e)).body.recovered, true);
}

group("pedido fallido: al reenviarlo con el mismo request_id se avisa que puede reintentarse");
{
  const e = env();
  await call(post(ID), e);
  for (let i = 0; i < MAX_ATTEMPTS; i++) { mockClaude(i === 0 ? [ANALISIS, "500"] : ["500"]); await e.REPORT_JOB.obj(ID).alarm(); }
  const r = await call(post(ID), e);
  assert.equal(r.body.status, "failed"); assert.equal(r.body.retry, true);
  // con un identificador nuevo se genera de nuevo, sin cupo descontado
  mockClaude([]);
  assert.equal((await call(post(ID2), e)).status, 202);
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), null);
}

group("errores dentro del flujo y cortes de red se clasifican como transitorios");
{
  assert.equal(streamErrorStatus({ type: "overloaded_error" }), 529);
  assert.equal(streamErrorStatus({ type: "rate_limit_error" }), 429);
  assert.equal(streamErrorStatus({ type: "api_error" }), 500);
  assert.equal(streamErrorStatus({ type: "invalid_request_error" }), 400);
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  const sse = (s) => new Response(s, { headers: { "content-type": "text/event-stream" } });
  let err = await readStream(sse(ev({ type: "message_start", message: { usage: {} } }) + ev({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } })), "m").catch((x) => x);
  assert.equal(err.status, 529);
  err = await readStream(sse(ev({ type: "message_start", message: { usage: {} } })), "m").catch((x) => x);
  assert.equal(err.status, null, "flujo cortado sin final");
  globalThis.fetch = async () => { throw new TypeError("network connection lost"); };
  err = await callClaude(baseEnv(), { system: "s", user: "u", maxTokens: 10 }).catch((x) => x);
  assert.equal(err.message, "upstream"); assert.equal(err.status, null);
  // en el trabajo desacoplado, un error de sobrecarga dentro del flujo se reintenta
  const e = env();
  await call(post(ID), e);
  globalThis.fetch = async () => sse(ev({ type: "message_start", message: { usage: {} } }) + ev({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }));
  await e.REPORT_JOB.obj(ID).alarm();
  assert.equal((await call(get(ID), e)).body.status, "queued", "vuelve a la cola en lugar de fallar");
}

group("cupo atómico: pedidos /jobs simultáneos con el mismo código crean un solo trabajo");
{
  const e = env();
  const rs = await Promise.all([ID, ID2, "job-000000000000003"].map((id) => call(post(id, "PEDRO-9X4"), e)));
  assert.equal(rs.filter((r) => r.status === 202).length, 1);
  assert.equal(rs.filter((r) => r.body.error === "in_progress").length, 2);
}

group("origen obligatorio, código verificado antes de tocar el pedido y límite de frecuencia");
{
  const e = env();
  const sinOrigen = new Request("https://astro.example.workers.dev/jobs/" + ID, { headers: { "x-astro-code": "LUZ-3M8Q" } });
  assert.equal((await call(sinOrigen, e)).body.error, "forbidden_origin");
  assert.equal((await call(post(ID, "FALSO-0000"), e)).body.error, "code_invalid");
  assert.equal(e.REPORT_JOB.objs.size, 0, "no se creó ningún objeto de pedido");
  let n = 0; e.RATE_LIMITER = { limit: async ({ key }) => { assert.equal(key, "c:LUZ-3M8Q"); return { success: ++n <= 1 }; } };
  assert.equal((await call(post(ID), e)).status, 202);
  assert.equal((await call(post(ID2), e)).body.error, "rate_limited");
  // las consultas de estado no cuentan para el límite
  assert.equal((await call(get(ID), e)).body.status, "queued");
}

group("sin el binding del Durable Object, /jobs responde not_configured");
{
  assert.equal((await call(post(ID), baseEnv())).body.error, "not_configured");
}

console.log(`OK — ${n} grupos de pruebas de trabajo desacoplado (1.6)`);
