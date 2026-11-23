// ASTROINFORME — servicio interpretativo. Archivo generado desde servicio/src (npm run build). AGPL-3.0.

// ../audit.js
var SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
var ELEMENT = ["FIRE", "EARTH", "AIR", "WATER"];
var MODALITY = ["CARDINAL", "FIXED", "MUTABLE"];
var ANGLE_OF_HOUSE = { 1: "ASC", 4: "IC", 7: "DSC", 10: "MC" };
var toMin = (deg) => {
  const m = String(deg).match(/(\d+)°\s*(\d+)'/);
  return m ? +m[1] * 60 + +m[2] : null;
};
var lonToSignMin = (lon) => {
  const l = (lon % 360 + 360) % 360;
  return { sign: SIGNS[Math.floor(l / 30)], min: Math.floor(l % 30 * 60) };
};
var sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
var subset = (a, b) => a.every((x) => b.includes(x));
var fmtMin = (min) => `${Math.floor(min / 60)}\xB0${String(min % 60).padStart(2, "0")}'`;
function membersOf(c) {
  if (c.type === "T_SQUARE") return [c.apex, ...c.opposition];
  if (c.type === "YOD") return [c.apex, ...c.base];
  return c.bodies || [];
}
function refText(r) {
  switch (r && r.type) {
    case "position":
      return `${r.body} ${r.sign || ""} ${r.deg || ""}${r.house != null ? " casa " + r.house : ""}`.replace(/\s+/g, " ").trim();
    case "angle":
      return `${r.angle} ${r.sign || ""} ${r.deg || ""}`.trim();
    case "aspect":
      return `${r.a} ${r.aspect} ${r.b}`;
    case "configuration":
      return `${r.configuration} ${[r.apex, ...r.opposition || r.base || r.bodies || []].filter(Boolean).join(", ")}`;
    case "rulership":
      return `regente de ${r.of}: ${r.ruler}`;
    case "stellium":
      return `stellium en ${r.by === "HOUSE" ? "casa " : ""}${r.where}${r.bodies ? " (" + r.bodies.join(", ") + ")" : ""}`;
    case "distribution":
      return `${r.group} ${r.key}${r.count != null ? ": " + r.count : ""}${r.bodies ? " (" + r.bodies.join(", ") + ")" : ""}`;
    default:
      return JSON.stringify(r);
  }
}
function auditReport(report, payload) {
  const issues = [], checked = [], unchecked = [];
  const chart = payload.chart;
  const bodies = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  const sn = chart.south_node;
  if (sn && !bodies.SOUTH_NODE) bodies.SOUTH_NODE = { id: "SOUTH_NODE", sign: sn.sign, longitude: sn.lon ?? sn.longitude, position: sn.deg ?? sn.position, house: sn.house };
  const houses = chart.houses;
  const derived = chart.derived || {};
  const timeKnown = payload.birth.time_precision !== "UNKNOWN";
  const unrel = chart.sensitivity && chart.sensitivity.unreliable || [];
  const signUnrel = (id) => unrel.some((u) => u.item === id && u.field === "sign");
  const houseUnrel = (id) => unrel.some((u) => u.item === id && u.field === "house");
  const findAspect2 = (a, b, type) => chart.aspects.find((x) => (!type || x.aspect === type) && (x.a === a && x.b === b || x.a === b && x.b === a));
  const refs = Array.isArray(report.technical_references_used) ? report.technical_references_used : [];
  const declaredMinutes = /* @__PURE__ */ new Set();
  for (const r of refs) {
    if (!r || typeof r !== "object") {
      unchecked.push({ ref: r, reason: "not_an_object" });
      continue;
    }
    if (r.type === "position") {
      const b = bodies[r.body];
      if (!b) {
        issues.push({ ref: r, kind: "missing", note: "El cuerpo no figura en la carta calculada." });
        continue;
      }
      if (!r.sign && !r.deg && r.house == null) {
        unchecked.push({ ref: r, reason: "empty" });
        continue;
      }
      const calc = { sign: b.sign, min: Math.floor(b.longitude % 30 * 60), house: b.house };
      const probs = [];
      if (r.deg) {
        const m = toMin(r.deg);
        if (m != null) declaredMinutes.add(m);
      }
      if (r.sign && r.sign !== calc.sign) probs.push({ field: "sign", report: r.sign, chart: calc.sign });
      else if (r.deg && toMin(r.deg) == null) probs.push({ field: "format", report: r.deg });
      else if (r.deg && Math.abs(toMin(r.deg) - calc.min) > 1) probs.push({ field: "deg", report: r.deg, chart: b.position });
      if (r.house != null) {
        if (!timeKnown) probs.push({ field: "house", report: r.house, chart: null, note: "Hora desconocida: no hay casas." });
        else if (r.house !== calc.house) probs.push({ field: "house", report: r.house, chart: calc.house });
      }
      if (signUnrel(r.body) || r.house != null && houseUnrel(r.body))
        probs.push({ field: "reliability", note: "Dato marcado como sensible a la precisi\xF3n horaria." });
      probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r);
    } else if (r.type === "angle") {
      if (!houses) {
        issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay \xE1ngulos." }] });
        continue;
      }
      const base2 = { ASC: houses.asc, DSC: houses.asc + 180, MC: houses.mc, IC: houses.mc + 180 }[r.angle];
      if (base2 == null) {
        issues.push({ ref: r, problems: [{ field: "angle", note: "\xC1ngulo desconocido." }] });
        continue;
      }
      const c = lonToSignMin(base2);
      if (r.deg) {
        const m = toMin(r.deg);
        if (m != null) declaredMinutes.add(m);
      }
      const probs = [];
      if (r.sign && r.sign !== c.sign) probs.push({ field: "sign", report: r.sign, chart: c.sign });
      else if (r.deg && toMin(r.deg) == null) probs.push({ field: "format", report: r.deg });
      else if (r.deg && Math.abs(toMin(r.deg) - c.min) > 1) probs.push({ field: "deg", report: r.deg, chart: fmtMin(c.min) });
      const axis = r.angle === "ASC" || r.angle === "DSC" ? "ASC" : "MC";
      if (r.sign && signUnrel(axis)) probs.push({ field: "reliability", note: "Signo del \xE1ngulo sensible a la precisi\xF3n horaria." });
      probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r);
    } else if (r.type === "aspect") {
      const a = findAspect2(r.a, r.b, r.aspect);
      if (!a) issues.push({ ref: r, problems: [{ field: "aspect", note: `No figura en la carta calculada con la pol\xEDtica ${payload.engine.aspect_policy}.` }] });
      else if (a.reliable === false) issues.push({ ref: r, problems: [{ field: "reliability", note: "Aspecto sensible a la precisi\xF3n horaria." }] });
      else checked.push({ ...r, orb: a.orb });
    } else if (r.type === "configuration") {
      const named = [r.apex, ...r.opposition || r.base || r.bodies || []].filter(Boolean);
      const found = (derived.configurations || []).find((c) => c.type === r.configuration && sameSet(membersOf(c), [...new Set(named)]) && (!r.apex || r.apex === c.apex));
      if (!found) {
        issues.push({ ref: r, problems: [{ field: "configuration", note: "La configuraci\xF3n no figura en la carta calculada." }] });
        continue;
      }
      const m = membersOf(found), weak = [];
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
        const a = findAspect2(m[i], m[j]);
        if (a && a.reliable === false) weak.push(a);
      }
      weak.length ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Alguno de sus aspectos es sensible a la precisi\xF3n horaria." }] }) : checked.push(r);
    } else if (r.type === "rulership") {
      const of = typeof r.of === "number" && ANGLE_OF_HOUSE[r.of] ? ANGLE_OF_HOUSE[r.of] : r.of;
      if (["ASC", "DSC", "MC", "IC"].includes(of)) {
        if (!houses || !derived.angle_rulers) {
          issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay \xE1ngulos." }] });
          continue;
        }
        const ar = derived.angle_rulers[of];
        if (!ar || r.ruler !== ar.ruler && r.ruler !== ar.traditional_coregent) {
          issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: ar ? ar.ruler : null }] });
          continue;
        }
        signUnrel(of === "ASC" || of === "DSC" ? "ASC" : "MC") ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Signo del \xE1ngulo sensible a la precisi\xF3n horaria." }] }) : checked.push(r);
      } else if (typeof r.of === "number") {
        const hr = (derived.house_rulers || []).find((h) => h.house === r.of);
        if (!hr) {
          issues.push({ ref: r, problems: [{ field: "house", report: r.of, chart: null, note: "Hora desconocida: no hay casas." }] });
          continue;
        }
        if (r.ruler !== hr.ruler && r.ruler !== hr.traditional_coregent) {
          issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: hr.ruler }] });
          continue;
        }
        unchecked.push({ ref: r, reason: "cusp_sensitivity_not_computed" });
      } else if (derived.dispositors && derived.dispositors[of]) {
        const d = derived.dispositors[of];
        if (r.ruler !== d.ruler && r.ruler !== d.traditional_coregent) {
          issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: d.ruler }] });
          continue;
        }
        signUnrel(of) ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Signo del planeta sensible a la precisi\xF3n horaria." }] }) : checked.push(r);
      } else issues.push({ ref: r, kind: "missing", note: "El punto no figura en la carta calculada." });
    } else if (r.type === "stellium") {
      if (r.by === "HOUSE" && !timeKnown) {
        issues.push({ ref: r, problems: [{ field: "house", report: r.where, chart: null, note: "Hora desconocida: no hay casas." }] });
        continue;
      }
      const st = (derived.stelliums || []).find((s) => s.by === r.by && s.where === r.where);
      if (!st || r.bodies && !subset(r.bodies, st.bodies)) {
        issues.push({ ref: r, problems: [{ field: "stellium", note: "El stellium no figura en la carta calculada." }] });
        continue;
      }
      const weak = r.by === "HOUSE" ? houseUnrel : signUnrel;
      const firm = st.bodies.filter((id) => !weak(id));
      firm.length < 3 || (r.bodies || []).some(weak) ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Integrantes sensibles a la precisi\xF3n horaria." }] }) : checked.push(r);
    } else if (r.type === "distribution") {
      const table = r.group === "ELEMENT" ? derived.elements : r.group === "MODALITY" ? derived.modalities : null;
      if (!table || !table[r.key]) {
        issues.push({ ref: r, kind: "missing", note: "Grupo desconocido." });
        continue;
      }
      if (r.count == null && !r.bodies) {
        unchecked.push({ ref: r, reason: "empty" });
        continue;
      }
      const members = table[r.key], probs = [];
      if (r.count != null && r.count !== members.length) probs.push({ field: "count", report: r.count, chart: members.length });
      if (r.bodies && !subset(r.bodies, members)) probs.push({ field: "group", report: r.bodies.filter((b) => !members.includes(b)).join(", "), chart: members.join(", ") });
      if (!probs.length) {
        const groupOf = (sign) => {
          const i = SIGNS.indexOf(sign);
          return r.group === "ELEMENT" ? ELEMENT[i % 4] : MODALITY[i % 3];
        };
        const moving = unrel.filter((u) => u.field === "sign" && Array.isArray(u.alternatives) && u.alternatives.some((s) => groupOf(s) === r.key) && !u.alternatives.every((s) => groupOf(s) === r.key));
        if (r.count != null && moving.length || (r.bodies || []).some((b) => moving.some((u) => u.item === b))) probs.push({ field: "reliability", note: "Recuento sensible a la precisi\xF3n horaria." });
      }
      probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r);
    } else {
      unchecked.push({ ref: r, reason: "unknown_type" });
    }
  }
  const undeclared = [];
  for (const s of Array.isArray(report.sections) ? report.sections : []) {
    for (const m of String(s && s.body_markdown || "").matchAll(/(\d{1,2})\s?°\s?(\d{1,2})\s?['′]/g)) {
      const min = +m[1] * 60 + +m[2];
      if (![...declaredMinutes].some((d) => Math.abs(d - min) <= 1)) undeclared.push({ section: s.id, text: m[0] });
    }
  }
  return {
    ok: issues.length === 0,
    scope: "declared_references",
    declared: refs.length,
    total: checked.length + issues.length,
    verified: checked.length,
    issues,
    unchecked,
    undeclared_degrees: undeclared
  };
}

// ../argument_audit.js
function argumentAudit(report, payload) {
  const theses = Array.isArray(report && report.theses) ? report.theses : null;
  if (!theses || !theses.length) return { declared: false, theses: [], ok: null };
  const sectionIds = new Set((report.sections || []).map((s) => s && s.id));
  const out = theses.map((t, i) => {
    const indicators = Array.isArray(t && t.indicators) ? t.indicators : [];
    const unique = [...new Map(indicators.map((r) => [refText(r), r])).values()];
    const a = auditReport({ technical_references_used: unique, sections: [] }, payload);
    const failed = a.issues.map((x) => refText(x.ref));
    const verified = a.verified;
    return {
      id: t && t.id || `t${i + 1}`,
      central: !!(t && t.central),
      status: verified >= 2 ? "supported" : verified === 1 ? "single_indicator" : "unsupported",
      verified,
      failed,
      unchecked: a.unchecked.length,
      missing_sections: (t && t.sections || []).filter((s) => !sectionIds.has(s))
    };
  });
  return { declared: true, theses: out, ok: out.every((t) => !t.central || t.status === "supported") };
}

// src/mail.js
var mailEnabled = (env) => !!(env.MAIL_API_KEY && env.MAIL_FROM);
async function sendMailResult(env, { to, subject, text, html, key }) {
  if (!mailEnabled(env) || !to) return { ok: false, status: null, skipped: true };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.MAIL_API_KEY, ...key ? { "idempotency-key": key } : {} },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, ...html ? { html } : {}, ...env.ADMIN_EMAIL ? { reply_to: env.ADMIN_EMAIL } : {} })
    });
    if (!r.ok) console.log(JSON.stringify({ event: "mail_rejected", status: r.status }));
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.log(JSON.stringify({ event: "mail_error" }));
    return { ok: false, status: null };
  }
}
async function sendMail(env, msg) {
  return (await sendMailResult(env, msg)).ok;
}
var mailRetryable = (status) => status == null || status === 429 || status === 409 || status >= 500;
var TEXTS = {
  es: { subject: "Tu informe de AsterOrbis est\xE1 listo", body: (u, d) => `Tu informe est\xE1 listo.

Abrilo desde este enlace privado:
${u}

El enlace funciona durante ${d} d\xEDas. Desde ah\xED pod\xE9s guardar el PDF. Despu\xE9s de ese plazo, el informe y tu carta se borran.

No compartas este enlace: quien lo tenga puede leer el informe. Si algo no funciona, respond\xE9 este correo.

B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis` },
  de: { subject: "Dein AsterOrbis-Bericht ist fertig", body: (u, d) => `Dein Bericht ist fertig.

\xD6ffne ihn \xFCber diesen privaten Link:
${u}

Der Link gilt ${d} Tage. Dort kannst du das PDF speichern. Nach Ablauf dieser Frist werden Bericht und Horoskop gel\xF6scht.

Teile diesen Link nicht: Wer ihn hat, kann den Bericht lesen. Wenn etwas nicht funktioniert, antworte auf diese E-Mail.

B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis` },
  en: { subject: "Your AsterOrbis report is ready", body: (u, d) => `Your report is ready.

Open it from this private link:
${u}

The link works for ${d} days. You can save the PDF from there. After that, the report and your chart are deleted.

Do not share this link: anyone who has it can read the report. If something does not work, reply to this email.

B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis` }
};
function reportMail(lang, url, days) {
  const t = TEXTS[lang] || TEXTS.es;
  return { subject: t.subject, text: t.body(url, days) };
}
var validEmail = (x) => typeof x === "string" && x.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;".]{2,}$/.test(x.trim());
var esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var FULL = {
  es: { subject: (t) => `Tu informe de AsterOrbis: ${t}`, intro: "Este es tu informe completo. Tambi\xE9n pod\xE9s abrirlo en AsterOrbis, con las ilustraciones, y guardarlo en PDF desde este enlace privado:", button: "Abrir el informe y guardar el PDF", days: (d) => `El enlace funciona durante ${d} d\xEDas; despu\xE9s, la copia guardada se borra. Este correo queda en tu casilla.`, warn: "No compartas el enlace: quien lo tenga puede leer el informe.", sign: "B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis" },
  de: { subject: (t) => `Dein AsterOrbis-Bericht: ${t}`, intro: "Hier ist dein vollst\xE4ndiger Bericht. \xDCber diesen privaten Link kannst du ihn mit den Illustrationen in AsterOrbis \xF6ffnen und als PDF speichern:", button: "Bericht \xF6ffnen und PDF speichern", days: (d) => `Der Link gilt ${d} Tage; danach wird die gespeicherte Kopie gel\xF6scht. Diese E-Mail bleibt in deinem Postfach.`, warn: "Teile den Link nicht: Wer ihn hat, kann den Bericht lesen.", sign: "B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis" },
  en: { subject: (t) => `Your AsterOrbis report: ${t}`, intro: "Here is your full report. You can also open it in AsterOrbis, with the illustrations, and save it as a PDF from this private link:", button: "Open the report and save the PDF", days: (d) => `The link works for ${d} days; after that, the stored copy is deleted. This email stays in your inbox.`, warn: "Do not share the link: anyone who has it can read the report.", sign: "B\xE1rbara Guti\xE9rrez \xB7 AsterOrbis" }
};
function fullReportMail(lang, report, url, days) {
  const t = FULL[lang] || FULL.es, title = String(report.title || "").slice(0, 160);
  const secs = (report.sections || []).filter((s) => s && s.body_markdown);
  const paras = (b) => String(b).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const html = `<!doctype html><html lang="${esc(lang)}"><body style="margin:0;background:#f4efe3;">
<div style="max-width:620px;margin:0 auto;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;color:#1c2230;line-height:1.6;font-size:17px;">
<p style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.12em;color:#5d6573;margin:0 0 18px;">ASTERORBIS</p>
<h1 style="font-weight:normal;font-size:28px;line-height:1.25;margin:0 0 18px;">${esc(title)}</h1>
<p style="font-family:Arial,sans-serif;font-size:15px;color:#3a4150;">${esc(t.intro)}</p>
<p style="margin:18px 0 28px;"><a href="${esc(url)}" style="display:inline-block;background:#1f3a5f;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:12px 20px;border-radius:999px;">${esc(t.button)}</a></p>
${secs.map((s) => `<h2 style="font-weight:normal;font-size:21px;line-height:1.3;margin:32px 0 10px;color:#1f3a5f;">${esc(s.heading)}</h2>
${paras(s.body_markdown).map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("\n")}`).join("\n")}
<hr style="border:none;border-top:1px solid #c9cdc6;margin:32px 0 16px;">
<p style="font-family:Arial,sans-serif;font-size:13px;color:#5d6573;">${esc(t.days(days))} ${esc(t.warn)}</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#5d6573;">${esc(t.sign)}</p>
</div></body></html>`;
  const text = `${title}

${t.intro}
${url}

${secs.map((s) => `${String(s.heading || "").toUpperCase()}

${paras(s.body_markdown).join("\n\n")}`).join("\n\n\n")}

\u2014
${t.days(days)} ${t.warn}
${t.sign}`;
  return { subject: t.subject(title), html, text };
}

