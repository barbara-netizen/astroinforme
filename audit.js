// ASTROINFORME — auditoría técnica de un informe (autónoma, en el navegador y en el servicio).
// Compara cada referencia técnica DECLARADA por el informe (technical_references_used) con la carta calculada.
// No confía en la auditoría que trae el informe: la rehace siempre.
//
// Alcance (importante para no sobreprometer):
// - Verifica solo lo que el informe declara en technical_references_used. Una afirmación técnica que esté en la
//   prosa y no en esa lista no se verifica. Como control complementario, se buscan en el texto las expresiones de
//   grado («21°50'») y se informan las que no corresponden a ninguna referencia declarada (undeclared_degrees).
// - Tipos verificables: position, angle, aspect, configuration, rulership (ángulos, casas angulares y dispositores),
//   stellium y distribution (elementos y modalidades). Cada uno se compara con datos que el motor calcula de forma
//   determinista y, cuando corresponde, con la sensibilidad a la precisión horaria (chart.sensitivity).
// - Lo declarado que no se puede verificar de forma inequívoca (tipo desconocido, regente de una casa no angular,
//   referencia vacía) no se cuenta como verificado ni como error: queda en «unchecked».

const SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
const ELEMENT = ["FIRE", "EARTH", "AIR", "WATER"];
const MODALITY = ["CARDINAL", "FIXED", "MUTABLE"];
const ANGLE_OF_HOUSE = { 1: "ASC", 4: "IC", 7: "DSC", 10: "MC" };
const toMin = (deg) => { const m = String(deg).match(/(\d+)°\s*(\d+)'/); return m ? +m[1] * 60 + +m[2] : null; };
const lonToSignMin = (lon) => { const l = ((lon % 360) + 360) % 360; return { sign: SIGNS[Math.floor(l / 30)], min: Math.floor((l % 30) * 60) }; };
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const subset = (a, b) => a.every((x) => b.includes(x));
const fmtMin = (min) => `${Math.floor(min / 60)}°${String(min % 60).padStart(2, "0")}'`;

/** Integrantes de una configuración calculada. */
function membersOf(c) {
  if (c.type === "T_SQUARE") return [c.apex, ...c.opposition];
  if (c.type === "YOD") return [c.apex, ...c.base];
  return c.bodies || [];
}

/** Descripción técnica breve de una referencia (para la fase de corrección y los registros). */
export function refText(r) {
  switch (r && r.type) {
    case "position": return `${r.body} ${r.sign || ""} ${r.deg || ""}${r.house != null ? " casa " + r.house : ""}`.replace(/\s+/g, " ").trim();
    case "angle": return `${r.angle} ${r.sign || ""} ${r.deg || ""}`.trim();
    case "aspect": return `${r.a} ${r.aspect} ${r.b}`;
    case "configuration": return `${r.configuration} ${[r.apex, ...(r.opposition || r.base || r.bodies || [])].filter(Boolean).join(", ")}`;
    case "rulership": return `regente de ${r.of}: ${r.ruler}`;
    case "stellium": return `stellium en ${r.by === "HOUSE" ? "casa " : ""}${r.where}${r.bodies ? " (" + r.bodies.join(", ") + ")" : ""}`;
    case "distribution": return `${r.group} ${r.key}${r.count != null ? ": " + r.count : ""}${r.bodies ? " (" + r.bodies.join(", ") + ")" : ""}`;
    default: return JSON.stringify(r);
  }
}

export function auditReport(report, payload) {
  const issues = [], checked = [], unchecked = [];
  const chart = payload.chart;
  const bodies = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  // el Nodo Sur viene aparte en el contrato (chart.south_node)
  const sn = chart.south_node;
  if (sn && !bodies.SOUTH_NODE) bodies.SOUTH_NODE = { id: "SOUTH_NODE", sign: sn.sign, longitude: sn.lon ?? sn.longitude, position: sn.deg ?? sn.position, house: sn.house };
  const houses = chart.houses;
  const derived = chart.derived || {};
  const timeKnown = payload.birth.time_precision !== "UNKNOWN";
  const unrel = (chart.sensitivity && chart.sensitivity.unreliable) || [];
  const signUnrel = (id) => unrel.some((u) => u.item === id && u.field === "sign");
  const houseUnrel = (id) => unrel.some((u) => u.item === id && u.field === "house");
  const findAspect = (a, b, type) => chart.aspects.find((x) => (!type || x.aspect === type) && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  const refs = Array.isArray(report.technical_references_used) ? report.technical_references_used : [];
  const declaredMinutes = new Set();

  for (const r of refs) {
    if (!r || typeof r !== "object") { unchecked.push({ ref: r, reason: "not_an_object" }); continue; }
    if (r.type === "position") {
      const b = bodies[r.body];
      if (!b) { issues.push({ ref: r, kind: "missing", note: "El cuerpo no figura en la carta calculada." }); continue; }
      if (!r.sign && !r.deg && r.house == null) { unchecked.push({ ref: r, reason: "empty" }); continue; }
      const calc = { sign: b.sign, min: Math.floor((b.longitude % 30) * 60), house: b.house };
      const probs = [];
      if (r.deg) { const m = toMin(r.deg); if (m != null) declaredMinutes.add(m); }
      if (r.sign && r.sign !== calc.sign) probs.push({ field: "sign", report: r.sign, chart: calc.sign });
      else if (r.deg && toMin(r.deg) == null) probs.push({ field: "format", report: r.deg });
      else if (r.deg && Math.abs(toMin(r.deg) - calc.min) > 1) probs.push({ field: "deg", report: r.deg, chart: b.position });
      if (r.house != null) {
        if (!timeKnown) probs.push({ field: "house", report: r.house, chart: null, note: "Hora desconocida: no hay casas." });
        else if (r.house !== calc.house) probs.push({ field: "house", report: r.house, chart: calc.house });
      }
      // sensibilidad horaria: igual que en la versión 1.4 (el signo se marca siempre; la casa, solo si el informe la usa)
      if (signUnrel(r.body) || (r.house != null && houseUnrel(r.body)))
        probs.push({ field: "reliability", note: "Dato marcado como sensible a la precisión horaria." });
      (probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r));
    } else if (r.type === "angle") {
      if (!houses) { issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay ángulos." }] }); continue; }
      const base = { ASC: houses.asc, DSC: houses.asc + 180, MC: houses.mc, IC: houses.mc + 180 }[r.angle];
      if (base == null) { issues.push({ ref: r, problems: [{ field: "angle", note: "Ángulo desconocido." }] }); continue; }
      const c = lonToSignMin(base);
      if (r.deg) { const m = toMin(r.deg); if (m != null) declaredMinutes.add(m); }
      const probs = [];
      if (r.sign && r.sign !== c.sign) probs.push({ field: "sign", report: r.sign, chart: c.sign });
      else if (r.deg && toMin(r.deg) == null) probs.push({ field: "format", report: r.deg });
      else if (r.deg && Math.abs(toMin(r.deg) - c.min) > 1) probs.push({ field: "deg", report: r.deg, chart: fmtMin(c.min) });
      const axis = r.angle === "ASC" || r.angle === "DSC" ? "ASC" : "MC";
      if (r.sign && signUnrel(axis)) probs.push({ field: "reliability", note: "Signo del ángulo sensible a la precisión horaria." });
      (probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r));
    } else if (r.type === "aspect") {
      const a = findAspect(r.a, r.b, r.aspect);
      if (!a) issues.push({ ref: r, problems: [{ field: "aspect", note: `No figura en la carta calculada con la política ${payload.engine.aspect_policy}.` }] });
      else if (a.reliable === false) issues.push({ ref: r, problems: [{ field: "reliability", note: "Aspecto sensible a la precisión horaria." }] });
      else checked.push({ ...r, orb: a.orb });
    } else if (r.type === "configuration") {
      const named = [r.apex, ...(r.opposition || r.base || r.bodies || [])].filter(Boolean);
      const found = (derived.configurations || []).find((c) => c.type === r.configuration && sameSet(membersOf(c), [...new Set(named)]) && (!r.apex || r.apex === c.apex));
      if (!found) { issues.push({ ref: r, problems: [{ field: "configuration", note: "La configuración no figura en la carta calculada." }] }); continue; }
      // la configuración depende de sus aspectos: si alguno es sensible a la hora, la configuración también
      const m = membersOf(found), weak = [];
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) { const a = findAspect(m[i], m[j]); if (a && a.reliable === false) weak.push(a); }
      (weak.length ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Alguno de sus aspectos es sensible a la precisión horaria." }] }) : checked.push(r));
    } else if (r.type === "rulership") {
      const of = typeof r.of === "number" && ANGLE_OF_HOUSE[r.of] ? ANGLE_OF_HOUSE[r.of] : r.of;
      if (["ASC", "DSC", "MC", "IC"].includes(of)) {
        if (!houses || !derived.angle_rulers) { issues.push({ ref: r, problems: [{ field: "angle", note: "Hora desconocida: no hay ángulos." }] }); continue; }
        const ar = derived.angle_rulers[of];
        if (!ar || (r.ruler !== ar.ruler && r.ruler !== ar.traditional_coregent)) { issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: ar ? ar.ruler : null }] }); continue; }
        (signUnrel(of === "ASC" || of === "DSC" ? "ASC" : "MC") ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Signo del ángulo sensible a la precisión horaria." }] }) : checked.push(r));
      } else if (typeof r.of === "number") {
        // casas no angulares: el valor se compara, pero el motor no calcula la sensibilidad horaria de esas cúspides
        const hr = (derived.house_rulers || []).find((h) => h.house === r.of);
        if (!hr) { issues.push({ ref: r, problems: [{ field: "house", report: r.of, chart: null, note: "Hora desconocida: no hay casas." }] }); continue; }
        if (r.ruler !== hr.ruler && r.ruler !== hr.traditional_coregent) { issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: hr.ruler }] }); continue; }
        unchecked.push({ ref: r, reason: "cusp_sensitivity_not_computed" });
      } else if (derived.dispositors && derived.dispositors[of]) {
        const d = derived.dispositors[of];
        if (r.ruler !== d.ruler && r.ruler !== d.traditional_coregent) { issues.push({ ref: r, problems: [{ field: "ruler", report: r.ruler, chart: d.ruler }] }); continue; }
        (signUnrel(of) ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Signo del planeta sensible a la precisión horaria." }] }) : checked.push(r));
      } else issues.push({ ref: r, kind: "missing", note: "El punto no figura en la carta calculada." });
    } else if (r.type === "stellium") {
      if (r.by === "HOUSE" && !timeKnown) { issues.push({ ref: r, problems: [{ field: "house", report: r.where, chart: null, note: "Hora desconocida: no hay casas." }] }); continue; }
      const st = (derived.stelliums || []).find((s) => s.by === r.by && s.where === r.where);
      if (!st || (r.bodies && !subset(r.bodies, st.bodies))) { issues.push({ ref: r, problems: [{ field: "stellium", note: "El stellium no figura en la carta calculada." }] }); continue; }
      const weak = r.by === "HOUSE" ? houseUnrel : signUnrel;
      const firm = st.bodies.filter((id) => !weak(id));
      (firm.length < 3 || (r.bodies || []).some(weak)
        ? issues.push({ ref: r, problems: [{ field: "reliability", note: "Integrantes sensibles a la precisión horaria." }] }) : checked.push(r));
    } else if (r.type === "distribution") {
      const table = r.group === "ELEMENT" ? derived.elements : r.group === "MODALITY" ? derived.modalities : null;
      if (!table || !table[r.key]) { issues.push({ ref: r, kind: "missing", note: "Grupo desconocido." }); continue; }
      if (r.count == null && !r.bodies) { unchecked.push({ ref: r, reason: "empty" }); continue; }
      const members = table[r.key], probs = [];
      if (r.count != null && r.count !== members.length) probs.push({ field: "count", report: r.count, chart: members.length });
      if (r.bodies && !subset(r.bodies, members)) probs.push({ field: "group", report: r.bodies.filter((b) => !members.includes(b)).join(", "), chart: members.join(", ") });
      if (!probs.length) {
        // un recuento es sensible si algún punto puede cambiar a otro signo que entra o sale de este grupo
        const groupOf = (sign) => { const i = SIGNS.indexOf(sign); return r.group === "ELEMENT" ? ELEMENT[i % 4] : MODALITY[i % 3]; };
        const moving = unrel.filter((u) => u.field === "sign" && Array.isArray(u.alternatives) && u.alternatives.some((s) => groupOf(s) === r.key) && !u.alternatives.every((s) => groupOf(s) === r.key));
        if ((r.count != null && moving.length) || (r.bodies || []).some((b) => moving.some((u) => u.item === b))) probs.push({ field: "reliability", note: "Recuento sensible a la precisión horaria." });
      }
      (probs.length ? issues.push({ ref: r, problems: probs }) : checked.push(r));
    } else {
      unchecked.push({ ref: r, reason: "unknown_type" });
    }
  }

  // control complementario: grados escritos en el texto que no corresponden a ninguna referencia declarada
  const undeclared = [];
  for (const s of Array.isArray(report.sections) ? report.sections : []) {
    for (const m of String((s && s.body_markdown) || "").matchAll(/(\d{1,2})\s?°\s?(\d{1,2})\s?['′]/g)) {
      const min = +m[1] * 60 + +m[2];
      if (![...declaredMinutes].some((d) => Math.abs(d - min) <= 1)) undeclared.push({ section: s.id, text: m[0] });
    }
  }

  return {
    ok: issues.length === 0, scope: "declared_references",
    declared: refs.length, total: checked.length + issues.length, verified: checked.length,
    issues, unchecked, undeclared_degrees: undeclared,
  };
}
