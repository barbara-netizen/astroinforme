// AsterOrbis — envío de correo (servicio 2.1). Sin carta ni informe: solo el enlace privado o un aviso técnico.
// Variables de Cloudflare: MAIL_API_KEY (secreto de Resend), MAIL_FROM ("AsterOrbis <informes@asterorbis.com>"),
// ADMIN_EMAIL (recibe avisos y responde las consultas), APP_URL (opcional).

export const mailEnabled = (env) => !!(env.MAIL_API_KEY && env.MAIL_FROM);

/** Envía un correo de texto. Devuelve true si el proveedor lo aceptó; aceptado no garantiza que llegue a la bandeja. */
export async function sendMail(env, { to, subject, text, key }) {
  if (!mailEnabled(env) || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.MAIL_API_KEY, ...(key ? { "idempotency-key": key } : {}) },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, ...(env.ADMIN_EMAIL ? { reply_to: env.ADMIN_EMAIL } : {}) }) });
    if (!r.ok) console.log(JSON.stringify({ event: "mail_rejected", status: r.status }));
    return r.ok;
  } catch (e) { console.log(JSON.stringify({ event: "mail_error" })); return false; }
}

const TEXTS = {
  es: { subject: "Tu informe de AsterOrbis está listo", body: (u, d) => `Tu informe está listo.\n\nAbrilo desde este enlace privado:\n${u}\n\nEl enlace funciona durante ${d} días. Desde ahí podés guardar el PDF. Después de ese plazo, el informe y tu carta se borran.\n\nNo compartas este enlace: quien lo tenga puede leer el informe. Si algo no funciona, respondé este correo.\n\nBárbara Gutiérrez · AsterOrbis` },
  de: { subject: "Dein AsterOrbis-Bericht ist fertig", body: (u, d) => `Dein Bericht ist fertig.\n\nÖffne ihn über diesen privaten Link:\n${u}\n\nDer Link gilt ${d} Tage. Dort kannst du das PDF speichern. Nach Ablauf dieser Frist werden Bericht und Horoskop gelöscht.\n\nTeile diesen Link nicht: Wer ihn hat, kann den Bericht lesen. Wenn etwas nicht funktioniert, antworte auf diese E-Mail.\n\nBárbara Gutiérrez · AsterOrbis` },
  en: { subject: "Your AsterOrbis report is ready", body: (u, d) => `Your report is ready.\n\nOpen it from this private link:\n${u}\n\nThe link works for ${d} days. You can save the PDF from there. After that, the report and your chart are deleted.\n\nDo not share this link: anyone who has it can read the report. If something does not work, reply to this email.\n\nBárbara Gutiérrez · AsterOrbis` },
};
export function reportMail(lang, url, days) { const t = TEXTS[lang] || TEXTS.es; return { subject: t.subject, text: t.body(url, days) }; }
export const validEmail = (x) => typeof x === "string" && x.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;".]{2,}$/.test(x.trim());
