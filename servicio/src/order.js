// AsterOrbis — pedido pago (servicio 2.0). Un Durable Object por pedido.
//
// El objeto es la fuente de verdad del pedido y procesa sus operaciones de a una, así que las transiciones son
// atómicas: dos avisos de pago simultáneos o repetidos nunca disparan dos generaciones.
//
// Estado guardado («o»), sin datos natales:
//   id, product, provider, amountMinor, currency, lang, tokenHash, idemKey, consent, createdAt, updatedAt,
//   payment:    { status, externalId, externalCheckoutId, events[], paidAt, mismatch }
//               status: created → pending → paid | failed | cancelled | mismatch ; paid → refunded
//   generation: { status, jobId, attempts, startedAt, deliveredAt, lastOutcome }
//               status: none → starting → running → delivered | failed ; failed → starting (reintento)
// La carta («payload») se guarda aparte, solo hasta que el informe se entrega o el pedido vence sin pagarse.
// Nunca se envía al proveedor de pagos.
//
// Operaciones internas (solo el Worker llega a este objeto; no hay acceso directo desde internet):
//   /create /view /checkout /payment /started /generation /retry /refund

export const PENDING_TTL_MS = 7 * 24 * 3600 * 1000; // un pedido sin pagar conserva la carta 7 días
export const START_WATCH_MS = 10 * 60 * 1000;          // si una generación no arrancó en 10 min, se marca como fallida
export const RUN_WATCH_MS = 75 * 60 * 1000;            // si no terminó en 75 min (3 intentos de hasta 15 min y esperas), también
export const RETAIN_MS = 7 * 24 * 3600 * 1000;         // carta, correo e informe se conservan 7 días desde la entrega
export const MAX_MAIL_TRIES = 5;

/** Marca un pedido en la cola de excepciones (sin datos de la carta ni del informe). */
async function flag(env, id, reason) {
  if (env && env.ASTRO_KV) await env.ASTRO_KV.put("exc:" + id, JSON.stringify({ order_id: id, reason, at: new Date().toISOString() })).catch(() => { });
}
const EVENTS_KEEP = 50;
const ok = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function sha256Hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vista pública de un pedido: nunca incluye la carta, la clave de acceso ni los eventos del proveedor. */
export function publicView(o) {
  return { order_id: o.id, product: o.product, provider: o.provider, amount: o.amountMinor / 100, currency: o.currency,
    payment_status: o.payment.status, generation_status: o.generation.status, generation_started_at: o.generation.startedAt, created_at: o.createdAt, updated_at: o.updatedAt };
}

export class OrderDO {
  constructor(state, env) { this.state = state; this.storage = state.storage; this.env = env; this.queue = Promise.resolve(); }
  serial(fn) { const run = this.queue.then(fn, fn); this.queue = run.catch(() => { }); return run; }

