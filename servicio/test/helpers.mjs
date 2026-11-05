// Utilidades compartidas por las pruebas nuevas (1.5). worker.test.mjs conserva las suyas sin cambios.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/worker.js";
import { CodeLedger } from "../src/ledger.js";

export const carta = () => JSON.parse(readFileSync(new URL("./carta-prueba.json", import.meta.url)));
export const informeOk = () => JSON.parse(readFileSync(new URL("./informe-ok.json", import.meta.url)));
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const ORIGIN = "https://barbara-netizen.github.io";
export const ANALISIS = { tension_organizadora: "x", temas: [], contradicciones: [], datos_no_fiables: [], jerarquia_de_secciones: [], mito: { nombre: "Prometeo", por_que: "y" } };

let now = Date.now();
export const advance = (s) => { now += s * 1000; };
export class KV {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); this.exp = new Map(); }
  async get(k) { if (this.exp.has(k) && this.exp.get(k) <= now) { this.m.delete(k); this.exp.delete(k); } return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v, o) { this.m.set(k, String(v)); if (o && o.expirationTtl) this.exp.set(k, now + o.expirationTtl * 1000); else this.exp.delete(k); }
  async delete(k) { this.m.delete(k); this.exp.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })) }; }
}
/** Durable Objects simulados: almacenamiento en memoria; la alarma la dispara la prueba a mano. */
export class FakeStorage {
  constructor() { this.m = new Map(); this.alarm = null; }
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { for (const x of [].concat(k)) this.m.delete(x); }
  async deleteAll() { this.m.clear(); this.alarm = null; }
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}
export class FakeNamespace {
  constructor(Cls) { this.Cls = Cls; this.objs = new Map(); this.env = null; }
  idFromName(name) { return name; }
  get(id) {
    if (!this.objs.has(id)) this.objs.set(id, new this.Cls({ storage: new FakeStorage() }, this.env));
    const o = this.objs.get(id);
    return { fetch: (url, init) => o.fetch(new Request(url, init)) };
  }
  obj(id) { return this.objs.get(id); }
}
/** Estado del libro de cupo de un código (para las pruebas). */
export async function ledgerState(e, code) {
  const o = e.CODE_LEDGER.obj("code:" + code);
  return o ? (await o.storage.get("s")) || null : null;
}
export const withLedger = (e) => { e.CODE_LEDGER = new FakeNamespace(CodeLedger); e.CODE_LEDGER.env = e; return e; };
export const env = (over = {}) => withLedger({ ANTHROPIC_API_KEY: "sk-test", ACCESS_CODES: "ANA-7K2:2, PEDRO-9X4:1, LUZ-3M8Q:3", ASTRO_KV: new KV({ protocol: "PROTOCOLO DE PRUEBA" }), LEGACY_STREAM: "true", ...over });

export const state = { calls: [] };
/** API de Claude simulada, en flujo. onCall(n) se ejecuta antes de responder cada llamada (para simular concurrencia). */
export function mockClaude(sequence, onCall) {
  state.calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.resend.com")) return new Response("{}");
    const body = JSON.parse(init.body); state.calls.push(body);
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    if (onCall) await onCall(state.calls.length);
    const next = sequence.shift();
    if (next === undefined) throw new Error("llamada a Claude no esperada");
    if (next === "500") return new Response(JSON.stringify({ error: { type: "overloaded_error" } }), { status: 529 });
    const cut = next && next.__stop; const text = cut ? next.text : typeof next === "string" ? next : JSON.stringify(next);
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    const sse = ev({ type: "message_start", message: { usage: { input_tokens: 10000, output_tokens: 1 } } })
      + ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })
      + ev({ type: "message_delta", delta: { stop_reason: cut || "end_turn" }, usage: { output_tokens: 5000 } });
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  };
}
export const sentText = () => state.calls.map((c) => c.messages[0].content).join("\n");

export const req = (body, code, extra = {}) => new Request("https://astro.example.workers.dev/", {
  method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...(code ? { "x-astro-code": code } : {}), ...extra },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
export async function run(r, e) {
  const res = await worker.fetch(r, e, { waitUntil() { } });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text.trim()), raw: text };
}
