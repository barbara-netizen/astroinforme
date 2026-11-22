// AsterOrbis — banco de informes (servicio 2.5).
//
// Con permiso explícito de la persona (casilla desmarcada por defecto: request.bank_consent = true), el servicio guarda
// una copia anónima del informe en un repositorio privado de GitHub, para estudiar la calidad de los informes y mejorar
// el método. Sin permiso no se guarda nada.
//
// Qué se guarda: el informe con el nombre de pila reemplazado por «[nombre]», la carta tal como la recibe el modelo
// (sin fecha, hora, lugar ni zona), las auditorías, el costo, la versión y el mito. Nunca correo, código, número de
// pedido, IP ni fecha exacta del pedido (solo año y mes).
// Cada informe recibe un número («AO-XXXXXXXX») que la persona ve al pie del informe y le permite pedir la baja.
// Los comentarios que deja esa persona se agregan al banco con el mismo número.
// Las entradas con más de BANK_MONTHS meses se borran solas (control periódico).
//
// Configuración (secretos en Cloudflare): BANK_GITHUB_TOKEN (token de acceso con permiso de contenido solo sobre el
// repositorio del banco) y BANK_REPO («dueño/repositorio»). Sin ambos, el banco queda apagado.

export const BANK_MONTHS = 24;
export const BANK_MARK_TTL = 7 * 86400; // el número sirve para vincular comentarios durante 7 días
const API = "https://api.github.com";
const ID_RE = /^AO-[A-Z2-7]{8}$/;

export const bankEnabled = (env) => !!(env && env.BANK_GITHUB_TOKEN && env.BANK_REPO && /^[\w.-]+\/[\w.-]+$/.test(env.BANK_REPO));
export const validBankId = (x) => typeof x === "string" && ID_RE.test(x);

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Número estable a partir del texto del informe: si el cierre se repite, el número y el archivo son los mismos. */
export async function bankId(report) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify((report && report.sections) || []))));
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5 && out.length < 8) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } if (out.length >= 8) break; }
  return "AO-" + out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Reemplaza el nombre de pila (y cada una de sus palabras) por «[nombre]» en todo el texto del informe. */
export function anonymize(report, firstName) {
  const r = JSON.parse(JSON.stringify(report));
  const parts = firstName ? [firstName, ...firstName.split(/[\s'’.-]+/)].map((x) => x.trim()).filter((x) => x.length >= 2) : [];
  if (!parts.length) return r;
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(?:${[...new Set(parts)].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?![\\p{L}\\p{M}])`, "giu");
  const fix = (s) => (typeof s === "string" ? s.replace(re, "[nombre]") : s);
  r.title = fix(r.title);
  for (const s of r.sections || []) { s.heading = fix(s.heading); s.body_markdown = fix(s.body_markdown); }
  for (const t of r.theses || []) t.claim = fix(t.claim);
  return r;
}

/** Entrada del banco. chart: la carta tal como la recibe el modelo (chartForModel). */
export function bankEntry({ id, report, payload, chart, usd, service, model, now = new Date() }) {
  const clean = anonymize(report, payload.person && payload.person.first_name);
  delete clean.bank_id;
  const myth = (clean.sections || []).find((s) => s && s.id === "myth");
  return {
    schema: "asterorbis.bank/v1", id, month: now.toISOString().slice(0, 7), service, model,
    language: payload.request.report_language, address_gender: payload.request.address_gender, time_precision: payload.birth.time_precision,
    had_first_name: !!(payload.person && payload.person.first_name), usd: +(+usd || 0).toFixed(4),
    myth_heading: myth ? myth.heading : null, chart, report: clean, comments: [],
  };
}

const utf8b64 = (s) => { const b = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
const gh = (env, path, init = {}) => fetch(`${API}/repos/${env.BANK_REPO}/contents/${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env.BANK_GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "asterorbis-servicio", ...(init.body ? { "content-type": "application/json" } : {}) },
});

/** Crea un archivo. Si ya existe (cierre repetido), no hace nada. Devuelve true si quedó guardado. */
async function putFile(env, path, obj, message) {
  const res = await gh(env, path, { method: "PUT", body: JSON.stringify({ message, content: utf8b64(JSON.stringify(obj, null, 2) + "\n") }) });
  if (res.ok) return true;
  if (res.status === 422) return true; // ya existe
  throw new Error(`bank_${res.status}`);
}

/** Guarda la entrada; marca el número en KV para vincular comentarios. No lanza: el banco nunca frena una entrega. */
export async function deposit(env, entry) {
  if (!bankEnabled(env)) return false;
  try {
    const [y, m] = entry.month.split("-");
    await putFile(env, `informes/${y}/${m}/${entry.id}.json`, entry, `Informe ${entry.id}`);
    if (env.ASTRO_KV) await env.ASTRO_KV.put("bank:" + entry.id, entry.month, { expirationTtl: BANK_MARK_TTL }).catch(() => { });
    return true;
  } catch (e) {
    console.log(JSON.stringify({ event: "bank_failed", detail: String((e && e.message) || e) }));
    return false;
  }
}

/** Comentario de una persona que autorizó el banco: se guarda aparte, con el mismo número. */
export async function depositComment(env, id, text, at = new Date().toISOString()) {
  if (!bankEnabled(env) || !validBankId(id) || !env.ASTRO_KV) return false;
  const month = await env.ASTRO_KV.get("bank:" + id).catch(() => null);
  if (!month) return false; // sin permiso registrado (o pasaron más de 7 días): no se vincula
  try {
    const [y, m] = month.split("-");
    await putFile(env, `comentarios/${y}/${m}/${id}-${at.replace(/[^0-9]/g, "").slice(0, 14)}.json`, { id, month, text }, `Comentario ${id}`);
    return true;
  } catch (e) { console.log(JSON.stringify({ event: "bank_comment_failed", detail: String((e && e.message) || e) })); return false; }
}

/** Borra las carpetas año/mes con más de BANK_MONTHS meses. Corre una vez por mes desde el control periódico. */
export async function purgeOld(env, nowMs = Date.now()) {
  if (!bankEnabled(env) || !env.ASTRO_KV) return 0;
  const now = new Date(nowMs), tag = "bank:purged:" + now.toISOString().slice(0, 7);
  if (await env.ASTRO_KV.get(tag)) return 0;
  const cut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - BANK_MONTHS, 1)).toISOString().slice(0, 7);
  let removed = 0;
  const list = async (p) => { const r = await gh(env, p); return r.ok ? r.json() : []; };
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
  } catch (e) { console.log(JSON.stringify({ event: "bank_purge_failed", detail: String((e && e.message) || e) })); }
  return removed;
}
