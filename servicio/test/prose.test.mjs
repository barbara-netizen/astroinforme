// Auditoría de la prosa (servicio 2.4): afirmaciones técnicas en el texto, biografía, jerga, vicios de redacción,
// repetición entre informes y mitos repetidos.
import assert from "node:assert/strict";
import { proseAudit, describeProse, fingerprint, crossRepetition, repeatedMyth } from "../../prose_audit.js";
import { avoidRepeatedMyth } from "../src/worker.js";
import { carta, clone } from "./helpers.mjs";

const payload = carta(); // Sol Cáncer casa 9, Luna Aries casa 5, Sol oposición Saturno, Marte junto al DSC
const rep = (...paras) => ({ language: "es", sections: [{ id: "opening", heading: "x", body_markdown: paras.join("\n\n") }], technical_references_used: [] });

// 1. datos correctos en la prosa: sin errores, quedan como no declarados
let a = proseAudit(rep("Tu Sol en Cáncer está en la casa nueve y forma una oposición con Saturno."), payload);
assert.equal(a.claims.errors.length, 0, JSON.stringify(a.claims.errors));
assert.ok(a.claims.checked >= 3);
assert.ok(a.claims.undeclared.length >= 2);

// 2. datos inventados en la prosa: signo, casa y aspecto
a = proseAudit(rep("Tu Sol en Leo marca la identidad. La Luna está en la casa diez. Hay una cuadratura entre Sol y Luna."), payload);
const kinds = a.claims.errors.map((e) => e.kind).sort();
assert.deepEqual(kinds, ["aspect", "house", "sign"]);
assert.ok(a.fix.includes("claims"));
assert.match(describeProse(a), /no coinciden con la carta calculada/);

// 3. ángulos: conjunción con el Descendente equivale a oposición con el Ascendente
a = proseAudit(rep("Marte está junto al Descendente."), payload);
assert.equal(a.claims.errors.length, 0, JSON.stringify(a.claims.errors));
a = proseAudit(rep("Saturno está sobre el Medio Cielo."), payload);
assert.equal(a.claims.errors[0].kind, "angular");

// 4. hora desconocida: casas y ángulos en el texto son error
const sinHora = clone(payload); sinHora.chart.houses = null;
a = proseAudit(rep("Tu Ascendente sugiere una entrada cautelosa."), sinHora);
assert.equal(a.claims.errors[0].kind, "time_unknown");

// 5. biografía: afirmada se marca; modulada o como pregunta, no; en el mito, no
a = proseAudit(rep("Tu padre fue distante y exigente."), payload);
assert.equal(a.biography.length, 1);
a = proseAudit(rep("Quizá la figura de tu padre se haya vivido como exigente. ¿Fue así en tu infancia?"), payload);
assert.equal(a.biography.length, 0);
a = proseAudit({ language: "es", sections: [{ id: "myth", heading: "Mito", body_markdown: "Tu padre te abandona en la isla, dice el relato." }] }, payload);
assert.equal(a.biography.length, 0);

// 6. jerga: un párrafo cargado de términos técnicos pide corrección
a = proseAudit(rep("Sol en Cáncer en casa nueve en oposición a Saturno en Capricornio, con Luna en Aries y Marte junto al Descendente."), payload);
assert.ok(a.jargon.per1000 > 20); assert.ok(!a.fix.includes("jargon")); assert.ok(a.notes.includes("jargon"));

// 7. modismos de texto genérico y «no solo… sino también»
a = proseAudit(rep("No es casualidad que esto pase. En definitiva, de alguna manera es un delicado equilibrio. No solo pensás, sino también sentís."), payload);
assert.ok(a.idioms.length >= 4); assert.ok(a.fix.includes("idioms"));

// 8. enumeraciones parejas sí; incisos con comas, no
a = proseAudit(rep("Te importan el orden, la calma, la constancia y la lealtad."), payload);
assert.equal(a.enumerations.length, 1);
a = proseAudit(rep("Eso te liga con fuerza, y en silencio, a tus raíces y a lo que querés."), payload);
assert.equal(a.enumerations.length, 0);

