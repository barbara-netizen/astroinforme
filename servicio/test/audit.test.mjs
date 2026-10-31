// Pruebas de audit.js (la misma auditoría que usan la app y el servicio): tipos nuevos de 1.5, positivos y negativos.
import assert from "node:assert/strict";
import { auditReport } from "../../audit.js";
import { carta, informeOk, clone } from "./helpers.mjs";

const base = carta();
let n = 0; const group = () => { n++; };
const one = (ref, payload = base, sections = []) => auditReport({ technical_references_used: [ref], sections }, payload);
const pass = (ref, payload, msg) => { const a = one(ref, payload); assert.equal(a.ok, true, msg || JSON.stringify(a.issues)); assert.equal(a.verified, 1, msg); assert.equal(a.unchecked.length, 0, msg); };
const fail = (ref, field, payload, msg) => { const a = one(ref, payload); assert.equal(a.ok, false, msg || JSON.stringify(ref)); const f = (a.issues[0].problems || [a.issues[0]]).map((p) => p.field || p.kind); if (field) assert.ok(f.includes(field), `${msg || ""} ${JSON.stringify(f)}`); };
const withUnrel = (...items) => { const c = clone(base); c.chart.sensitivity.unreliable.push(...items); return c; };

group("compatibilidad: el informe de prueba da lo mismo que en 1.4");
{
  const a = auditReport(informeOk(), base);
  assert.equal(a.ok, true); assert.equal(a.verified, 6); assert.equal(a.total, 6); assert.equal(a.declared, 6); assert.equal(a.scope, "declared_references");
}

group("tipos desconocidos: no se cuentan como verificados ni desaparecen");
{
  const a = auditReport({ technical_references_used: [{ type: "angular", body: "MARS", angle: "DSC" }, { type: "midpoint", a: "SUN", b: "MOON" }, null], sections: [] }, base);
  assert.equal(a.ok, true); assert.equal(a.total, 0); assert.equal(a.verified, 0); assert.equal(a.declared, 3); assert.equal(a.unchecked.length, 3);
  assert.equal(one({ type: "position", body: "SUN" }).unchecked[0].reason, "empty");
}

group("grado mal escrito");
{
  const c = clone(base); const b = c.chart.bodies.find((x) => x.id === "SUN"); b.longitude = 90.005; b.sign = "CANCER";
  fail({ type: "position", body: "SUN", deg: "cero grados" }, "format", c);
  pass({ type: "position", body: "SUN", deg: "0°00'" }, c);
}

group("ángulo con signo sensible a la hora (antes pasaba)");
{
  pass({ type: "angle", angle: "ASC", sign: "SCORPIO", deg: "5°37'" });
  fail({ type: "angle", angle: "ASC", sign: "SCORPIO" }, "reliability", withUnrel({ item: "ASC", field: "sign", alternatives: ["SCORPIO", "LIBRA"] }));
  fail({ type: "angle", angle: "DSC", sign: "TAURUS" }, "reliability", withUnrel({ item: "ASC", field: "sign", alternatives: ["SCORPIO", "LIBRA"] }));
  pass({ type: "angle", angle: "MC", sign: "LEO" }, withUnrel({ item: "ASC", field: "sign", alternatives: ["SCORPIO", "LIBRA"] }));
}

group("configuration");
{
  pass({ type: "configuration", configuration: "T_SQUARE", apex: "MERCURY", opposition: ["MARS", "ASC"] });
  pass({ type: "configuration", configuration: "T_SQUARE", bodies: ["ASC", "MARS", "MERCURY"] }, base, "sin ápice explícito");
  fail({ type: "configuration", configuration: "T_SQUARE", apex: "MARS", opposition: ["MERCURY", "ASC"] }, "configuration", base, "ápice equivocado");
  fail({ type: "configuration", configuration: "GRAND_TRINE", bodies: ["SUN", "MOON", "PLUTO"] }, "configuration");
  fail({ type: "configuration", configuration: "YOD", apex: "MERCURY", base: ["MARS", "ASC"] }, "configuration");
  const c = clone(base); c.chart.aspects.find((a) => a.aspect === "SQUARE" && [a.a, a.b].includes("MERCURY") && [a.a, a.b].includes("MARS")).reliable = false;
  fail({ type: "configuration", configuration: "T_SQUARE", apex: "MERCURY", opposition: ["MARS", "ASC"] }, "reliability", c);
}