// src/order.js
var PENDING_TTL_MS = 7 * 24 * 3600 * 1e3;
var START_WATCH_MS = 10 * 60 * 1e3;
var RUN_WATCH_MS = 75 * 60 * 1e3;
var RETAIN_MS = 7 * 24 * 3600 * 1e3;
var MAX_MAIL_TRIES = 5;
async function flag(env, id, reason) {
  if (env && env.ASTRO_KV) await env.ASTRO_KV.put("exc:" + id, JSON.stringify({ order_id: id, reason, at: (/* @__PURE__ */ new Date()).toISOString() })).catch(() => {
  });
}
var EVENTS_KEEP = 50;
var ok = (obj2, status = 200) => new Response(JSON.stringify(obj2), { status, headers: { "content-type": "application/json; charset=utf-8" } });
async function sha256Hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function publicView(o) {
  return {
    order_id: o.id,
    product: o.product,
    provider: o.provider,
    amount: o.amountMinor / 100,
    currency: o.currency,
    payment_status: o.payment.status,
    generation_status: o.generation.status,
    generation_started_at: o.generation.startedAt,
    created_at: o.createdAt,
    updated_at: o.updatedAt
  };
}
var OrderDO = class {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.queue = Promise.resolve();
  }
  serial(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {
    });
    return run;
  }
  async save(o) {
    o.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.put("o", o);
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const b = await request.json().catch(() => ({}));
    return this.serial(async () => {
      if (path === "/claim") {
        const c = await this.storage.get("claim");
        if (c) return ok({ ...c, first: false });
        await this.storage.put("claim", { id: b.id, token: b.token, url: null });
        await this.storage.setAlarm(Date.now() + PENDING_TTL_MS);
        return ok({ id: b.id, token: b.token, url: null, first: true });
      }
      if (path === "/claim-url") {
        const c = await this.storage.get("claim");
        if (c) {
          c.url = b.url;
          await this.storage.put("claim", c);
        }
        return ok({});
      }
      if (path === "/claim-release") {
        await this.storage.delete("claim");
        return ok({});
      }
      let o = await this.storage.get("o");
      if (path === "/create") {
        if (o) return ok({ existed: true, order: publicView(o) });
        o = {
          ...b.order,
          payment: { status: "created", externalId: null, externalCheckoutId: null, events: [], paidAt: null, mismatch: null },
          generation: { status: "none", jobId: null, attempts: 0, startedAt: null, deliveredAt: null, lastOutcome: null },
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await this.save(o);
        await this.storage.put("payload", b.payload);
        if (b.email) await this.storage.put("email", b.email);
        await this.storage.setAlarm(Date.now() + PENDING_TTL_MS);
        return ok({ existed: false, order: publicView(o) });
      }
      if (!o) return ok({ error: "not_found" }, 404);
      if (path === "/view") {
        const hash = b.token ? await sha256Hex(b.token) : null;
        if (!hash || hash !== o.tokenHash && hash !== (o.mail && o.mail.tokenHash)) return ok({ error: "forbidden" }, 403);
        const open = o.generation.status === "delivered" && o.payment.status !== "refunded";
        return ok({ order: publicView(o), jobId: open ? o.generation.jobId : null, chart: open ? await this.storage.get("payload") || null : null });
      }
      if (path === "/checkout") {
        o.payment.externalCheckoutId = b.externalCheckoutId || null;
        await this.save(o);
        return ok({ order: publicView(o) });
      }
      if (path === "/payment") {
        const tx = b.tx || {};
        if (b.eventId && o.payment.events.includes(b.eventId)) return ok({ action: "none", duplicate: true, order: publicView(o) });
        if (b.eventId) o.payment.events = [...o.payment.events, b.eventId].slice(-EVENTS_KEEP);
        if (tx.orderId !== o.id || b.provider && b.provider !== o.provider) {
          await this.save(o);
          return ok({ action: "none", ignored: "other_order", order: publicView(o) });
        }
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
          if (o.payment.status === "refunded" || o.payment.status === "mismatch") {
          } else if (wrong.length) {
            o.payment.status = "mismatch";
            o.payment.mismatch = { fields: wrong, amountMinor: tx.amountMinor, currency: tx.currency, productRef: tx.productRef };
            exception = "payment_mismatch";
          } else {
            if (o.payment.status !== "paid") {
              o.payment.status = "paid";
              o.payment.paidAt = (/* @__PURE__ */ new Date()).toISOString();
              o.payment.externalId = o.payment.externalId || tx.externalId;
            }
            if (o.generation.status === "none") {
              o.generation.status = "starting";
              o.generation.attempts = 1;
              o.generation.jobId = o.id;
              o.generation.startedAt = (/* @__PURE__ */ new Date()).toISOString();
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
        const payload = action === "start" ? await this.storage.get("payload") : void 0;
        if (action === "start" && !payload) {
          o.generation.status = "failed";
          o.generation.lastOutcome = "payload_missing";
          await this.save(o);
          return ok({ action: "none", exception: "payload_missing", order: publicView(o) });
        }
        return ok({ action, exception, jobId: o.generation.jobId, payload, order: publicView(o), internal: { externalId: o.payment.externalId, provider: o.provider } });
      }
      if (path === "/started") {
        if (b.jobId === o.generation.jobId && o.generation.status === "starting") {
          o.generation.status = "running";
          await this.save(o);
          await this.storage.setAlarm(Date.now() + RUN_WATCH_MS);
        }
        return ok({ order: publicView(o) });
      }
      if (path === "/generation") {
        const ownJob = typeof b.jobId === "string" && (b.jobId === o.id || b.jobId.startsWith(o.id + "-r"));
        if (!ownJob || b.jobId !== o.generation.jobId && b.outcome !== "delivered") return ok({ ignored: true, order: publicView(o) });
        if (b.outcome === "delivered") {
          o.generation.jobId = b.jobId;
          o.generation.status = "delivered";
          o.generation.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
          o.generation.lastOutcome = "delivered";
          o.retainUntil = Date.now() + RETAIN_MS;
          await this.storage.setAlarm(o.retainUntil);
        } else if (o.generation.status !== "delivered") {
          o.generation.status = "failed";
          o.generation.lastOutcome = b.outcome || "error";
        }
        await this.save(o);
        return ok({ order: publicView(o), exception: o.generation.status === "failed" ? "generation_failed" : null });
      }
      if (path === "/retry") {
        if (o.payment.status !== "paid" || o.generation.status !== "failed") return ok({ error: "not_retryable", order: publicView(o) }, 409);
        const payload = await this.storage.get("payload");
        if (!payload) return ok({ error: "payload_missing", order: publicView(o) }, 409);
        o.generation.attempts += 1;
        o.generation.jobId = `${o.id}-r${o.generation.attempts - 1}`;
        o.generation.status = "starting";
        o.generation.startedAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.save(o);
        return ok({ action: "start", jobId: o.generation.jobId, payload, order: publicView(o) });
      }
      if (path === "/mail-prepare") {
        o.mail = o.mail || { status: "none", tries: 0, tokenHash: null, sentAt: null };
        if (o.generation.status !== "delivered" || o.payment.status === "refunded" || o.mail.status === "sent" || o.mail.tries >= MAX_MAIL_TRIES) return ok({ skip: true, mail: o.mail });
        const email = await this.storage.get("email");
        if (!email) return ok({ skip: true, mail: o.mail });
        const token = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
        o.mail.tries += 1;
        o.mail.status = "sending";
        o.mail.tokenHash = await sha256Hex(token);
        await this.save(o);
        return ok({ email, token, lang: o.lang, tries: o.mail.tries });
      }
      if (path === "/mail-result") {
        if (o.mail) {
          o.mail.status = b.ok ? "sent" : "failed";
          if (b.ok) o.mail.sentAt = (/* @__PURE__ */ new Date()).toISOString();
          await this.save(o);
        }
        return ok({ mail: o.mail || null });
      }
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
      if (!o) {
        await this.storage.deleteAll();
        return;
      }
      const now = Date.now(), started = o.generation.startedAt ? Date.parse(o.generation.startedAt) : 0;
      if (o.generation.status === "starting" || o.generation.status === "running") {
        const limit = o.generation.status === "starting" ? START_WATCH_MS : RUN_WATCH_MS;
        if (now - started >= limit) {
          o.generation.lastOutcome = o.generation.status === "starting" ? "start_lost" : "timeout";
          o.generation.status = "failed";
          await this.save(o);
          await flag(this.env, o.id, "generation_stuck");
        } else {
          await this.storage.setAlarm(started + limit);
          return;
        }
      }
      const created = Date.parse(o.createdAt), until = Math.max(created + PENDING_TTL_MS, o.retainUntil || 0);
      if (now < until) {
        await this.storage.setAlarm(until);
        return;
      }
      if (o.generation.status !== "delivered" && await this.storage.get("payload") && o.payment.status === "paid") await flag(this.env, o.id, "payload_expired");
      await this.storage.delete(["payload", "email"]);
      if (o.mail) o.mail.tokenHash = null;
      if (!["paid", "refunded", "mismatch"].includes(o.payment.status)) {
        o.payment.status = "cancelled";
        o.generation.lastOutcome = o.generation.lastOutcome || "expired_unpaid";
      }
      await this.save(o);
    });
  }
};

// src/bank.js
var BANK_MONTHS = 24;
var BANK_MARK_TTL = 7 * 86400;
var API = "https://api.github.com";
var ID_RE = /^AO-[A-Z2-7]{8}$/;
var bankEnabled = (env) => !!(env && env.BANK_GITHUB_TOKEN && env.BANK_REPO && /^[\w.-]+\/[\w.-]+$/.test(env.BANK_REPO));
var validBankId = (x) => typeof x === "string" && ID_RE.test(x);
var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
async function bankId(report) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(report && report.sections || []))));
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = val << 8 | b;
    bits += 8;
    while (bits >= 5 && out.length < 8) {
      out += B32[val >>> bits - 5 & 31];
      bits -= 5;
    }
    if (out.length >= 8) break;
  }
  return "AO-" + out;
}
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function anonymize(report, firstName) {
  const r = JSON.parse(JSON.stringify(report));
  const parts = firstName ? [firstName, ...firstName.split(/[\s'’.-]+/)].map((x) => x.trim()).filter((x) => x.length >= 2) : [];
  if (!parts.length) return r;
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(?:${[...new Set(parts)].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?![\\p{L}\\p{M}])`, "giu");
  const fix = (s) => typeof s === "string" ? s.replace(re, "[nombre]") : s;
  r.title = fix(r.title);
  for (const s of r.sections || []) {
    s.heading = fix(s.heading);
    s.body_markdown = fix(s.body_markdown);
  }
  for (const t of r.theses || []) t.claim = fix(t.claim);
  return r;
}
function bankEntry({ id, report, payload, chart, usd, service, model, now = /* @__PURE__ */ new Date() }) {
  const clean = anonymize(report, payload.person && payload.person.first_name);
  delete clean.bank_id;
  const myth = (clean.sections || []).find((s) => s && s.id === "myth");
  return {
    schema: "asterorbis.bank/v1",
    id,
    month: now.toISOString().slice(0, 7),
    service,
    model,
    language: payload.request.report_language,
    address_gender: payload.request.address_gender,
    time_precision: payload.birth.time_precision,
    had_first_name: !!(payload.person && payload.person.first_name),
    usd: +(+usd || 0).toFixed(4),
    myth_heading: myth ? myth.heading : null,
    chart,
    report: clean,
    comments: []
  };
}
var utf8b64 = (s) => {
  const b = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(bin);
};
var gh = (env, path, init = {}) => fetch(`${API}/repos/${env.BANK_REPO}/contents/${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env.BANK_GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "asterorbis-servicio", ...init.body ? { "content-type": "application/json" } : {} }
});
async function putFile(env, path, obj2, message) {
  const res = await gh(env, path, { method: "PUT", body: JSON.stringify({ message, content: utf8b64(JSON.stringify(obj2, null, 2) + "\n") }) });
  if (res.ok) return true;
  if (res.status === 422) return true;
  throw new Error(`bank_${res.status}`);
}
async function deposit(env, entry) {
  if (!bankEnabled(env)) return false;
  try {
    const [y, m] = entry.month.split("-");
    await putFile(env, `informes/${y}/${m}/${entry.id}.json`, entry, `Informe ${entry.id}`);
    if (env.ASTRO_KV) await env.ASTRO_KV.put("bank:" + entry.id, entry.month, { expirationTtl: BANK_MARK_TTL }).catch(() => {
    });
    return true;
  } catch (e) {
    console.log(JSON.stringify({ event: "bank_failed", detail: String(e && e.message || e) }));
    return false;
  }
}
async function depositComment(env, id, text, at = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!bankEnabled(env) || !validBankId(id) || !env.ASTRO_KV) return false;
  const month = await env.ASTRO_KV.get("bank:" + id).catch(() => null);
  if (!month) return false;
  try {
    const [y, m] = month.split("-");
    await putFile(env, `comentarios/${y}/${m}/${id}-${at.replace(/[^0-9]/g, "").slice(0, 14)}.json`, { id, month, text }, `Comentario ${id}`);
    return true;
  } catch (e) {
    console.log(JSON.stringify({ event: "bank_comment_failed", detail: String(e && e.message || e) }));
    return false;
  }
}
async function purgeOld(env, nowMs = Date.now()) {
  if (!bankEnabled(env) || !env.ASTRO_KV) return 0;
  const now = new Date(nowMs), tag = "bank:purged:" + now.toISOString().slice(0, 7);
  if (await env.ASTRO_KV.get(tag)) return 0;
  const cut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - BANK_MONTHS, 1)).toISOString().slice(0, 7);
  let removed = 0;
  const list = async (p) => {
    const r = await gh(env, p);
    return r.ok ? r.json() : [];
  };
  try {
    for (const root of ["informes", "comentarios"]) for (const y of await list(root)) {
      if (y.type !== "dir") continue;
      for (const mo of await list(`${root}/${y.name}`)) {
        if (mo.type !== "dir" || `${y.name}-${mo.name}` >= cut) continue;
        for (const f of await list(`${root}/${y.name}/${mo.name}`)) {
          if (f.type !== "file") continue;
          const r = await gh(env, f.path, { method: "DELETE", body: JSON.stringify({ message: `Vencimiento ${BANK_MONTHS} meses`, sha: f.sha }) });
          if (r.ok) removed++;
        }
      }
    }
    await env.ASTRO_KV.put(tag, String(removed), { expirationTtl: 40 * 86400 });
  } catch (e) {
    console.log(JSON.stringify({ event: "bank_purge_failed", detail: String(e && e.message || e) }));
  }
  return removed;
}

