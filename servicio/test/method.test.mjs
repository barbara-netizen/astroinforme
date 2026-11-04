// Método 1.9: datos estructurales, mitos recientes y auditoría argumental.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePayload } from "../src/validate.js";
import { PROMPT_ANALISIS, PROMPT_INFORME, IDIOMA, TRATAMIENTO } from "../src/prompts.js";
import { styleCheck } from "../src/style.js";
import { normalizeReferences } from "../src/worker.js";

const carta = JSON.parse(readFileSync(new URL("./carta-prueba.json", import.meta.url)));
carta.chart.derived.structure = { connected_groups: [["SUN", "MOON"]], bridges: [{ a: "SUN", b: "MOON", aspect: "TRINE" }], aspect_counts: { TENSION: 1, FLOWING: 1 }, closest_aspects: [{ a: "SUN", b: "MOON", aspect: "TRINE", orb_class: "TIGHT" }] };
const n = normalizePayload(carta);
assert.ok(n.ok);
assert.deepEqual(n.payload.chart.derived.structure.aspect_counts, { TENSION: 1, FLOWING: 1, ADJUSTMENT: 0, CONJUNCTION: 0 });
assert.ok(PROMPT_ANALISIS("{}", ["Alcestis"]).includes("Alcestis"));
assert.ok(!PROMPT_ANALISIS("{}").includes("Mitos usados recientemente"));
assert.ok(PROMPT_INFORME({ idioma: IDIOMA.es, lang: "es", nombre: "", tratamiento: TRATAMIENTO.UNSPECIFIED, analisis: "{}", carta: "{}" }).includes('"theses"'));
const s = styleCheck({ language: "es", sections: [{ heading: "x", body_markdown: "Quizá reconozcas esta escena." }] });
assert.equal(s.issues[0].kind, "cliche");
const refs = normalizeReferences({ technical_references_used: [{ type: "rulership", of: "2", ruler: "VENUS" }, { type: "stellium", by: "HOUSE", where: "4", bodies: [] }, { type: "rulership", of: "ASC", ruler: "MARS" }] }).technical_references_used;
assert.deepEqual([refs[0].of, refs[1].where, refs[2].of], [2, 4, "ASC"]);
// con hora desconocida no se afirma la exactitud de los aspectos de la Luna
assert.ok(PROMPT_ANALISIS("{}").includes("no la cuentes entre los aspectos más cerrados"));
assert.ok(PROMPT_INFORME({ idioma: IDIOMA.es, lang: "es", nombre: "", tratamiento: TRATAMIENTO.UNSPECIFIED, analisis: "{}", carta: "{}" }).includes("aspecto de la Luna es cerrado"));
console.log("método 1.9: ok");
