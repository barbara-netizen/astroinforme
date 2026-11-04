// Pruebas 1.9.2: una respuesta defectuosa no hace perder el pedido ni el cupo.
import assert from "node:assert/strict";
import { ReportJob } from "../src/job.js";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, ORIGIN, FakeNamespace, ledgerState } from "./helpers.mjs";
import worker from "../src/worker.js";

const ok = informeOk(), ID = "gen-000000000000001", CODE = "LUZ-3M8Q";
const env = () => { const e = baseEnv(); e.REPORT_JOB = new FakeNamespace(ReportJob); e.REPORT_JOB.env = e; return e; };
const post = () => new Request("https://astro.example.workers.dev/jobs", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-astro-code": CODE }, body: JSON.stringify({ ...carta(), request_id: ID }) });
const get = () => new Request("https://astro.example.workers.dev/jobs/" + ID, { headers: { origin: ORIGIN, "x-astro-code": CODE } });
const call = async (r, e) => { const res = await worker.fetch(r, e, {}); return { status: res.status, body: await res.json() }; };
const generate = async (e, seq) => { mockClaude([]); await call(post(), e); mockClaude(seq); await e.REPORT_JOB.obj(ID).alarm(); return (await call(get(), e)).body; };
const gen = async (e) => JSON.parse(await e.ASTRO_KV.get("gen:" + ID));

{ // fase B cortada por max_tokens: se reintenta solo esa fase
  const e = env(); const r = await generate(e, [ANALISIS, { __stop: "max_tokens", text: "{ \"sections\": [" }, ok]);
  assert.equal(r.status, "done"); assert.equal(state.calls.length, 3); assert.equal(await e.ASTRO_KV.get("used:" + CODE), "1");
}
{ // JSON roto una vez
  const e = env(); const r = await generate(e, [ANALISIS, "esto no es json", ok]);
  assert.equal(r.status, "done"); assert.equal(state.calls.length, 3);
}
{ // análisis roto una vez
  const e = env(); const r = await generate(e, ["nada", ANALISIS, ok]);
  assert.equal(r.status, "done"); assert.equal(state.calls.length, 3);
}
{ // informe vacío, incompleto o sin mito: no se entrega como bueno
  for (const mala of [{}, { sections: [] }, { ...clone(ok), sections: ok.sections.slice(0, 2) }, { ...clone(ok), sections: ok.sections.filter((s) => s.id !== "myth") }]) {
    const e = env(); const r = await generate(e, [ANALISIS, mala, ok]);
    assert.equal(r.status, "done"); assert.ok(r.report.sections.length >= 6);
  }
}
{ // dos respuestas malas: falla, sin descontar cupo, con el motivo registrado y sin más llamadas
  const e = env(); const r = await generate(e, [ANALISIS, "roto", "roto"]);
  assert.equal(r.status, "failed"); assert.equal(r.error, "upstream"); assert.equal(state.calls.length, 3);
  assert.equal(await e.ASTRO_KV.get("used:" + CODE), null); assert.equal((await ledgerState(e, CODE)).inflight, null);
  const g = await gen(e); assert.equal(g.outcome, "upstream"); assert.equal(g.reason, "json"); assert.ok(g.usd > 0);
}
{ // informe técnicamente bueno y corrección de estilo rota: se entrega el informe original
  const e = env(); const estilo = clone(ok);
  estilo.sections[0].body_markdown += "\n\nSaturno no es un castigo, sino una forma. Tu miedo no es debilidad, sino prudencia. Tu deseo no es capricho, sino brújula.";
  const r = await generate(e, [ANALISIS, estilo, "roto", "roto"]);
  assert.equal(r.status, "done"); assert.equal(r.report.audit.corrected, false); assert.equal(await e.ASTRO_KV.get("used:" + CODE), "1");
}
{ // falla la API en la corrección de estilo: también se entrega
  const e = env(); const estilo = clone(ok);
  estilo.sections[0].body_markdown += "\n\nSaturno no es un castigo, sino una forma. Tu miedo no es debilidad, sino prudencia. Tu deseo no es capricho, sino brújula.";
  const r = await generate(e, [ANALISIS, estilo, "500"]);
  assert.equal(r.status, "done");
}
{ // fallan la copia y el registro del mes: el informe se entrega igual y el cupo se descuenta una vez
  const e = env(); const put = e.ASTRO_KV.put.bind(e.ASTRO_KV);
  e.ASTRO_KV.put = async (k, v, o) => { if (k.startsWith("rep:") || k.startsWith("month:")) throw new Error("kv 429"); return put(k, v, o); };
  const r = await generate(e, [ANALISIS, ok]);
  assert.equal(r.status, "done"); assert.ok(r.report); assert.equal(await e.ASTRO_KV.get("used:" + CODE), "1");
}
console.log("OK — generación 1.9.2: 8 grupos");