// ../prose_audit.js
var PROSE_AUDIT_VERSION = "1";
var strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var PLANETS = { sol: "SUN", luna: "MOON", mercurio: "MERCURY", venus: "VENUS", marte: "MARS", jupiter: "JUPITER", saturno: "SATURN", urano: "URANUS", neptuno: "NEPTUNE", pluton: "PLUTO", quiron: "CHIRON", "nodo norte": "NORTH_NODE" };
var SIGNS2 = { aries: "ARIES", tauro: "TAURUS", geminis: "GEMINI", cancer: "CANCER", leo: "LEO", virgo: "VIRGO", libra: "LIBRA", escorpio: "SCORPIO", escorpion: "SCORPIO", sagitario: "SAGITTARIUS", capricornio: "CAPRICORN", acuario: "AQUARIUS", piscis: "PISCES" };
var ANGLES = { ascendente: "ASC", descendente: "DSC", "medio cielo": "MC", "fondo del cielo": "IC", "fondo de cielo": "IC" };
var ASPECTS = { conjuncion: "CONJUNCTION", oposicion: "OPPOSITION", cuadratura: "SQUARE", trigono: "TRINE", sextil: "SEXTILE", quincuncio: "QUINCUNX" };
var NUM = { uno: 1, una: 1, primera: 1, dos: 2, segunda: 2, tres: 3, tercera: 3, cuatro: 4, cuarta: 4, cinco: 5, quinta: 5, seis: 6, sexta: 6, siete: 7, septima: 7, setima: 7, ocho: 8, octava: 8, nueve: 9, novena: 9, diez: 10, decima: 10, once: 11, undecima: 11, doce: 12, duodecima: 12 };
var ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
var OPPOSITE_ANGLE = { DSC: "ASC", IC: "MC" };
var alt = (o) => Object.keys(o).sort((a, b) => b.length - a.length).join("|");
var P = alt(PLANETS);
var S = alt(SIGNS2);
var A = alt(ANGLES);
var X = alt(ASPECTS);
var PT = `(?:${P}|${A})`;
var HOUSE_NUM = `(\\d{1,2}|${alt(NUM)}|${alt(ROMAN)})`;
var toHouse = (s) => {
  const n = /^\d+$/.test(s) ? +s : NUM[s] ?? ROMAN[s];
  return n >= 1 && n <= 12 ? n : null;
};
var idOf = (w) => PLANETS[w] || ANGLES[w] || null;
var TECH_RE = new RegExp(`\\b(?:${P}|${S}|${A}|${X}|casas?|regente|regencia|stellium|retrogrado|orbe|aspecto|hemisferio|cuspide|nodo)\\b`, "g");
var techCount = (plain) => (plain.match(TECH_RE) || []).length;
var TECH_ONE = new RegExp(`^(?:${TECH_RE.source})$`);
function paragraphsOf(report) {
  const out = [];
  for (const s of report.sections || []) {
    const id = s && s.id || "";
    for (const p of String(s && s.body_markdown || "").split(/\n\s*\n/)) if (p.trim()) out.push({ section: id, text: p.trim() });
  }
  return out;
}
var sentencesOf = (t) => t.split(/(?<=[.!?…])\s+(?=[«"¿¡A-ZÁÉÍÓÚÑ])/);
var short = (t, n = 140) => (t.length > n ? t.slice(0, n - 1) + "\u2026" : t).replace(/\s+/g, " ");
function chartIndex(payload) {
  const c = payload.chart || {};
  const bodies = Object.fromEntries((c.bodies || []).map((b) => [b.id, b]));
  const unreliable = new Set((c.sensitivity && c.sensitivity.unreliable || []).map((u) => `${u.item}|${u.field}`));
  const asp = /* @__PURE__ */ new Map();
  for (const a of c.aspects || []) {
    asp.set(`${a.a}|${a.b}`, a);
    asp.set(`${a.b}|${a.a}`, a);
  }
  const angleSign = {};
  if (c.houses) {
    const sign = (lon) => ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"][Math.floor((lon % 360 + 360) % 360 / 30)];
    angleSign.ASC = sign(c.houses.asc);
    angleSign.DSC = sign(c.houses.asc + 180);
    angleSign.MC = sign(c.houses.mc);
    angleSign.IC = sign(c.houses.mc + 180);
  }
  const angular = c.derived && c.derived.angular || [];
  return { bodies, asp, angleSign, angular, timeKnown: !!c.houses, unreliable };
}
function findAspect(ix, a, b, type) {
  const direct = ix.asp.get(`${a}|${b}`);
  if (direct && direct.aspect === type) return direct;
  const flip = { CONJUNCTION: "OPPOSITION", OPPOSITION: "CONJUNCTION" }[type];
  for (const [p, q] of [[a, b], [b, a]]) if (OPPOSITE_ANGLE[q] && flip) {
    const r = ix.asp.get(`${p}|${OPPOSITE_ANGLE[q]}`);
    if (r && r.aspect === flip) return r;
  }
  if (type === "SQUARE") {
    for (const [p, q] of [[a, b], [b, a]]) if (OPPOSITE_ANGLE[q]) {
      const r = ix.asp.get(`${p}|${OPPOSITE_ANGLE[q]}`);
      if (r && r.aspect === "SQUARE") return r;
    }
  }
  return null;
}
function declaredSet(report) {
  const s = /* @__PURE__ */ new Set();
  for (const r of report.technical_references_used || []) {
    if (!r) continue;
    if (r.type === "position") {
      s.add(`pos|${r.body}|${r.sign}`);
      if (r.house != null) s.add(`house|${r.body}|${r.house}`);
    }
    if (r.type === "angle") s.add(`angle|${r.angle}|${r.sign}`);
    if (r.type === "aspect") {
      s.add(`asp|${r.a}|${r.b}|${r.aspect}`);
      s.add(`asp|${r.b}|${r.a}|${r.aspect}`);
    }
  }
  return s;
}
var POS_RE = new RegExp(`\\b(${P})\\b(?:\\s+(?:natal|retrogrado|que esta|esta|estaba|queda|cae))?\\s+en\\s+(?:el\\s+signo\\s+de\\s+)?(${S})\\b`, "g");
var ANGLE_SIGN_RE = new RegExp(`\\b(${A})\\b(?:\\s+(?:esta|cae|queda))?\\s+en\\s+(${S})\\b`, "g");
var HOUSE_RE = new RegExp(`\\b(${P})\\b([^.;:!?]{0,60}?)\\b(?:en\\s+(?:la\\s+|tu\\s+)?)?casa\\s+${HOUSE_NUM}\\b`, "g");
var HOUSE_ORD_RE = new RegExp(`\\b(${P})\\b([^.;:!?]{0,60}?)\\ben\\s+(?:la\\s+|tu\\s+)?(${alt(NUM)})\\s+casa\\b`, "g");
var ASP1_RE = new RegExp(`\\b(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:entre|de|del|de\\s+la|con)\\s+(?:tu\\s+|el\\s+|la\\s+)?(${PT})\\s+(?:y|con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
var ASP2_RE = new RegExp(`\\b(${PT})\\b\\s+(?:esta\\s+|forma\\s+|hace\\s+|queda\\s+)?(?:en\\s+|una\\s+|un\\s+)?(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
var ASP3_RE = new RegExp(`\\b(${X})\\b\\s+(?:muy\\s+\\w+\\s+|cerrada\\s+|amplia\\s+|exacta\\s+)?(?:con|a)\\s+(?:tu\\s+|el\\s+|la\\s+|al\\s+)?(${PT})\\b`, "g");
var PT_ANY = new RegExp(`\\b(${PT})\\b`, "g");
var ANGULAR_RE = new RegExp(`\\b(${P})\\b[^.;:!?]{0,40}?\\b(?:junto\\s+al?|sobre\\s+el|pegad[oa]\\s+al?|cerca\\s+del?|encima\\s+del?)\\s+(${A})\\b`, "g");
var HOUSE_WORD_RE = /\bcasas?\b|\bascendente\b|\bmedio cielo\b|\bdescendente\b|\bfondo del cielo\b/;
var BETWEEN_OTHER = new RegExp(`\\b(?:${P})\\b`);
function claimCheck(report, payload) {
  const ix = chartIndex(payload);
  const declared = declaredSet(report);
  const errors = [], undeclared = [], doubtful = [];
  let checked = 0;
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const plain = strip(text);
    const add = (list, kind, detail, key) => list.push({ section, kind, detail, excerpt: key });
    if (!ix.timeKnown && HOUSE_WORD_RE.test(plain)) add(errors, "time_unknown", "con hora desconocida no hay casas ni \xE1ngulos", short(text));
    let m;
    POS_RE.lastIndex = 0;
    while (m = POS_RE.exec(plain)) {
      const id = PLANETS[m[1]], sign = SIGNS2[m[2]], b = ix.bodies[id];
      checked++;
      if (!b) continue;
      if (b.sign !== sign) add(errors, "sign", `${m[1]} est\xE1 en ${b.sign}, no en ${sign}`, m[0]);
      else {
        if (ix.unreliable.has(`${id}|sign`)) add(doubtful, "sign", `${m[1]}: signo sensible a la hora`, m[0]);
        if (!declared.has(`pos|${id}|${sign}`)) add(undeclared, "position", `${id} ${sign}`, m[0]);
      }
    }
    ANGLE_SIGN_RE.lastIndex = 0;
    while (ix.timeKnown && (m = ANGLE_SIGN_RE.exec(plain))) {
      const id = ANGLES[m[1]], sign = SIGNS2[m[2]];
      checked++;
      if (ix.angleSign[id] !== sign) add(errors, "angle", `${m[1]} est\xE1 en ${ix.angleSign[id]}, no en ${sign}`, m[0]);
    }
    for (const re of [HOUSE_RE, HOUSE_ORD_RE]) {
      re.lastIndex = 0;
      while (ix.timeKnown && (m = re.exec(plain))) {
        if (BETWEEN_OTHER.test(m[2]) || /\bregente\b|\brige\b|\bgobierna\b|\bcuspide\b/.test(m[2])) continue;
        const id = PLANETS[m[1]], h = toHouse(m[3]), b = ix.bodies[id];
        checked++;
        if (!b || h == null) continue;
        if (b.house !== h) add(errors, "house", `${m[1]} est\xE1 en la casa ${b.house}, no en la ${h}`, m[0]);
        else {
          if (b.reliable === false || ix.unreliable.has(`${id}|house`)) add(doubtful, "house", `${m[1]}: casa sensible a la hora`, m[0]);
          if (!declared.has(`house|${id}|${h}`)) add(undeclared, "house", `${id} casa ${h}`, m[0]);
        }
      }
    }
    const used = /* @__PURE__ */ new Set();
    const subjectBefore = (end) => {
      const start = Math.max(plain.lastIndexOf(".", end), plain.lastIndexOf(";", end), plain.lastIndexOf("?", end), plain.lastIndexOf("!", end)) + 1;
      PT_ANY.lastIndex = 0;
      const mm = PT_ANY.exec(plain.slice(start, end));
      return mm ? mm[1] : null;
    };
    for (const re of [ASP1_RE, ASP2_RE, ASP3_RE]) {
      re.lastIndex = 0;
      while (m = re.exec(plain)) {
        const word = re === ASP2_RE ? m[2] : m[1], at = m.index + m[0].indexOf(word, re === ASP2_RE ? m[1].length : 0);
        if (re === ASP3_RE && used.has(at)) continue;
        used.add(at);
        const [type, a, b] = re === ASP1_RE ? [ASPECTS[m[1]], idOf(m[2]), idOf(m[3])] : re === ASP2_RE ? [ASPECTS[m[2]], idOf(m[1]), idOf(m[3])] : [ASPECTS[m[1]], idOf(subjectBefore(m.index) || ""), idOf(m[2])];
        if (!a || !b || a === b) continue;
        if (!ix.timeKnown && (ANGLES[strip(a)] || ["ASC", "DSC", "MC", "IC"].includes(a) || ["ASC", "DSC", "MC", "IC"].includes(b))) continue;
        checked++;
        const found = findAspect(ix, a, b, type);
        if (!found) add(errors, "aspect", `no hay ${type} calculado entre ${a} y ${b}`, m[0]);
        else {
          if (found.reliable === false) add(doubtful, "aspect", `${a}-${b}: aspecto sensible a la hora`, m[0]);
          if (!declared.has(`asp|${found.a}|${found.b}|${found.aspect}`)) add(undeclared, "aspect", `${a} ${type} ${b}`, m[0]);
        }
      }
    }
    ANGULAR_RE.lastIndex = 0;
    while (ix.timeKnown && (m = ANGULAR_RE.exec(plain))) {
      const id = PLANETS[m[1]], ang = ANGLES[m[2]];
      checked++;
      const near = ix.angular.some((x) => x.body === id && x.angle === ang) || findAspect(ix, id, ang, "CONJUNCTION");
      if (!near) add(errors, "angular", `${m[1]} no est\xE1 junto al ${m[2]} en la carta calculada`, m[0]);
    }
  }
  return { checked, errors, undeclared, doubtful };
}
var BIO_RE = /\b(tu (?:padre|madre|papa|mama|abuel[oa]|herman[oa])|tus (?:padres|abuelos|hermanos)|tu infancia|tu ninez|de (?:chica|chico|nina|nino|pequen[oa])|cuando eras (?:chica|chico|nina|nino|pequen[oa])|en tu casa de origen|tu familia de origen|traumas?|traumatic[oa]s?|abus(?:o|aron)|te abandonaron|divorcio de tus padres|separacion de tus padres|duelo por)\b/;
var HEDGE_RE = /\b(puede|pueden|podria|podrian|pudo|pudieron|quiza|quizas|tal vez|acaso|posible|posiblemente|probablemente|parece|pareciera|si |preguntarte|pregunta|imagen|simbolic|vale preguntarse|solo vos|no lo sabe|no puede saber|depende de tu historia)\b|\?/;
function biographyCheck(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    for (const s of sentencesOf(text)) {
      const p = strip(s);
      if (BIO_RE.test(p) && !HEDGE_RE.test(p)) out.push({ section, excerpt: short(s) });
    }
  }
  return out;
}
function jargonCheck(report) {
  let words = 0, terms = 0;
  const dense = [], techOpenings = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const plain = strip(text);
    const w = plain.split(/\s+/).filter(Boolean).length, t = techCount(plain);
    words += w;
    terms += t;
    if (t >= THRESHOLDS.termsPerParagraph) dense.push({ section, terms: t, excerpt: short(text, 100) });
    const first = sentencesOf(text)[0] || "";
    if (techCount(strip(first.split(/\s+/).slice(0, 6).join(" "))) >= 1 && techCount(strip(first)) >= 2) techOpenings.push({ section, excerpt: short(first, 100) });
  }
  return { words, terms, per1000: words ? +(terms * 1e3 / words).toFixed(1) : 0, dense, techOpenings };
}
var IDIOMS = [
  /\bno es (?:casual|casualidad|menor|poca cosa)\b/,
  /\bcabe (?:destacar|senalar|mencionar|preguntarse)\b/,
  /\b(?:es|resulta) (?:importante|fundamental|clave) (?:senalar|destacar|notar|entender|reconocer)\b/,
  /\bvale la pena (?:senalar|destacar|notar|detenerse)\b/,
  /\ben definitiva\b/,
  /\ben ultima instancia\b/,
  /\ba fin de cuentas\b/,
  /\bde alguna manera\b/,
  /\bde algun modo\b/,
  /\ben cierto sentido\b/,
  /\balgo asi como\b/,
  /\bpor asi decirlo\b/,
  /\bdicho de otro modo\b/,
  /\ben otras palabras\b/,
  /\ben esencia\b/,
  /\bsin duda\b/,
  /\bpor supuesto\b/,
  /\b(?:un|el) delicado equilibrio\b/,
  /\b(?:una|la) danza\b/,
  /\btapiz\b/,
  /\bnavegar\b/,
  /\bbrujula\b/,
  /\bfaro\b/,
  /\bmotor (?:interno|interior)\b/,
  /\btelon de fondo\b/,
  /\bla clave (?:esta|es|reside)\b/,
  /\bel (?:gran )?desafio (?:es|esta|consiste|sera)\b/,
  /\b(?:una|la) invitacion a\b/,
  /\bte invita a\b/,
  /\bpotencial (?:enorme|inmenso)\b/,
  /\bprofundamente\b/,
  /\bgenuin[oa]s?\b/,
  /\bautentic[oa]s?\b/,
  /\bresuen(?:a|an)\b/,
  /\bflorec(?:er|e|en)\b/,
  /\btransitar\b/,
  /\bespacio seguro\b/,
  /\blo que (?:verdaderamente|realmente) importa\b/,
  /\bni mas ni menos\b/,
  /\bal fin y al cabo\b/,
  /\bmas alla de\b/,
  /\bpoderos[oa]s?\b/,
  /\bfascinante\b/,
  /\bcomplej[oa] y ric[oa]\b/,
  /\bric[oa] y complej[oa]\b/,
  /\bmuy (?:especial|interesante|particular)\b/,
  /\bun viaje\b/,
  /\bun camino de\b/
];
var NOT_ONLY = /\bno (?:solo|solamente)\b[^.;:!?]{1,80}\bsino (?:tambien|ademas)\b/g;
var STOP = new Set("a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bajo bien cada casi como con contra cual cuales cuando cuanto de del desde donde dos el ella ellas ellos en entre era eres es esa esas ese eso esos esta estas este esto estos estar fue ha hace hacia han hasta hay la las le les lo los mas me mi mientras mis mismo muy nada ni no nos o otra otras otro otros para pero poco por porque puede pueden que quien se sea ser si sin sino sobre solo son su sus tambien tan tanto te tener tiene tienen toda todas todo todos tu tus un una unas uno unos vos y ya cuya cuyo ese esta parte forma vez lado modo manera".split(" "));
function enumerationCheck(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const re = /((?:[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2},\s+){2,}[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2}\s+(?:y|o|ni)\s+[^\s,.;:!?«»]+(?:\s+[^\s,.;:!?«»]+){0,2})/g;
    let m;
    while (m = re.exec(text)) {
      const items = m[1].split(/,\s+|\s+(?:y|o|ni)\s+/).filter(Boolean);
      if (items.length < 3) continue;
      const first = (x) => strip(x.split(/\s+/)[0]).replace(/^al$/, "a").replace(/^del$/, "de");
      const singles = items.filter((x) => !/\s/.test(x)).length;
      const starts = new Set(items.slice(1).map(first));
      if (singles >= items.length - 1 || starts.size === 1 && !["y", "o", "ni", "que"].includes([...starts][0])) out.push({ section, items: items.length, excerpt: short(m[1], 120) });
    }
  }
  return out;
}
function repetitionWithin(report) {
  const paras = paragraphsOf(report).filter((p) => p.section !== "myth");
  const tokens = paras.map((p) => strip(p.text).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean));
  const all = tokens.flat();
  const freq = /* @__PURE__ */ new Map();
  for (const w of all) if (w.length >= 5 && !STOP.has(w) && !TECH_ONE.test(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const overused = [...freq].filter(([, n]) => n >= THRESHOLDS.overusedMin && n * 1e3 / Math.max(all.length, 1) >= THRESHOLDS.overusedPer1000).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));
  const grams = /* @__PURE__ */ new Map();
  for (const t of tokens) for (let i = 0; i + 5 <= t.length; i++) {
    const g = t.slice(i, i + 5);
    if (g.filter((w) => !STOP.has(w)).length < 2) continue;
    const k = g.join(" ");
    grams.set(k, (grams.get(k) || 0) + 1);
  }
  const phrases = [...grams].filter(([, n]) => n >= 2).map(([phrase, count]) => ({ phrase, count })).slice(0, 10);
  const op = /* @__PURE__ */ new Map();
  for (const t of tokens) if (t.length >= 2) {
    const k = t.slice(0, 2).join(" ");
    op.set(k, (op.get(k) || 0) + 1);
  }
  const openings = [...op].filter(([, n]) => n >= 3).map(([opening, count]) => ({ opening, count }));
  return { overused, phrases, openings };
}
function idiomCheck(report) {
  const hits = [];
  for (const { section, text } of paragraphsOf(report)) {
    const p = strip(text);
    for (const re of IDIOMS) {
      const m2 = p.match(re);
      if (m2) hits.push({ section, idiom: m2[0] });
    }
    NOT_ONLY.lastIndex = 0;
    let m;
    while (m = NOT_ONLY.exec(p)) hits.push({ section, idiom: "no solo\u2026 sino tambi\xE9n" });
  }
  return hits;
}
var SHINGLE = 7;
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shingles(report) {
  const out = [];
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    const t = strip(text).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean);
    for (let i = 0; i + SHINGLE <= t.length; i++) {
      const g = t.slice(i, i + SHINGLE), k = g.join(" ");
      if (g.filter((w) => !STOP.has(w)).length < 3 || techCount(k) > 1 || /\d/.test(k)) continue;
      out.push({ phrase: k, h: hash32(k) });
    }
  }
  return out;
}
function fingerprint(report) {
  return [...new Set(shingles(report).map((s) => s.h).filter((h) => h % 3 === 0))];
}
function crossRepetition(report, recent) {
  const seen = /* @__PURE__ */ new Map();
  (recent || []).forEach((fp) => {
    for (const h of fp || []) seen.set(h, (seen.get(h) || 0) + 1);
  });
  const shared = [], done = /* @__PURE__ */ new Set();
  for (const s of shingles(report)) if (s.h % 3 === 0 && seen.has(s.h) && !done.has(s.h)) {
    done.add(s.h);
    shared.push({ phrase: s.phrase, reports: seen.get(s.h) });
  }
  return shared;
}
var MYTH_STOP = /* @__PURE__ */ new Set(["y", "e", "el", "la", "los", "las", "de", "del", "su", "sus", "en", "a", "con", "mito", "hermana", "hermano", "hijo", "hija", "padre", "madre"]);
var mythTokens = (name) => new Set(strip(String(name || "")).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !MYTH_STOP.has(w)));
function repeatedMyth(name, recent) {
  const a = mythTokens(name);
  if (!a.size) return null;
  for (const r of recent || []) for (const w of mythTokens(r)) if (a.has(w)) return r;
  return null;
}
var GROUP_TERMS = [
  ["MODALITY", "FIXED", /\bsignos? (?:fij[oa]s?|de (?:la )?constancia|de (?:la )?estabilidad)\b|\b(?:lo|la modalidad) fij[oa]\b/],
  ["MODALITY", "CARDINAL", /\bsignos? (?:cardinal(?:es)?|de (?:la )?iniciativa|que inician|de inicio)\b|\b(?:lo|la modalidad) cardinal\b/],
  ["MODALITY", "MUTABLE", /\bsignos? (?:mutables?|de (?:la )?adaptacion)\b|\b(?:lo|la modalidad) mutable\b/],
  ["ELEMENT", "FIRE", /\b(?:signos? de |el |del |poco |mucho |muy poco )fuego\b/],
  ["ELEMENT", "EARTH", /\b(?:signos? de |la |de la |poca |mucha |muy poca )tierra\b/],
  ["ELEMENT", "AIR", /\b(?:signos? de |el |del |poco |mucho |muy poco )aire\b/],
  ["ELEMENT", "WATER", /\b(?:signos? de |el |del |poca |mucha |muy poca )agua\b/]
];
var Q_MOST = /\b(casi tod[oa]s?|la mayoria|la mayor parte|predomin\w*|abunda\w*|domina\w*)\b/;
var Q_ONE = /\b(solo (?:un|una|uno)|un unico|una unica|uno solo|una sola|unico factor|unico planeta)\b/;
var Q_NONE = /\b(ningun\w*|no hay (?:planetas?|factores?|nada) en)\b/;
var Q_FEW = /\b(muy poc[oa]s?|escas[oa]s?|casi no hay|casi nada de)\b/;
var ANGLE_IDS = /* @__PURE__ */ new Set(["ASC", "MC", "DSC", "IC"]);
function countClaims(report, payload) {
  const d = payload.chart && payload.chart.derived || {};
  const errors = [];
  let checked = 0;
  const counts = (group, key) => {
    const src = group === "ELEMENT" ? d.elements : d.modalities;
    if (!src) return null;
    const all = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.length]));
    const pl = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.filter((x) => !ANGLE_IDS.has(x)).length]));
    return [all, pl];
  };
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    for (const sent of sentencesOf(text)) {
      const p = strip(sent);
      const hits = GROUP_TERMS.filter(([, , re]) => re.test(p));
      if (hits.length !== 1) continue;
      const [group, key] = hits[0];
      const c = counts(group, key);
      if (!c) continue;
      const kind = Q_ONE.test(p) ? "one" : Q_NONE.test(p) ? "none" : Q_MOST.test(p) ? "most" : Q_FEW.test(p) ? "few" : null;
      if (!kind) continue;
      checked++;
      const ok4 = c.some((m) => {
        const n = m[key] || 0, total = Object.values(m).reduce((a, b) => a + b, 0), max = Math.max(...Object.values(m));
        return kind === "one" ? n === 1 : kind === "none" ? n === 0 : kind === "few" ? n <= 2 : n > total / 2 || /predomin|domina/.test(p) && n === max;
      });
      if (!ok4) errors.push({ section, kind: "count", detail: `recuento: ${group === "ELEMENT" ? "elemento" : "modalidad"} ${key} = ${c[1][key] || 0} planetas (${c[0][key] || 0} con \xE1ngulos)`, excerpt: short(sent) });
    }
  }
  return { checked, errors };
}
var TEMPLATE = {
  questions: { max: 3, re: null },
  alternatives: { max: 2, re: /\b(otra lectura|admite (?:otra|una) lectura|lectura alternativa|lectura mas amable|tambien puede leerse|otra forma de leer)\b/g },
  defenses: { max: 2, re: /\bla defensa (?:mas )?(?:probable|tipica|natural|habitual|frecuente)\b/g },
  costs: { max: 2, re: /\bel costo (?:es|son|posible|puede|de esa|de esta)\b|\bsu costo\b/g },
  closers: { max: 2, re: /\b(?:sostiene (?:esta|esa) lectura|sostiene ese lado|es su fuente|condensa (?:esa|la|este|ese) \w+|une esas dos ideas|lo indica|lo sugiere(?:n)?)\b/g }
};
function templateCheck(report) {
  const out = { questions: 0, alternatives: 0, defenses: 0, costs: 0, closers: 0 };
  for (const { section, text } of paragraphsOf(report)) {
    if (section === "myth") continue;
    out.questions += (text.match(/\?/g) || []).length;
    const p = strip(text);
    for (const k of ["alternatives", "defenses", "costs", "closers"]) out[k] += (p.match(TEMPLATE[k].re) || []).length;
  }
  out.over = Object.keys(out).filter((k) => TEMPLATE[k] && out[k] > TEMPLATE[k].max);
  return out;
}
var THRESHOLDS = {
  termsPerParagraph: 5,
  // un párrafo con cinco o más términos técnicos es denso
  jargonPer1000: 20,
  // por encima, se pide bajar la jerga (la guía v4 dio 11,5 a 17,8)
  densePara: 3,
  techOpenings: 4,
  idioms: 3,
  notOnly: 1,
  enumerations: 5,
  overusedMin: 9,
  overusedPer1000: 3.5,
  repeatedPhrases: 2,
  repeatedOpenings: 1,
  crossShared: 3
  // frases de siete palabras compartidas con informes recientes
};
function proseAudit(report, payload, recentPrints2 = []) {
  const claims = claimCheck(report, payload);
  const biography = biographyCheck(report);
  const jargon = jargonCheck(report);
  const idioms = idiomCheck(report);
  const enumerations = enumerationCheck(report);
  const within = repetitionWithin(report);
  const cross = crossRepetition(report, recentPrints2);
  const counts = countClaims(report, payload);
  if (counts.errors.length) {
    claims.errors.push(...counts.errors);
    claims.checked += counts.checked;
  } else claims.checked += counts.checked;
  const template = templateCheck(report);
  const fix = [];
  if (claims.errors.length) fix.push("claims");
  if (biography.length) fix.push("biography");
  const notes = [];
  if (jargon.per1000 > THRESHOLDS.jargonPer1000 || jargon.dense.length >= THRESHOLDS.densePara || jargon.techOpenings.length >= THRESHOLDS.techOpenings) notes.push("jargon");
  if (idioms.length >= THRESHOLDS.idioms || idioms.filter((i) => i.idiom.startsWith("no solo")).length > THRESHOLDS.notOnly) fix.push("idioms");
  if (enumerations.length >= THRESHOLDS.enumerations) fix.push("enumerations");
  if (within.phrases.length >= THRESHOLDS.repeatedPhrases || within.openings.length >= THRESHOLDS.repeatedOpenings || within.overused.length) fix.push("repetition");
  if (cross.length >= THRESHOLDS.crossShared) fix.push("cross_repetition");
  if (template.over.length) fix.push("template");
  return { version: PROSE_AUDIT_VERSION, ok: fix.length === 0, claims, biography, jargon, idioms, enumerations, within, cross, template, fix, notes };
}
function describeProse(r) {
  const out = [], ex = (list, f, n = 5) => list.slice(0, n).map((x) => `  \xAB${f(x)}\xBB`).join("\n");
  if (r.fix.includes("claims")) out.push(`- El texto afirma datos t\xE9cnicos que no coinciden con la carta calculada. Correg\xED o quit\xE1 cada uno:
${r.claims.errors.slice(0, 8).map((e) => `  ${e.detail} \u2014 \xAB${e.excerpt}\xBB`).join("\n")}`);
  if (r.fix.includes("biography")) out.push(`- Estas oraciones presentan como hecho algo de la biograf\xEDa que la carta no puede saber. Reformulalas como posibilidad o pregunta, o quitalas:
${ex(r.biography, (b) => b.excerpt)}`);
  if (r.fix.includes("jargon")) out.push(`- Hay demasiada jerga astrol\xF3gica (${r.jargon.per1000} t\xE9rminos cada mil palabras; objetivo: 15 o menos). En cada p\xE1rrafo, primero la experiencia; el dato t\xE9cnico, como mucho una vez y al final, solo si sostiene la idea. P\xE1rrafos m\xE1s cargados:
${ex(r.jargon.dense.concat(r.jargon.techOpenings), (d) => d.excerpt)}`);
  if (r.fix.includes("idioms")) out.push(`- Muletillas y modismos de texto gen\xE9rico (${r.idioms.length}): ${[...new Set(r.idioms.map((i) => i.idiom))].slice(0, 10).join(", ")}. Reemplazalos por una formulaci\xF3n precisa o eliminalos sin sustituto.`);
  if (r.fix.includes("enumerations")) out.push(`- Hay ${r.enumerations.length} enumeraciones de tres o m\xE1s elementos. Dej\xE1 solo las que nombran cosas distintas y concretas de esta carta; las dem\xE1s, reducilas a lo que de verdad dice algo:
${ex(r.enumerations, (e) => e.excerpt)}`);
  if (r.fix.includes("repetition")) {
    const parts = [];
    if (r.within.overused.length) parts.push(`palabras repetidas en exceso: ${r.within.overused.map((o) => `\xAB${o.word}\xBB (${o.count})`).join(", ")}`);
    if (r.within.phrases.length) parts.push(`frases repetidas: ${r.within.phrases.slice(0, 5).map((p) => `\xAB${p.phrase}\xBB`).join(", ")}`);
    if (r.within.openings.length) parts.push(`p\xE1rrafos que empiezan igual: ${r.within.openings.map((o) => `\xAB${o.opening}\u2026\xBB (${o.count})`).join(", ")}`);
    out.push(`- Repeticiones dentro del informe: ${parts.join("; ")}. Vari\xE1 sin buscar sin\xF3nimos de adorno: si una idea ya se dijo, no la repitas.`);
  }
  if (r.fix.includes("template")) {
    const T = r.template, parts = [];
    if (T.questions > 3) parts.push(`${T.questions} preguntas (m\xE1ximo 3 en todo el informe)`);
    if (T.alternatives > 2) parts.push(`${T.alternatives} \xABotra lectura\xBB o equivalentes (m\xE1ximo 2)`);
    if (T.defenses > 2) parts.push(`${T.defenses} \xABla defensa m\xE1s probable/t\xEDpica\xBB (m\xE1ximo 2)`);
    if (T.costs > 2) parts.push(`${T.costs} \xABel costo\xBB (m\xE1ximo 2)`);
    if (T.closers > 2) parts.push(`${T.closers} cierres del tipo \xAB\u2026sostiene esta lectura\xBB, \xAB\u2026es su fuente\xBB, \xAB\u2026condensa\u2026\xBB (m\xE1ximo 2)`);
    out.push(`- La estructura del an\xE1lisis qued\xF3 a la vista como plantilla: ${parts.join("; ")}. Integr\xE1 defensa, costo y alternativas en el relato solo donde importan, quit\xE1 preguntas hasta dejar las m\xE1s necesarias y vari\xE1 c\xF3mo nombr\xE1s el dato t\xE9cnico (no siempre al final del p\xE1rrafo).`);
  }
  if (r.fix.includes("cross_repetition")) out.push(`- Estas frases ya aparecieron en otros informes recientes. Reescribilas desde esta carta:
${ex(r.cross, (c) => c.phrase, 8)}`);
  return out.join("\n");
}