// 9. repetición dentro del informe: aperturas iguales y frases repetidas
a = proseAudit(rep("Lo que buscás aparece cuando alguien confía en vos.", "Lo que buscás aparece cuando alguien confía en vos.", "Lo que buscás aparece otra vez acá."), payload);
assert.ok(a.within.openings.length >= 1); assert.ok(a.fix.includes("repetition"));

// 10. repetición entre informes: huellas hasheadas
const viejo = rep("Una forma de cuidado que llega antes que el pedido y deja al deseo propio esperando turno detrás de la puerta.");
const prints = [fingerprint(viejo)];
assert.ok(prints[0].every((h) => typeof h === "number"), "la huella no guarda texto");
assert.ok(crossRepetition(viejo, prints).length >= 1);
assert.equal(crossRepetition(rep("Un texto completamente distinto sobre la manera de pedir ayuda cuando nadie mira."), prints).length, 0);

// 11. mitos: coincidencia por nombre propio, y reemplazo por otro considerado sin llamada extra
assert.equal(repeatedMyth("Antígona y su hermana", ["Antígona"]), "Antígona");
assert.equal(repeatedMyth("Eros y Psique", ["Psique y Eros"]), "Psique y Eros");
assert.equal(repeatedMyth("Aretusa y Alfeo", ["Antígona", "Prometeo"]), null);
let an = { mito: { nombre: "Antígona", por_que: "x" }, mitos_considerados: [{ nombre: "Antígona", motivo: "x" }, { nombre: "Alcestis", motivo: "y" }] };
avoidRepeatedMyth(an, ["Antígona"]);
assert.equal(an.mito.nombre, "Alcestis"); assert.equal(an.mito_descartado.nombre, "Antígona");
an = { mito: { nombre: "Prometeo", por_que: "x" }, mitos_considerados: [{ nombre: "Prometeo y Epimeteo", motivo: "x" }] };
avoidRepeatedMyth(an, ["Prometeo"]);
assert.equal(an.mito.nombre, ""); assert.match(an.mito.por_que, /no esté en la lista/);

// 12. recuentos por modalidad o elemento (2.6.1): falso «casi todo en fijos», cierto «solo un cardinal»
{
  const d = { modalities: { FIXED: ["SUN", "MARS", "SATURN", "NEPTUNE", "ASC", "MC"], MUTABLE: ["MOON", "VENUS", "JUPITER", "URANUS", "PLUTO"], CARDINAL: ["MERCURY"] },
    elements: { AIR: ["SUN", "SATURN"], WATER: ["MOON", "JUPITER", "NEPTUNE", "ASC"], FIRE: ["VENUS", "MARS", "MC"], EARTH: ["MERCURY", "URANUS", "PLUTO"] } };
  const p2 = { chart: { bodies: [], aspects: [], derived: d } };
  let b = proseAudit(rep("Casi todo en tu mapa está en signos de constancia."), p2);
  assert.equal(b.claims.errors[0].kind, "count"); assert.ok(b.fix.includes("claims"));
  b = proseAudit(rep("Solo un factor está en signos cardinales, el del pensamiento."), p2);
  assert.equal(b.claims.errors.length, 0);
  b = proseAudit(rep("Hay muy poco aire y muy poca tierra."), p2); // dos familias: no se juzga
  assert.equal(b.claims.errors.length, 0);
}

// 13. plantilla visible: demasiadas preguntas, «otra lectura», «la defensa», «el costo» y cierres técnicos
{
  const many = Array.from({ length: 4 }, (_, i) => `Párrafo ${i}. La defensa más probable es callar. El costo es alto. Otra lectura posible es la contraria. Saturno sostiene esta lectura. ¿Te pasa?`);
  const b = proseAudit(rep(...many), payload);
  assert.ok(b.fix.includes("template")); assert.deepEqual(b.template.over.sort(), ["alternatives", "closers", "costs", "defenses", "questions"]);
  assert.match(describeProse(b), /plantilla/);
  assert.ok(!proseAudit(rep("Una sola pregunta. ¿Te pasa?"), payload).fix.includes("template"));
}

console.log("OK — auditoría de la prosa 2.6.1: 13 grupos");
