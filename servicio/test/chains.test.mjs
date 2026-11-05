// Servicio 2.3: recorrido de regencias y comprobación de alcance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rulerChains } from "../src/chains.js";
import { normalizePayload } from "../src/validate.js";
import { PROMPT_ANALISIS, PROMPT_INFORME, IDIOMA, TRATAMIENTO } from "../src/prompts.js";

const cuerpos = (o) => Object.entries(o).map(([id, sign]) => ({ id, sign }));
const casas = (asc, ic, dsc, mc) => { const cusps = Array.from({ length: 12 }, () => ({ sign: "ARIES" })); cusps[0].sign = asc; cusps[3].sign = ic; cusps[6].sign = dsc; cusps[9].sign = mc; return { cusps }; };

// La carta del 13-9-1960: el caso que originó esta regla.
const r = rulerChains(cuerpos({ SUN: "VIRGO", MOON: "CANCER", MERCURY: "LIBRA", VENUS: "LIBRA", MARS: "GEMINI", JUPITER: "SAGITTARIUS", SATURN: "CAPRICORN", URANUS: "LEO", NEPTUNE: "SCORPIO", PLUTO: "VIRGO", CHIRON: "AQUARIUS" }), casas("ARIES", "CANCER", "LIBRA", "CAPRICORN"));
assert.deepEqual(r.points.ASC, ["ASC", "MARS", "MERCURY", "VENUS"]);
assert.deepEqual(r.points.URANUS, ["URANUS", "SUN", "MERCURY", "VENUS"]);
assert.deepEqual(r.points.JUPITER, ["JUPITER"]);
assert.deepEqual(r.points.NEPTUNE, ["NEPTUNE", "PLUTO", "MERCURY", "VENUS"]);
assert.deepEqual(r.points.CHIRON, ["CHIRON", "URANUS", "SUN", "MERCURY", "VENUS"]);
const enVenus = r.groups.find((g) => g.ends_in[0] === "VENUS").points;
assert.ok(["ASC", "URANUS", "SUN", "MARS", "PLUTO"].every((p) => enVenus.includes(p)));
assert.ok(!enVenus.includes("JUPITER"));

// Ciclo de dos planetas (recepción mutua) y un punto que entra desde afuera.
const ciclo = rulerChains(cuerpos({ SUN: "GEMINI", MOON: "LEO", MERCURY: "ARIES", VENUS: "ARIES", MARS: "GEMINI", JUPITER: "PISCES", SATURN: "PISCES", URANUS: "PISCES", NEPTUNE: "PISCES", PLUTO: "PISCES" }), null);
assert.deepEqual(ciclo.points.SUN, ["SUN", "MERCURY", "MARS"]);
const g = ciclo.groups.find((x) => x.kind === "CYCLE");
assert.deepEqual(g.ends_in, ["MARS", "MERCURY"]);
assert.ok(["SUN", "MARS", "MERCURY"].every((p) => g.points.includes(p))); // mismo final desde cualquier miembro
assert.ok(ciclo.groups.find((x) => x.ends_in[0] === "NEPTUNE" && x.kind === "DOMICILE").points.includes("JUPITER"));
assert.equal(ciclo.points.ASC, undefined); // sin hora no hay ángulos

// Signo dudoso: invalida todo recorrido que pase por él, y el eje acompaña a su ángulo.
const duda = rulerChains(cuerpos({ SUN: "VIRGO", MOON: "CANCER", MERCURY: "LIBRA", VENUS: "LIBRA", MARS: "GEMINI", JUPITER: "SAGITTARIUS", SATURN: "CAPRICORN", URANUS: "LEO", NEPTUNE: "SCORPIO", PLUTO: "VIRGO" }), casas("ARIES", "CANCER", "LIBRA", "CAPRICORN"), [{ item: "MARS", field: "sign" }, { item: "ASC", field: "sign" }, { item: "VENUS", field: "house" }]);
assert.ok(duda.unreliable.includes("MARS"));
assert.ok(duda.unreliable.includes("DSC"));
assert.ok(duda.unreliable.includes("ASC"));
assert.ok(!duda.unreliable.includes("SUN")); // el dato de casa no cambia regencias

// Integrado: siempre lo calcula el servicio, y lo enviado por el cliente se ignora.
const carta = JSON.parse(readFileSync(new URL("./carta-prueba.json", import.meta.url)));
carta.chart.derived.ruler_chains = { rulership: "FALSO", points: { SUN: ["indicación libre"] } };
const n = normalizePayload(carta);
assert.ok(n.ok);
const rc = n.payload.chart.derived.ruler_chains;
assert.equal(rc.rulership, "MODERN");
assert.deepEqual(rc.points.SUN, ["SUN", "MOON", "MARS", "VENUS", "MERCURY"]); // ciclo de cinco
assert.equal(rc.groups[0].kind, "CYCLE");
assert.deepEqual(rc.points.ASC, ["ASC", "PLUTO"]);
assert.deepEqual(normalizePayload(n.payload).payload.chart.derived.ruler_chains, rc); // se puede renormalizar
assert.ok(JSON.stringify(rc).length < 1200);

// La regla llega a las dos fases y solo la redacción compara secciones.
const a = PROMPT_ANALISIS("{}"), b = PROMPT_INFORME({ idioma: IDIOMA.es, lang: "es", nombre: "", tratamiento: TRATAMIENTO.UNSPECIFIED, analisis: "{}", carta: "{}" });
for (const t of [a, b]) { assert.ok(t.includes("Comprobación de alcance")); assert.ok(t.includes("ruler_chains")); }
assert.ok(b.includes("la apertura, los recursos y la síntesis"));
assert.ok(!a.includes("la apertura, los recursos y la síntesis"));
console.log("OK — recorrido de regencias 2.3");