// src/style.js
var CONTRAST = {
  es: [/\bno\s(?!(?:s[oó]lo|solamente|[uú]nicamente)\b)(?![^.;:!?]{0,80}\bsino\s+tambi[eé]n\b)[^.;:!?]{1,80}?\bsino\b/gi, /\besto no significa\b/gi, /\bno significa\b[^.!?]{1,100}?[;:,]\s*significa\b/gi],
  de: [/\bnicht\s(?!nur\b)(?![^.;:!?]{0,80}\bsondern\s+auch\b)[^.;:!?]{1,80}?\bsondern\b/gi, /\bdas bedeutet nicht\b/gi],
  en: [/\bnot\s(?!only\b|just\b|merely\b)[^.;:!?]{1,60}?,\s*but\b/gi, /\bisn['’]t about\b[^.;:!?]{1,60}?\bit['’]s about\b/gi, /\bthis doesn['’]t mean\b/gi]
};
var CONTRAST_MAX = 1;
var CLICHES = {
  es: [
    /\ben un mundo (?:que|donde|en el que)\b/gi,
    /\bviaje (?:interior|del alma|de autodescubrimiento)\b/gi,
    /\btu (?:verdadero|aut[eé]ntico) (?:yo|ser)\b/gi,
    /\bni[ñn][oa] interior\b/gi,
    /\bel universo (?:te|nos)\b/gi,
    /\bdespertar espiritual\b/gi,
    /\bvibraci[oó]n(?:es)?\b/gi,
    /\benerg[ií]as? (?:c[oó]smicas?|positivas?|negativas?)\b/gi,
    /\bbrillar con luz propia\b/gi,
    /\bsin lugar a dudas\b/gi,
    /\blos astros (?:te |nos )?(?:dicen|indican|anuncian|predicen)\b/gi,
    /\bestá escrito\b/gi,
    /\btu destino\b/gi,
    /\babraz(?:ar|á|a) (?:tu|tus) (?:sombra|heridas?)\b/gi,
    /\btrastorno\b/gi,
    // fórmulas heredadas de instrucciones internas o repetidas entre informes
    /\bquiz[aá] reconozcas\b/gi,
    /\btal vez conozcas\b/gi,
    /\bno dice nada comprobable\b/gi,
    /\blo que la carta sugiere integrar\b/gi,
    /\ben t[eé]rminos de experiencia\b/gi,
    /\brepartir esta contradicci[oó]n\b/gi,
    /\bla pregunta que condensa\b/gi,
    /\blas necesidades en tensi[oó]n\b/gi
  ],
  de: [
    /\bin einer welt,? in der\b/gi,
    /\binnere reise\b/gi,
    /\bdein wahres selbst\b/gi,
    /\binneres kind\b/gi,
    /\bdas universum\b/gi,
    /\bspirituelles erwachen\b/gi,
    /\bschwingung(?:en)?\b/gi,
    /\bkosmische energie\b/gi,
    /\bdein schicksal\b/gi,
    /\bdie sterne (?:sagen|zeigen)\b/gi,
    /\bst[öo]rung\b/gi
  ],
  en: [
    /\bin a world (?:where|that)\b/gi,
    /\binner journey\b/gi,
    /\bjourney of self-discovery\b/gi,
    /\byour true self\b/gi,
    /\binner child\b/gi,
    /\bthe universe (?:is|wants|has)\b/gi,
    /\bspiritual awakening\b/gi,
    /\bvibrations?\b/gi,
    /\bcosmic energ(?:y|ies)\b/gi,
    /\byour destiny\b/gi,
    /\bthe stars (?:say|tell|show)\b/gi,
    /\bembrace your (?:shadow|wounds?)\b/gi,
    /\bdisorder\b/gi
  ]
};
var snippet = (text, i, len) => text.slice(Math.max(0, i - 30), Math.min(text.length, i + len + 30)).replace(/\s+/g, " ").trim();
function findAll(text, regexes) {
  const hits = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while (m = re.exec(text)) hits.push({ i: m.index, s: m[0] });
  }
  return hits.sort((a, b) => a.i - b.i);
}
function styleCheck(report) {
  const lang = CONTRAST[report && report.language] ? report.language : "es";
  const text = (report.sections || []).map((s) => `${s.heading || ""}
${s.body_markdown || ""}`).join("\n\n");
  const issues = [];
  const contrast = findAll(text, CONTRAST[lang]);
  if (contrast.length > CONTRAST_MAX) issues.push({ kind: "contrast_formula", count: contrast.length, examples: contrast.slice(0, 6).map((h) => snippet(text, h.i, h.s.length)) });
  const cl = findAll(text, CLICHES[lang]);
  if (cl.length) issues.push({ kind: "cliche", count: cl.length, examples: cl.slice(0, 8).map((h) => snippet(text, h.i, h.s.length)) });
  return { ok: issues.length === 0, issues };
}
function describeStyle(style) {
  return style.issues.map((i) => i.kind === "contrast_formula" ? `- La f\xF3rmula de contraste \xABno X, sino Y\xBB (o \xABesto no significa\u2026\xBB) aparece ${i.count} veces; el protocolo pide no usarla como recurso habitual. Reescrib\xED esos pasajes afirmando directamente la interpretaci\xF3n. Ejemplos:
${i.examples.map((e) => `  \xAB\u2026${e}\u2026\xBB`).join("\n")}` : `- Frases hechas o lenguaje de hor\xF3scopo, autoayuda o diagn\xF3stico (${i.count}). Reemplazalas por una formulaci\xF3n precisa y propia de esta carta. Ejemplos:
${i.examples.map((e) => `  \xAB\u2026${e}\u2026\xBB`).join("\n")}`).join("\n");
}

// src/prompts.js
var IDIOMA = { es: "espa\xF1ol rioplatense, con voseo", de: "alem\xE1n, tuteando (du)", en: "ingl\xE9s brit\xE1nico (ortograf\xEDa brit\xE1nica: organise, colour)" };
var TRATAMIENTO = {
  FEMININE: "Cuando el idioma exija concordancia de g\xE9nero para referirse a la persona, us\xE1 el femenino.",
  MASCULINE: "Cuando el idioma exija concordancia de g\xE9nero para referirse a la persona, us\xE1 el masculino.",
  NEUTRAL: "La persona prefiere un tratamiento neutro: no uses marcas de g\xE9nero gramatical para referirte a ella. Eleg\xED construcciones que no las requieran (por ejemplo, \xABten\xE9s tendencia a\u2026\xBB en lugar de \xABsos propenso/propensa a\u2026\xBB). No uses \xABe\xBB, \xABx\xBB ni \xAB@\xBB como desinencias.",
  UNSPECIFIED: "No sab\xE9s el g\xE9nero de la persona: no uses marcas de g\xE9nero gramatical para referirte a ella. Eleg\xED construcciones que no las requieran (por ejemplo, \xABten\xE9s tendencia a\u2026\xBB en lugar de \xABsos propenso/propensa a\u2026\xBB). No uses \xABe\xBB, \xABx\xBB ni \xAB@\xBB como desinencias."
};
var PROMPT_ANALISIS = (carta, mitosRecientes = []) => `FASE A \u2014 AN\xC1LISIS ESTRUCTURAL (no es el informe).
Le\xE9 la carta calculada que sigue y devolv\xE9 SOLO un objeto JSON, sin texto antes ni despu\xE9s, con esta forma:
{
 "tension_organizadora": "una o dos oraciones",
 "temas": [{"tema": "\u2026", "indicadores": ["referencias t\xE9cnicas exactas tomadas del JSON"], "peso": "alto|medio|bajo"}],
 "contradicciones": ["\u2026"],
 "datos_no_fiables": ["elementos marcados reliable:false o en sensitivity.unreliable que no deben sostener conclusiones"],
 "jerarquia_de_secciones": ["ids de secci\xF3n en el orden que conviene"],
 "mito": {"nombre": "\u2026", "por_que": "\u2026"},
 "pasadas": {"forma_general": "\u2026", "planeta_por_planeta": "\u2026", "diferencias": "\u2026"},
 "forma_de_la_tension": "qu\xE9 forma tiene (oposici\xF3n, cadena, tri\xE1ngulo, desproporci\xF3n, ausencia, ciclo, desfase u otra) y por qu\xE9",
 "tesis": [{"id": "t1", "afirmacion": "\u2026", "central": true, "indicators": ["referencias t\xE9cnicas declaradas como en technical_references_used"],
   "mecanismo": "c\xF3mo se vive en una situaci\xF3n concreta: qu\xE9 se siente, qu\xE9 se hace, qu\xE9 se evita",
   "defensa": "qu\xE9 hace la persona para no sentir el polo inc\xF3modo", "costo": "qu\xE9 pierde o posterga con esa defensa",
   "recurso": "qu\xE9 capacidad de la misma carta permite sostener la tensi\xF3n", "especificidad": "qu\xE9 combinaci\xF3n de esta carta la separa de la lectura de manual de cada posici\xF3n",
   "lectura_alternativa": "\u2026", "que_la_debilitaria": "\u2026"}],
 "lecturas_descartadas": [{"lectura": "interpretaci\xF3n habitual que esta carta no sostiene", "motivo": "\u2026"}],
 "preguntas_biograficas": ["lo que la carta no puede saber y el informe solo puede preguntar"],
 "mitos_considerados": [{"nombre": "\u2026", "motivo": "\u2026"}]
}
Antes de responder, hac\xE9 dos pasadas: forma general de la carta y revisi\xF3n planeta por planeta. Escrib\xED entre tres y cinco tesis. Toda tesis
central necesita al menos dos indicadores distintos. Una tesis relaciona factores entre s\xED: una posici\xF3n aislada no es una tesis. Si no pod\xE9s
completar "especificidad" sin repetir el significado de manual de una posici\xF3n, la tesis es gen\xE9rica: descartala y anotala en
"lecturas_descartadas". No asocies un s\xEDmbolo con un hecho de la vida (padre, madre, infancia, p\xE9rdidas, enfermedad): eso va en
"preguntas_biograficas". El mito se elige despu\xE9s de las tesis y debe condensar la tesis central, no un planeta. Prioriz\xE1 los aspectos m\xE1s cerrados y us\xE1 chart.derived.structure si existe. Consider\xE1 tres
mitos y explic\xE1 por qu\xE9 eleg\xEDs uno.
Us\xE1 exclusivamente los datos del JSON. Nada de memoria ni c\xE1lculos propios. Si la hora es desconocida, no uses casas ni \xE1ngulos.
Con hora desconocida, la Luna est\xE1 calculada a las 12:00 y pudo estar unos 6\xB0 antes o despu\xE9s: no la cuentes entre los aspectos m\xE1s cerrados
ni bases una tesis en que un aspecto suyo sea exacto.
Antes de elegir los temas, revis\xE1 chart.derived.configurations (cuadraturas en T, grandes cruces, yods, grandes tr\xEDgonos) y
chart.derived.angular: toda configuraci\xF3n calculada y todo planeta a menos de 3\xB0 de un \xE1ngulo debe figurar en "temas" o, si decid\xEDs
no desarrollarlo, en una nota breve dentro de "contradicciones" que explique por qu\xE9 pesa menos en esta carta.

${mitosRecientes.length ? `Mitos usados recientemente (evitalos salvo justificaci\xF3n concreta): ${mitosRecientes.join("; ")}.

` : ""}CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
var PROMPT_INFORME = ({ idioma, lang, nombre, tratamiento, analisis, carta }) => `FASE B \u2014 REDACCI\xD3N DEL INFORME.
Redact\xE1 el informe natal completo siguiendo el protocolo, en ${idioma}, en segunda persona, a partir del an\xE1lisis estructural
y de la carta calculada. ${nombre}
${tratamiento}
Devolv\xE9 SOLO un objeto JSON v\xE1lido, sin texto antes ni despu\xE9s, con esta forma (contrato astroinforme.report/v1):
{
 "schema": "astroinforme.report/v1",
 "language": "${lang}",
 "title": "\u2026",
 "sections": [{"id": "opening|identity|emotional|central_conflict|saturn|desire|relationships|roots|vocation|neptune|shadow|transformation|resources|synthesis|myth", "heading": "\u2026", "body_markdown": "p\xE1rrafos separados por una l\xEDnea en blanco"}],
 "technical_references_used": [
   {"type": "position", "body": "SUN", "sign": "AQUARIUS", "deg": "9\xB029'", "house": 4},
   {"type": "angle", "angle": "ASC", "sign": "SCORPIO", "deg": "5\xB042'"},
   {"type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "CONJUNCTION"}
 ],
 "theses": [{"id": "t1", "claim": "\u2026", "sections": ["ids de secci\xF3n"], "central": true, "indicators": [referencias con el mismo formato de technical_references_used]}]
}
Cada tesis central del an\xE1lisis debe figurar en "theses" y desarrollarse en al menos una secci\xF3n, con su mecanismo, defensa, costo y
recurso contados como experiencia concreta. Las lecturas descartadas no aparecen en el informe. Las preguntas biogr\xE1ficas se formulan
como preguntas o posibilidades, nunca como hechos.
Redacci\xF3n:
- Jerga: en cada p\xE1rrafo, primero la experiencia; el dato astrol\xF3gico va despu\xE9s, una sola vez y solo si sostiene la idea. Apunt\xE1 a
  15 t\xE9rminos t\xE9cnicos o menos cada mil palabras. No enumeres posiciones ni recorras cadenas de regencias en el texto.
- Cada secci\xF3n agrega algo que las anteriores no dijeron. La s\xEDntesis integra sin resumir. Si una idea ya se dijo, no la repitas con otras palabras.
- Enumeraciones solo cuando cada elemento nombra algo distinto y propio de esta carta; nada de series de tres adjetivos o sustantivos abstractos.
- Sin muletillas ni modismos de texto gen\xE9rico (por ejemplo: \xABno es casualidad\xBB, \xABen definitiva\xBB, \xABde alguna manera\xBB, \xABla clave est\xE1 en\xBB,
  \xABte invita a\xBB, \xABun delicado equilibrio\xBB, \xABno solo\u2026 sino tambi\xE9n\xBB). Sin met\xE1foras de viaje, danza, tapiz, br\xFAjula o faro.
- Mecanismo, defensa, costo, recurso y lectura alternativa son herramientas del an\xE1lisis, no una plantilla de secci\xF3n: contalos
  solo donde cambian lo que la persona puede entender de s\xED, integrados en el relato. En todo el informe: como mucho tres
  preguntas y dos lecturas alternativas; no abras p\xE1rrafos con \xABLa defensa\u2026\xBB ni \xABEl costo\u2026\xBB.
- El dato t\xE9cnico no va siempre al final del p\xE1rrafo ni con la misma f\xF3rmula (\xAB\u2026sostiene esta lectura\xBB, \xAB\u2026es su fuente\xBB,
  \xAB\u2026condensa\u2026\xBB): vari\xE1 su lugar o omitilo cuando la idea ya qued\xF3 fundada.
- Recuentos por elemento o modalidad (\xABcasi todo\xBB, \xABsolo un\xBB, \xABpredominio\xBB): solo si coinciden con chart.derived.
- Mito: la versi\xF3n de las fuentes cl\xE1sicas, solo la escena necesaria. Si dud\xE1s de un detalle, omitilo; no agregues hechos ni motivos.
  Si "mito_descartado" figura en el an\xE1lisis, us\xE1 el mito de "mito" y no menciones el descartado.
No incluyas dedicatoria ni ninguna secci\xF3n dirigida a la persona despu\xE9s del corolario mitol\xF3gico.
Reglas para technical_references_used: inclu\xED cada posici\xF3n, \xE1ngulo y aspecto que el texto menciona, con los valores exactos del
JSON (deg = grados y minutos de "position"). Omit\xED "house" si no la mencion\xE1s o si la casa figura como no fiable. No incluyas
aspectos que no est\xE9n en chart.aspects. Con hora desconocida no hay casas ni \xE1ngulos.
Con hora desconocida, no escribas que un aspecto de la Luna es cerrado, exacto o firme: su orbe vale solo como referencia de las 12:00.
Si el texto se apoya en una configuraci\xF3n, una regencia, un stellium o un recuento por elemento o modalidad, declaralo tambi\xE9n,
copiando los valores de chart.derived (no los deduzcas):
   {"type": "configuration", "configuration": "T_SQUARE", "apex": "MARS", "opposition": ["SUN", "MOON"]}  (GRAND_TRINE y GRAND_CROSS: "bodies"; YOD: "apex" y "base")
   {"type": "rulership", "of": "ASC", "ruler": "SATURN"}  ("of": ASC, DSC, MC, IC, un n\xFAmero de casa o un planeta, seg\xFAn angle_rulers, house_rulers o dispositors)
   {"type": "stellium", "by": "SIGN", "where": "PISCES", "bodies": ["SUN", "VENUS", "NEPTUNE"]}  ("by": SIGN o HOUSE, seg\xFAn stelliums)
   {"type": "distribution", "group": "ELEMENT", "key": "WATER", "count": 4}  ("group": ELEMENT o MODALITY, seg\xFAn elements o modalities)

AN\xC1LISIS ESTRUCTURAL (fase A):
${analisis}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
var PROMPT_CORRECCION = ({ problemas, estilo, informe, carta }) => `FASE C \u2014 CORRECCI\xD3N.
${problemas ? `La auditor\xEDa compar\xF3 las referencias de tu informe con la carta calculada y encontr\xF3 estos problemas:
${problemas}

Correg\xED esos pasajes para que digan lo que efectivamente figura en la carta calculada, o quit\xE1 la afirmaci\xF3n si el dato no
existe o no es fiable. Actualiz\xE1 technical_references_used y theses en consecuencia.
` : ""}${estilo ? `
El control de estilo encontr\xF3 esto:
${estilo}
` : ""}
Cambi\xE1 solo los pasajes se\xF1alados y manten\xE9 el resto del texto. Devolv\xE9 SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

// src/validate.js
var SIGNS3 = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
var CORE = ["SUN", "MOON", "MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE", "PLUTO"];
var BODY_IDS = [...CORE, "CHIRON", "NORTH_NODE"];
var ANGLES2 = ["ASC", "DSC", "MC", "IC"];
var POINT_IDS = [...BODY_IDS, "ASC", "MC"];
var ASPECTS2 = ["CONJUNCTION", "OPPOSITION", "SQUARE", "TRINE", "SEXTILE", "QUINCUNX"];
var PRECISIONS = { EXACT: "\xB14 min", PM15: "\xB115 min", PM30: "\xB130 min", PM60: "\xB160 min", UNKNOWN: "unknown" };
var LANGS = { es: "voseo", de: "du", en: "you" };
var GENDERS = ["FEMININE", "MASCULINE", "NEUTRAL", "UNSPECIFIED"];
var WARNINGS = ["PRE_1970_TZ", "AMBIGUOUS_LOCAL_TIME", "MANUAL_OFFSET", "MANUAL_COORDS", "PLACIDUS_FAILED", "UNKNOWN_TIME", "TIME_SENSITIVE"];
var PHASES = ["NEW", "CRESCENT", "FIRST_QUARTER", "GIBBOUS", "FULL", "DISSEMINATING", "LAST_QUARTER", "BALSAMIC"];
var CONFIG_TYPES = ["T_SQUARE", "GRAND_TRINE", "YOD", "GRAND_CROSS"];
var SENS_NOTES = ["podr\xEDa entrar en orbe", "podr\xEDa salir de orbe"];
var ID_RE2 = /^[A-Za-z0-9._-]{1,30}$/;
var DEG_RE = /^(\d{1,2})°(\d{2})'(?:(\d{2})")?$/;
var LIMITS = { name: 40, nameWords: 3, aspects: 150, configurations: 40, stelliums: 20, unreliable: 120, warnings: 10 };
var Invalid = class extends Error {
  constructor(where) {
    super(where);
    this.where = where;
  }
};
var fail = (where) => {
  throw new Invalid(where);
};
var isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
var obj = (x, where) => isObj(x) ? x : fail(where);
var arr = (x, max, where) => Array.isArray(x) && x.length <= max ? x : fail(where);
var num = (x, min, max, where) => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : fail(where);
var bool = (x, where) => typeof x === "boolean" ? x : fail(where);
var oneOf = (x, list, where) => list.includes(x) ? x : fail(where);
var optOneOf = (x, list, where) => x == null ? null : oneOf(x, list, where);
var house = (x, where) => Number.isInteger(x) && x >= 1 && x <= 12 ? x : fail(where);
var optHouse = (x, where) => x == null ? null : house(x, where);
var ids = (x, list, max, where) => arr(x, max, where).map((v) => oneOf(v, list, where));
var signOf = (lon) => SIGNS3[Math.floor((lon % 360 + 360) % 360 / 30)];
function degString(s, lon, where) {
  const m = typeof s === "string" ? s.match(DEG_RE) : null;
  if (!m || +m[1] > 30 || +m[2] > 59) fail(where);
  const inSign = (lon % 360 + 360) % 360 % 30 * 60;
  const said = +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
  if (Math.abs(said - inSign) > 1.01 && Math.abs(said - inSign) < 1800 - 1.01) fail(where);
  return s;
}
function normalizeFirstName(x) {
  if (x == null || x === "") return null;
  if (typeof x !== "string") return void 0;
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(x)) return void 0;
  const s = x.normalize("NFC").replace(/ +/g, " ").trim();
  if (!s) return null;
  if (s.length > LIMITS.name || s.split(" ").length > LIMITS.nameWords) return void 0;
  if (!/^[\p{L}\p{M}]+(?:[ '’.-]{1,2}[\p{L}\p{M}]+)*\.?$/u.test(s)) return void 0;
  return s;
}
function normBody(b, timeKnown) {
  obj(b, "body");
  const id = oneOf(b.id, BODY_IDS, "body.id");
  const longitude = num(b.longitude, 0, 360, "body.longitude") % 360;
  const sign = oneOf(b.sign, SIGNS3, "body.sign");
  if (sign !== signOf(longitude)) fail("body.sign\u2260longitude");
  return {
    id,
    longitude,
    sign,
    position: degString(b.position, longitude, "body.position"),
    house: timeKnown ? house(b.house, "body.house") : b.house == null ? null : fail("body.house"),
    speed: num(b.speed, -30, 30, "body.speed"),
    retrograde: bool(b.retrograde, "body.retrograde"),
    stationary: bool(b.stationary, "body.stationary"),
    near_next_cusp: b.near_next_cusp == null ? null : bool(b.near_next_cusp, "body.near_next_cusp"),
    reliable: bool(b.reliable, "body.reliable")
  };
}
function normHouses(h) {
  if (h == null) return null;
  obj(h, "houses");
  const asc = num(h.asc, 0, 360, "houses.asc") % 360, mc = num(h.mc, 0, 360, "houses.mc") % 360;
  const cusps = arr(h.cusps, 12, "houses.cusps");
  if (cusps.length !== 12) fail("houses.cusps");
  return {
    system: oneOf(h.system, ["PLACIDUS", "PORPHYRY"], "houses.system"),
    requested: optOneOf(h.requested, ["PLACIDUS", "PORPHYRY"], "houses.requested"),
    asc,
    mc,
    cusps: cusps.map((c, i) => {
      obj(c, "cusp");
      const longitude = num(c.longitude, 0, 360, "cusp.longitude") % 360;
      if (c.house !== i + 1) fail("cusp.house");
      const sign = oneOf(c.sign, SIGNS3, "cusp.sign");
      if (sign !== signOf(longitude)) fail("cusp.sign\u2260longitude");
      return { house: i + 1, longitude, sign, position: degString(c.position, longitude, "cusp.position") };
    })
  };
}
function normAspect(a) {
  obj(a, "aspect");
  return {
    a: oneOf(a.a, POINT_IDS, "aspect.a"),
    b: oneOf(a.b, POINT_IDS, "aspect.b"),
    aspect: oneOf(a.aspect, ASPECTS2, "aspect.aspect"),
    orb: num(a.orb, 0, 15, "aspect.orb"),
    max_orb: num(a.max_orb, 0, 15, "aspect.max_orb"),
    orb_class: oneOf(a.orb_class, ["TIGHT", "MEDIUM", "WIDE"], "aspect.orb_class"),
    applying: a.applying == null ? null : bool(a.applying, "aspect.applying"),
    reliable: bool(a.reliable, "aspect.reliable")
  };
}
function normConfig(c) {
  obj(c, "configuration");
  const type = oneOf(c.type, CONFIG_TYPES, "configuration.type");
  if (type === "T_SQUARE") {
    const opposition = ids(c.opposition, POINT_IDS, 2, "configuration.opposition");
    if (opposition.length !== 2) fail("configuration.opposition");
    return { type, apex: oneOf(c.apex, POINT_IDS, "configuration.apex"), opposition };
  }
  if (type === "YOD") {
    const base2 = ids(c.base, POINT_IDS, 2, "configuration.base");
    if (base2.length !== 2) fail("configuration.base");
    return { type, apex: oneOf(c.apex, POINT_IDS, "configuration.apex"), base: base2 };
  }
  const bodies = ids(c.bodies, POINT_IDS, 4, "configuration.bodies");
  if (bodies.length !== (type === "GRAND_TRINE" ? 3 : 4)) fail("configuration.bodies");
  return { type, bodies };
}
function normRuler(r, where) {
  obj(r, where);
  return { ruler: oneOf(r.ruler, CORE, where), traditional_coregent: optOneOf(r.traditional_coregent, CORE, where) };
}
function normDerived(d, timeKnown) {
  obj(d, "derived");
  const groups = (x, keys, where) => {
    obj(x, where);
    return Object.fromEntries(keys.map((k) => [k, ids(x[k] || [], POINT_IDS, 14, where)]));
  };
  const out = {
    elements: groups(d.elements, ["FIRE", "EARTH", "AIR", "WATER"], "derived.elements"),
    modalities: groups(d.modalities, ["CARDINAL", "FIXED", "MUTABLE"], "derived.modalities"),
    elements_counted: ids(d.elements_counted || [], POINT_IDS, 14, "derived.elements_counted"),
    stelliums: arr(d.stelliums || [], LIMITS.stelliums, "derived.stelliums").map((s) => {
      obj(s, "stellium");
      const by = oneOf(s.by, ["SIGN", "HOUSE"], "stellium.by");
      return { by, where: by === "SIGN" ? oneOf(s.where, SIGNS3, "stellium.where") : house(s.where, "stellium.where"), bodies: ids(s.bodies, CORE, 10, "stellium.bodies") };
    }),
    dispositors: Object.fromEntries(Object.entries(obj(d.dispositors || {}, "derived.dispositors")).map(([k, v]) => [oneOf(k, CORE, "dispositor"), normRuler(v, "dispositor")])),
    planets_in_domicile: ids(d.planets_in_domicile || [], CORE, 10, "derived.planets_in_domicile"),
    final_dispositor: optOneOf(d.final_dispositor, CORE, "derived.final_dispositor"),
    mutual_receptions: arr(d.mutual_receptions || [], 20, "derived.mutual_receptions").map((m) => {
      obj(m, "mutual_reception");
      return { a: oneOf(m.a, CORE, "mr.a"), b: oneOf(m.b, CORE, "mr.b"), rulership: oneOf(m.rulership, ["MODERN"], "mr.rulership") };
    }),
    configurations: arr(d.configurations || [], LIMITS.configurations, "derived.configurations").map(normConfig),
    unaspected: ids(d.unaspected || [], CORE, 10, "derived.unaspected")
  };
  if (d.structure != null) {
    obj(d.structure, "structure");
    const pair = (x, where) => {
      obj(x, where);
      return { a: oneOf(x.a, CORE, where), b: oneOf(x.b, CORE, where), aspect: oneOf(x.aspect, ASPECTS2, where) };
    };
    const counts = obj(d.structure.aspect_counts || {}, "structure.counts");
    out.structure = {
      connected_groups: arr(d.structure.connected_groups || [], 10, "structure.groups").map((g) => ids(g, CORE, 10, "structure.group")),
      bridges: arr(d.structure.bridges || [], 45, "structure.bridges").map((x) => pair(x, "structure.bridge")),
      aspect_counts: Object.fromEntries(["TENSION", "FLOWING", "ADJUSTMENT", "CONJUNCTION"].map((k) => [k, num(counts[k] || 0, 0, 45, "structure.count")])),
      closest_aspects: arr(d.structure.closest_aspects || [], 6, "structure.closest").map((x) => ({ ...pair(x, "structure.closest"), orb_class: oneOf(x.orb_class, ["TIGHT", "MEDIUM", "WIDE"], "structure.orb_class") }))
    };
  }
  if (d.sun_moon_phase != null) {
    obj(d.sun_moon_phase, "phase");
    out.sun_moon_phase = { angle: num(d.sun_moon_phase.angle, 0, 360, "phase.angle"), phase: oneOf(d.sun_moon_phase.phase, PHASES, "phase.phase") };
  }
  if (timeKnown) {
    out.angular = arr(d.angular || [], 30, "derived.angular").map((x) => {
      obj(x, "angular");
      return { body: oneOf(x.body, BODY_IDS, "angular.body"), angle: oneOf(x.angle, ANGLES2, "angular.angle"), distance: num(x.distance, 0, 10, "angular.distance") };
    });
    if (d.angle_rulers != null) out.angle_rulers = Object.fromEntries(Object.entries(obj(d.angle_rulers, "angle_rulers")).map(([k, v]) => {
      oneOf(k, ANGLES2, "angle_rulers.key");
      obj(v, "angle_ruler");
      return [k, { sign: oneOf(v.sign, SIGNS3, "angle_ruler.sign"), ...normRuler(v, "angle_ruler"), ruler_sign: oneOf(v.ruler_sign, SIGNS3, "angle_ruler.ruler_sign"), ruler_house: optHouse(v.ruler_house, "angle_ruler.ruler_house") }];
    }));
    if (d.house_rulers != null) out.house_rulers = arr(d.house_rulers, 12, "house_rulers").map((h) => {
      obj(h, "house_ruler");
      return { house: house(h.house, "house_ruler.house"), cusp_sign: oneOf(h.cusp_sign, SIGNS3, "house_ruler.cusp_sign"), ...normRuler(h, "house_ruler") };
    });
    if (d.houses_occupancy != null) out.houses_occupancy = Object.fromEntries(Object.entries(obj(d.houses_occupancy, "houses_occupancy")).map(([k, v]) => [String(house(+k, "occupancy.key")), ids(v, CORE, 10, "occupancy")]));
    if (d.hemispheres != null) out.hemispheres = groups(d.hemispheres, ["UPPER_7_12", "LOWER_1_6", "EASTERN_10_3", "WESTERN_4_9"], "derived.hemispheres");
  }
  return out;
}
function normSensitivity(s) {
  if (s == null) return { precision: null, window_min: null, unreliable: [] };
  obj(s, "sensitivity");
  const itemOK = (it) => typeof it === "string" && (POINT_IDS.includes(it) || /^[A-Z_]{2,12}\|[A-Z_]{2,12}\|[A-Z]{4,12}$/.test(it) && it.split("|").every((p, i) => i < 2 ? POINT_IDS.includes(p) : ASPECTS2.includes(p)));
  return {
    precision: optOneOf(s.precision, Object.keys(PRECISIONS), "sensitivity.precision"),
    window_min: s.window_min === "FULL_DAY" ? "FULL_DAY" : s.window_min == null ? null : num(s.window_min, 0, 1440, "sensitivity.window_min"),
    unreliable: arr(s.unreliable || [], LIMITS.unreliable, "sensitivity.unreliable").map((u) => {
      obj(u, "unreliable");
      if (!itemOK(u.item)) fail("unreliable.item");
      const field = oneOf(u.field, ["sign", "house", "aspect"], "unreliable.field");
      const out = { item: u.item, field };
      if (u.alternatives != null) out.alternatives = arr(u.alternatives, 2, "unreliable.alternatives").map((v) => field === "house" ? optHouse(v, "unreliable.alt") : oneOf(v, SIGNS3, "unreliable.alt"));
      if (u.note != null) out.note = oneOf(u.note, SENS_NOTES, "unreliable.note");
      return out;
    })
  };
}
function normalizePayload(p) {
  try {
    obj(p, "payload");
    if (p.schema !== "astroinforme.chart/v1") fail("schema");
    const first_name = normalizeFirstName(p.person && p.person.first_name);
    if (first_name === void 0) return { ok: false, error: "bad_name", where: "person.first_name" };
    obj(p.request, "request");
    obj(p.birth, "birth");
    obj(p.chart, "chart");
    const lang = oneOf(p.request.report_language, Object.keys(LANGS), "request.report_language");
    const precision = oneOf(p.birth.time_precision, Object.keys(PRECISIONS), "birth.time_precision");
    const timeKnown = precision !== "UNKNOWN";
    const engine = obj(p.engine, "engine");
    const c = p.chart;
    const bodies = arr(c.bodies, BODY_IDS.length, "chart.bodies").map((b) => normBody(b, timeKnown));
    const seen = new Set(bodies.map((b) => b.id));
    if (seen.size !== bodies.length || CORE.some((id) => !seen.has(id))) fail("chart.bodies");
    const houses = normHouses(c.houses);
    if (timeKnown !== !!houses) fail("houses\u2260precision");
    let south_node = null;
    if (c.south_node != null) {
      const sn = obj(c.south_node, "south_node");
      const lon = num(sn.lon ?? sn.longitude, 0, 360, "south_node.lon") % 360;
      const sign = oneOf(sn.sign, SIGNS3, "south_node.sign");
      if (sign !== signOf(lon)) fail("south_node.sign");
      south_node = { id: "SOUTH_NODE", lon, sign, deg: degString(sn.deg ?? sn.position, lon, "south_node.deg"), derived: "NORTH_NODE+180", house: timeKnown ? house(sn.house, "south_node.house") : null };
    }
    const aspects = arr(c.aspects, LIMITS.aspects, "chart.aspects").map(normAspect);
    if (!timeKnown && aspects.some((a) => a.a === "ASC" || a.a === "MC" || a.b === "ASC" || a.b === "MC")) fail("aspects.angles");
    const warnings = arr(p.warnings || [], LIMITS.warnings, "warnings").map((w) => ({ code: oneOf(isObj(w) ? w.code : null, WARNINGS, "warning.code") }));
    const payload = {
      schema: "astroinforme.chart/v1",
      engine: { version: ID_RE2.test(engine.version || "") ? engine.version : fail("engine.version"), aspect_policy: oneOf(engine.aspect_policy, ["orbes_v1"], "engine.aspect_policy") },
      person: { first_name },
      request: {
        kind: oneOf(p.request.kind ?? "NATAL_FULL_REPORT", ["NATAL_FULL_REPORT"], "request.kind"),
        report_language: lang,
        address: LANGS[lang],
        address_gender: p.request.address_gender == null ? "UNSPECIFIED" : oneOf(p.request.address_gender, GENDERS, "request.address_gender"),
        include_myth: true,
        // permiso para guardar una copia anónima en el banco de informes (casilla desmarcada por defecto)
        bank_consent: p.request.bank_consent === true
      },
      birth: { time_precision: precision, time_precision_label: PRECISIONS[precision] },
      chart: { bodies, south_node, houses, aspects, derived: normDerived(c.derived, timeKnown), sensitivity: normSensitivity(c.sensitivity) },
      warnings
    };
    return { ok: true, payload };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: "bad_request", where: e.where };
    throw e;
  }
}
function normalizeRequestId(x) {
  return typeof x === "string" && /^[A-Za-z0-9-]{16,64}$/.test(x) ? x : null;
}

// src/ledger.js
var RESERVE_TTL_MS = 60 * 60 * 1e3;
var CONSUMED_KEEP = 20;
var ok2 = (obj2, status = 200) => new Response(JSON.stringify(obj2), { status, headers: { "content-type": "application/json; charset=utf-8" } });
var CodeLedger = class {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.queue = Promise.resolve();
  }
  /** Ejecuta las operaciones de a una, en orden de llegada. */
  serial(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {
    });
    return run;
  }
  async load(code) {
    let s = await this.storage.get("s");
    if (!s) {
      const kvUsed = this.env && this.env.ASTRO_KV ? +await this.env.ASTRO_KV.get("used:" + code) || 0 : 0;
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
      if (path === "/get") return ok2({ used: s.used, inflight: s.inflight });
      if (path === "/reserve") {
        if (s.inflight) return ok2({ error: "in_progress", same_request: !!b.request_id && s.inflight.request_id === b.request_id, used: s.used }, 409);
        if (s.used >= +b.limit) return ok2({ error: "quota_exhausted", used: s.used }, 403);
        const token = crypto.randomUUID();
        s.inflight = { request_id: b.request_id || null, token, at: Date.now(), exp: Date.now() + RESERVE_TTL_MS };
        await this.storage.put("s", s);
        return ok2({ reserved: true, token, used: s.used });
      }
      if (path === "/consume") {
        if (b.token && s.consumed.includes(b.token)) return ok2({ used: s.used, duplicate: true });
        s.used += 1;
        if (s.inflight && s.inflight.token === b.token) s.inflight = null;
        if (b.token) s.consumed = [...s.consumed, b.token].slice(-CONSUMED_KEEP);
        await this.storage.put("s", s);
        if (this.env && this.env.ASTRO_KV) await this.env.ASTRO_KV.put("used:" + code, String(s.used)).catch(() => {
        });
        return ok2({ used: s.used });
      }
      if (path === "/release") {
        if (s.inflight && s.inflight.token === b.token) {
          s.inflight = null;
          await this.storage.put("s", s);
        }
        return ok2({ released: true, used: s.used });
      }
      return ok2({ error: "bad_request" }, 400);
    });
  }
};
function ledger(env, code) {
  const stub = env.CODE_LEDGER.get(env.CODE_LEDGER.idFromName("code:" + code));
  const call2 = async (op, body = {}) => {
    const r = await stub.fetch("https://ledger/" + op, { method: "POST", body: JSON.stringify({ code, ...body }) });
    return { status: r.status, ...await r.json() };
  };
  return {
    get: () => call2("get"),
    reserve: (request_id, limit) => call2("reserve", { request_id, limit }),
    consume: (token) => call2("consume", { token }),
    release: (token) => call2("release", { token })
  };
}

// src/payments/sim.js
var SIM_SIGNATURE_HEADER = "x-sim-signature";
async function simSign(secret, raw) {
  return toHex(await hmac(new TextEncoder().encode(secret), raw));
}
var simProvider = {
  name: "sim",
  enabled: (env) => env.PAYMENTS_SIM === "true" && !!env.SIM_WEBHOOK_SECRET,
  async createCheckout(env, order, urls) {
    return { url: `${urls.serviceOrigin}/sim/checkout/${encodeURIComponent(order.id)}`, externalCheckoutId: "simck_" + order.id };
  },
  async verifyWebhook(env, request, raw) {
    const sig = request.headers.get(SIM_SIGNATURE_HEADER) || "";
    if (!safeEqual(sig, await simSign(env.SIM_WEBHOOK_SECRET, raw))) return { ok: false };
    let ev;
    try {
      ev = JSON.parse(raw);
    } catch (e) {
      return { ok: false };
    }
    if (!ev || !ev.event_id || !ev.payment) return { ok: false };
    return { ok: true, eventId: String(ev.event_id), externalId: String(ev.payment.id), kind: "payment", hint: ev.payment };
  },
  async getTransaction(env, externalId, hint) {
    const p = hint || {};
    return normalized({ status: p.status, orderId: p.order_id, externalId, amountMinor: p.amount_minor, currency: p.currency, productRef: p.product });
  },
  async refund() {
    return { ok: true, status: "refunded" };
  }
};
function simCheckoutPage(orderId, amountText) {
  const id = String(orderId).replace(/[^A-Za-z0-9-]/g, "");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout simulado</title><body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px">
<h1>Checkout simulado</h1><p>Pedido <code>${id}</code> \xB7 ${amountText}</p>
<p>Esto no cobra nada: env\xEDa un aviso de pago firmado al servicio, como har\xEDa un proveedor real.</p>
<form method="post" action="/sim/pay/${id}"><button name="result" value="paid">Pagar</button> <button name="result" value="failed">Rechazar</button></form>`;
}

// src/payments/catalog.js
var PRODUCT_ID = "informe_completo";
function expectedPrice(env, provider, product = PRODUCT_ID) {
  if (product !== PRODUCT_ID) return null;
  if (provider === "mercadopago") {
    const a = toMinor(env.PRICE_ARS);
    return a ? { amountMinor: a, currency: "ARS", productRef: PRODUCT_ID } : null;
  }
  if (provider === "dodo") {
    const a = toMinor(env.PRICE_USD);
    return a && env.DODO_PRODUCT_ID ? { amountMinor: a, currency: "USD", productRef: env.DODO_PRODUCT_ID } : null;
  }
  if (provider === "sim") {
    const a = toMinor(env.PRICE_USD || "15.00");
    return { amountMinor: a, currency: "USD", productRef: PRODUCT_ID };
  }
  return null;
}
var PRODUCT_TITLE = {
  es: "AsterOrbis \u2014 informe digital personalizado de astrolog\xEDa psicol\xF3gica",
  de: "AsterOrbis \u2014 personalisierter digitaler Bericht der psychologischen Astrologie",
  en: "AsterOrbis \u2014 personalised digital report in psychological astrology"
};

// src/payments/mercadopago.js
var API2 = "https://api.mercadopago.com";
function orderStatus(o) {
  if (o.status === "processed") return ["accredited", "partially_refunded"].includes(o.status_detail) ? "paid" : "pending";
  return { refunded: "refunded", canceled: "cancelled", failed: "failed" }[o.status] || "pending";
}
var money = (minor) => (minor / 100).toFixed(2);
var idempotencyUuid = (id) => {
  const h = String(id).replace(/[^0-9a-f]/g, "").padEnd(32, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
async function mp(env, path, init = {}) {
  const r = await fetch(API2 + path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + env.MP_ACCESS_TOKEN, ...init.headers || {} } });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error("mercadopago");
    e.status = r.status;
    e.detail = body && (body.message || body.error);
    throw e;
  }
  return body;
}
function fromOrder(o) {
  const item = Array.isArray(o.items) ? o.items[0] : null;
  return normalized({ status: orderStatus(o), orderId: o.external_reference, externalId: o.id, amountMinor: toMinor(o.total_amount), currency: o.currency, productRef: item ? item.external_code : null });
}
async function mpManifestSignature(secret, dataId, requestId, ts) {
  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : String(dataId);
  return toHex(await hmac(new TextEncoder().encode(secret), `id:${id};request-id:${requestId};ts:${ts};`));
}
var mercadoPagoProvider = {
  name: "mercadopago",
  enabled: (env) => !!(env.MP_ACCESS_TOKEN && env.MP_WEBHOOK_SECRET),
  async createCheckout(env, order, urls) {
    const back = (r) => `${urls.appOrigin}/?pedido=${encodeURIComponent(order.id)}&resultado=${r}`;
    const total = money(order.amountMinor);
    const o = await mp(env, "/v1/orders", { method: "POST", headers: { "x-idempotency-key": idempotencyUuid(order.id) }, body: JSON.stringify({
      type: "online",
      processing_mode: "manual",
      total_amount: total,
      external_reference: order.id,
      // el enlace vence antes que la carta guardada: no se puede pagar un pedido que ya no se puede generar
      expiration_time: "P2D",
      items: [{ external_code: order.product, title: PRODUCT_TITLE[order.lang] || PRODUCT_TITLE.es, quantity: 1, unit_price: total }],
      config: { statement_descriptor: "ASTERORBIS", online: { success_url: back("ok"), pending_url: back("pendiente"), failure_url: back("error"), auto_return: "approved" } }
    }) });
    return { url: o.checkout_url, externalCheckoutId: o.id };
  },
  async verifyWebhook(env, request, raw) {
    const u = new URL(request.url);
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {
    }
    const type = u.searchParams.get("type") || u.searchParams.get("topic") || body && body.type || "";
    const dataId = u.searchParams.get("data.id") || body && body.data && body.data.id || "";
    const reqId = request.headers.get("x-request-id") || "";
    const parts = Object.fromEntries((request.headers.get("x-signature") || "").split(",").map((kv) => kv.trim().split("=")));
    if (!dataId || !reqId || !parts.ts || !parts.v1) return { ok: false };
    if (!safeEqual(parts.v1, await mpManifestSignature(env.MP_WEBHOOK_SECRET, dataId, reqId, parts.ts))) return { ok: false };
    return { ok: true, eventId: `mp:${type}:${dataId}:${body && body.action || ""}:${body && body.id || reqId}`, externalId: String(dataId), kind: type === "order" ? "payment" : "ignore" };
  },
  async getTransaction(env, externalId) {
    return fromOrder(await mp(env, "/v1/orders/" + encodeURIComponent(externalId)));
  },
  /** Conciliación: busca la order por identificador del pedido, por si el aviso se perdió. */
  async findPayment(env, orderId) {
    const end = /* @__PURE__ */ new Date(), begin = new Date(end.getTime() - 9 * 864e5);
    const q = new URLSearchParams({ begin_date: begin.toISOString(), end_date: end.toISOString(), external_reference: orderId });
    const r = await mp(env, "/v1/orders?" + q);
    const list = r.data || [], o = list.find((x) => orderStatus(x) === "paid") || list[0];
    return o ? fromOrder(await mp(env, "/v1/orders/" + encodeURIComponent(o.id))) : null;
  },
  async refund(env, order) {
    const r = await mp(env, `/v1/orders/${encodeURIComponent(order.externalId)}/refund`, { method: "POST", headers: { "x-idempotency-key": idempotencyUuid("f" + order.id) }, body: "{}" });
    return { ok: true, status: r && r.status === "refunded" ? "refunded" : "pending" };
  }
};

