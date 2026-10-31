// ASTROINFORME — validación y normalización de la carta que recibe el servicio.
//
// El endpoint es público: cualquiera puede enviarle un JSON fabricado fuera de la app. Por eso el servicio
// no reenvía lo que recibe: reconstruye la carta campo por campo con una lista blanca (identificadores,
// enums, rangos y topes de tamaño) y descarta todo lo demás. Lo que no pasa la validación se rechaza.
// Nada de lo que sale de acá puede contener texto libre, salvo el nombre de pila, que tiene su propio control.
// La fecha, la hora, el lugar, la zona y el día juliano nunca forman parte del resultado.

const SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
const CORE = ["SUN", "MOON", "MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE", "PLUTO"];
const BODY_IDS = [...CORE, "CHIRON", "NORTH_NODE"];
const ANGLES = ["ASC", "DSC", "MC", "IC"];
const POINT_IDS = [...BODY_IDS, "ASC", "MC"];
const ASPECTS = ["CONJUNCTION", "OPPOSITION", "SQUARE", "TRINE", "SEXTILE", "QUINCUNX"];
const PRECISIONS = { EXACT: "±4 min", PM15: "±15 min", PM30: "±30 min", PM60: "±60 min", UNKNOWN: "unknown" };
const LANGS = { es: "voseo", de: "du", en: "you" };
const GENDERS = ["FEMININE", "MASCULINE", "NEUTRAL", "UNSPECIFIED"];
const WARNINGS = ["PRE_1970_TZ", "AMBIGUOUS_LOCAL_TIME", "MANUAL_OFFSET", "MANUAL_COORDS", "PLACIDUS_FAILED", "UNKNOWN_TIME", "TIME_SENSITIVE"];
const PHASES = ["NEW", "CRESCENT", "FIRST_QUARTER", "GIBBOUS", "FULL", "DISSEMINATING", "LAST_QUARTER", "BALSAMIC"];
const CONFIG_TYPES = ["T_SQUARE", "GRAND_TRINE", "YOD", "GRAND_CROSS"];
const SENS_NOTES = ["podría entrar en orbe", "podría salir de orbe"];
const ID_RE = /^[A-Za-z0-9._-]{1,30}$/;
const DEG_RE = /^(\d{1,2})°(\d{2})'(?:(\d{2})")?$/;

export const LIMITS = { name: 40, nameWords: 3, aspects: 150, configurations: 40, stelliums: 20, unreliable: 120, warnings: 10 };

class Invalid extends Error { constructor(where) { super(where); this.where = where; } }
const fail = (where) => { throw new Invalid(where); };
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const obj = (x, where) => (isObj(x) ? x : fail(where));
const arr = (x, max, where) => (Array.isArray(x) && x.length <= max ? x : fail(where));
const num = (x, min, max, where) => (typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : fail(where));
const bool = (x, where) => (typeof x === "boolean" ? x : fail(where));
const oneOf = (x, list, where) => (list.includes(x) ? x : fail(where));
const optOneOf = (x, list, where) => (x == null ? null : oneOf(x, list, where));
const house = (x, where) => (Number.isInteger(x) && x >= 1 && x <= 12 ? x : fail(where));
const optHouse = (x, where) => (x == null ? null : house(x, where));
const ids = (x, list, max, where) => arr(x, max, where).map((v) => oneOf(v, list, where));
const signOf = (lon) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];

/** «12°34'56"» debe corresponder a la longitud (tolerancia de un minuto, por el redondeo de los segundos). */
function degString(s, lon, where) {
  const m = typeof s === "string" ? s.match(DEG_RE) : null;
  if (!m || +m[1] > 30 || +m[2] > 59) fail(where);
  const inSign = ((((lon % 360) + 360) % 360) % 30) * 60;
  const said = +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
  if (Math.abs(said - inSign) > 1.01 && Math.abs(said - inSign) < 1800 - 1.01) fail(where);
  return s;
}

