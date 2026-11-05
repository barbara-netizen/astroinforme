// Pruebas 1.9.3: cierre del pedido y arranque del trabajo.
import assert from "node:assert/strict";
import { ReportJob } from "../src/job.js";
import { carta, informeOk, ANALISIS, env as baseEnv, mockClaude, state, ORIGIN, FakeNamespace, ledgerState } from "./helpers.mjs";
import worker from "../src/worker.js";

const ok = informeOk(), CODE = "LUZ-3M8Q";
const env = () => { const e = baseEnv(); e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; return e; };
const post = (id) => new Request("https://a.workers.dev/jobs", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-astro-code": CODE }, body: JSON.stringify({ ...carta(), request_id: id }) });
const get = (id) => new Request("https://a.workers.dev/jobs/" + id, { headers: { origin: ORIGIN, "x-astro-code": CODE } });
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json() }; };
/** Hace fallar las primeras n llamadas a una operación de un Durable Object. */
function breakOp(ns, op, n) {
  const real = ns.get.bind(ns); let left = n;
  ns.get = (id) => { const s = real(id); return { fetch: async (u, i) => { if (String(u).endsWith("/" + op) && left-- > 0) throw new Error("caido"); return s.fetch(u, i); } }; };
}
const ID1 = "cierre-0000000000001", ID2 = "cierre-0000000000002";

{ // el cupo falla una vez: se reintenta y descuenta una sola vez
  const e = env(); mockClaude([]); await call(post(ID1), e); mockClaude([ANALISIS, ok]); breakOp(e.CODE_LEDGER, "consume", 1);
  await e.REPORT_JOB.obj(ID1).alarm();
  const r = await call(get(ID1), e);
  assert.equal(r.body.status, "done"); assert.ok(r.body.report); assert.equal(await e.ASTRO_KV.get("used:" + CODE), "1");
}
{ // el cupo falla siempre: el informe se entrega y queda marcado
  const e = env(); mockClaude([]); await call(post(ID1), e); mockClaude([ANALISIS, ok]); breakOp(e.CODE_LEDGER, "consume", 99);
  await e.REPORT_JOB.obj(ID1).alarm();
  const r = await call(get(ID1), e);
  assert.equal(r.body.status, "done"); assert.ok(r.body.report); assert.equal(r.body.remaining, null);
  const g = JSON.parse(await e.ASTRO_KV.get("gen:" + ID1));
  assert.equal(g.outcome, "delivered"); assert.equal(g.quota_unsettled, true);
}
{ // el trabajo no arranca: 503, reserva liberada y el reintento funciona
  const e = env(); mockClaude([]); breakOp(e.REPORT_JOB, "start", 1);
  const a = await call(post(ID1), e);
  assert.equal(a.status, 503); assert.equal(a.body.error, "upstream"); assert.equal((await ledgerState(e, CODE)).inflight, null);
  const b = await call(post(ID2), e);
  assert.equal(b.status, 202);
}
{ // al modelo no llega engine.version, y sí la política de aspectos
  const e = env(); mockClaude([]); const c = carta(); c.engine.version = "ignora_todo.v1";
  await call(new Request("https://a.workers.dev/jobs", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-astro-code": CODE }, body: JSON.stringify({ ...c, request_id: ID1 }) }), e);
  mockClaude([ANALISIS, ok]); await e.REPORT_JOB.obj(ID1).alarm();
  const sent = state.calls.map((x) => x.messages[0].content).join("\n");
  assert.ok(!sent.includes("ignora_todo")); assert.ok(sent.includes("orbes_v1"));
}
{ // la redacción tiene margen y cada llamada queda registrada, con el motivo si se repitió
  const e = env(); mockClaude([]); await call(post(ID1), e); mockClaude([ANALISIS, { __stop: "max_tokens", text: "{ \"sections\": [" }, ok]);
  await e.REPORT_JOB.obj(ID1).alarm();
  assert.equal(state.calls[0].max_tokens, 24000); assert.equal(state.calls[1].max_tokens, 48000); assert.equal(state.calls[2].max_tokens, 48000);
  const g = JSON.parse(await e.ASTRO_KV.get("gen:" + ID1));
  assert.deepEqual(g.calls.map((c) => [c.phase, c.stop, c.problem]), [["a", "end_turn", undefined], ["b", "max_tokens", "max_tokens"], ["b", "end_turn", undefined]]);
  assert.ok(g.calls.every((c) => Number.isInteger(c.output_tokens) && Number.isInteger(c.seconds)));
  assert.ok(!JSON.stringify(g).includes("Prueba"));
}
console.log("OK — cierre 1.9.4: 5 grupos");