// src/payments/dodo.js
var base = (env) => env.DODO_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
var TOLERANCE_S = 300;
var DODO_STATUS = {
  succeeded: "paid",
  processing: "pending",
  requires_customer_action: "pending",
  requires_merchant_action: "pending",
  requires_payment_method: "pending",
  requires_confirmation: "pending",
  requires_capture: "pending",
  partially_captured: "pending",
  failed: "failed",
  cancelled: "cancelled"
};
async function dodo(env, path, init = {}) {
  const r = await fetch(base(env) + path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + env.DODO_API_KEY, ...init.headers || {} } });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error("dodo");
    e.status = r.status;
    e.detail = body && (body.message || body.code);
    throw e;
  }
  return body;
}
async function standardWebhookSignature(secret, id, ts, raw) {
  const key = fromB64(String(secret).replace(/^whsec_/, ""));
  return toB64(await hmac(key, `${id}.${ts}.${raw}`));
}
var dodoProvider = {
  name: "dodo",
  enabled: (env) => !!(env.DODO_API_KEY && env.DODO_WEBHOOK_SECRET && env.DODO_PRODUCT_ID),
  async createCheckout(env, order, urls) {
    const s = await dodo(env, "/checkouts", { method: "POST", body: JSON.stringify({
      product_cart: [{ product_id: env.DODO_PRODUCT_ID, quantity: 1 }],
      return_url: `${urls.appOrigin}/?pedido=${encodeURIComponent(order.id)}`,
      metadata: { order_id: order.id }
    }) });
    return { url: s.checkout_url, externalCheckoutId: s.session_id };
  },
  async verifyWebhook(env, request, raw, now = Date.now()) {
    const id = request.headers.get("webhook-id"), ts = request.headers.get("webhook-timestamp"), sigs = request.headers.get("webhook-signature") || "";
    if (!id || !ts || !/^\d+$/.test(ts) || Math.abs(now / 1e3 - +ts) > TOLERANCE_S) return { ok: false };
    const expected = await standardWebhookSignature(env.DODO_WEBHOOK_SECRET, id, ts, raw);
    if (!sigs.split(" ").some((s) => s.startsWith("v1,") && safeEqual(s.slice(3), expected))) return { ok: false };
    let ev;
    try {
      ev = JSON.parse(raw);
    } catch (e) {
      return { ok: false };
    }
    const type = String(ev.type || ""), data = ev.data || {};
    const kind = (type.startsWith("payment.") || type.startsWith("refund.")) && data.payment_id ? "payment" : "ignore";
    return { ok: true, eventId: "dodo:" + id, externalId: data.payment_id ? String(data.payment_id) : null, kind };
  },
  async getTransaction(env, externalId) {
    const p = await dodo(env, "/payments/" + encodeURIComponent(externalId));
    const refunded = Array.isArray(p.refunds) && p.refunds.some((r) => r.status === "succeeded");
    const item = Array.isArray(p.product_cart) ? p.product_cart[0] : null;
    const net = Number.isInteger(p.total_amount) ? p.total_amount - (Number.isInteger(p.tax) ? p.tax : 0) : null;
    return normalized({
      status: refunded ? "refunded" : DODO_STATUS[p.status] || "pending",
      orderId: p.metadata && p.metadata.order_id,
      externalId: p.payment_id || externalId,
      amountMinor: net,
      currency: p.currency,
      productRef: item ? item.product_id : null
    });
  },
  async refund(env, order) {
    const r = await dodo(env, "/refunds", { method: "POST", body: JSON.stringify({ payment_id: order.externalId, reason: "AsterOrbis: informe no entregado" }) });
    return { ok: true, status: r && r.status === "succeeded" ? "refunded" : "pending" };
  }
};