  async save(o) { o.updatedAt = new Date().toISOString(); await this.storage.put("o", o); }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const b = await request.json().catch(() => ({}));
    return this.serial(async () => {
      // reparto del pedido de un intento de compra (objeto aparte, nombrado por la clave de idempotencia)
      if (path === "/claim") {
        const c = await this.storage.get("claim");
        if (c) return ok({ ...c, first: false });
        await this.storage.put("claim", { id: b.id, token: b.token, url: null });
        await this.storage.setAlarm(Date.now() + PENDING_TTL_MS);
        return ok({ id: b.id, token: b.token, url: null, first: true });
      }
      if (path === "/claim-url") { const c = await this.storage.get("claim"); if (c) { c.url = b.url; await this.storage.put("claim", c); } return ok({}); }
      if (path === "/claim-release") { await this.storage.delete("claim"); return ok({}); }
      let o = await this.storage.get("o");
      if (path === "/create") {
        if (o) return ok({ existed: true, order: publicView(o) });
        o = { ...b.order, payment: { status: "created", externalId: null, externalCheckoutId: null, events: [], paidAt: null, mismatch: null },
          generation: { status: "none", jobId: null, attempts: 0, startedAt: null, deliveredAt: null, lastOutcome: null },
          createdAt: new Date().toISOString() };
        await this.save(o);
        await this.storage.put("payload", b.payload);
        if (b.email) await this.storage.put("email", b.email);
        await this.storage.setAlarm(Date.now() + PENDING_TTL_MS);
        return ok({ existed: false, order: publicView(o) });
      }
      if (!o) return ok({ error: "not_found" }, 404);

      if (path === "/view") {
        const hash = b.token ? await sha256Hex(b.token) : null;
        if (!hash || (hash !== o.tokenHash && hash !== (o.mail && o.mail.tokenHash))) return ok({ error: "forbidden" }, 403);
        const open = o.generation.status === "delivered" && o.payment.status !== "refunded";
        return ok({ order: publicView(o), jobId: open ? o.generation.jobId : null, chart: open ? (await this.storage.get("payload")) || null : null });
      }
      if (path === "/checkout") {
        o.payment.externalCheckoutId = b.externalCheckoutId || null;
        await this.save(o); return ok({ order: publicView(o) });
      }

      // aviso de pago ya verificado por el Worker (firma) y confirmado con la API del proveedor (tx normalizada)
      if (path === "/payment") {
        const tx = b.tx || {};
        if (b.eventId && o.payment.events.includes(b.eventId)) return ok({ action: "none", duplicate: true, order: publicView(o) });
        if (b.eventId) o.payment.events = [...o.payment.events, b.eventId].slice(-EVENTS_KEEP);
        if (tx.orderId !== o.id || (b.provider && b.provider !== o.provider)) { await this.save(o); return ok({ action: "none", ignored: "other_order", order: publicView(o) }); }
        // otro pago distinto del que habilitó el pedido (doble cobro, o reembolso de ese otro pago): no cambia el
        // pedido; queda para revisión
        if (o.payment.externalId && tx.externalId && tx.externalId !== o.payment.externalId && ["paid", "refunded"].includes(tx.status)) {
          await this.save(o);
          return ok({ action: "none", exception: tx.status === "paid" ? "duplicate_payment" : "refund_other_payment", order: publicView(o) });
        }
        let action = "none", exception = null;
        if (tx.status === "paid") {
          const wrong = [];
          if (tx.amountMinor !== o.amountMinor) wrong.push("amount");
          if (tx.currency !== o.currency) wrong.push("currency");
          if (o.productRef && tx.productRef !== o.productRef) wrong.push("product");
          // un pago ya reembolsado, o un pedido marcado por importe incorrecto, no vuelve a habilitar la generación:
          // queda para revisión (cola de excepciones)
          if (o.payment.status === "refunded" || o.payment.status === "mismatch") { /* sin cambios */ }
          else if (wrong.length) {
            o.payment.status = "mismatch"; o.payment.mismatch = { fields: wrong, amountMinor: tx.amountMinor, currency: tx.currency, productRef: tx.productRef };
            exception = "payment_mismatch";
          } else {
            if (o.payment.status !== "paid") { o.payment.status = "paid"; o.payment.paidAt = new Date().toISOString(); o.payment.externalId = o.payment.externalId || tx.externalId; }
            if (o.generation.status === "none") {
              o.generation.status = "starting"; o.generation.attempts = 1; o.generation.jobId = o.id; o.generation.startedAt = new Date().toISOString();
              action = "start";
            }
          }
        } else if (tx.status === "refunded") {
          o.payment.status = "refunded";
          if (o.generation.status !== "delivered") await this.storage.delete("payload");
        } else if (["failed", "cancelled"].includes(tx.status)) {
          if (!["paid", "refunded", "mismatch"].includes(o.payment.status)) o.payment.status = tx.status;
        } else if (tx.status === "pending" && o.payment.status === "created") {
          o.payment.status = "pending";
        }
        await this.save(o);
        if (action === "start") await this.storage.setAlarm(Date.now() + START_WATCH_MS);
        const payload = action === "start" ? await this.storage.get("payload") : undefined;
        if (action === "start" && !payload) { o.generation.status = "failed"; o.generation.lastOutcome = "payload_missing"; await this.save(o); return ok({ action: "none", exception: "payload_missing", order: publicView(o) }); }
        return ok({ action, exception, jobId: o.generation.jobId, payload, order: publicView(o), internal: { externalId: o.payment.externalId, provider: o.provider } });
      }

      if (path === "/started") {
        if (b.jobId === o.generation.jobId && o.generation.status === "starting") { o.generation.status = "running"; await this.save(o); await this.storage.setAlarm(Date.now() + RUN_WATCH_MS); }
        return ok({ order: publicView(o) });
      }
      if (path === "/generation") {
        const ownJob = typeof b.jobId === "string" && (b.jobId === o.id || b.jobId.startsWith(o.id + "-r"));
        // un trabajo anterior del mismo pedido que termina bien también cuenta como entrega (por ejemplo, si un
        // reintento se lanzó mientras el primero seguía); un fallo de un trabajo que ya no es el vigente se ignora
        if (!ownJob || (b.jobId !== o.generation.jobId && b.outcome !== "delivered")) return ok({ ignored: true, order: publicView(o) });
        if (b.outcome === "delivered") {
          o.generation.jobId = b.jobId;
          o.generation.status = "delivered"; o.generation.deliveredAt = new Date().toISOString(); o.generation.lastOutcome = "delivered";
          // la carta queda con el informe: permite abrirlo desde el enlace del correo en otro aparato
          o.retainUntil = Date.now() + RETAIN_MS;
          await this.storage.setAlarm(o.retainUntil);
        } else if (o.generation.status !== "delivered") {
          o.generation.status = "failed"; o.generation.lastOutcome = b.outcome || "error";
        }
        await this.save(o); return ok({ order: publicView(o), exception: o.generation.status === "failed" ? "generation_failed" : null });
      }
      // reintento manual o automático de una generación fallida de un pedido pago
      if (path === "/retry") {
        if (o.payment.status !== "paid" || o.generation.status !== "failed") return ok({ error: "not_retryable", order: publicView(o) }, 409);
        const payload = await this.storage.get("payload");
        if (!payload) return ok({ error: "payload_missing", order: publicView(o) }, 409);
        o.generation.attempts += 1; o.generation.jobId = `${o.id}-r${o.generation.attempts - 1}`; o.generation.status = "starting"; o.generation.startedAt = new Date().toISOString();
        await this.save(o);
        return ok({ action: "start", jobId: o.generation.jobId, payload, order: publicView(o) });
      }
      // enlace privado para el correo: una clave nueva por intento; en el pedido solo queda su resumen
      if (path === "/mail-prepare") {
        o.mail = o.mail || { status: "none", tries: 0, tokenHash: null, sentAt: null };
        if (o.generation.status !== "delivered" || o.payment.status === "refunded" || o.mail.status === "sent" || o.mail.tries >= MAX_MAIL_TRIES) return ok({ skip: true, mail: o.mail });
        const email = await this.storage.get("email");
        if (!email) return ok({ skip: true, mail: o.mail });
        const token = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
        o.mail.tries += 1; o.mail.status = "sending"; o.mail.tokenHash = await sha256Hex(token);
        await this.save(o);
        return ok({ email, token, lang: o.lang, tries: o.mail.tries });
      }
      if (path === "/mail-result") {
        if (o.mail) { o.mail.status = b.ok ? "sent" : "failed"; if (b.ok) o.mail.sentAt = new Date().toISOString(); await this.save(o); }
        return ok({ mail: o.mail || null });
      }
      // estado para el control periódico, sin carta, correo ni informe
      if (path === "/check") return ok({ order: publicView(o), attempts: o.generation.attempts, mail: o.mail ? { status: o.mail.status, tries: o.mail.tries } : null, createdAt: o.createdAt, provider: o.provider, paidAt: o.payment.paidAt });
      if (path === "/refund") {
        return ok({ order: publicView(o), internal: { externalId: o.payment.externalId, provider: o.provider }, refundable: o.payment.status === "paid" });
      }
      return ok({ error: "bad_request" }, 400);
    });
  }

  /**
   * Alarma del pedido:
   *  - vigilancia de la generación: si quedó en «starting» o «running» más de lo previsto (el Worker se cortó, el
   *    trabajo no arrancó), pasa a «failed» y entra en la cola de excepciones para reintentar o reembolsar;
   *  - vencimiento: a los 7 días, un pedido sin pagar pierde la carta y queda cancelado; un pedido pagado que no se
   *    entregó también pierde la carta (queda en excepciones para reembolso).
   */
  async alarm() {
    return this.serial(async () => {
      const o = await this.storage.get("o");
      if (!o) { await this.storage.deleteAll(); return; } // reparto vencido
      const now = Date.now(), started = o.generation.startedAt ? Date.parse(o.generation.startedAt) : 0;
      if (o.generation.status === "starting" || o.generation.status === "running") {
        const limit = o.generation.status === "starting" ? START_WATCH_MS : RUN_WATCH_MS;
        if (now - started >= limit) {
          o.generation.lastOutcome = o.generation.status === "starting" ? "start_lost" : "timeout"; o.generation.status = "failed";
          await this.save(o); await flag(this.env, o.id, "generation_stuck");
        } else { await this.storage.setAlarm(started + limit); return; }
      }
      const created = Date.parse(o.createdAt), until = Math.max(created + PENDING_TTL_MS, o.retainUntil || 0);
      if (now < until) { await this.storage.setAlarm(until); return; }
      if (o.generation.status !== "delivered" && (await this.storage.get("payload")) && o.payment.status === "paid") await flag(this.env, o.id, "payload_expired");
      await this.storage.delete(["payload", "email"]);
      if (o.mail) o.mail.tokenHash = null;
      if (!["paid", "refunded", "mismatch"].includes(o.payment.status)) { o.payment.status = "cancelled"; o.generation.lastOutcome = o.generation.lastOutcome || "expired_unpaid"; }
      await this.save(o);
    });
  }
}
