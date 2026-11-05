// Recorrido de regencias: desde cada punto de la carta, de regente en regente, hasta un planeta en su domicilio
// o un ciclo. Se calcula en el servicio a partir de signos ya validados, para que el modelo no lo reconstruya.
// Usa regencias modernas, las mismas de derived.dispositors. Los co-regentes tradicionales no alteran el recorrido.

const MODERN_RULER = {
  ARIES: "MARS", TAURUS: "VENUS", GEMINI: "MERCURY", CANCER: "MOON", LEO: "SUN", VIRGO: "MERCURY",
  LIBRA: "VENUS", SCORPIO: "PLUTO", SAGITTARIUS: "JUPITER", CAPRICORN: "SATURN", AQUARIUS: "URANUS", PISCES: "NEPTUNE",
};
const PLANETS = ["SUN", "MOON", "MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE", "PLUTO"];
const ANGLE_CUSP = { ASC: 0, DSC: 6, MC: 9, IC: 3 };

/** Devuelve { rulership, points: { ID: [recorrido] }, groups: [{ ends_in, kind, points }], unreliable: [ID] }. Compacto: va en cada fase. */
export function rulerChains(bodies, houses, unreliable = []) {
  const signOfBody = Object.fromEntries(bodies.map((b) => [b.id, b.sign]));
  const unsure = new Set(unreliable.filter((u) => u.field === "sign").map((u) => u.item));
  const starts = PLANETS.map((id) => [id, MODERN_RULER[signOfBody[id]]]);
  if (signOfBody.CHIRON) starts.push(["CHIRON", MODERN_RULER[signOfBody.CHIRON]]);
  if (houses) for (const [angle, i] of Object.entries(ANGLE_CUSP)) starts.push([angle, MODERN_RULER[houses.cusps[i].sign]]);

  const points = {}, groups = new Map(), dudosos = [];
  for (const [start, first] of starts) {
    const path = [start];
    let cur = first;
    while (!path.includes(cur)) { path.push(cur); cur = MODERN_RULER[signOfBody[cur]]; }
    // al repetirse un planeta el recorrido se cerró: en un solo planeta es domicilio; en varios, un ciclo
    const loop = path.slice(path.indexOf(cur));
    const kind = loop.length === 1 ? "DOMICILE" : "CYCLE";
    const ends_in = kind === "DOMICILE" ? [cur] : [...loop].sort();
    if (path.some((id) => unsure.has(id) || (id === "DSC" && unsure.has("ASC")) || (id === "IC" && unsure.has("MC")))) dudosos.push(start);
    points[start] = path;
    const key = ends_in.join("+");
    if (!groups.has(key)) groups.set(key, { ends_in, kind, points: [] });
    groups.get(key).points.push(start);
  }
  return { rulership: "MODERN", points, groups: [...groups.values()], unreliable: dudosos };
}
