// Pruebas 1.6: generación desacoplada (Durable Object con alarma), reanudación por fases y registro de costos.
import assert from "node:assert/strict";
import { ReportJob, MAX_ATTEMPTS } from "../src/job.js";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, req, run, ORIGIN } from "./helpers.mjs";
import worker from "../src/worker.js";

const ok = informeOk();
const bad = clone(ok); bad.technical_references_used.push({ type: "position", body: "SUN", sign: "LEO", deg: "9°29'" });
let n = 0; const group = () => { n++; };

// Durable Object simulado: almacenamiento en memoria y alarma que la prueba dispara a mano
class FakeStorage {
  constructor() { this.m = new Map(); this.alarm = null; }
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { for (const x of [].concat(k)) this.m.delete(x); }
  async deleteAll() { this.m.clear(); this.alarm = null; }
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}
class FakeNamespace {
  constructor() { this.objs = new Map(); this.env = null; }
  idFromName(name) { return name; }
  get(id) {
    if (!this.objs.has(id)) this.objs.set(id, new ReportJob({ storage: new FakeStorage() }, this.env));
    const o = this.objs.get(id);
    return { fetch: (url, init) => o.fetch(new Request(url, init)) };
  }
  obj(id) { return this.objs.get(id); }
}
const env = (over = {}) => { const e = baseEnv(over); e.REPORT_JOB = new FakeNamespace(); e.REPORT_JOB.env = e; return e; };
const ID = "job-000000000000001", ID2 = "job-000000000000002";
const post = (id, code = "LUZ-3M8Q", c = carta()) => new Request("https://astro.example.workers.dev/jobs", {
  method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...(code ? { "x-astro-code": code } : {}) }, body: JSON.stringify({ ...c, request_id: id }) });
const get = (id, code = "LUZ-3M8Q") => new Request("https://astro.example.workers.dev/jobs/" + id, { headers: { origin: ORIGIN, ...(code ? { "x-astro-code": code } : {}) } });
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json() }; };

group("health anuncia el modo desacoplado");
{
  const h = await call(new Request("https://x/health"), env());
  assert.equal(h.body.version, "1.6"); assert.equal(h.body.jobs, true);
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
  assert.ok(await e.ASTRO_KV.get("inflight:LUZ-3M8Q"), "reserva el cupo");
  r = await call(get(ID), e);
  assert.equal(r.body.status, "queued");
  // la app se desconecta: la generación no depende de ella
  mockClaude([ANALISIS, ok]);
  await e.REPORT_JOB.obj(ID).alarm();
  r = await call(get(ID), e);
  assert.equal(r.body.status, "done"); assert.equal(r.body.report.schema, "astroinforme.report/v1"); assert.equal(r.body.remaining, 2);
  assert.equal(await e.ASTRO_KV.get("used:LUZ-3M8Q"), "1");
  assert.equal(await e.ASTRO_KV.get("inflight:LUZ-3M8Q"), null);
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
  assert.equal(await e.ASTRO_KV.get("inflight:LUZ-3M8Q"), null, "libera la reserva para reintentar");
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

group("sin el binding del Durable Object, /jobs responde not_configured");
{
  assert.equal((await call(post(ID), baseEnv())).body.error, "not_configured");
}

console.log(`OK — ${n} grupos de pruebas de trabajo desacoplado (1.6)`);
