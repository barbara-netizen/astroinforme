// ASTROINFORME — motor de cálculo para el navegador.
// Swiss Ephemeris (WASM) + archivos sepl_18/semo_18/seas_18. Nunca acepta Moshier en silencio.
// Reglas portadas del MVP local (registro de decisiones v1, política orbes_v1).

import { SwissEphemeris } from "./swisseph-browser.js";
import tzlookup from "./tzlookup.js";

export const ENGINE_VERSION = "web-1.0";
const SEFLG_SWIEPH = 2, SEFLG_SPEED = 256;

export const BODIES = [
  ["SUN", 0], ["MOON", 1], ["MERCURY", 2], ["VENUS", 3], ["MARS", 4], ["JUPITER", 5],
  ["SATURN", 6], ["URANUS", 7], ["NEPTUNE", 8], ["PLUTO", 9], ["CHIRON", 15], ["NORTH_NODE", 11],
];
const PERSONAL_TO_PLUTO = ["SUN", "MOON", "MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE", "PLUTO"];
// velocidades medias aproximadas (°/día) para el criterio de estacionario (|v| < 10 % de la media)
const MEAN_SPEED = { SUN: 0.9856, MOON: 13.176, MERCURY: 1.383, VENUS: 1.2, MARS: 0.524, JUPITER: 0.083, SATURN: 0.0335, URANUS: 0.0117, NEPTUNE: 0.006, PLUTO: 0.004, CHIRON: 0.02, NORTH_NODE: 0.053 };

export const SIGNS = ["ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES"];
const ELEMENT = ["FIRE", "EARTH", "AIR", "WATER"];
const MODALITY = ["CARDINAL", "FIXED", "MUTABLE"];
const MODERN_RULER = ["MARS", "VENUS", "MERCURY", "MOON", "SUN", "MERCURY", "VENUS", "PLUTO", "JUPITER", "SATURN", "URANUS", "NEPTUNE"];
const TRAD_COREGENT = { SCORPIO: "MARS", AQUARIUS: "SATURN", PISCES: "JUPITER" };

// Política orbes_v1 (idéntica al MVP)
export const ASPECT_POLICY = {
  id: "orbes_v1",
  angles: { CONJUNCTION: 0, OPPOSITION: 180, SQUARE: 90, TRINE: 120, SEXTILE: 60, QUINCUNX: 150 },
  categories: { SUN: "LUMINARY", MOON: "LUMINARY", ASC: "ANGLE", MC: "ANGLE", NORTH_NODE: "NODE" },
  orbs: {
    LUMINARY: { CONJUNCTION: 10, OPPOSITION: 10, SQUARE: 8, TRINE: 8, SEXTILE: 6, QUINCUNX: 3 },
    PLANET: { CONJUNCTION: 8, OPPOSITION: 8, SQUARE: 7, TRINE: 7, SEXTILE: 5, QUINCUNX: 3 },
    ANGLE: { CONJUNCTION: 8, OPPOSITION: 8, SQUARE: 5, TRINE: 5, SEXTILE: 4 },
    NODE: { CONJUNCTION: 5, OPPOSITION: 5 },
  },
  orb_classes: { TIGHT: 2.0, MEDIUM: 5.0 },
};
const cat = (id) => ASPECT_POLICY.categories[id] || "PLANET";

let swe = null;
let epheInfo = null;

/** Inicializa WASM y carga los archivos de efemérides. loadBytes(name) -> Uint8Array */
export async function initEngine({ wasmPath, loadBytes }) {
  if (swe) return epheInfo;
  const s = new SwissEphemeris();
  await s.init(wasmPath);
  const m = s.module;
  try { m.FS.mkdir("/ephe"); } catch (e) { }
  for (const f of ["sepl_18.se1", "semo_18.se1", "seas_18.se1"]) {
    const data = await loadBytes(f);
    if (!data || data.length < 100000) throw codeError("EPHEMERIS_FILES_MISSING", f);
    m.FS.writeFile("/ephe/" + f, data);
  }
  s.setEphemerisPath("/ephe");
  swe = s;
  epheInfo = { engine: "Swiss Ephemeris " + s.version() + " (WASM)", files: ["sepl_18", "semo_18", "seas_18"], flags: "SEFLG_SWIEPH|SEFLG_SPEED (tropical, geocéntrico, aparente)" };
  return epheInfo;
}

