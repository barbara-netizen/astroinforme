// ASTROINFORME — auditoría técnica de un informe (autónoma, en el navegador).
// Compara cada referencia técnica declarada por el informe (technical_references_used) con la carta calculada.
// No confía en la auditoría que trae el informe: la rehace siempre.

const SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
const toMin = (deg) => { const m = String(deg).match(/(\d+)°\s*(\d+)'/); return m ? +m[1] * 60 + +m[2] : null; };
const lonToSignMin = (lon) => { const l = ((lon % 360) + 360) % 360; return { sign: SIGNS[Math.floor(l / 30)], min: Math.floor((l % 30) * 60) }; };

export function auditReport(report, payload) {
  const issues = [], checked = [];
  const bodies = Object.fromEntries(payload.chart.bodies.map((b) => [b.id, b]));
  const houses = payload.chart.houses;
  const timeKnown = payload.birth.time_precision !== "UNKNOWN";
  for (const r of report.technical_references_used || []) {
    if (r.type === "position") {
      const b = bodies[r.body];
      if (!b) { issues.push({ ref: r, kind: "missing", note: "El cuerpo no figura en la carta calculada." }); continue; }
      const calc = { sign: b.sign, min: Math.floor((b.longitude % 30) * 60), house: b.house };
      const probs = [];
      if (r.sign && r.sign !== calc.sign) probs.push({ field: "sign", report: r.sign, chart: calc.sign });
      else if (r.deg && Math.abs(toMin(r.deg) - calc.min) > 1) probs.push({ field: "deg", report: r.deg, chart: b.position });
      if (r.house != null) {
        if (!timeKnown) probs.push({ field: "house", report: r.house, chart: null, note: "Hora desconocida: no hay casas." });
        else if (r.house !== calc.house) probs.push({ field: "house", report: r.house, chart: calc.house });
      }
      // solo cuenta la sensibilidad horaria del dato que el informe efectivamente usa (signo o casa)
      const unrel = (payload.chart.sensitivity?.unreliable || []).filter((u) => u.item === r.body);
      if (unrel.some((u) => u.field === "sign") || (r.house != null && unrel.some((u) => u.field === "house")))
        probs.push({ field: "reliability", note: "Dato marcado como sensible a la precisión horaria." });
      (probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r));
    } else if (r.type === "angle") {
      if (!houses) { issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay ángulos." }] }); continue; }
      const c = lonToSignMin(r.angle === "ASC" ? houses.asc : houses.mc);
      const probs = [];
      if (r.sign && r.sign !== c.sign) probs.push({ field: "sign", report: r.sign, chart: c.sign });
      else if (r.deg && Math.abs(toMin(r.deg) - c.min) > 1) probs.push({ field: "deg", report: r.deg, chart: `${Math.floor(c.min / 60)}°${String(c.min % 60).padStart(2, "0")}'` });
      (probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r));
    } else if (r.type === "aspect") {
      const a = payload.chart.aspects.find((x) => x.aspect === r.aspect && ((x.a === r.a && x.b === r.b) || (x.a === r.b && x.b === r.a)));
      if (!a) issues.push({ ref: r, problems: [{ field: "aspect", note: `No figura en la carta calculada con la política ${payload.engine.aspect_policy}.` }] });
      else if (a.reliable === false) issues.push({ ref: r, problems: [{ field: "reliability", note: "Aspecto sensible a la precisión horaria." }] });
      else checked.push({ ...r, orb: a.orb });
    }
  }
  return { ok: issues.length === 0, total: checked.length + issues.length, verified: checked.length, issues };
}