// src/payments/provider.js
var PAYMENT_STATUSES = ["paid", "pending", "failed", "refunded", "cancelled"];
var PROVIDERS = { sim: simProvider, mercadopago: mercadoPagoProvider, dodo: dodoProvider };
function getProvider(env, name) {
  const p = PROVIDERS[name];
  return p && p.enabled(env) ? p : null;
}
var providerNames = () => Object.keys(PROVIDERS);
function toMinor(x) {
  if (x == null || x === "") return null;
  const s = String(x).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  return +i * 100 + +(d + "00").slice(0, 2);
}
function normalized({ status, orderId, externalId, amountMinor, currency, productRef }) {
  return {
    status: PAYMENT_STATUSES.includes(status) ? status : "pending",
    orderId: orderId ? String(orderId) : null,
    externalId: externalId != null ? String(externalId) : null,
    amountMinor: Number.isInteger(amountMinor) ? amountMinor : null,
    currency: currency ? String(currency).toUpperCase() : null,
    productRef: productRef != null ? String(productRef) : null
  };
}
async function hmac(keyBytes, data, hash = "SHA-256") {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
var toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
var toB64 = (b) => btoa(String.fromCharCode(...b));
var fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// src/orders.js
var ORDER_CODE_PREFIX = "ORDER:";
var TERMS_VERSIONS = ["2026-11-04", "2026-11-05"];
var MAX_ORDER_BODY = 12e4;
var MAX_GENERATIONS = 3;
var OPEN_TTL = 9 * 86400;
var HOUR = 3600 * 1e3;
var json = (obj2, status, headers = {}) => new Response(JSON.stringify(obj2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
var randHex = (n) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};
var orderStub = (env, id) => env.ORDERS.get(env.ORDERS.idFromName(id));
async function call(stub, op, body) {
  const r = await stub.fetch("https://order/" + op, { method: "POST", body: JSON.stringify(body || {}) });
  return { status: r.status, ...await r.json() };
}
var ORDER_ID_RE = /^ord-[0-9a-f]{32}$/;
async function flagException(env, orderId, reason) {
  if (env.ASTRO_KV) await env.ASTRO_KV.put("exc:" + orderId, JSON.stringify({ order_id: orderId, reason, at: (/* @__PURE__ */ new Date()).toISOString() })).catch(() => {
  });
}
async function clearException(env, orderId) {
  if (env.ASTRO_KV) await env.ASTRO_KV.delete("exc:" + orderId).catch(() => {
  });
}
async function startOrderJob(env, orderId, jobId, payload, providerRef) {
  const code = ORDER_CODE_PREFIX + orderId;
  const res = await ledger(env, code).reserve(jobId, 1);
  if (res.error) {
    await call(orderStub(env, orderId), "generation", { jobId, outcome: "start_" + res.error });
    await flagException(env, orderId, "start_" + res.error);
    return { started: false, reason: res.error };
  }
  const job = {
    payload,
    fp: await payloadFingerprint(payload),
    token: res.token,
    codeKind: "order",
    orderId,
    order: providerRef || null,
    requestId: jobId,
    useCode: true,
    code,
    limit: 1,
    retainMs: RETAIN_MS,
    mk: monthKey(),
    vKey: null,
    vUsed: 0,
    dKey: null,
    dUsed: 0
  };
  const stub = env.REPORT_JOB.get(env.REPORT_JOB.idFromName(jobId));
  await stub.fetch("https://job/start", { method: "POST", body: JSON.stringify(job) });
  await call(orderStub(env, orderId), "started", { jobId });
  return { started: true };
}
async function notifyOrderGeneration(env, orderId, jobId, outcome) {
  if (!env.ORDERS || !orderId) return;
  const r = await call(orderStub(env, orderId), "generation", { jobId, outcome });
  if (r.exception) await flagException(env, orderId, r.exception);
  else if (outcome === "delivered") {
    await clearException(env, orderId);
    await deliverMail(env, orderId);
  }
}
async function deliverMail(env, orderId) {
  const stub = orderStub(env, orderId), p = await call(stub, "mail-prepare", {});
  if (p.skip || !p.email) return false;
  const url = `${(env.APP_URL || "https://asterorbis.com").replace(/\/$/, "")}/?pedido=${orderId}#k=${p.token}`;
  const m = reportMail(p.lang, url, Math.round(RETAIN_MS / (24 * HOUR)));
  const sent = await sendMail(env, { to: p.email, subject: m.subject, text: m.text, key: `${orderId}-${p.tries}` });
  await call(stub, "mail-result", { ok: sent });
  return sent;
}
async function alertAdmin(env, orderId, reason) {
  if (!env.ADMIN_EMAIL || !env.ASTRO_KV) return;
  const key = `alerted:${orderId}:${reason}`;
  if (await env.ASTRO_KV.get(key)) return;
  const ok4 = await sendMail(env, { to: env.ADMIN_EMAIL, subject: `AsterOrbis: revisar pedido (${reason})`, text: `Pedido: ${orderId}
Motivo: ${reason}

Ver /admin/exceptions.`, key });
  if (ok4) await env.ASTRO_KV.put(key, "1", { expirationTtl: 86400 });
}
async function reconcile(env, id, st) {
  const provider = getProvider(env, st.provider);
  if (!provider || !provider.findPayment) return;
  let tx;
  try {
    tx = await provider.findPayment(env, id);
  } catch (e) {
    return;
  }
  if (!tx || tx.orderId !== id || tx.status !== "paid") return;
  await applyPayment(env, "recon:" + tx.externalId, tx, st.provider);
}
async function runControls(env, now = Date.now()) {
  if (serviceMode(env) !== "paid" || !env.ORDERS || !env.ASTRO_KV) return { skipped: true };
  const list = await env.ASTRO_KV.list({ prefix: "open:" }), out = { checked: 0, retried: 0, mailed: 0, alerts: 0 };
  for (const { name } of list.keys) {
    const id = name.slice(5);
    if (!ORDER_ID_RE.test(id)) continue;
    let st = await call(orderStub(env, id), "check", {});
    if (st.status === 404) {
      await env.ASTRO_KV.delete(name);
      continue;
    }
    out.checked++;
    if (["created", "pending"].includes(st.order.payment_status)) {
      await reconcile(env, id, st);
      st = await call(orderStub(env, id), "check", {});
    }
    const pay = st.order.payment_status, gen = st.order.generation_status;
    if (["cancelled", "failed", "refunded", "mismatch"].includes(pay)) {
      if (pay === "mismatch") {
        await alertAdmin(env, id, "payment_mismatch");
        out.alerts++;
      }
      await env.ASTRO_KV.delete(name);
      continue;
    }
    if (pay !== "paid") continue;
    if (gen === "failed") {
      if (st.attempts < MAX_GENERATIONS) {
        const r = await call(orderStub(env, id), "retry", {});
        if (r.status === 200) {
          await startOrderJob(env, id, r.jobId, r.payload, null);
          await clearException(env, id);
          out.retried++;
        }
      } else {
        await alertAdmin(env, id, "generation_failed");
        out.alerts++;
      }
    } else if (gen === "delivered") {
      if (st.mail && st.mail.status === "sent") {
        await env.ASTRO_KV.delete(name);
        continue;
      }
      if (mailEnabled(env) && (!st.mail || st.mail.tries < MAX_MAIL_TRIES)) {
        if (await deliverMail(env, id)) {
          out.mailed++;
          await env.ASTRO_KV.delete(name);
        }
      } else {
        await alertAdmin(env, id, "mail_failed");
        out.alerts++;
      }
    } else if (st.paidAt && now - Date.parse(st.paidAt) > 3 * HOUR) {
      await alertAdmin(env, id, "paid_without_report");
      out.alerts++;
    }
  }
  await dailySummary(env, now, list.keys.length);
  return out;
}
async function dailySummary(env, now, open) {
  const d = new Date(now), day = d.toISOString().slice(0, 10), key = "summary:" + day;
  if (!env.ADMIN_EMAIL || d.getUTCHours() < 12 || await env.ASTRO_KV.get(key)) return;
  const month = await kvGetJSON(env.ASTRO_KV, monthKey(d), { reports: 0, usd: 0, failed: 0 });
  const exc = await env.ASTRO_KV.list({ prefix: "exc:" });
  const saleKeys = (await env.ASTRO_KV.list({ prefix: "sale:" })).keys, sales = [];
  for (const k of saleKeys) {
    const s = await kvGetJSON(env.ASTRO_KV, k.name, null);
    if (s) sales.push(`${s.at.slice(0, 10)} \xB7 ${s.currency} ${(s.minor / 100).toFixed(2)} \xB7 ${s.provider} \xB7 pago ${s.external}`);
  }
  const salesText = sales.length ? `

Ventas para facturar (${sales.length}):
${sales.sort().join("\n")}` : "\n\nVentas para facturar: ninguna";
  const ok4 = await sendMail(env, { to: env.ADMIN_EMAIL, subject: `AsterOrbis: resumen ${day}`, text: `Pedidos abiertos: ${open}
Pedidos para revisar: ${exc.keys.length}
Mes: ${month.reports} informes, ${month.failed} fallidos, US$ ${month.usd}${salesText}`, key });
  if (ok4) {
    await env.ASTRO_KV.put(key, "1", { expirationTtl: 3 * 86400 });
    for (const k of saleKeys) await env.ASTRO_KV.delete(k.name);
  }
}
async function createOrder(request, env, cors) {
  if (serviceMode(env) !== "paid") return json({ error: serviceMode(env) === "disabled" ? "disabled" : "not_available" }, serviceMode(env) === "disabled" ? 503 : 404, cors);
  if (!env.ORDERS || !env.REPORT_JOB || !env.CODE_LEDGER) return json({ error: "not_configured" }, 503, cors);
  const raw = await request.text();
  if (raw.length > MAX_ORDER_BODY) return json({ error: "bad_request" }, 413, cors);
  let b;
  try {
    b = JSON.parse(raw);
  } catch (e) {
    return json({ error: "bad_request" }, 400, cors);
  }
  const providerName = String(b && b.provider || "");
  const provider = getProvider(env, providerName);
  if (!provider) return json({ error: "provider_unavailable" }, 400, cors);
  const product = String(b.product || PRODUCT_ID);
  const price = expectedPrice(env, providerName, product);
  if (!price) return json({ error: "price_not_configured" }, 503, cors);
  const c = b.consent || {};
  if (c.accepted !== true || !TERMS_VERSIONS.includes(c.terms_version)) return json({ error: "consent_required" }, 400, cors);
  if (!validEmail(b.email)) return json({ error: "email_invalid" }, 400, cors);
  if (!mailEnabled(env) || !await generationAvailable(env)) return json({ error: "unavailable" }, 503, cors);
  const idem = normalizeRequestId(b.idempotency_key);
  if (!idem) return json({ error: "bad_request" }, 400, cors);
  const norm = normalizePayload(b.payload);
  if (!norm.ok) return json({ error: norm.error }, 400, cors);
  const claimStub = env.ORDERS.get(env.ORDERS.idFromName("idem:" + idem));
  const claim = await call(claimStub, "claim", { id: "ord-" + randHex(16), token: randHex(24) });
  const id = claim.id, token = claim.token;
  if (!claim.first) {
    const v = await call(orderStub(env, id), "view", { token });
    if (v.order && v.order.payment_status === "paid") return json({ order_id: id, token, already_paid: true, existed: true }, 200, cors);
    if (claim.url) return json({ order_id: id, token, checkout_url: claim.url, existed: true }, 200, cors);
    return json({ error: "order_in_progress" }, 409, cors);
  }
  const order = {
    id,
    product,
    provider: providerName,
    amountMinor: price.amountMinor,
    currency: price.currency,
    productRef: price.productRef,
    lang: norm.payload.request.report_language,
    tokenHash: await sha256Hex(token),
    idemKey: idem,
    consent: { terms_version: c.terms_version, disclaimer_version: String(c.disclaimer_version || ""), at: (/* @__PURE__ */ new Date()).toISOString() }
  };
  await call(orderStub(env, id), "create", { order, payload: norm.payload, email: b.email.trim() });
  if (env.ASTRO_KV) await env.ASTRO_KV.put("open:" + id, "1", { expirationTtl: OPEN_TTL });
  return checkout(id, token, 201);
  async function checkout(oid, tok, okStatus = 200) {
    const appOrigin = request.headers.get("origin");
    const serviceOrigin = new URL(request.url).origin;
    let ck;
    try {
      ck = await provider.createCheckout(env, { id: oid, product, amountMinor: price.amountMinor, currency: price.currency, lang: norm.payload.request.report_language }, { appOrigin, serviceOrigin });
    } catch (e) {
      console.log(JSON.stringify({ event: "checkout_error", provider: providerName, status: e.status || null }));
      await call(claimStub, "claim-release", {});
      return json({ error: "checkout_unavailable", order_id: oid }, 502, cors);
    }
    await call(orderStub(env, oid), "checkout", { externalCheckoutId: ck.externalCheckoutId });
    await call(claimStub, "claim-url", { url: ck.url });
    return json({ order_id: oid, token: tok, checkout_url: ck.url, ...okStatus === 200 ? { existed: true } : {} }, okStatus, cors);
  }
}
async function getOrder(request, env, cors, id) {
  if (!ORDER_ID_RE.test(id) || !env.ORDERS) return json({ error: "not_found" }, 404, cors);
  const v = await call(orderStub(env, id), "view", { token: request.headers.get("x-order-token") || "" });
  if (v.status !== 200) return json({ error: v.error }, v.status, cors);
  const out = { ...v.order, chart: v.chart || void 0 };
  if (out.generation_status === "delivered" && v.jobId) {
    const r = await env.REPORT_JOB.get(env.REPORT_JOB.idFromName(v.jobId)).fetch("https://job/status", { method: "POST", body: JSON.stringify({ code: ORDER_CODE_PREFIX + id }) });
    const body = await r.json().catch(() => ({}));
    if (body.report) out.report = body.report;
    else out.report_expired = true;
  }
  return json(out, 200, cors);
}
async function handleWebhook(request, env, name, rawOverride) {
  const provider = getProvider(env, name);
  if (!provider || !env.ORDERS) return json({ error: "not_found" }, 404);
  const raw = rawOverride != null ? rawOverride : await request.text();
  const v = await provider.verifyWebhook(env, request, raw);
  if (!v.ok) return json({ error: "bad_signature" }, 401);
  if (v.kind !== "payment" || !v.externalId) return json({ ok: true, ignored: true }, 200);
  let tx;
  try {
    tx = await provider.getTransaction(env, v.externalId, v.hint);
  } catch (e) {
    return json({ error: "provider_unavailable" }, 502);
  }
  if (!tx.orderId || !ORDER_ID_RE.test(tx.orderId)) return json({ ok: true, ignored: "no_order" }, 200);
  const r = await applyPayment(env, v.eventId, tx, name);
  if (r.status === 404) return json({ ok: true, ignored: "unknown_order" }, 200);
  return json({ ok: true, duplicate: !!r.duplicate }, 200);
}
async function applyPayment(env, eventId, tx, name) {
  const r = await call(orderStub(env, tx.orderId), "payment", { eventId, tx, provider: name });
  if (r.status === 404) return r;
  if (r.exception) await flagException(env, tx.orderId, r.exception);
  if (r.action === "start") {
    if (env.ASTRO_KV) await env.ASTRO_KV.put("sale:" + tx.orderId, JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), minor: tx.amountMinor, currency: tx.currency, provider: name, external: tx.externalId }), { expirationTtl: 60 * 86400 }).catch(() => {
    });
    try {
      await startOrderJob(env, tx.orderId, r.jobId, r.payload, r.internal && r.internal.externalId);
    } catch (e) {
      await call(orderStub(env, tx.orderId), "generation", { jobId: r.jobId, outcome: "start_error" });
      await flagException(env, tx.orderId, "generation_failed");
    }
  }
  return r;
}
async function simRoute(request, env, url) {
  if (!simProvider.enabled(env)) return json({ error: "not_found" }, 404);
  const m = url.pathname.match(/^\/sim\/(checkout|pay)\/(ord-[0-9a-f]{32})$/);
  if (!m) return json({ error: "not_found" }, 404);
  const id = m[2];
  const price = expectedPrice(env, "sim");
  if (m[1] === "checkout" && request.method === "GET")
    return new Response(simCheckoutPage(id, `${(price.amountMinor / 100).toFixed(2)} ${price.currency}`), { headers: { "content-type": "text/html; charset=utf-8" } });
  if (m[1] === "pay" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const result = form && form.get("result") === "paid" ? "paid" : "failed";
    const raw = JSON.stringify({ event_id: "simev_" + randHex(8), payment: { id: "simpay_" + id, order_id: id, status: result, amount_minor: price.amountMinor, currency: price.currency, product: PRODUCT_ID } });
    const req = new Request(url.origin + "/webhooks/sim", { method: "POST", headers: { [SIM_SIGNATURE_HEADER]: await simSign(env.SIM_WEBHOOK_SECRET, raw) } });
    await handleWebhook(req, env, "sim", raw);
    return new Response(`<!doctype html><meta charset="utf-8"><p>Pago simulado: ${result}. Volv\xE9 a AsterOrbis.</p>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return json({ error: "not_found" }, 404);
}
async function adminRoute(request, env, url) {
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || !auth || !safeEqual(auth, env.ADMIN_TOKEN)) return json({ error: "forbidden" }, 403);
  if (request.method === "GET" && url.pathname === "/admin/exceptions") {
    const list = env.ASTRO_KV && env.ASTRO_KV.list ? await env.ASTRO_KV.list({ prefix: "exc:" }) : { keys: [] };
    const items = [];
    for (const k of list.keys) items.push(await kvGetJSON(env.ASTRO_KV, k.name, null));
    return json({ exceptions: items.filter(Boolean) }, 200);
  }
  const m = url.pathname.match(/^\/admin\/orders\/(ord-[0-9a-f]{32})\/(retry|refund)$/);
  if (!m || request.method !== "POST") return json({ error: "not_found" }, 404);
  const [, id, op] = m;
  if (op === "retry") {
    const r2 = await call(orderStub(env, id), "retry", {});
    if (r2.status !== 200) return json({ error: r2.error, order: r2.order }, r2.status);
    const s = await startOrderJob(env, id, r2.jobId, r2.payload, null);
    return json({ ok: s.started, reason: s.reason || null, order: r2.order }, 200);
  }
  const r = await call(orderStub(env, id), "refund", {});
  if (!r.refundable) return json({ error: "not_refundable", order: r.order }, 409);
  const provider = getProvider(env, r.internal.provider);
  if (!provider) return json({ error: "provider_unavailable" }, 503);
  const rr = await provider.refund(env, { id, externalId: r.internal.externalId });
  return json({ ok: rr.ok, status: rr.status, order: r.order }, 200);
}
async function routePayments(request, env, cors, url) {
  if (url.pathname.startsWith("/webhooks/") && request.method === "POST") return handleWebhook(request, env, url.pathname.slice("/webhooks/".length));
  if (url.pathname.startsWith("/sim/")) return simRoute(request, env, url);
  if (url.pathname.startsWith("/admin/")) return adminRoute(request, env, url);
  return null;
}
async function routeOrders(request, env, cors, url) {
  if (url.pathname === "/orders" && request.method === "POST") return createOrder(request, env, cors);
  const m = url.pathname.match(/^\/orders\/([^/]+)$/);
  if (m && request.method === "GET") return getOrder(request, env, cors, m[1]);
  return null;
}

// src/worker.js
var SERVICE_VERSION = "2.6.2";
var DEFAULT_MODEL = "claude-opus-5-5";
var DEFAULT_ORIGINS = "https://asterorbis.com,https://www.asterorbis.com,https://barbara-netizen.github.io";
var PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cache_write: 5, cache_read: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cache_write: 2.5, cache_read: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cache_write: 0.125, cache_read: 0.01 }
};
var MAX_BODY = 2e5;
var KEEPALIVE_MS = 1e4;
var json2 = (obj2, status = 200, headers = {}) => new Response(JSON.stringify(obj2), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const ok4 = allowed.includes("*") || allowed.includes(origin);
  return ok4 ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-astro-code, x-turnstile-token, x-order-token, x-link-key", "access-control-max-age": "86400", vary: "origin" } : { vary: "origin" };
}
async function allCodes(env) {
  const extra = env.ASTRO_KV ? parseCodes(await env.ASTRO_KV.get("codes").catch(() => null)) : {};
  return { ...extra, ...parseCodes(env.ACCESS_CODES) };
}
var LICENSE_RE = /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/;
var LICENSE_CACHE_TTL = 600;
async function sha256hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyLicense(env, key) {
  const kv = env.ASTRO_KV, ck = "lic:" + (await sha256hex(key)).slice(0, 32);
  const cached = kv ? await kvGetJSON(kv, ck, null) : null;
  let info = cached;
  if (!info) {
    let r, body = null;
    try {
      r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ product_id: env.GUMROAD_PRODUCT_ID, license_key: key, increment_uses_count: "false" }).toString()
      });
      body = await r.json().catch(() => null);
    } catch (e) {
      return { error: "license_unavailable", status: 503 };
    }
    if (r.status === 404 || body && body.success === false && r.status < 500) info = { ok: false };
    else if (!r.ok || !body || !body.purchase) return { error: "license_unavailable", status: 503 };
    else {
      const pu = body.purchase;
      info = { ok: true, quantity: Math.max(1, +pu.quantity || 1), refunded: !!(pu.refunded || pu.chargebacked || pu.disputed), order: pu.order_number != null ? String(pu.order_number) : null };
    }
    if (kv) await kv.put(ck, JSON.stringify(info), { expirationTtl: LICENSE_CACHE_TTL }).catch(() => {
    });
  }
  if (!info.ok) return null;
  if (info.refunded) return { error: "license_refunded", status: 403 };
  return { limit: info.quantity * Math.max(1, +(env.REPORTS_PER_LICENSE || 1)), kind: "license", order: info.order };
}
async function resolveCode(env, code) {
  if (!code || code.startsWith("ORDER:")) return null;
  const codes = await allCodes(env);
  if (code in codes) return { limit: codes[code], kind: "code" };
  if (env.GUMROAD_PRODUCT_ID && LICENSE_RE.test(code)) return verifyLicense(env, code);
  return null;
}
function parseCodes(s) {
  const out = {};
  for (const part of String(s || "").split(/[,;\n]/)) {
    const m = part.trim().match(/^([A-Za-z0-9_-]{4,40})\s*:\s*(\d{1,4})$/);
    if (m) out[m[1].toUpperCase()] = +m[2];
  }
  return out;
}
var monthKey = (d = /* @__PURE__ */ new Date()) => `month:${d.toISOString().slice(0, 7)}`;
var dayKey = (d = /* @__PURE__ */ new Date()) => `day:${d.toISOString().slice(0, 10)}`;
async function visitorId(ip, salt) {
  const data = new TextEncoder().encode(`${salt || "astroinforme"}|${ip || "?"}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const b = await r.json();
    return !!(b && b.success);
  } catch (e) {
    return false;
  }
}
function costUSD(usage, model) {
  const p = PRICES[model] || PRICES[DEFAULT_MODEL];
  return ((usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out + (usage.cache_creation_input_tokens || 0) * p.cache_write + (usage.cache_read_input_tokens || 0) * p.cache_read) / 1e6;
}
function extractJSON(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j < i) throw new Error("no_json");
  return JSON.parse(t.slice(i, j + 1));
}
function withoutDedication(report) {
  if (report && Array.isArray(report.sections)) report.sections = report.sections.filter((s) => !s || s.id !== "dedication");
  return report;
}
function normalizeReferences(report) {
  const fix = (r) => {
    if (!r || typeof r !== "object") return;
    if (r.type === "rulership" && typeof r.of === "string" && /^\d{1,2}$/.test(r.of)) r.of = +r.of;
    if (r.type === "stellium" && r.by === "HOUSE" && typeof r.where === "string" && /^\d{1,2}$/.test(r.where)) r.where = +r.where;
  };
  if (report && Array.isArray(report.technical_references_used)) report.technical_references_used.forEach(fix);
  if (report && Array.isArray(report.theses)) report.theses.forEach((t) => t && Array.isArray(t.indicators) && t.indicators.forEach(fix));
  return report;
}
function chartForModel(p) {
  const n = normalizePayload(p);
  if (!n.ok) throw new Error("bad_request");
  const { person, engine, ...rest } = n.payload;
  const { bank_consent, ...request } = rest.request;
  return { ...rest, request, engine: { aspect_policy: engine.aspect_policy } };
}
function describeArgument(argument) {
  if (argument.ok !== false) return "";
  return argument.theses.filter((t) => t.central && t.status !== "supported").map((t) => `- La tesis central ${t.id} necesita al menos dos indicadores distintos verificados (tiene ${t.verified}).`).join("\n");
}
var MYTHS_KEY = "myths:recent";
var MYTHS_KEEP = 12;
var REFERENCE_MYTHS = ["Odiseo y las Sirenas", "Pers\xE9fone", "Prometeo", "Pen\xE9lope", "Proteo", "Psique y Eros", "D\xE9dalo e \xCDcaro", "Ant\xEDgona"];
async function recentMyths(env) {
  if (!env.ASTRO_KV) return [];
  try {
    const l = JSON.parse(await env.ASTRO_KV.get(MYTHS_KEY) || "[]");
    return Array.isArray(l) ? l.filter((x) => typeof x === "string").slice(0, MYTHS_KEEP) : [];
  } catch (e) {
    return [];
  }
}
async function rememberMyth(env, analisis) {
  const name = analisis && analisis.mito && typeof analisis.mito.nombre === "string" ? analisis.mito.nombre.trim().slice(0, 80) : "";
  if (!name || !env.ASTRO_KV) return;
  try {
    const l = await recentMyths(env);
    await env.ASTRO_KV.put(MYTHS_KEY, JSON.stringify([name, ...l.filter((x) => x !== name)].slice(0, MYTHS_KEEP)));
  } catch (e) {
  }
}
var PRINTS_KEY = "prints:recent";
var PRINTS_KEEP = 20;
async function recentPrints(env) {
  if (!env.ASTRO_KV) return [];
  try {
    const l = JSON.parse(await env.ASTRO_KV.get(PRINTS_KEY) || "[]");
    return Array.isArray(l) ? l.filter(Array.isArray).slice(0, PRINTS_KEEP) : [];
  } catch (e) {
    return [];
  }
}
async function rememberPrint(env, report) {
  if (!env.ASTRO_KV) return;
  try {
    const l = await recentPrints(env);
    await env.ASTRO_KV.put(PRINTS_KEY, JSON.stringify([fingerprint(report), ...l].slice(0, PRINTS_KEEP)));
  } catch (e) {
  }
}
function avoidRepeatedMyth(analisis, recent) {
  const m = analisis && analisis.mito;
  if (!m || typeof m.nombre !== "string") return analisis;
  const clash = repeatedMyth(m.nombre, recent);
  if (!clash) return analisis;
  const alt2 = (Array.isArray(analisis.mitos_considerados) ? analisis.mitos_considerados : []).find((x) => x && typeof x.nombre === "string" && !repeatedMyth(x.nombre, recent));
  analisis.mito_descartado = { nombre: m.nombre, motivo: `coincide con un mito usado recientemente (${clash})` };
  analisis.mito = alt2 ? { nombre: alt2.nombre, por_que: alt2.motivo || "" } : { nombre: "", por_que: "Eleg\xED un mito cl\xE1sico que no est\xE9 en la lista de mitos recientes." };
  return analisis;
}
function describeIssues(audit) {
  return audit.issues.map((i) => {
    const probs = (i.problems || [i]).map((p) => ["sign", "deg", "house", "ruler", "count", "group"].includes(p.field) ? `${p.field}: informe ${p.report}, carta ${p.chart ?? (p.field === "house" ? "sin casas" : "sin dato")}` : p.field === "format" ? `formato de grado inv\xE1lido: ${p.report}` : p.note || p.kind);
    return `- ${refText(i.ref)}: ${probs.join("; ")}`;
  }).join("\n");
}
async function callClaude(env, { system, user, maxTokens }) {
  const model = env.MODEL || DEFAULT_MODEL;
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      // en flujo: la API exige streaming para respuestas largas (el informe pide hasta 32.000 tokens)
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }]
      })
    });
  } catch (err) {
    const e = new Error("upstream");
    e.status = null;
    e.detail = "fetch: " + String(err && err.message || err);
    throw e;
  }
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const e = new Error("upstream");
    e.status = r.status;
    e.detail = body && body.error ? `${body.error.type}: ${body.error.message}` : null;
    throw e;
  }
  const ctype = r.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = await r.json().catch(() => null);
    if (!body) {
      const e = new Error("upstream");
      e.status = r.status;
      throw e;
    }
    const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, usage: body.usage || {}, stop: body.stop_reason, model };
  }
  return readStream(r, model);
}
function streamErrorStatus(err) {
  const t = err && err.type;
  return t === "overloaded_error" ? 529 : t === "rate_limit_error" ? 429 : t === "api_error" ? 500 : t === "timeout_error" ? 504 : 400;
}
async function readStream(r, model) {
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", usage = {}, stop = null;
  const handle = (data) => {
    let ev;
    try {
      ev = JSON.parse(data);
    } catch (e) {
      return;
    }
    if (ev.type === "message_start" && ev.message && ev.message.usage) usage = { ...ev.message.usage };
    else if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") text += ev.delta.text;
    else if (ev.type === "message_delta") {
      if (ev.usage) usage = { ...usage, ...ev.usage };
      if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
    } else if (ev.type === "error") {
      const e = new Error("upstream");
      e.status = streamErrorStatus(ev.error);
      e.detail = ev.error ? `${ev.error.type}: ${ev.error.message}` : "stream error";
      throw e;
    }
  };
  for (; ; ) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (data) handle(data);
    }
    if (done) break;
  }
  if (!stop) {
    const e = new Error("upstream");
    e.status = null;
    e.detail = "stream ended without stop_reason";
    throw e;
  }
  return { text, usage, stop, model };
}
var REPORT_MIN_SECTIONS = 6;
var REPORT_MIN_WORDS = 800;
var PHASE_TRIES = 2;
var MAX_TOKENS_ANALYSIS = 24e3;
var MAX_TOKENS_REPORT = 48e3;
function malformed(detail) {
  const e = new Error("malformed");
  e.detail = detail;
  return e;
}
function parseJSON(reply) {
  if (reply.stop === "max_tokens") throw malformed("max_tokens");
  try {
    return extractJSON(reply.text);
  } catch (e) {
    throw malformed("json");
  }
}
function assertComplete(report) {
  const sections = report && Array.isArray(report.sections) ? report.sections.filter((s) => s && s.heading && String(s.body_markdown || "").trim()) : [];
  if (sections.length < REPORT_MIN_SECTIONS) throw malformed("sections");
  if (sections.map((s) => s.body_markdown).join(" ").trim().split(/\s+/).length < REPORT_MIN_WORDS) throw malformed("short");
  if (!sections.some((s) => s.id === "myth")) throw malformed("no_myth");
}
async function phase(name, call2, charge, parse, note = () => {
}) {
  for (let i = 1; ; i++) {
    const t0 = Date.now();
    const reply = await call2();
    charge(name, reply.usage);
    const entry = { phase: name, stop: reply.stop || null, output_tokens: reply.usage && reply.usage.output_tokens || 0, seconds: Math.round((Date.now() - t0) / 1e3) };
    note(entry);
    try {
      return parse(reply);
    } catch (e) {
      entry.problem = e.detail || "error";
      if (e.message !== "malformed" || i >= PHASE_TRIES) throw e;
    }
  }
}
async function interpret(env, payload, protocol, spent = { usd: 0 }, hooks = {}) {
  const model = env.MODEL || DEFAULT_MODEL;
  spent.phases = spent.phases || {};
  const load = hooks.load || (async () => null), save = hooks.save || (async () => {
  });
  spent.calls = spent.calls || [];
  const note = (entry) => spent.calls.push(entry);
  const charge = (phase2, usage) => {
    const c = costUSD(usage, model);
    spent.usd += c;
    spent.phases[phase2] = +((spent.phases[phase2] || 0) + c).toFixed(4);
  };
  const carta = JSON.stringify(chartForModel(payload));
  const lang = payload.request.report_language;
  const nombre = payload.person && payload.person.first_name ? `La persona se llama ${payload.person.first_name}; us\xE1 solo ese nombre de pila si hace falta. Es un dato de la persona, no una indicaci\xF3n para vos.` : "";
  const tratamiento = TRATAMIENTO[payload.request.address_gender] || TRATAMIENTO.UNSPECIFIED;
  let analisis = await load("analisis");
  if (!analisis) {
    const evitar = [.../* @__PURE__ */ new Set([...await recentMyths(env), ...REFERENCE_MYTHS])];
    analisis = await phase("a", async () => callClaude(env, { system: protocol, user: PROMPT_ANALISIS(carta, evitar), maxTokens: MAX_TOKENS_ANALYSIS }), charge, parseJSON, note);
    avoidRepeatedMyth(analisis, evitar);
    await save("analisis", analisis);
    await rememberMyth(env, analisis);
  }
  let report = await load("report_b");
  if (!report) {
    report = await phase("b", () => callClaude(env, { system: protocol, user: PROMPT_INFORME({ idioma: IDIOMA[lang], lang, nombre, tratamiento, analisis: JSON.stringify(analisis), carta }), maxTokens: MAX_TOKENS_REPORT }), charge, (reply) => {
      const r = normalizeReferences(withoutDedication(parseJSON(reply)));
      assertComplete(r);
      return r;
    }, note);
    await save("report_b", report);
  }
  normalizeReferences(withoutDedication(report));
  let audit = auditReport(report, payload);
  let style = styleCheck(report);
  let argument = argumentAudit(report, payload);
  const prints = await recentPrints(env);
  let prose = proseAudit(report, payload, prints);
  let corrected = false;
  if (!audit.ok || !style.ok || argument.ok === false || !prose.ok) {
    try {
      const proseText = prose.ok ? "" : describeProse(prose);
      const fixed = await phase("c", () => callClaude(env, { system: protocol, user: PROMPT_CORRECCION({ problemas: [audit.ok ? "" : describeIssues(audit), describeArgument(argument)].filter(Boolean).join("\n"), estilo: [style.ok ? "" : describeStyle(style), proseText].filter(Boolean).join("\n"), informe: JSON.stringify(report), carta }), maxTokens: MAX_TOKENS_REPORT }), charge, (reply) => {
        const r = normalizeReferences(withoutDedication(parseJSON(reply)));
        assertComplete(r);
        return r;
      }, note);
      const fixedAudit = auditReport(fixed, payload);
      const fixedProse = proseAudit(fixed, payload, prints);
      const prosaPeor = fixedProse.claims.errors.length > prose.claims.errors.length;
      if (fixedAudit.ok && !prosaPeor || !audit.ok) {
        report = fixed;
        audit = fixedAudit;
        style = styleCheck(fixed);
        argument = argumentAudit(fixed, payload);
        prose = fixedProse;
        corrected = true;
      }
    } catch (e) {
      if (!audit.ok) throw e;
    }
  }
  report.engine = { model, protocol_version: "ASTROINFORME", service: SERVICE_VERSION };
  report.argument_audit = { declared: argument.declared, ok: argument.ok, theses: argument.theses.map((t) => ({ id: t.id, central: t.central, status: t.status })) };
  report.prose_audit = {
    version: PROSE_AUDIT_VERSION,
    checked: prose.claims.checked,
    claim_errors: prose.claims.errors.length,
    undeclared: prose.claims.undeclared.length,
    biography: prose.biography.length,
    jargon_per_1000: prose.jargon.per1000,
    idioms: prose.idioms.length,
    enumerations: prose.enumerations.length,
    repeated_phrases: prose.within.phrases.length,
    cross_shared: prose.cross.length,
    pending: prose.fix,
    notes: prose.notes
  };
  await rememberPrint(env, report);
  report.audit = {
    all_references_present_in_chart: audit.ok,
    scope: audit.scope,
    declared: audit.declared,
    verified: audit.verified,
    total: audit.total,
    unchecked: audit.unchecked.length,
    undeclared_degrees: audit.undeclared_degrees.length,
    corrected,
    style_issues: style.issues.map((i) => ({ kind: i.kind, count: i.count }))
  };
  return { report, audit, usd: spent.usd, corrected };
}
var REPORT_TTL = 172800;
var FEEDBACK_MIN = 200;
var FEEDBACK_MAX = 5e3;
var FEEDBACK_PER_CODE = 3;
async function handleFeedback(request, env, cors, requireCode) {
  if (!env.ASTRO_KV) return json2({ error: "not_configured" }, 503, cors);
  const raw = await request.text();
  if (raw.length > FEEDBACK_MAX * 4) return json2({ error: "bad_request" }, 413, cors);
  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json2({ error: "bad_request" }, 400, cors);
  }
  const text = String(body && body.text || "").replace(/\s+\n/g, "\n").trim();
  if (text.length < FEEDBACK_MIN) return json2({ error: "feedback_short", min: FEEDBACK_MIN }, 400, cors);
  if (text.length > FEEDBACK_MAX) return json2({ error: "feedback_long", max: FEEDBACK_MAX }, 400, cors);
  let code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
  if (code) {
    const info = await resolveCode(env, code);
    if (!info || info.error) return json2({ error: info && info.error || "code_invalid" }, info && info.status || 403, cors);
  }
  if (!code && requireCode) return json2({ error: "code_required" }, 401, cors);
  if (!code) code = "PUBLICO";
  const kv = env.ASTRO_KV, ck = "fbcount:" + code;
  const n = +await kv.get(ck) || 0;
  if (n >= FEEDBACK_PER_CODE) return json2({ error: "feedback_limit" }, 429, cors);
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const title = String(body && body.report_title || "").slice(0, 200);
  await kv.put(`fb:${at}:${code}`, JSON.stringify({ code, at, report_title: title, text }));
  if (validBankId(body && body.bank_id)) await depositComment(env, body.bank_id, text, at);
  await kv.put(ck, String(n + 1));
  return json2({ ok: true }, 200, cors);
}
async function kvGetJSON(kv, key, fallback) {
  try {
    const v = await kv.get(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function addToMonth(kv, mk, { usd = 0, reports = 0, failed = 0 }) {
  const m = await kvGetJSON(kv, mk, { reports: 0, usd: 0, failed: 0 });
  m.usd = +((m.usd || 0) + usd).toFixed(4);
  m.reports = (m.reports || 0) + reports;
  m.failed = (m.failed || 0) + failed;
  await kv.put(mk, JSON.stringify(m));
}
async function payloadFingerprint(payload) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))));
  return [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var savedReport = (s) => s && s.report ? s.report : s && s.schema ? s : null;
var CONSUME_TRIES = 3;
var GEN_TTL = 90 * 86400;
async function loadProtocol(env) {
  const base2 = env.PROTOCOL || (env.ASTRO_KV ? await env.ASTRO_KV.get("protocol") : null);
  if (!base2) return null;
  const style = env.ASTRO_KV ? await env.ASTRO_KV.get("style") : null;
  return style ? `${base2}

${style}` : base2;
}
async function admit(request, env, cors, { requireCode, cap, incoming }) {
  const json400 = (error, status = 400) => ({ response: json2({ error }, status, cors) });
  const norm = normalizePayload(incoming);
  if (!norm.ok) return json400(norm.error);
  const payload = norm.payload;
  const requestId = normalizeRequestId(incoming && incoming.request_id);
  const kv = env.ASTRO_KV;
  const ip = request.headers.get("cf-connecting-ip") || "";
  const fp = await payloadFingerprint(payload);
  if (env.TURNSTILE_SECRET && !await verifyTurnstile(env.TURNSTILE_SECRET, request.headers.get("x-turnstile-token"), ip)) return json400("bot_check", 403);
  const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
  const useCode = requireCode || !!code;
  let limit = null, used = 0, token = null, codeKind = null, order = null;
  if (useCode) {
    if (!code) return json400("code_required", 401);
    const info = await resolveCode(env, code);
    if (!info) return json400("code_invalid", 403);
    if (info.error) return json400(info.error, info.status);
    limit = info.limit;
    codeKind = info.kind;
    order = info.order || null;
    if (!env.CODE_LEDGER) return json400("not_configured", 503);
    const book = ledger(env, code);
    const saved = await kvGetJSON(kv, "rep:" + code, null);
    if (requestId && saved && saved.request_id === requestId && savedReport(saved)) {
      used = (await book.get()).used;
      return { response: json2({ report: savedReport(saved), remaining: Math.max(0, limit - used), recovered: true }, 200, cors) };
    }
    const res = await book.reserve(requestId, limit);
    if (res.error === "in_progress") return { response: json2({ error: "in_progress", same_request: !!res.same_request }, 409, cors) };
    used = res.used;
    token = res.token || null;
    if (res.error === "quota_exhausted") {
      if (savedReport(saved) && (saved.fp == null || saved.fp === fp)) return { response: json2({ report: savedReport(saved), remaining: 0, recovered: true }, 200, cors) };
      return { response: json2({ error: "quota_exhausted", remaining: 0 }, 403, cors) };
    }
  }
  const mk = monthKey();
  const month = await kvGetJSON(kv, mk, { reports: 0, usd: 0, failed: 0 });
  if (month.usd >= cap) {
    if (useCode) await ledger(env, code).release(token).catch(() => {
    });
    return json400("budget_exhausted", 429);
  }
  let vKey = null, vUsed = 0, dKey = null, dUsed = 0;
  if (!useCode) {
    dKey = dayKey();
    dUsed = +await kv.get(dKey) || 0;
    if (dUsed >= +(env.DAILY_LIMIT || 8)) return json400("daily_limit", 429);
    vKey = `v:${dKey.slice(4)}:${await visitorId(ip, env.VISITOR_SALT || env.ANTHROPIC_API_KEY)}`;
    vUsed = +await kv.get(vKey) || 0;
    if (vUsed >= +(env.VISITOR_DAILY_LIMIT || 1)) return json400("visitor_limit", 429);
    await kv.put(vKey, String(vUsed + 1), { expirationTtl: 172800 });
    await kv.put(dKey, String(dUsed + 1), { expirationTtl: 172800 });
  }
  const ne = incoming && typeof incoming.notify_email === "string" ? incoming.notify_email.trim() : "";
  const notifyEmail = ne && validEmail(ne) && codeKind !== "order" && mailEnabled(env) ? ne : null;
  return { job: { payload, fp, token, codeKind, order, requestId, useCode, code: useCode ? code : null, limit, mk, vKey, vUsed, dKey, dUsed, notifyEmail } };
}
async function finalizeJob(env, job, spent, result, error, extra = {}) {
  const kv = env.ASTRO_KV;
  const { useCode, code, requestId, limit, mk, vKey, vUsed, dKey, dUsed, fp, token } = job;
  let out, outcome, consumed = false, unsettled = false, mailInfo = null;
  if (result) {
    const strict = env.AUDIT_STRICT !== "false";
    if (!result.audit.ok && strict) {
      await addToMonth(kv, mk, { usd: spent.usd, failed: 1 }).catch((e) => console.log(JSON.stringify({ event: "month_failed", detail: String(e && e.message || e) })));
      out = { error: "audit_failed" };
      outcome = "audit_failed";
    } else {
      if (job.payload.request.bank_consent && bankEnabled(env)) {
        const id = await bankId(result.report);
        const entry = bankEntry({ id, report: result.report, payload: job.payload, chart: chartForModel(job.payload), usd: spent.usd, service: SERVICE_VERSION, model: env.MODEL || DEFAULT_MODEL });
        if (await deposit(env, entry)) result.report.bank_id = id;
      }
      let used = null;
      if (useCode) {
        await kv.put("rep:" + code, JSON.stringify({ request_id: requestId, fp: fp || null, report: result.report, at: (/* @__PURE__ */ new Date()).toISOString() }), { expirationTtl: REPORT_TTL }).catch((e) => console.log(JSON.stringify({ event: "report_copy_failed", detail: String(e && e.message || e) })));
        for (let i = 1; i <= CONSUME_TRIES && !consumed; i++) {
          try {
            used = (await ledger(env, code).consume(token)).used;
            consumed = true;
          } catch (e) {
            if (i === CONSUME_TRIES) {
              unsettled = true;
              console.log(JSON.stringify({ event: "consume_failed", detail: String(e && e.message || e) }));
            }
          }
        }
      }
      await addToMonth(kv, mk, { usd: spent.usd, reports: 1 }).catch((e) => console.log(JSON.stringify({ event: "month_failed", detail: String(e && e.message || e) })));
      out = { report: result.report, remaining: useCode && used != null ? Math.max(0, limit - used) : null };
      outcome = "delivered";
      if (job.notifyEmail) {
        mailInfo = await mailReportLink(env, job, result.report, env.MAIL_RETRY_FAST === "1" ? [0, 0] : MAIL_WAITS_MS).catch(() => ({ status: "rejected", http: null, tries: 0 }));
        out.mailed = !!(mailInfo && mailInfo.status === "accepted");
      }
    }
  } else {
    out = { error: "upstream" };
    outcome = "upstream";
    console.log(JSON.stringify({ event: "upstream_error", status: error && error.status || null, detail: error && (error.detail || String(error.message || error)) || null }));
    if (spent.usd) await addToMonth(kv, mk, { usd: spent.usd, failed: 1 }).catch(() => {
    });
    if (vKey) {
      await kv.put(vKey, String(vUsed), { expirationTtl: 172800 }).catch(() => {
      });
      await kv.put(dKey, String(dUsed), { expirationTtl: 172800 }).catch(() => {
      });
    }
  }
  if (useCode && !consumed && !unsettled) await ledger(env, code).release(token).catch(() => {
  });
  const genId = requestId || crypto.randomUUID();
  await kv.put("gen:" + genId, JSON.stringify({
    at: (/* @__PURE__ */ new Date()).toISOString(),
    model: env.MODEL || DEFAULT_MODEL,
    service: SERVICE_VERSION,
    mode: extra.mode || "stream",
    access: useCode ? job.codeKind || "code" : "public",
    // referencia para conciliar reclamos: número de orden de la compra (licencias) o el código (códigos de regalo)
    ref: useCode ? job.codeKind === "license" ? job.order ? "order:" + job.order : null : job.codeKind === "order" ? "order:" + job.orderId : job.code : null,
    usd: +spent.usd.toFixed(4),
    phases: spent.phases || {},
    calls: spent.calls || [],
    corrected: !!(result && result.corrected),
    outcome,
    quota_unsettled: unsettled || void 0,
    reason: error ? String(error.status || error.detail || error.message || "").slice(0, 60) : void 0,
    attempts: extra.attempts || 1,
    lang: job.payload.request.report_language,
    // correo del informe (2.6.2): aceptado o rechazado por Resend, sin la dirección
    mail: mailInfo ? mailInfo.status : void 0,
    mail_http: mailInfo && mailInfo.status !== "accepted" ? mailInfo.http : void 0,
    mail_tries: mailInfo ? mailInfo.tries : void 0
  }), { expirationTtl: GEN_TTL }).catch(() => {
  });
  if (mailInfo && mailInfo.status === "rejected") await alertMailFailure(env, job, genId, mailInfo).catch(() => {
  });
  if (job.codeKind === "order") await notifyOrderGeneration(env, job.orderId, requestId, outcome).catch(() => {
  });
  return out;
}
var LINK_TTL = 7 * 86400;
var LINK_DAYS = 7;
var linkHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
var MAIL_TRIES = 3;
var MAIL_WAITS_MS = [2e3, 6e3];
async function mailReportLink(env, job, report, waits = MAIL_WAITS_MS) {
  if (!env.ASTRO_KV || !job.notifyEmail) return null;
  const id = linkHex(8), key = linkHex(24);
  const payload = { ...job.payload, person: { first_name: null } };
  await env.ASTRO_KV.put("lnk:" + id, JSON.stringify({ keyHash: await sha256Hex(key), report, payload, at: (/* @__PURE__ */ new Date()).toISOString() }), { expirationTtl: LINK_TTL });
  const url = `${(env.APP_URL || "https://asterorbis.com").replace(/\/$/, "")}/?informe=${id}#k=${key}`;
  const m = fullReportMail(job.payload.request.report_language, report, url, LINK_DAYS);
  let r = { ok: false, status: null }, tries = 0;
  while (tries < MAIL_TRIES) {
    tries++;
    r = await sendMailResult(env, { to: job.notifyEmail, subject: m.subject, text: m.text, html: m.html, key: `lnk-${job.requestId || id}` });
    if (r.ok || !mailRetryable(r.status) || tries >= MAIL_TRIES) break;
    await new Promise((res) => setTimeout(res, waits[tries - 1] || 0));
  }
  return { status: r.ok ? "accepted" : "rejected", http: r.status, tries };
}
async function alertMailFailure(env, job, genId, mail) {
  if (!env.ADMIN_EMAIL) return false;
  const ref = job.code || job.orderId || "sin c\xF3digo";
  const text = `No sali\xF3 el correo con el informe.

C\xF3digo: ${ref}
Registro: gen:${genId}
Hora: ${(/* @__PURE__ */ new Date()).toISOString()}
Respuesta de Resend: ${mail.http == null ? "sin respuesta" : mail.http}
Intentos: ${mail.tries}

El informe se entreg\xF3 en pantalla y se puede recuperar durante 48 horas con el mismo c\xF3digo. La direcci\xF3n de correo no se guarda: para reenviarlo hay que ped\xEDrsela a la persona.`;
  return sendMail(env, { to: env.ADMIN_EMAIL, subject: `AsterOrbis: no sali\xF3 el correo de un informe (${ref})`, text, key: `mailfail-${genId}` });
}
async function handleLink(env, id, keyHeader, cors) {
  if (!/^[0-9a-f]{16}$/.test(id) || !/^[0-9a-f]{48}$/.test(keyHeader || "")) return json2({ error: "not_found" }, 404, cors);
  const saved = await kvGetJSON(env.ASTRO_KV, "lnk:" + id, null);
  if (!saved || saved.keyHash !== await sha256Hex(keyHeader)) return json2({ error: "not_found" }, 404, cors);
  return json2({ report: saved.report, chart: saved.payload }, 200, { ...cors, "cache-control": "no-store" });
}
async function undoAdmission(env, job) {
  if (job.useCode) await ledger(env, job.code).release(job.token).catch(() => {
  });
  if (job.vKey) {
    await env.ASTRO_KV.put(job.vKey, String(job.vUsed), { expirationTtl: 172800 }).catch(() => {
    });
    await env.ASTRO_KV.put(job.dKey, String(job.dUsed), { expirationTtl: 172800 }).catch(() => {
    });
  }
}
async function readBody(request, cors) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return { response: json2({ error: "bad_request" }, 413, cors) };
  try {
    return { incoming: JSON.parse(raw) };
  } catch (e) {
    return { response: json2({ error: "bad_request" }, 400, cors) };
  }
}
var JOB_PREFIX = "/jobs";
function serviceMode(env) {
  const m = String(env.SERVICE_MODE || "pilot").toLowerCase();
  return ["pilot", "paid", "disabled"].includes(m) ? m : "pilot";
}
async function rateLimited(env, key) {
  if (!env.RATE_LIMITER) return false;
  try {
    const { success } = await env.RATE_LIMITER.limit({ key });
    return !success;
  } catch (e) {
    return false;
  }
}
async function generationAvailable(env) {
  if (!env.ANTHROPIC_API_KEY || !env.ASTRO_KV || !await loadProtocol(env)) return false;
  const month = await kvGetJSON(env.ASTRO_KV, monthKey(), { usd: 0 });
  return month.usd < +(env.MONTHLY_USD_LIMIT || 15);
}
var worker_default = {
  // control periódico de pedidos pagos (Cron); no hace nada fuera del modo "paid"
  async scheduled(event, env, ctx) {
    const t = event.scheduledTime || Date.now();
    ctx.waitUntil(runControls(env, t));
    ctx.waitUntil(purgeOld(env, t));
  },
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const requireCode = env.REQUIRE_CODE !== "false";
    const cap = +(env.MONTHLY_USD_LIMIT || 15);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const protocolOk = !!(env.PROTOCOL || env.ASTRO_KV && await env.ASTRO_KV.get("protocol"));
      const month = env.ASTRO_KV ? await kvGetJSON(env.ASTRO_KV, monthKey(), { usd: 0 }) : { usd: 0 };
      const day = env.ASTRO_KV ? +await env.ASTRO_KV.get(dayKey()) || 0 : 0;
      const configured = !!(env.ANTHROPIC_API_KEY && protocolOk && env.ASTRO_KV);
      return json2({
        service: "astroinforme",
        version: SERVICE_VERSION,
        model: env.MODEL || DEFAULT_MODEL,
        access: requireCode ? "code" : "public",
        turnstile: !!env.TURNSTILE_SECRET,
        // «jobs»: generación desacoplada de la conexión (servicio 1.6, Durable Object REPORT_JOB)
        jobs: !!env.REPORT_JOB,
        mode: serviceMode(env),
        // proveedores de pago configurados (solo los nombres; en modo "paid")
        payments: serviceMode(env) === "paid" ? providerNames().filter((n) => getProvider(env, n)) : [],
        // «ledger»: cupo por código con reserva atómica (servicio 1.7, Durable Object CODE_LEDGER)
        ledger: !!env.CODE_LEDGER,
        // «available»: si hoy se puede pedir un informe (sin revelar el gasto)
        available: configured && serviceMode(env) !== "disabled" && month.usd < cap && (requireCode || day < +(env.DAILY_LIMIT || 8)),
        configured: { api_key: !!env.ANTHROPIC_API_KEY, protocol: protocolOk, style: !!(env.ASTRO_KV && await env.ASTRO_KV.get("style")), kv: !!env.ASTRO_KV, codes: Object.keys(await allCodes(env)).length > 0 }
      }, 200, cors);
    }
    const pay = await routePayments(request, env, cors, url);
    if (pay) return pay;
    if (!cors["access-control-allow-origin"] || !request.headers.get("origin")) return json2({ error: "forbidden_origin" }, 403, cors);
    const code = (request.headers.get("x-astro-code") || "").trim().toUpperCase();
    if (code.startsWith("ORDER:")) return json2({ error: "code_invalid" }, 403, cors);
    if (request.method === "POST" && await rateLimited(env, code ? "c:" + code : "ip:" + await visitorId(request.headers.get("cf-connecting-ip") || "", env.VISITOR_SALT || env.ANTHROPIC_API_KEY)))
      return json2({ error: "rate_limited" }, 429, cors);
    if (url.pathname === "/orders" || url.pathname.startsWith("/orders/")) {
      const r = await routeOrders(request, env, cors, url);
      if (r) return r;
    }
    if (request.method === "GET" && url.pathname.startsWith("/links/")) {
      if (!env.ASTRO_KV) return json2({ error: "not_configured" }, 503, cors);
      return handleLink(env, url.pathname.slice(7), request.headers.get("x-link-key"), cors);
    }
    if (request.method === "GET" && url.pathname.startsWith(JOB_PREFIX + "/")) {
      if (!env.REPORT_JOB) return json2({ error: "not_configured" }, 503, cors);
      const id = normalizeRequestId(decodeURIComponent(url.pathname.slice(JOB_PREFIX.length + 1)));
      if (!id) return json2({ error: "bad_request" }, 400, cors);
      const r = await env.REPORT_JOB.get(env.REPORT_JOB.idFromName(id)).fetch("https://job/status", { method: "POST", body: JSON.stringify({ code }) });
      return json2(await r.json(), r.status, { ...cors, "cache-control": "no-store" });
    }
    if (request.method !== "POST") return json2({ error: "bad_request" }, 405, cors);
    if (url.pathname === "/feedback") return handleFeedback(request, env, cors, requireCode);
    if (serviceMode(env) === "disabled") return json2({ error: "disabled" }, 503, cors);
    const protocol = await loadProtocol(env);
    if (!env.ANTHROPIC_API_KEY || !protocol || !env.ASTRO_KV) return json2({ error: "not_configured" }, 503, cors);
    const body = await readBody(request, cors);
    if (body.response) return body.response;
    if (url.pathname === JOB_PREFIX) {
      if (!env.REPORT_JOB) return json2({ error: "not_configured" }, 503, cors);
      const id = normalizeRequestId(body.incoming && body.incoming.request_id);
      if (!id) return json2({ error: "bad_request" }, 400, cors);
      if (code) {
        const info = await resolveCode(env, code);
        if (!info || info.error) return json2({ error: info && info.error || "code_invalid" }, info && info.status || 403, cors);
      }
      if (requireCode && !code) return json2({ error: "code_required" }, 401, cors);
      const stub = env.REPORT_JOB.get(env.REPORT_JOB.idFromName(id));
      const prev = await stub.fetch("https://job/status", { method: "POST", body: JSON.stringify({ code }) });
      if (prev.status !== 404) {
        const pb = await prev.json();
        if (pb.status === "failed") pb.retry = true;
        return json2(pb, prev.status, { ...cors, "cache-control": "no-store" });
      }
      const adm2 = await admit(request, env, cors, { requireCode, cap, incoming: body.incoming });
      if (adm2.response) return adm2.response;
      try {
        const r = await stub.fetch("https://job/start", { method: "POST", body: JSON.stringify(adm2.job) });
        if (!r.ok) throw new Error("job_start");
        return json2(await r.json(), 202, { ...cors, "cache-control": "no-store" });
      } catch (e) {
        console.log(JSON.stringify({ event: "job_start_failed", detail: String(e && e.message || e) }));
        await undoAdmission(env, adm2.job);
        return json2({ error: "upstream" }, 503, cors);
      }
    }
    if (env.LEGACY_STREAM !== "true") return json2({ error: "app_outdated" }, 410, cors);
    const adm = await admit(request, env, cors, { requireCode, cap, incoming: body.incoming });
    if (adm.response) return adm.response;
    const job = adm.job;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const keep = setInterval(() => {
      writer.write(enc.encode(" ")).catch(() => {
      });
    }, KEEPALIVE_MS);
    const work = (async () => {
      const spent = { usd: 0 };
      let out;
      try {
        out = await finalizeJob(env, job, spent, await interpret(env, job.payload, protocol, spent), null);
      } catch (e) {
        out = await finalizeJob(env, job, spent, null, e);
      }
      clearInterval(keep);
      await writer.write(enc.encode(JSON.stringify(out)));
      await writer.close();
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(work);
    return new Response(readable, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });
  }
};