function codeError(code, detail) { const e = new Error(code + (detail ? ": " + detail : "")); e.code = code; return e; }
const norm = (x) => ((x % 360) + 360) % 360;
const signOf = (lon) => Math.floor(norm(lon) / 30);
export function fmtDeg(lon) {
  const l = norm(lon), inSign = l % 30;
  let d = Math.floor(inSign), mFloat = (inSign - d) * 60, mi = Math.floor(mFloat), s = Math.round((mFloat - mi) * 60);
  if (s === 60) { s = 0; mi++; } if (mi === 60) { mi = 0; d++; }
  return `${d}°${String(mi).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
}

// ---------------- Lugar y tiempo ----------------

export function zoneFor(lat, lon) { return tzlookup(lat, lon); }

/** desfase (minutos) de una zona IANA en un instante UTC (ms) */
export function offsetMinutes(zone, utcMs) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/**
 * Hora civil local -> instante(s) UTC.
 * Devuelve {status: "OK"|"AMBIGUOUS"|"NONEXISTENT", options:[{utcMs, offsetMin}]}
 * Con manualOffsetMin, se usa ese desfase sin consultar la zona.
 */
export function resolveLocalTime({ y, mo, d, h, mi }, zone, manualOffsetMin = null) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (manualOffsetMin !== null && manualOffsetMin !== undefined) {
    return { status: "OK", source: "MANUAL", options: [{ utcMs: wall - manualOffsetMin * 60000, offsetMin: manualOffsetMin }] };
  }
  const candidates = new Set();
  for (const dh of [-36, -24, -12, -6, -3, 0, 3, 6, 12, 24, 36]) candidates.add(offsetMinutes(zone, wall + dh * 3600000));
  const opts = [];
  for (const off of candidates) {
    const t = wall - off * 60000;
    if (offsetMinutes(zone, t) === off && !opts.some((o) => o.utcMs === t)) opts.push({ utcMs: t, offsetMin: off });
  }
  opts.sort((a, b) => a.utcMs - b.utcMs);
  return { status: opts.length === 1 ? "OK" : opts.length === 0 ? "NONEXISTENT" : "AMBIGUOUS", source: "IANA", options: opts };
}

// ---------------- Cálculo ----------------

function jdFromUtc(utcMs) {
  const dt = new Date(utcMs);
  const hour = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
  return swe.julianDay(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), hour);
}

function calcBody(jd, id, num) {
  const r = swe.calculatePosition(jd, num, SEFLG_SWIEPH | SEFLG_SPEED);
  if (!(r.flags & SEFLG_SWIEPH)) throw codeError("EPHEMERIS_FALLBACK_REFUSED", id);
  const speed = r.longitudeSpeed;
  return {
    id, lon: norm(r.longitude), lat: r.latitude, speed,
    sign: SIGNS[signOf(r.longitude)], deg: fmtDeg(r.longitude),
    retrograde: speed < 0,
    stationary: Math.abs(speed) < 0.1 * MEAN_SPEED[id],
  };
}

function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    const span = norm(b - a), off = norm(lon - a);
    if (off < span) return { house: i + 1, toNextCusp: span - off };
  }
  return { house: 12, toNextCusp: 0 };
}

function computeHouses(jd, lat, lon) {
  // Placidus no existe dentro de los círculos polares: |lat| >= 90° − oblicuidad (Swiss Ephemeris lo rechaza)
  const eps = 23.4392911 - 0.0130042 * ((jd - 2451545) / 36525);
  const placidusPossible = Math.abs(lat) < 90 - eps;
  const sys = placidusPossible ? "P" : "O";
  const h = swe.calculateHouses(jd, lat, lon, sys);
  const cusps = h.cusps.slice(1, 13).map(norm);
  if (cusps.some((c) => !Number.isFinite(c))) throw codeError("HOUSES_FAILED");
  return {
    system_requested: "PLACIDUS",
    system_effective: placidusPossible ? "PLACIDUS" : "PORPHYRY",
    warning: placidusPossible ? null : "PLACIDUS_FAILED",
    cusps, asc: norm(h.ascendant), mc: norm(h.mc),
  };
}

function sep(a, b) { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; }

function findAspects(points) {
  const out = [];
  const P = ASPECT_POLICY;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const A = points[i], B = points[j];
    if ((A.id === "ASC" && B.id === "MC") || (A.id === "MC" && B.id === "ASC")) continue;
    const s = sep(A.lon, B.lon);
    for (const [asp, ang] of Object.entries(P.angles)) {
      const oa = P.orbs[cat(A.id)][asp], ob = P.orbs[cat(B.id)][asp];
      if (oa === undefined || ob === undefined) continue; // categoría no admite el aspecto
      const orb = Math.abs(s - ang), maxOrb = Math.max(oa, ob);
      if (orb > maxOrb) continue;
      let applying = null;
      if (A.speed !== undefined && B.speed !== undefined) {
        const dt = 1 / 1440; // un minuto
        const s2 = sep(A.lon + A.speed * dt, B.lon + B.speed * dt);
        applying = Math.abs(s2 - ang) < orb;
      }
      out.push({
        a: A.id, b: B.id, aspect: asp, orb: +orb.toFixed(2), max_orb: maxOrb,
        orb_class: orb <= P.orb_classes.TIGHT ? "TIGHT" : orb <= P.orb_classes.MEDIUM ? "MEDIUM" : "WIDE",
        applying,
      });
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

function derive(bodies, houses, aspects, hasHouses) {
  const byId = Object.fromEntries(bodies.map((b) => [b.id, b]));
  const core = PERSONAL_TO_PLUTO.map((id) => byId[id]);
  const d = {};

  // elementos y modalidades: Sol–Plutón + ASC + MC, sin ponderación
  const pts = core.map((b) => ({ id: b.id, lon: b.lon }));
  if (hasHouses) pts.push({ id: "ASC", lon: houses.asc }, { id: "MC", lon: houses.mc });
  d.elements = { FIRE: [], EARTH: [], AIR: [], WATER: [] };
  d.modalities = { CARDINAL: [], FIXED: [], MUTABLE: [] };
  for (const p of pts) { const s = signOf(p.lon); d.elements[ELEMENT[s % 4]].push(p.id); d.modalities[MODALITY[s % 3]].push(p.id); }
  d.elements_counted = pts.map((p) => p.id);

  // estelliums por signo
  const bySign = {};
  for (const b of core) (bySign[b.sign] ||= []).push(b.id);
  d.stelliums = Object.entries(bySign).filter(([, v]) => v.length >= 3).map(([k, v]) => ({ by: "SIGN", where: k, bodies: v }));

  // regencias y dispositores (modernas, co-regentes tradicionales registrados)
  d.dispositors = Object.fromEntries(core.map((b) => [b.id, { ruler: MODERN_RULER[signOf(b.lon)], traditional_coregent: TRAD_COREGENT[b.sign] || null }]));
  d.planets_in_domicile = core.filter((b) => MODERN_RULER[signOf(b.lon)] === b.id).map((b) => b.id);
  const final = new Set();
  for (const b of core) {
    let cur = b.id; const seen = new Set();
    while (!seen.has(cur)) { seen.add(cur); cur = MODERN_RULER[signOf(byId[cur].lon)]; }
    if (MODERN_RULER[signOf(byId[cur].lon)] === cur) final.add(cur); else { final.clear(); break; }
  }
  d.final_dispositor = final.size === 1 ? [...final][0] : null;
  d.mutual_receptions = [];
  for (let i = 0; i < core.length; i++) for (let j = i + 1; j < core.length; j++) {
    const A = core[i], B = core[j];
    if (MODERN_RULER[signOf(A.lon)] === B.id && MODERN_RULER[signOf(B.lon)] === A.id) d.mutual_receptions.push({ a: A.id, b: B.id, rulership: "MODERN" });
  }

  // configuraciones (Sol–Plutón + Quirón + ángulos)
  const cfgIds = new Set([...PERSONAL_TO_PLUTO, "CHIRON", "ASC", "MC"]);
  const asp = aspects.filter((x) => cfgIds.has(x.a) && cfgIds.has(x.b));
  const has = (a, b, t) => asp.some((x) => x.aspect === t && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  const ids = [...cfgIds].filter((id) => id in byId || (hasHouses && (id === "ASC" || id === "MC")));
  const cfg = [];
  for (const o of asp.filter((x) => x.aspect === "OPPOSITION"))
    for (const c of ids) if (c !== o.a && c !== o.b && has(c, o.a, "SQUARE") && has(c, o.b, "SQUARE")) cfg.push({ type: "T_SQUARE", apex: c, opposition: [o.a, o.b] });
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) {
    const [a, b, c] = [ids[i], ids[j], ids[k]];
    if (has(a, b, "TRINE") && has(b, c, "TRINE") && has(a, c, "TRINE")) cfg.push({ type: "GRAND_TRINE", bodies: [a, b, c] });
    for (const [apex, x, y] of [[a, b, c], [b, a, c], [c, a, b]])
      if (has(x, y, "SEXTILE") && has(apex, x, "QUINCUNX") && has(apex, y, "QUINCUNX")) cfg.push({ type: "YOD", apex, base: [x, y] });
  }
  const tsq = cfg.filter((c) => c.type === "T_SQUARE");
  for (let i = 0; i < tsq.length; i++) for (let j = i + 1; j < tsq.length; j++) {
    const s1 = new Set([...tsq[i].opposition, tsq[i].apex, ...tsq[j].opposition, tsq[j].apex]);
    if (s1.size === 4 && tsq[i].opposition.includes(tsq[j].apex) === false && has(tsq[i].apex, tsq[j].apex, "OPPOSITION")) {
      const key = [...s1].sort().join(",");
      if (!cfg.some((c) => c.type === "GRAND_CROSS" && c.bodies.join(",") === key)) cfg.push({ type: "GRAND_CROSS", bodies: key.split(",") });
    }
  }
  d.configurations = cfg;
  d.unaspected = PERSONAL_TO_PLUTO.filter((id) => !asp.some((x) => x.a === id || x.b === id));

  // fase Sol–Luna
  const phase = norm(byId.MOON.lon - byId.SUN.lon);
  const names = ["NEW", "CRESCENT", "FIRST_QUARTER", "GIBBOUS", "FULL", "DISSEMINATING", "LAST_QUARTER", "BALSAMIC"];
  d.sun_moon_phase = { angle: +phase.toFixed(2), phase: names[Math.floor(phase / 45)] };

  if (hasHouses) {
    const angles = { ASC: houses.asc, DSC: norm(houses.asc + 180), MC: houses.mc, IC: norm(houses.mc + 180) };
    d.angular = [];
    for (const b of [...core, byId.CHIRON]) for (const [an, al] of Object.entries(angles)) {
      const s = sep(b.lon, al); if (s <= 10) d.angular.push({ body: b.id, angle: an, distance: +s.toFixed(2) });
    }
    d.angle_rulers = Object.fromEntries(Object.entries(angles).map(([an, al]) => {
      const sg = SIGNS[signOf(al)], r = MODERN_RULER[signOf(al)];
      return [an, { sign: sg, ruler: r, ruler_sign: byId[r].sign, ruler_house: byId[r].house, traditional_coregent: TRAD_COREGENT[sg] || null }];
    }));
    d.house_rulers = houses.cusps.map((c, i) => ({ house: i + 1, cusp_sign: SIGNS[signOf(c)], ruler: MODERN_RULER[signOf(c)], traditional_coregent: TRAD_COREGENT[SIGNS[signOf(c)]] || null }));
    const byHouse = {};
    for (const b of core) (byHouse[b.house] ||= []).push(b.id);
    d.stelliums.push(...Object.entries(byHouse).filter(([, v]) => v.length >= 3).map(([k, v]) => ({ by: "HOUSE", where: +k, bodies: v })));
    d.houses_occupancy = byHouse;
    // hemisferios por casas (Sol–Plutón)
    const h = (set) => core.filter((b) => set.includes(b.house)).map((b) => b.id);
    d.hemispheres = {
      UPPER_7_12: h([7, 8, 9, 10, 11, 12]), LOWER_1_6: h([1, 2, 3, 4, 5, 6]),
      EASTERN_10_3: h([10, 11, 12, 1, 2, 3]), WESTERN_4_9: h([4, 5, 6, 7, 8, 9]),
    };
  }
  return d;
}

/** Carta en un instante UTC dado. hasHouses=false para hora desconocida. */
export function chartAt(utcMs, lat, lon, hasHouses = true) {
  if (!swe) throw codeError("ENGINE_NOT_READY");
  const jd = jdFromUtc(utcMs);
  const bodies = BODIES.map(([id, n]) => calcBody(jd, id, n));
  const nn = bodies.find((b) => b.id === "NORTH_NODE");
  const south = { id: "SOUTH_NODE", lon: norm(nn.lon + 180), sign: SIGNS[signOf(nn.lon + 180)], deg: fmtDeg(nn.lon + 180), derived: "NORTH_NODE+180" };
  let houses = null;
  if (hasHouses) {
    houses = computeHouses(jd, lat, lon);
    for (const b of bodies) { const r = houseOf(b.lon, houses.cusps); b.house = r.house; b.near_next_cusp = r.toNextCusp < 2; }
    south.house = houseOf(south.lon, houses.cusps).house;
  }
  const pts = bodies.map((b) => ({ id: b.id, lon: b.lon, speed: b.speed }));
  if (hasHouses) pts.push({ id: "ASC", lon: houses.asc }, { id: "MC", lon: houses.mc });
  const aspects = findAspects(pts);
  return { jd_ut: jd, bodies, south_node: south, houses, aspects, derived: derive(bodies, houses, aspects, hasHouses) };
}

const PRECISION_MIN = { EXACT: 4, PM15: 15, PM30: 30, PM60: 60 };

/**
 * Carta completa con sensibilidad horaria.
 * precision: EXACT | PM15 | PM30 | PM60 | UNKNOWN
 * input: {utcMs, lat, lon, precision, localDate:{y,mo,d}, zone, offsetMin}
 */
export function buildChart({ utcMs, lat, lon, precision, zoneNoonUtcMs, dayStartUtcMs, dayEndUtcMs }) {
  const unknown = precision === "UNKNOWN";
  const base = unknown ? chartAt(zoneNoonUtcMs, lat, lon, false) : chartAt(utcMs, lat, lon, true);
  const ext = unknown
    ? [chartAt(dayStartUtcMs, lat, lon, false), chartAt(dayEndUtcMs, lat, lon, false)]
    : [chartAt(utcMs - PRECISION_MIN[precision] * 60000, lat, lon, true), chartAt(utcMs + PRECISION_MIN[precision] * 60000, lat, lon, true)];
  const unreliable = [];
  for (const b of base.bodies) for (const e of ext) {
    const eb = e.bodies.find((x) => x.id === b.id);
    if (eb.sign !== b.sign) unreliable.push({ item: b.id, field: "sign", alternatives: [b.sign, eb.sign] });
    if (!unknown && eb.house !== b.house) unreliable.push({ item: b.id, field: "house", alternatives: [b.house, eb.house] });
  }
  if (!unknown) for (const [k, key] of [["ASC", "asc"], ["MC", "mc"]]) for (const e of ext) {
    const s0 = SIGNS[signOf(base.houses[key])], s1 = SIGNS[signOf(e.houses[key])];
    if (s0 !== s1) unreliable.push({ item: k, field: "sign", alternatives: [s0, s1] });
  }
  const keyOf = (a) => [a.a, a.b, a.aspect].join("|");
  const baseKeys = new Set(base.aspects.map(keyOf));
  for (const e of ext) for (const a of e.aspects) if (!baseKeys.has(keyOf(a))) unreliable.push({ item: keyOf(a), field: "aspect", note: "podría entrar en orbe" });
  for (const a of base.aspects) for (const e of ext) if (!e.aspects.some((x) => keyOf(x) === keyOf(a))) unreliable.push({ item: keyOf(a), field: "aspect", note: "podría salir de orbe" });
  const uniq = [...new Map(unreliable.map((u) => [u.item + u.field, u])).values()];
  const flagged = new Set(uniq.map((u) => u.item));
  for (const b of base.bodies) b.reliable = !flagged.has(b.id);
  for (const a of base.aspects) a.reliable = !flagged.has(keyOf(a));
  base.sensitivity = { precision, window_min: unknown ? "FULL_DAY" : PRECISION_MIN[precision], unreliable: uniq };
  base.ephemeris = epheInfo;
  base.engine_version = ENGINE_VERSION;
  base.aspect_policy = ASPECT_POLICY.id;
  if (unknown) base.note = "Hora desconocida: carta calculada a las 12:00 locales, sin casas, ángulos ni aspectos con ángulos.";
  return base;
}