group("rulership: ángulos, casas angulares, dispositores; casas no angulares quedan sin verificar");
{
  pass({ type: "rulership", of: "ASC", ruler: "PLUTO" });
  pass({ type: "rulership", of: "ASC", ruler: "MARS" }, base, "co-regente tradicional");
  pass({ type: "rulership", of: 7, ruler: "VENUS" });
  pass({ type: "rulership", of: "IC", ruler: "URANUS" });
  pass({ type: "rulership", of: "SUN", ruler: "MOON" });
  fail({ type: "rulership", of: "ASC", ruler: "VENUS" }, "ruler");
  fail({ type: "rulership", of: 10, ruler: "MOON" }, "ruler");
  fail({ type: "rulership", of: "SUN", ruler: "SATURN" }, "ruler");
  fail({ type: "rulership", of: "VULCAN", ruler: "SUN" }, "missing");
  fail({ type: "rulership", of: "ASC", ruler: "PLUTO" }, "reliability", withUnrel({ item: "ASC", field: "sign", alternatives: ["SCORPIO", "LIBRA"] }));
  fail({ type: "rulership", of: "SUN", ruler: "MOON" }, "reliability", withUnrel({ item: "SUN", field: "sign", alternatives: ["CANCER", "LEO"] }));
  let a = one({ type: "rulership", of: 2, ruler: "JUPITER" });
  assert.equal(a.ok, true); assert.equal(a.verified, 0); assert.equal(a.unchecked[0].reason, "cusp_sensitivity_not_computed");
  fail({ type: "rulership", of: 2, ruler: "SATURN" }, "ruler", base, "valor equivocado en casa no angular sí es error");
  const u = clone(base); u.birth.time_precision = "UNKNOWN"; u.chart.houses = null; delete u.chart.derived.angle_rulers; delete u.chart.derived.house_rulers;
  fail({ type: "rulership", of: "ASC", ruler: "PLUTO" }, "angle", u);
}

group("stellium");
{
  pass({ type: "stellium", by: "SIGN", where: "CAPRICORN" });
  pass({ type: "stellium", by: "SIGN", where: "CAPRICORN", bodies: ["SATURN", "NEPTUNE"] });
  pass({ type: "stellium", by: "HOUSE", where: 9, bodies: ["SUN", "MERCURY", "JUPITER"] });
  fail({ type: "stellium", by: "SIGN", where: "LEO" }, "stellium");
  fail({ type: "stellium", by: "HOUSE", where: 3 }, "stellium");
  fail({ type: "stellium", by: "SIGN", where: "CAPRICORN", bodies: ["SATURN", "PLUTO"] }, "stellium");
  fail({ type: "stellium", by: "HOUSE", where: 9 }, "reliability", withUnrel({ item: "SUN", field: "house", alternatives: [9, 10] }));
  // la casa de Urano es sensible, pero no integra el stellium por casa: no afecta
  pass({ type: "stellium", by: "HOUSE", where: 9 });
  const u = clone(base); u.birth.time_precision = "UNKNOWN";
  fail({ type: "stellium", by: "HOUSE", where: 9 }, "house", u);
}

group("distribution (elementos y modalidades)");
{
  pass({ type: "distribution", group: "ELEMENT", key: "EARTH", count: 4 });
  pass({ type: "distribution", group: "ELEMENT", key: "EARTH", bodies: ["SATURN", "URANUS"] });
  pass({ type: "distribution", group: "MODALITY", key: "MUTABLE", count: 1, bodies: ["VENUS"] });
  fail({ type: "distribution", group: "ELEMENT", key: "EARTH", count: 5 }, "count");
  fail({ type: "distribution", group: "ELEMENT", key: "EARTH", bodies: ["SUN"] }, "group");
  fail({ type: "distribution", group: "ELEMENT", key: "ETHER", count: 1 }, "missing");
  // la Luna podría pasar de Aries a Tauro: cambia el recuento de tierra y de fuego, no el de agua
  const m = withUnrel({ item: "MOON", field: "sign", alternatives: ["ARIES", "TAURUS"] });
  fail({ type: "distribution", group: "ELEMENT", key: "EARTH", count: 4 }, "reliability", m);
  fail({ type: "distribution", group: "ELEMENT", key: "FIRE", count: 3 }, "reliability", m);
  pass({ type: "distribution", group: "ELEMENT", key: "WATER", count: 4 }, m);
  assert.equal(one({ type: "distribution", group: "ELEMENT", key: "EARTH" }).unchecked[0].reason, "empty");
}

group("grados en el texto que no están declarados");
{
  const refs = [{ type: "position", body: "SATURN", sign: "CAPRICORN", deg: "22°02'" }];
  const a = auditReport({ technical_references_used: refs, sections: [{ id: "saturn", body_markdown: "Saturno a 22°02' de Capricornio. Otro planeta a 13° 13' y un ángulo a 5°37′." }] }, base);
  assert.equal(a.ok, true, "es un control informativo: no bloquea");
  assert.deepEqual(a.undeclared_degrees.map((u) => u.text), ["13° 13'", "5°37′"]);
}

console.log(`OK — ${n} grupos de pruebas de auditoría técnica`);