// src/job.js
var MAX_ATTEMPTS = 3;
var RETRY_DELAY_MS = 2e4;
var TRANSIENT = (e) => e && e.message === "upstream" && (e.status == null || e.status === 429 || e.status >= 500);
var ok3 = (obj2, status = 200) => new Response(JSON.stringify(obj2), { status, headers: { "content-type": "application/json; charset=utf-8" } });
var ReportJob = class {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }
  /** Vista pública del estado. Si el pedido se hizo con código, solo lo ve quien presenta el mismo código. */
  async view(code) {
    const meta = await this.storage.get("meta");
    if (!meta) return ok3({ error: "not_found" }, 404);
    if (meta.job.useCode && (code || "") !== meta.job.code) return ok3({ error: "forbidden" }, 403);
    const base2 = { job_id: meta.job.requestId, status: meta.status };
    if (meta.status === "done" || meta.status === "failed") return ok3({ ...base2, ...await this.storage.get("out") });
    return ok3(base2);
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = await request.json().catch(() => ({}));
    if (path === "/status") return this.view(body.code);
    if (path === "/start") {
      if (await this.storage.get("meta")) return this.view(body.code);
      await this.storage.put("meta", { job: body, status: "queued", attempts: 0, created: Date.now() });
      await this.storage.setAlarm(Date.now());
      return ok3({ job_id: body.requestId, status: "queued" });
    }
    return ok3({ error: "bad_request" }, 400);
  }
  async alarm() {
    const meta = await this.storage.get("meta");
    if (!meta) return;
    if (meta.status === "done" || meta.status === "failed") {
      if (Date.now() >= (meta.cleanupAt || 0)) await this.storage.deleteAll();
      return;
    }
    const spent = await this.storage.get("spent") || { usd: 0, phases: {} };
    if (meta.attempts >= MAX_ATTEMPTS) {
      const e = new Error("upstream");
      e.detail = "max attempts";
      return this.close(meta, await finalizeJob(this.env, meta.job, spent, null, e, { mode: "job", attempts: meta.attempts }));
    }
    meta.attempts += 1;
    meta.status = "running";
    await this.storage.put("meta", meta);
    const hooks = {
      load: (k) => this.storage.get("phase:" + k),
      // cada fase guardada lleva el gasto acumulado: si la ejecución se corta, el gasto no se pierde
      save: async (k, v) => {
        await this.storage.put("phase:" + k, v);
        await this.storage.put("spent", spent);
      }
    };
    let out;
    try {
      const protocol = await loadProtocol(this.env);
      if (!protocol) {
        const e = new Error("upstream");
        e.detail = "protocol missing";
        throw e;
      }
      const result = await interpret(this.env, meta.job.payload, protocol, spent, hooks);
      out = await finalizeJob(this.env, meta.job, spent, result, null, { mode: "job", attempts: meta.attempts });
    } catch (e) {
      await this.storage.put("spent", spent);
      if (TRANSIENT(e) && meta.attempts < MAX_ATTEMPTS) {
        meta.status = "queued";
        await this.storage.put("meta", meta);
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
    if (meta.job) delete meta.job.notifyEmail;
    meta.cleanupAt = Date.now() + (meta.job.retainMs || REPORT_TTL * 1e3);
    await this.storage.put("out", out);
    await this.storage.delete(["phase:analisis", "phase:report_b"]);
    await this.storage.put("meta", meta);
    await this.storage.setAlarm(meta.cleanupAt);
  }
};

// src/entry.js
var entry_default = worker_default;
export {
  CodeLedger,
  OrderDO,
  ReportJob,
  entry_default as default
};