/** Nombre de pila: una o pocas palabras, solo letras (cualquier alfabeto), espacios, apóstrofo, punto o guion. */
export function normalizeFirstName(x) {
  if (x == null || x === "") return null;
  if (typeof x !== "string") return undefined;
  // una sola línea: saltos, tabulaciones y caracteres de control se rechazan (no se «arreglan»)
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(x)) return undefined;
  const s = x.normalize("NFC").replace(/ +/g, " ").trim();
  if (!s) return null;
  if (s.length > LIMITS.name || s.split(" ").length > LIMITS.nameWords) return undefined;
  if (!/^[\p{L}\p{M}]+(?:[ '’.-]{1,2}[\p{L}\p{M}]+)*\.?$/u.test(s)) return undefined;
  return s;
}

function normBody(b, timeKnown) {
  obj(b, "body");
  const id = oneOf(b.id, BODY_IDS, "body.id");
  const longitude = num(b.longitude, 0, 360, "body.longitude") % 360;
  const sign = oneOf(b.sign, SIGNS, "body.sign");
  if (sign !== signOf(longitude)) fail("body.sign≠longitude");
  return {
    id, longitude, sign, position: degString(b.position, longitude, "body.position"),
    house: timeKnown ? house(b.house, "body.house") : (b.house == null ? null : fail("body.house")),
    speed: num(b.speed, -30, 30, "body.speed"), retrograde: bool(b.retrograde, "body.retrograde"), stationary: bool(b.stationary, "body.stationary"),
    near_next_cusp: b.near_next_cusp == null ? null : bool(b.near_next_cusp, "body.near_next_cusp"), reliable: bool(b.reliable, "body.reliable"),
  };
}

function normHouses(h) {
  if (h == null) return null;
  obj(h, "houses");
  const asc = num(h.asc, 0, 360, "houses.asc") % 360, mc = num(h.mc, 0, 360, "houses.mc") % 360;
  const cusps = arr(h.cusps, 12, "houses.cusps");
  if (cusps.length !== 12) fail("houses.cusps");
  return {
    system: oneOf(h.system, ["PLACIDUS", "PORPHYRY"], "houses.system"), requested: optOneOf(h.requested, ["PLACIDUS", "PORPHYRY"], "houses.requested"),
    asc, mc,
    cusps: cusps.map((c, i) => {
      obj(c, "cusp"); const longitude = num(c.longitude, 0, 360, "cusp.longitude") % 360;
      if (c.house !== i + 1) fail("cusp.house");
      const sign = oneOf(c.sign, SIGNS, "cusp.sign"); if (sign !== signOf(longitude)) fail("cusp.sign≠longitude");
      return { house: i + 1, longitude, sign, position: degString(c.position, longitude, "cusp.position") };
    }),
  };
}

function normAspect(a) {
  obj(a, "aspect");
  return {
    a: oneOf(a.a, POINT_IDS, "aspect.a"), b: oneOf(a.b, POINT_IDS, "aspect.b"), aspect: oneOf(a.aspect, ASPECTS, "aspect.aspect"),
    orb: num(a.orb, 0, 15, "aspect.orb"), max_orb: num(a.max_orb, 0, 15, "aspect.max_orb"),
    orb_class: oneOf(a.orb_class, ["TIGHT", "MEDIUM", "WIDE"], "aspect.orb_class"),
    applying: a.applying == null ? null : bool(a.applying, "aspect.applying"), reliable: bool(a.reliable, "aspect.reliable"),
  };
}

function normConfig(c) {
  obj(c, "configuration");
  const type = oneOf(c.type, CONFIG_TYPES, "configuration.type");
  if (type === "T_SQUARE") { const opposition = ids(c.opposition, POINT_IDS, 2, "configuration.opposition"); if (opposition.length !== 2) fail("configuration.opposition"); return { type, apex: oneOf(c.apex, POINT_IDS, "configuration.apex"), opposition }; }
  if (type === "YOD") { const base = ids(c.base, POINT_IDS, 2, "configuration.base"); if (base.length !== 2) fail("configuration.base"); return { type, apex: oneOf(c.apex, POINT_IDS, "configuration.apex"), base }; }
  const bodies = ids(c.bodies, POINT_IDS, 4, "configuration.bodies");
  if (bodies.length !== (type === "GRAND_TRINE" ? 3 : 4)) fail("configuration.bodies");
  return { type, bodies };
}

function normRuler(r, where) {
  obj(r, where);
  return { ruler: oneOf(r.ruler, CORE, where), traditional_coregent: optOneOf(r.traditional_coregent, CORE, where) };
}

function normDerived(d, timeKnown) {
  obj(d, "derived");
  const groups = (x, keys, where) => { obj(x, where); return Object.fromEntries(keys.map((k) => [k, ids(x[k] || [], POINT_IDS, 14, where)])); };
  const out = {
    elements: groups(d.elements, ["FIRE", "EARTH", "AIR", "WATER"], "derived.elements"),
    modalities: groups(d.modalities, ["CARDINAL", "FIXED", "MUTABLE"], "derived.modalities"),
    elements_counted: ids(d.elements_counted || [], POINT_IDS, 14, "derived.elements_counted"),
    stelliums: arr(d.stelliums || [], LIMITS.stelliums, "derived.stelliums").map((s) => {
      obj(s, "stellium"); const by = oneOf(s.by, ["SIGN", "HOUSE"], "stellium.by");
      return { by, where: by === "SIGN" ? oneOf(s.where, SIGNS, "stellium.where") : house(s.where, "stellium.where"), bodies: ids(s.bodies, CORE, 10, "stellium.bodies") };
    }),
    dispositors: Object.fromEntries(Object.entries(obj(d.dispositors || {}, "derived.dispositors")).map(([k, v]) => [oneOf(k, CORE, "dispositor"), normRuler(v, "dispositor")])),
    planets_in_domicile: ids(d.planets_in_domicile || [], CORE, 10, "derived.planets_in_domicile"),
    final_dispositor: optOneOf(d.final_dispositor, CORE, "derived.final_dispositor"),
    mutual_receptions: arr(d.mutual_receptions || [], 20, "derived.mutual_receptions").map((m) => { obj(m, "mutual_reception"); return { a: oneOf(m.a, CORE, "mr.a"), b: oneOf(m.b, CORE, "mr.b"), rulership: oneOf(m.rulership, ["MODERN"], "mr.rulership") }; }),
    configurations: arr(d.configurations || [], LIMITS.configurations, "derived.configurations").map(normConfig),
    unaspected: ids(d.unaspected || [], CORE, 10, "derived.unaspected"),
  };
  if (d.sun_moon_phase != null) { obj(d.sun_moon_phase, "phase"); out.sun_moon_phase = { angle: num(d.sun_moon_phase.angle, 0, 360, "phase.angle"), phase: oneOf(d.sun_moon_phase.phase, PHASES, "phase.phase") }; }
  if (timeKnown) {
    out.angular = arr(d.angular || [], 30, "derived.angular").map((x) => { obj(x, "angular"); return { body: oneOf(x.body, BODY_IDS, "angular.body"), angle: oneOf(x.angle, ANGLES, "angular.angle"), distance: num(x.distance, 0, 10, "angular.distance") }; });
    if (d.angle_rulers != null) out.angle_rulers = Object.fromEntries(Object.entries(obj(d.angle_rulers, "angle_rulers")).map(([k, v]) => {
      oneOf(k, ANGLES, "angle_rulers.key"); obj(v, "angle_ruler");
      return [k, { sign: oneOf(v.sign, SIGNS, "angle_ruler.sign"), ...normRuler(v, "angle_ruler"), ruler_sign: oneOf(v.ruler_sign, SIGNS, "angle_ruler.ruler_sign"), ruler_house: optHouse(v.ruler_house, "angle_ruler.ruler_house") }];
    }));
    if (d.house_rulers != null) out.house_rulers = arr(d.house_rulers, 12, "house_rulers").map((h) => { obj(h, "house_ruler"); return { house: house(h.house, "house_ruler.house"), cusp_sign: oneOf(h.cusp_sign, SIGNS, "house_ruler.cusp_sign"), ...normRuler(h, "house_ruler") }; });
    if (d.houses_occupancy != null) out.houses_occupancy = Object.fromEntries(Object.entries(obj(d.houses_occupancy, "houses_occupancy")).map(([k, v]) => [String(house(+k, "occupancy.key")), ids(v, CORE, 10, "occupancy")]));
    if (d.hemispheres != null) out.hemispheres = groups(d.hemispheres, ["UPPER_7_12", "LOWER_1_6", "EASTERN_10_3", "WESTERN_4_9"], "derived.hemispheres");
  }
  return out;
}

function normSensitivity(s) {
  if (s == null) return { precision: null, window_min: null, unreliable: [] };
  obj(s, "sensitivity");
  const itemOK = (it) => typeof it === "string" && (POINT_IDS.includes(it) || /^[A-Z_]{2,12}\|[A-Z_]{2,12}\|[A-Z]{4,12}$/.test(it) && it.split("|").every((p, i) => (i < 2 ? POINT_IDS.includes(p) : ASPECTS.includes(p))));
  return {
    precision: optOneOf(s.precision, Object.keys(PRECISIONS), "sensitivity.precision"),
    window_min: s.window_min === "FULL_DAY" ? "FULL_DAY" : s.window_min == null ? null : num(s.window_min, 0, 1440, "sensitivity.window_min"),
    unreliable: arr(s.unreliable || [], LIMITS.unreliable, "sensitivity.unreliable").map((u) => {
      obj(u, "unreliable");
      if (!itemOK(u.item)) fail("unreliable.item");
      const field = oneOf(u.field, ["sign", "house", "aspect"], "unreliable.field");
      const out = { item: u.item, field };
      if (u.alternatives != null) out.alternatives = arr(u.alternatives, 2, "unreliable.alternatives").map((v) => (field === "house" ? optHouse(v, "unreliable.alt") : oneOf(v, SIGNS, "unreliable.alt")));
      if (u.note != null) out.note = oneOf(u.note, SENS_NOTES, "unreliable.note");
      return out;
    }),
  };
}

/**
 * Valida y reconstruye la carta recibida. Devuelve { ok: true, payload } con un objeto nuevo que solo contiene
 * campos permitidos, o { ok: false, error, where }. error = "bad_request" | "bad_name".
 */
export function normalizePayload(p) {
  try {
    obj(p, "payload");
    if (p.schema !== "astroinforme.chart/v1") fail("schema");
    const first_name = normalizeFirstName(p.person && p.person.first_name);
    if (first_name === undefined) return { ok: false, error: "bad_name", where: "person.first_name" };
    obj(p.request, "request"); obj(p.birth, "birth"); obj(p.chart, "chart");
    const lang = oneOf(p.request.report_language, Object.keys(LANGS), "request.report_language");
    const precision = oneOf(p.birth.time_precision, Object.keys(PRECISIONS), "birth.time_precision");
    const timeKnown = precision !== "UNKNOWN";
    const engine = obj(p.engine, "engine");
    const c = p.chart;
    const bodies = arr(c.bodies, BODY_IDS.length, "chart.bodies").map((b) => normBody(b, timeKnown));
    const seen = new Set(bodies.map((b) => b.id));
    if (seen.size !== bodies.length || CORE.some((id) => !seen.has(id))) fail("chart.bodies");
    const houses = normHouses(c.houses);
    if (timeKnown !== !!houses) fail("houses≠precision");
    let south_node = null;
    if (c.south_node != null) {
      const sn = obj(c.south_node, "south_node"); const lon = num(sn.lon ?? sn.longitude, 0, 360, "south_node.lon") % 360;
      const sign = oneOf(sn.sign, SIGNS, "south_node.sign"); if (sign !== signOf(lon)) fail("south_node.sign");
      south_node = { id: "SOUTH_NODE", lon, sign, deg: degString(sn.deg ?? sn.position, lon, "south_node.deg"), derived: "NORTH_NODE+180", house: timeKnown ? house(sn.house, "south_node.house") : null };
    }
    const aspects = arr(c.aspects, LIMITS.aspects, "chart.aspects").map(normAspect);
    if (!timeKnown && aspects.some((a) => a.a === "ASC" || a.a === "MC" || a.b === "ASC" || a.b === "MC")) fail("aspects.angles");
    const warnings = arr(p.warnings || [], LIMITS.warnings, "warnings").map((w) => ({ code: oneOf(isObj(w) ? w.code : null, WARNINGS, "warning.code") }));
    const payload = {
      schema: "astroinforme.chart/v1",
      engine: { version: ID_RE.test(engine.version || "") ? engine.version : fail("engine.version"), aspect_policy: oneOf(engine.aspect_policy, ["orbes_v1"], "engine.aspect_policy") },
      person: { first_name },
      request: {
        kind: oneOf(p.request.kind ?? "NATAL_FULL_REPORT", ["NATAL_FULL_REPORT"], "request.kind"), report_language: lang, address: LANGS[lang],
        address_gender: p.request.address_gender == null ? "UNSPECIFIED" : oneOf(p.request.address_gender, GENDERS, "request.address_gender"),
        include_myth: true,
      },
      birth: { time_precision: precision, time_precision_label: PRECISIONS[precision] },
      chart: { bodies, south_node, houses, aspects, derived: normDerived(c.derived, timeKnown), sensitivity: normSensitivity(c.sensitivity) },
      warnings,
    };
    return { ok: true, payload };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: "bad_request", where: e.where };
    throw e;
  }
}

/** Identificador de pedido elegido por la app para reintentar sin gastar otra generación. */
export function normalizeRequestId(x) {
  return typeof x === "string" && /^[A-Za-z0-9-]{16,64}$/.test(x) ? x : null;
}
