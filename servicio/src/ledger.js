// AsterOrbis — libro de cupo por código (servicio 1.7).
//
// Problema que resuelve: el cupo vivía en el KV («used:» e «inflight:»). El KV no tiene operaciones atómicas: dos pedidos
// simultáneos con el mismo código leían el cupo antes de que alguno lo reservara, y los dos generaban. Con cobro, eso
// significa entregar más informes que los pagados.
//
// Un Durable Object por código. Cloudflare entrega sus pedidos de a uno (y además acá se encadenan explícitamente), así
// que «reservar», «consumir» y «liberar» son operaciones atómicas:
//   reserve  → si no hay otra generación en curso y queda cupo, deja la reserva a nombre de ese request_id;
//   consume  → al entregar el informe, suma uno al cupo usado y borra la reserva. Es idempotente: cada reserva tiene
//              una ficha única y la misma ficha no descuenta dos veces;
//   release  → si el pedido falla, borra la reserva sin descontar.
// La reserva vence sola (RESERVE_TTL_MS) por si un trabajo se corta sin cerrar. El valor inicial de «usado» se toma
// del KV la primera vez (códigos que ya generaron informes antes de esta versión), y cada consumo se copia al KV para
// poder consultarlo desde el panel.

export const RESERVE_TTL_MS = 60 * 60 * 1000; // 3 intentos de hasta 15 min, más las esperas entre intentos
const CONSUMED_KEEP = 20;
const ok = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export class CodeLedger {
  constructor(state, env) { this.state = state; this.storage = state.storage; this.env = env; this.queue = Promise.resolve(); }

  /** Ejecuta las operaciones de a una, en orden de llegada. */
  serial(fn) { const run = this.queue.then(fn, fn); this.queue = run.catch(() => { }); return run; }

  async load(code) {
    let s = await this.storage.get("s");
    if (!s) {
      const kvUsed = this.env && this.env.ASTRO_KV ? +(await this.env.ASTRO_KV.get("used:" + code)) || 0 : 0;
      s = { code, used: kvUsed, inflight: null, consumed: [] };
    }
    if (s.inflight && s.inflight.exp <= Date.now()) s.inflight = null;
    return s;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const b = await request.json().catch(() => ({}));
    return this.serial(async () => {
      const code = String(b.code || "");
      const s = await this.load(code);
      if (path === "/get") return ok({ used: s.used, inflight: s.inflight });
      if (path === "/reserve") {
        if (s.inflight) return ok({ error: "in_progress", same_request: !!b.request_id && s.inflight.request_id === b.request_id, used: s.used }, 409);
        if (s.used >= +b.limit) return ok({ error: "quota_exhausted", used: s.used }, 403);
        const token = crypto.randomUUID();
        s.inflight = { request_id: b.request_id || null, token, at: Date.now(), exp: Date.now() + RESERVE_TTL_MS };
        await this.storage.put("s", s);
        return ok({ reserved: true, token, used: s.used });
      }
      if (path === "/consume") {
        if (b.token && s.consumed.includes(b.token)) return ok({ used: s.used, duplicate: true });
        s.used += 1;
        if (s.inflight && s.inflight.token === b.token) s.inflight = null;
        if (b.token) s.consumed = [...s.consumed, b.token].slice(-CONSUMED_KEEP);
        await this.storage.put("s", s);
        if (this.env && this.env.ASTRO_KV) await this.env.ASTRO_KV.put("used:" + code, String(s.used)).catch(() => { });
        return ok({ used: s.used });
      }
      if (path === "/release") {
        if (s.inflight && s.inflight.token === b.token) { s.inflight = null; await this.storage.put("s", s); }
        return ok({ released: true, used: s.used });
      }
      return ok({ error: "bad_request" }, 400);
    });
  }
}

/** Acceso al libro de un código desde el Worker. */
export function ledger(env, code) {
  const stub = env.CODE_LEDGER.get(env.CODE_LEDGER.idFromName("code:" + code));
  const call = async (op, body = {}) => {
    const r = await stub.fetch("https://ledger/" + op, { method: "POST", body: JSON.stringify({ code, ...body }) });
    return { status: r.status, ...(await r.json()) };
  };
  return {
    get: () => call("get"),
    reserve: (request_id, limit) => call("reserve", { request_id, limit }),
    consume: (token) => call("consume", { token }),
    release: (token) => call("release", { token }),
  };
}
