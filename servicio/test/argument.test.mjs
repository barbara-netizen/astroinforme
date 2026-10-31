// Pruebas del diseño de auditoría argumental (argument_audit.js). No está conectada al servicio.
import assert from "node:assert/strict";
import { argumentAudit } from "../../argument_audit.js";
import { carta, informeOk } from "./helpers.mjs";

const base = carta();
const rep = (theses) => ({ ...informeOk(), theses });
const SUN_SAT = { type: "aspect", a: "SUN", b: "SATURN", aspect: "OPPOSITION" };
const SAT_CAP = { type: "position", body: "SATURN", sign: "CAPRICORN" };
const STEL = { type: "stellium", by: "SIGN", where: "CAPRICORN" };
const FALSO = { type: "aspect", a: "SUN", b: "MOON", aspect: "CONJUNCTION" };

// sin tesis declaradas: no hay nada que auditar (no es un error)
assert.deepEqual(argumentAudit(informeOk(), base), { declared: false, theses: [], ok: null });

// tesis central con dos indicadores verificados
let a = argumentAudit(rep([{ id: "t1", central: true, sections: ["opening"], indicators: [SUN_SAT, SAT_CAP, STEL] }]), base);
assert.equal(a.ok, true); assert.equal(a.theses[0].status, "supported"); assert.equal(a.theses[0].verified, 3);

// el mismo indicador repetido no cuenta dos veces
a = argumentAudit(rep([{ id: "t1", central: true, indicators: [SUN_SAT, { ...SUN_SAT }] }]), base);
assert.equal(a.theses[0].status, "single_indicator"); assert.equal(a.ok, false);

// un indicador falso no suma; se informa
a = argumentAudit(rep([{ id: "t1", central: true, indicators: [SUN_SAT, FALSO] }]), base);
assert.equal(a.theses[0].status, "single_indicator"); assert.deepEqual(a.theses[0].failed, ["SUN CONJUNCTION MOON"]);

// sin indicadores válidos
a = argumentAudit(rep([{ id: "t1", central: true, indicators: [FALSO] }]), base);
assert.equal(a.theses[0].status, "unsupported");

// una tesis no central con un solo indicador no hace fallar el conjunto
a = argumentAudit(rep([{ id: "t1", central: true, indicators: [SUN_SAT, STEL] }, { id: "t2", central: false, indicators: [SAT_CAP] }]), base);
assert.equal(a.ok, true); assert.equal(a.theses[1].status, "single_indicator");

// secciones inexistentes se informan
a = argumentAudit(rep([{ id: "t1", central: true, sections: ["opening", "nada"], indicators: [SUN_SAT, STEL] }]), base);
assert.deepEqual(a.theses[0].missing_sections, ["nada"]);

console.log("OK — auditoría argumental (diseño): 7 casos");
