// AsterOrbis — envío de correo (servicio 2.1; desde la 2.6 también el informe completo para quien lo pide con código).
// Variables de Cloudflare: MAIL_API_KEY (secreto de Resend), MAIL_FROM ("AsterOrbis <informes@asterorbis.com>"),
// ADMIN_EMAIL (recibe avisos y responde las consultas), APP_URL (opcional).

export const mailEnabled = (env) => !!(env.MAIL_API_KEY && env.MAIL_FROM);

/** Envía un correo y devuelve { ok, status }: status es el código HTTP de Resend, o null si no hubo respuesta.
 *  Aceptado no garantiza que llegue a la bandeja. */
export async function sendMailResult(env, { to, subject, text, html, key }) {
  if (!mailEnabled(env) || !to) return { ok: false, status: null, skipped: true };
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.MAIL_API_KEY, ...(key ? { "idempotency-key": key } : {}) },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}), ...(env.ADMIN_EMAIL ? { reply_to: env.ADMIN_EMAIL } : {}) }) });
    if (!r.ok) console.log(JSON.stringify({ event: "mail_rejected", status: r.status }));
    return { ok: r.ok, status: r.status };
  } catch (e) { console.log(JSON.stringify({ event: "mail_error" })); return { ok: false, status: null }; }
}
/** Envía un correo de texto. Devuelve true si el proveedor lo aceptó; aceptado no garantiza que llegue a la bandeja. */
export async function sendMail(env, msg) { return (await sendMailResult(env, msg)).ok; }

/** Vale la pena reintentar: sin respuesta, límite de frecuencia, pedido simultáneo con la misma clave o falla del proveedor. */
export const mailRetryable = (status) => status == null || status === 429 || status === 409 || status >= 500;

const TEXTS = {
  es: { subject: "Tu informe de AsterOrbis está listo", body: (u, d) => `Tu informe está listo.\n\nAbrilo desde este enlace privado:\n${u}\n\nEl enlace funciona durante ${d} días. Desde ahí podés guardar el PDF. Después de ese plazo, el informe y tu carta se borran.\n\nNo compartas este enlace: quien lo tenga puede leer el informe. Si algo no funciona, respondé este correo.\n\nBárbara Gutiérrez · AsterOrbis` },
  de: { subject: "Dein AsterOrbis-Bericht ist fertig", body: (u, d) => `Dein Bericht ist fertig.\n\nÖffne ihn über diesen privaten Link:\n${u}\n\nDer Link gilt ${d} Tage. Dort kannst du das PDF speichern. Nach Ablauf dieser Frist werden Bericht und Horoskop gelöscht.\n\nTeile diesen Link nicht: Wer ihn hat, kann den Bericht lesen. Wenn etwas nicht funktioniert, antworte auf diese E-Mail.\n\nBárbara Gutiérrez · AsterOrbis` },
  en: { subject: "Your AsterOrbis report is ready", body: (u, d) => `Your report is ready.\n\nOpen it from this private link:\n${u}\n\nThe link works for ${d} days. You can save the PDF from there. After that, the report and your chart are deleted.\n\nDo not share this link: anyone who has it can read the report. If something does not work, reply to this email.\n\nBárbara Gutiérrez · AsterOrbis` },
};
export function reportMail(lang, url, days) { const t = TEXTS[lang] || TEXTS.es; return { subject: t.subject, text: t.body(url, days) }; }
export const validEmail = (x) => typeof x === "string" && x.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;".]{2,}$/.test(x.trim());

// ---------------------------------------------------------------- informe completo en el cuerpo del correo (2.6)
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const FULL = {
  es: { subject: (t) => `Tu informe de AsterOrbis: ${t}`, intro: "Este es tu informe completo. También podés abrirlo en AsterOrbis, con las ilustraciones, y guardarlo en PDF desde este enlace privado:", button: "Abrir el informe y guardar el PDF", days: (d) => `El enlace funciona durante ${d} días; después, la copia guardada se borra. Este correo queda en tu casilla.`, warn: "No compartas el enlace: quien lo tenga puede leer el informe.", sign: "Bárbara Gutiérrez · AsterOrbis" },
  de: { subject: (t) => `Dein AsterOrbis-Bericht: ${t}`, intro: "Hier ist dein vollständiger Bericht. Über diesen privaten Link kannst du ihn mit den Illustrationen in AsterOrbis öffnen und als PDF speichern:", button: "Bericht öffnen und PDF speichern", days: (d) => `Der Link gilt ${d} Tage; danach wird die gespeicherte Kopie gelöscht. Diese E-Mail bleibt in deinem Postfach.`, warn: "Teile den Link nicht: Wer ihn hat, kann den Bericht lesen.", sign: "Bárbara Gutiérrez · AsterOrbis" },
  en: { subject: (t) => `Your AsterOrbis report: ${t}`, intro: "Here is your full report. You can also open it in AsterOrbis, with the illustrations, and save it as a PDF from this private link:", button: "Open the report and save the PDF", days: (d) => `The link works for ${d} days; after that, the stored copy is deleted. This email stays in your inbox.`, warn: "Do not share the link: anyone who has it can read the report.", sign: "Bárbara Gutiérrez · AsterOrbis" },
};
/** Correo con el informe completo (HTML y texto) y el enlace privado. */
export function fullReportMail(lang, report, url, days) {
  const t = FULL[lang] || FULL.es, title = String(report.title || "").slice(0, 160);
  const secs = (report.sections || []).filter((s) => s && s.body_markdown);
  const paras = (b) => String(b).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const html = `<!doctype html><html lang="${esc(lang)}"><body style="margin:0;background:#f4efe3;">
<div style="max-width:620px;margin:0 auto;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;color:#1c2230;line-height:1.6;font-size:17px;">
<p style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.12em;color:#5d6573;margin:0 0 18px;">ASTERORBIS</p>
<h1 style="font-weight:normal;font-size:28px;line-height:1.25;margin:0 0 18px;">${esc(title)}</h1>
<p style="font-family:Arial,sans-serif;font-size:15px;color:#3a4150;">${esc(t.intro)}</p>
<p style="margin:18px 0 28px;"><a href="${esc(url)}" style="display:inline-block;background:#1f3a5f;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:12px 20px;border-radius:999px;">${esc(t.button)}</a></p>
${secs.map((s) => `<h2 style="font-weight:normal;font-size:21px;line-height:1.3;margin:32px 0 10px;color:#1f3a5f;">${esc(s.heading)}</h2>\n${paras(s.body_markdown).map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("\n")}`).join("\n")}
<hr style="border:none;border-top:1px solid #c9cdc6;margin:32px 0 16px;">
<p style="font-family:Arial,sans-serif;font-size:13px;color:#5d6573;">${esc(t.days(days))} ${esc(t.warn)}</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#5d6573;">${esc(t.sign)}</p>
</div></body></html>`;
  const text = `${title}\n\n${t.intro}\n${url}\n\n${secs.map((s) => `${String(s.heading || "").toUpperCase()}\n\n${paras(s.body_markdown).join("\n\n")}`).join("\n\n\n")}\n\n—\n${t.days(days)} ${t.warn}\n${t.sign}`;
  return { subject: t.subject(title), html, text };
}
