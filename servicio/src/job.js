// ASTROINFORME — trabajo de generación desacoplado de la conexión (servicio 1.6).
//
// Problema que resuelve: en el modo en flujo, si el teléfono se bloquea y la conexión se corta, Cloudflare puede
// cancelar la generación unos 30 s después. Acá la generación corre en un Durable Object, disparada por una alarma
// (hasta 15 min de duración por ejecución, sin necesidad de que la app siga conectada). La app consulta el estado
// cada pocos segundos; si se desconecta, al volver retoma la consulta y recibe el informe.
//
// Un objeto por pedido (nombre = request_id que eligió la app). Guarda las fases A y B a medida que terminan:
// si una ejecución se corta o la API falla de forma transitoria, la alarma se reintenta y retoma desde la última
// fase guardada, sin volver a pagarla. Como máximo MAX_ATTEMPTS ejecuciones por pedido.
// Pasadas 48 h desde el final, el objeto borra todo lo que guardó (incluido el informe).

import { interpret, finalizeJob, loadProtocol, REPORT_TTL } from "./worker.js";

export const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20_000;
const TRANSIENT = (e) => e && e.message === "upstream" && (e.status == null || e.status === 429 || e.status >= 500);
const ok = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export class ReportJob {
  constructor(state, env) { this.state = state; this.storage = state.storage; this.env = env; }

  /** Vista pública del estado. Si el pedido se hizo con código, solo lo ve quien presenta el mismo código. */
  async view(code) {
    const meta = await this.storage.get("meta");
    if (!meta) return ok({ error: "not_found" }, 404);
    if (meta.job.useCode && (code || "") !== meta.job.code) return ok({ error: "forbidden" }, 403);
    const base = { job_id: meta.job.requestId, status: meta.status };
    if (meta.status === "done" || meta.status === "failed") return ok({ ...base, ...(await this.storage.get("out")) });
    return ok(base);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = await request.json().catch(() => ({}));
    if (path === "/status") return this.view(body.code);
    if (path === "/start") {
      if (await this.storage.get("meta")) return this.view(body.code);
      await this.storage.put("meta", { job: body, status: "queued", attempts: 0, created: Date.now() });
      await this.storage.setAlarm(Date.now());
      return ok({ job_id: body.requestId, status: "queued" });
    }
    return ok({ error: "bad_request" }, 400);
  }

  async alarm() {
    const meta = await this.storage.get("meta");
    if (!meta) return;
    // limpieza: pasado el plazo, se borra todo (el informe ya quedó, por 48 h, en la copia «rep:» del código)
    if (meta.status === "done" || meta.status === "failed") {
      if (Date.now() >= (meta.cleanupAt || 0)) await this.storage.deleteAll();
      return;
    }
    const spent = (await this.storage.get("spent")) || { usd: 0, phases: {} };
    // una ejecución anterior se cortó sin terminar (p. ej., por el límite de 15 min) y ya no quedan intentos
    if (meta.attempts >= MAX_ATTEMPTS) {
      const e = new Error("upstream"); e.detail = "max attempts";
      return this.close(meta, await finalizeJob(this.env, meta.job, spent, null, e, { mode: "job", attempts: meta.attempts }));
    }
    meta.attempts += 1; meta.status = "running";
    await this.storage.put("meta", meta);
    const hooks = {
      load: (k) => this.storage.get("phase:" + k),
      // cada fase guardada lleva el gasto acumulado: si la ejecución se corta, el gasto no se pierde
      save: async (k, v) => { await this.storage.put("phase:" + k, v); await this.storage.put("spent", spent); },
    };
    let out;
    try {
      const protocol = await loadProtocol(this.env);
      if (!protocol) { const e = new Error("upstream"); e.detail = "protocol missing"; throw e; }
      const result = await interpret(this.env, meta.job.payload, protocol, spent, hooks);
      out = await finalizeJob(this.env, meta.job, spent, result, null, { mode: "job", attempts: meta.attempts });
    } catch (e) {
      await this.storage.put("spent", spent);
      // error transitorio de la API y quedan intentos: se reintenta más tarde desde la última fase guardada
      if (TRANSIENT(e) && meta.attempts < MAX_ATTEMPTS) {
        meta.status = "queued"; await this.storage.put("meta", meta);
        await this.storage.setAlarm(Date.now() + RETRY_DELAY_MS);
        return;
      }
      out = await finalizeJob(this.env, meta.job, spent, null, e, { mode: "job", attempts: meta.attempts });
    }
    return this.close(meta, out);
  }

  /** Guarda el resultado, borra las fases intermedias y programa la limpieza a las 48 h. */
  async close(meta, out) {
    meta.status = out.error ? "failed" : "done";
    meta.cleanupAt = Date.now() + REPORT_TTL * 1000;
    await this.storage.put("out", out);
    await this.storage.delete(["phase:analisis", "phase:report_b"]);
    await this.storage.put("meta", meta);
    await this.storage.setAlarm(meta.cleanupAt);
  }
}
