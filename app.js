// ASTROINFORME — interfaz web. Todo el cálculo ocurre en este dispositivo.
import * as E from "./engine.js";
import { CONFIG } from "./config.js";
import * as V from "./visuals.js";
import { auditReport } from "./audit.js";

const $ = (s) => document.querySelector(s);
const VS = "︎";
const NAME = { SUN: "Sol", MOON: "Luna", MERCURY: "Mercurio", VENUS: "Venus", MARS: "Marte", JUPITER: "Júpiter", SATURN: "Saturno", URANUS: "Urano", NEPTUNE: "Neptuno", PLUTO: "Plutón", CHIRON: "Quirón", NORTH_NODE: "Nodo Norte", SOUTH_NODE: "Nodo Sur", ASC: "Ascendente", MC: "Medio Cielo", DSC: "Descendente", IC: "Fondo del Cielo" };
const GLYPH = { SUN: "☉", MOON: "☽", MERCURY: "☿", VENUS: "♀", MARS: "♂", JUPITER: "♃", SATURN: "♄", URANUS: "♅", NEPTUNE: "♆", PLUTO: "♇", CHIRON: "⚷", NORTH_NODE: "☊", ASC: "AC", MC: "MC" };
const SIGN_ES = { ARIES: "Aries", TAURUS: "Tauro", GEMINI: "Géminis", CANCER: "Cáncer", LEO: "Leo", VIRGO: "Virgo", LIBRA: "Libra", SCORPIO: "Escorpio", SAGITTARIUS: "Sagitario", CAPRICORN: "Capricornio", AQUARIUS: "Acuario", PISCES: "Piscis" };
const SIGN_GLYPH = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const ASP_ES = { CONJUNCTION: "Conjunción", OPPOSITION: "Oposición", SQUARE: "Cuadratura", TRINE: "Trígono", SEXTILE: "Sextil", QUINCUNX: "Quincuncio" };
const ASP_GLYPH = { CONJUNCTION: "☌", OPPOSITION: "☍", SQUARE: "□", TRINE: "△", SEXTILE: "⚹", QUINCUNX: "⚻" };
const ELEM_ES = { FIRE: "Fuego", EARTH: "Tierra", AIR: "Aire", WATER: "Agua" };
const MOD_ES = { CARDINAL: "Cardinal", FIXED: "Fija", MUTABLE: "Mutable" };
const PHASE_ES = { NEW: "Nueva", CRESCENT: "Creciente", FIRST_QUARTER: "Cuarto creciente", GIBBOUS: "Gibosa", FULL: "Llena", DISSEMINATING: "Diseminante", LAST_QUARTER: "Cuarto menguante", BALSAMIC: "Balsámica" };
const CFG_ES = { T_SQUARE: "Cuadratura en T", GRAND_TRINE: "Gran trígono", GRAND_CROSS: "Gran cruz", YOD: "Yod" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const nm = (id) => NAME[id] || id;
const g = (s) => s + VS;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const posStr = (b) => `${b.deg} ${SIGN_ES[b.sign]}`;

let regionName = null;
try { regionName = new Intl.DisplayNames(["es"], { type: "region" }); } catch (e) { }
const country = (cc) => { try { return regionName ? regionName.of(cc) : cc; } catch (e) { return cc; } };

// ---------- estado ----------
const state = { place: null, chart: null, payload: null, engineReady: null };

function setStatus(el, kind, html) { el.className = "note " + kind; el.innerHTML = html; el.hidden = !html; }

// ---------- motor ----------
async function ensureEngine() {
  if (!state.engineReady) {
    state.engineReady = E.initEngine({
      wasmPath: new URL("./swisseph.wasm", import.meta.url).href,
      loadBytes: async (f) => {
        // los archivos de efemérides se publican en base64 (.b64.txt) porque el hosting de artifacts no sirve binarios arbitrarios
        const r = await fetch(new URL("./" + f + ".b64.txt", import.meta.url)); if (!r.ok) throw new Error(f);
        const bin = atob((await r.text()).trim()); const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      },
    });
    state.engineReady.then((info) => { $("#engine-state").textContent = info.engine + " · archivos sepl_18, semo_18, seas_18 cargados"; $("#engine-state").dataset.ok = "1"; })
      .catch((e) => { $("#engine-state").textContent = "El motor no pudo cargarse en este navegador (" + (e.code || e.message) + ")."; $("#engine-state").dataset.ok = "0"; state.engineReady = null; });
  }
  return state.engineReady;
}

// ---------- ciudades ----------
let cities = null, citiesLoading = null;
const SPECIAL = { "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "ß": "ss", "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ı": "i", "œ": "oe", "þ": "th", "ð": "d" };
const fold = (s) => s.replace(/[øØæÆßłŁđĐıœþð]/g, (c) => SPECIAL[c]).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ALIASES = { "ciudad de mexico": "mexico city", "cdmx": "mexico city", "df": "mexico city", "nueva york": "new york city", "londres": "london", "munich": "munich", "muenchen": "munich", "munchen": "munich", "colonia": "cologne", "koln": "cologne", "francfort": "frankfurt am main", "frankfurt": "frankfurt am main", "hamburgo": "hamburg", "berlin": "berlin", "viena": "vienna", "wien": "vienna", "roma": "rome", "milan": "milan", "florencia": "florence", "napoles": "naples", "venecia": "venice", "lisboa": "lisbon", "moscu": "moscow", "atenas": "athens", "ginebra": "geneva", "zurich": "zurich", "bruselas": "brussels", "estocolmo": "stockholm", "copenhague": "copenhagen", "varsovia": "warsaw", "praga": "prague", "pekin": "beijing", "tokio": "tokyo", "el cairo": "cairo", "la habana": "havana", "nueva orleans": "new orleans", "filadelfia": "philadelphia", "montreal": "montreal", "asuncion": "asuncion", "san pablo": "sao paulo", "sao paulo": "sao paulo", "rio de janeiro": "rio de janeiro", "caba": "buenos aires", "capital federal": "buenos aires", "nurnberg": "nuremberg", "nuremberg": "nuremberg", "dusseldorf": "dusseldorf" };

async function loadCities() {
  if (cities) return cities;
  if (!citiesLoading) citiesLoading = fetch(new URL("./cities.txt", import.meta.url)).then((r) => { if (!r.ok) throw new Error("cities"); return r.text(); }).then((t) => {
    cities = t.split("\n").map((l) => { const [n, cc, adm, pop, lat, lon] = l.split("\t"); return { n, f: fold(n), cc, adm, pop: +pop, lat: +lat, lon: +lon }; });
    return cities;
  });
  return citiesLoading;
}
function searchCities(q) {
  const parts = q.split(",").map(fold);
  let qn = parts[0]; if (!qn) return [];
  if (ALIASES[qn]) qn = ALIASES[qn];
  const ccFilter = parts[1] ? parts[1] : null;
  const exact = [], prefix = [], inner = [];
  for (const c of cities) {
    if (ccFilter && !(c.cc.toLowerCase() === ccFilter || fold(country(c.cc)).startsWith(ccFilter))) continue;
    if (c.f === qn) exact.push(c); else if (c.f.startsWith(qn)) prefix.push(c); else if (qn.length > 3 && c.f.includes(qn)) inner.push(c);
    if (exact.length + prefix.length > 400) break;
  }
  return [...exact, ...prefix, ...inner].slice(0, 12);
}

function renderPlaceResults(list) {
  const box = $("#place-results");
  if (!list.length) { box.innerHTML = `<p class="muted small">Sin resultados. Probá con el nombre en inglés o en el idioma local, o agregá el país después de una coma (por ejemplo, «Córdoba, Argentina»). También podés cargar coordenadas a mano.</p>`; box.hidden = false; return; }
  box.innerHTML = list.map((c, i) => `<button type="button" class="place-opt" data-i="${i}"><span class="pn">${esc(c.n)}</span><span class="pm">${esc(country(c.cc))} · ${c.pop.toLocaleString("es-AR")} hab. · ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}</span></button>`).join("");
  box.hidden = false;
  box.querySelectorAll(".place-opt").forEach((b) => b.addEventListener("click", () => choosePlace(list[+b.dataset.i])));
}

function choosePlace(c) {
  const zone = E.zoneFor(c.lat, c.lon);
  state.place = { label: `${c.n}, ${country(c.cc)}`, lat: c.lat, lon: c.lon, zone, source: "GeoNames (all-the-cities)" };
  $("#place-results").hidden = true;
  $("#place-q").value = state.place.label;
  showPlace();
}
function showPlace() {
  const p = state.place, box = $("#place-chosen");
  if (!p) { box.hidden = true; return; }
  box.hidden = false;
  $("#pc-label").textContent = p.label;
  $("#pc-coords").textContent = `${Math.abs(p.lat).toFixed(4)}° ${p.lat >= 0 ? "N" : "S"} · ${Math.abs(p.lon).toFixed(4)}° ${p.lon >= 0 ? "E" : "O"}`;
  $("#tz").value = p.zone;
}

// ---------- cálculo ----------
function readForm() {
  const d = $("#bdate").value, t = $("#btime").value, prec = $("#prec").value;
  if (!d) throw new Error("Falta la fecha de nacimiento.");
  const [y, mo, dd] = d.split("-").map(Number);
  if (y < 1800 || y > 2399) throw new Error("Los archivos de efemérides cubren de 1800 a 2399.");
  let h = 12, mi = 0;
  if (prec !== "UNKNOWN") { if (!t) throw new Error("Falta la hora. Si no la conocés, elegí «Desconocida» en precisión."); [h, mi] = t.split(":").map(Number); }
  if (!state.place) throw new Error("Elegí el lugar de nacimiento de la lista o cargá coordenadas.");
  const zone = $("#tz").value.trim();
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); } catch (e) { throw new Error("La zona horaria «" + zone + "» no es válida."); }
  let manual = null;
  if ($("#use-manual-offset").checked) {
    const v = $("#manual-offset").value.trim().replace(",", ".");
    const m = v.match(/^([+-])?(\d{1,2})(?::(\d{2}))?$/) || v.match(/^([+-])?(\d{1,2}(?:\.\d+)?)$/);
    if (!m) throw new Error("Desfase manual inválido. Usá un formato como -3, +1 o -3:30.");
    const sign = m[1] === "-" ? -1 : 1; const hrs = parseFloat(m[2]); const mins = m[3] ? +m[3] : 0;
    manual = sign * Math.round(hrs * 60 + mins);
  }
  return { first: $("#fname").value.trim(), lang: $("#lang").value, y, mo, d: dd, h, mi, prec, zone, manual };
}

function fmtOffset(min) { const s = min < 0 ? "−" : "+"; const a = Math.abs(min); return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ":" + String(a % 60).padStart(2, "0") : ""}`; }
function fmtUtc(ms) { return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC"; }

async function calculate(chosenUtc = null) {
  const err = $("#form-error"); setStatus(err, "", "");
  let f;
  try { f = readForm(); } catch (e) { setStatus(err, "bad", esc(e.message)); return; }
  const waitFig = $("#fig-wait");
  let waiting = false;
  const t = setTimeout(() => { waiting = true; V.show(waitFig, "analysis_neural"); }, 250); // solo si la espera es real
  try { await ensureEngine(); } catch (e) { clearTimeout(t); V.clear(waitFig); setStatus(err, "bad", "El motor de cálculo no pudo cargarse en este navegador. Probá con una versión actual de Chrome, Firefox o Safari."); return; }
  clearTimeout(t); if (waiting) V.clear(waitFig);

  const warnings = [];
  let opt, res;
  if (f.prec === "UNKNOWN") {
    res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: 12, mi: 0 }, f.zone, f.manual);
    if (!res.options.length) res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: 13, mi: 0 }, f.zone, f.manual);
    opt = res.options[0];
  } else {
    res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: f.h, mi: f.mi }, f.zone, f.manual);
    if (res.status === "NONEXISTENT") { setStatus(err, "bad", `La hora ${String(f.h).padStart(2, "0")}:${String(f.mi).padStart(2, "0")} no existió en ${esc(f.zone)} ese día: cae en un adelanto de reloj. Revisá la hora del acta o cargá el desfase a mano.`); return; }
    if (res.status === "AMBIGUOUS" && chosenUtc === null) {
      const box = $("#ambig");
      box.innerHTML = `<p><strong>Esa hora ocurrió dos veces</strong> ese día en ${esc(f.zone)} (retraso de reloj). Elegí cuál corresponde:</p>` +
        res.options.map((o, i) => `<button type="button" class="btn ghost" data-u="${o.utcMs}">${i === 0 ? "Primera vez" : "Segunda vez"} · ${fmtOffset(o.offsetMin)} · ${fmtUtc(o.utcMs)}</button>`).join("");
      box.hidden = false;
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { box.hidden = true; calculate(+b.dataset.u); }));
      return;
    }
    opt = chosenUtc !== null ? res.options.find((o) => o.utcMs === chosenUtc) : res.options[0];
    if (res.status === "AMBIGUOUS") warnings.push({ code: "AMBIGUOUS_LOCAL_TIME", text: `Hora repetida por cambio de horario; se eligió ${fmtOffset(opt.offsetMin)}.` });
  }
  if (f.manual === null && f.y < 1970) warnings.push({ code: "PRE_1970_TZ", text: `Antes de 1970 la base de zonas horarias puede no reflejar el horario oficial de ${f.zone}. Desfase usado: ${fmtOffset(opt.offsetMin)}. Si tenés otra fuente, cargalo a mano.` });
  if (f.manual !== null) warnings.push({ code: "MANUAL_OFFSET", text: `Desfase cargado a mano: ${fmtOffset(f.manual)}.` });
  if (state.place.source === "MANUAL") warnings.push({ code: "MANUAL_COORDS", text: "Coordenadas cargadas a mano." });

  const dayEdge = (h, mi) => { const r = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h, mi }, f.zone, f.manual); return (r.options[0] || opt).utcMs; };
  let chart;
  try {
    chart = E.buildChart({ utcMs: opt.utcMs, lat: state.place.lat, lon: state.place.lon, precision: f.prec, zoneNoonUtcMs: opt.utcMs, dayStartUtcMs: dayEdge(0, 0), dayEndUtcMs: dayEdge(23, 59) });
  } catch (e) { setStatus(err, "bad", "Error de cálculo: " + esc(e.code || e.message) + ". No se muestra ninguna carta."); return; }
  if (chart.houses && chart.houses.warning) warnings.push({ code: chart.houses.warning, text: "Placidus no está definido en esta latitud; las casas se calcularon con Porfirio." });
  if (f.prec === "UNKNOWN") warnings.push({ code: "UNKNOWN_TIME", text: chart.note });
  if (chart.sensitivity.unreliable.length) warnings.push({ code: "TIME_SENSITIVE", text: `Con la precisión indicada, ${chart.sensitivity.unreliable.length} dato(s) podrían cambiar (marcados con ◇).` });

  state.chart = chart;
  state.payload = buildPayload(f, opt, res.source, chart, warnings);
  render(f, opt, chart, warnings);
}

// ---------- contrato de datos ----------
function buildPayload(f, opt, source, chart, warnings) {
  const precLabel = { EXACT: "±4 min", PM15: "±15 min", PM30: "±30 min", PM60: "±60 min", UNKNOWN: "desconocida" }[f.prec];
  return {
    schema: "astroinforme.chart/v1",
    generated_at: new Date().toISOString(),
    engine: { name: "ASTROINFORME web", version: E.ENGINE_VERSION, ephemeris: chart.ephemeris, aspect_policy: chart.aspect_policy },
    person: { first_name: f.first || null },
    request: { kind: "NATAL_FULL_REPORT", report_language: f.lang, address: f.lang === "de" ? "du" : f.lang === "es" ? "voseo" : "you", include_myth: true },
    birth: {
      local_date: `${f.y}-${String(f.mo).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`,
      local_time: f.prec === "UNKNOWN" ? null : `${String(f.h).padStart(2, "0")}:${String(f.mi).padStart(2, "0")}`,
      time_precision: f.prec, time_precision_label: precLabel,
      place: { label: state.place.label, lat: state.place.lat, lon: state.place.lon, source: state.place.source },
      time_zone: f.zone, utc_offset_minutes: opt.offsetMin, offset_source: source, utc: new Date(opt.utcMs).toISOString(),
    },
    chart: {
      jd_ut: chart.jd_ut,
      bodies: chart.bodies.map((b) => ({ id: b.id, longitude: +b.lon.toFixed(6), sign: b.sign, position: b.deg, house: b.house ?? null, speed: +b.speed.toFixed(6), retrograde: b.retrograde, stationary: b.stationary, near_next_cusp: b.near_next_cusp ?? null, reliable: b.reliable })),
      south_node: chart.south_node,
      houses: chart.houses ? { system: chart.houses.system_effective, requested: chart.houses.system_requested, asc: +chart.houses.asc.toFixed(6), mc: +chart.houses.mc.toFixed(6), cusps: chart.houses.cusps.map((c, i) => ({ house: i + 1, longitude: +c.toFixed(6), sign: E.SIGNS[Math.floor(c / 30)], position: E.fmtDeg(c) })) } : null,
      aspects: chart.aspects,
      derived: chart.derived,
      sensitivity: chart.sensitivity,
    },
    warnings,
  };
}

// ---------- render ----------
function render(f, opt, chart, warnings) {
  $("#result").hidden = false;
  const by = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  const mark = (ok) => ok === false ? ` <span class="uns" title="Podría cambiar dentro de la precisión horaria">◇</span>` : "";
  const ascTxt = chart.houses ? `${E.fmtDeg(chart.houses.asc)} ${SIGN_ES[E.SIGNS[Math.floor(chart.houses.asc / 30)]]}` : "sin hora";
  $("#r-title").textContent = f.first ? `Carta natal de ${f.first}` : "Carta natal";
  $("#r-meta").textContent = `${state.payload.birth.local_date}${f.prec === "UNKNOWN" ? " · hora desconocida" : " · " + state.payload.birth.local_time + " (" + state.payload.birth.time_precision_label + ")"} · ${state.place.label} · ${fmtOffset(opt.offsetMin)} · ${fmtUtc(opt.utcMs)}`;
  $("#r-big3").innerHTML = [
    ["Sol", posStr(by.SUN) + (chart.houses ? " · casa " + ROMAN[by.SUN.house] : ""), by.SUN.reliable],
    ["Luna", posStr(by.MOON) + (chart.houses ? " · casa " + ROMAN[by.MOON.house] : ""), by.MOON.reliable],
    ["Ascendente", ascTxt, !chart.sensitivity.unreliable.some((u) => u.item === "ASC")],
  ].map(([k, v, ok]) => `<div class="b3"><span class="lab">${k}</span><span class="val">${esc(v)}${mark(ok)}</span></div>`).join("");

  $("#r-warn").innerHTML = warnings.map((w) => `<li><code>${w.code}</code> ${esc(w.text)}</li>`).join("");
  $("#r-warn-box").hidden = !warnings.length;

  $("#wheel").innerHTML = wheelSVG(chart);

  $("#t-pos").innerHTML = `<thead><tr><th>Punto</th><th>Posición</th>${chart.houses ? "<th>Casa</th>" : ""}<th>Mov.</th></tr></thead><tbody>` +
    chart.bodies.map((b) => `<tr><td><span class="gl">${g(GLYPH[b.id])}</span> ${nm(b.id)}</td><td class="num">${b.deg} ${SIGN_ES[b.sign]}${mark(b.reliable)}</td>${chart.houses ? `<td class="num">${ROMAN[b.house]}${b.near_next_cusp ? " <span class='muted' title='A menos de 2° de la cúspide siguiente'>↦</span>" : ""}</td>` : ""}<td>${b.retrograde ? "R" : ""}${b.stationary ? " est." : ""}</td></tr>`).join("") +
    `<tr><td><span class="gl">${g("☋")}</span> Nodo Sur</td><td class="num">${chart.south_node.deg} ${SIGN_ES[chart.south_node.sign]}</td>${chart.houses ? `<td class="num">${ROMAN[chart.south_node.house]}</td>` : ""}<td></td></tr></tbody>`;

  $("#houses-block").hidden = !chart.houses;
  if (chart.houses) {
    $("#t-houses").innerHTML = `<thead><tr><th>Casa</th><th>Cúspide</th><th>Regente</th></tr></thead><tbody>` + chart.houses.cusps.map((c, i) => {
      const r = chart.derived.house_rulers[i];
      return `<tr><td>${ROMAN[i + 1]}${i === 0 ? " · AC" : i === 9 ? " · MC" : ""}</td><td class="num">${E.fmtDeg(c)} ${SIGN_ES[E.SIGNS[Math.floor(c / 30)]]}</td><td>${nm(r.ruler)}${r.traditional_coregent ? ` <span class="muted">(trad. ${nm(r.traditional_coregent)})</span>` : ""}</td></tr>`;
    }).join("") + "</tbody>";
    $("#houses-sys").textContent = chart.houses.system_effective === "PLACIDUS" ? "Placidus" : "Porfirio (Placidus no definido en esta latitud)";
  }

  $("#t-asp").innerHTML = `<thead><tr><th>Aspecto</th><th>Orbe</th><th></th></tr></thead><tbody>` + chart.aspects.map((a) =>
    `<tr class="${a.orb_class.toLowerCase()}"><td>${nm(a.a)} <span class="gl">${g(ASP_GLYPH[a.aspect])}</span> ${nm(a.b)} <span class="muted small">${ASP_ES[a.aspect].toLowerCase()}</span>${mark(a.reliable)}</td><td class="num">${a.orb.toFixed(2)}°</td><td class="small muted">${a.applying === null ? "" : a.applying ? "aplic." : "separ."}</td></tr>`).join("") + "</tbody>";

  const d = chart.derived;
  const list = (arr) => arr.length ? arr.map(nm).join(", ") : "—";
  const rows = [];
  rows.push(["Elementos", Object.entries(d.elements).map(([k, v]) => `${ELEM_ES[k]} ${v.length}`).join(" · "), Object.entries(d.elements).map(([k, v]) => `${ELEM_ES[k]}: ${list(v)}`).join("<br>")]);
  rows.push(["Modalidades", Object.entries(d.modalities).map(([k, v]) => `${MOD_ES[k]} ${v.length}`).join(" · "), Object.entries(d.modalities).map(([k, v]) => `${MOD_ES[k]}: ${list(v)}`).join("<br>")]);
  if (d.hemispheres) rows.push(["Hemisferios", `Arriba ${d.hemispheres.UPPER_7_12.length} · abajo ${d.hemispheres.LOWER_1_6.length} · este ${d.hemispheres.EASTERN_10_3.length} · oeste ${d.hemispheres.WESTERN_4_9.length}`, "Por casas, Sol a Plutón."]);
  if (d.angular) rows.push(["Planetas angulares", d.angular.length ? d.angular.map((x) => `${nm(x.body)} (${x.angle}, ${x.distance.toFixed(1)}°)`).join(", ") : "—", "Hasta 10° de un ángulo."]);
  if (d.angle_rulers) rows.push(["Regentes de los ángulos", Object.entries(d.angle_rulers).map(([k, v]) => `${k}: ${nm(v.ruler)} en ${SIGN_ES[v.ruler_sign]}, casa ${ROMAN[v.ruler_house]}`).join("<br>"), ""]);
  rows.push(["Configuraciones", d.configurations.length ? d.configurations.map((c) => c.type === "T_SQUARE" ? `${CFG_ES[c.type]}: ${nm(c.opposition[0])}–${nm(c.opposition[1])}, ápice ${nm(c.apex)}` : c.type === "YOD" ? `${CFG_ES[c.type]}: base ${nm(c.base[0])}–${nm(c.base[1])}, ápice ${nm(c.apex)}` : `${CFG_ES[c.type]}: ${c.bodies.map(nm).join(", ")}`).join("<br>") : "—", ""]);
  rows.push(["Stelliums", d.stelliums.length ? d.stelliums.map((s) => `${s.by === "SIGN" ? SIGN_ES[s.where] : "casa " + ROMAN[s.where]}: ${list(s.bodies)}`).join("<br>") : "—", "Tres o más cuerpos."]);
  rows.push(["Sin aspectos", list(d.unaspected), ""]);
  rows.push(["Recepciones mutuas", d.mutual_receptions.length ? d.mutual_receptions.map((r) => `${nm(r.a)}–${nm(r.b)}`).join(", ") : "—", "Regencias modernas."]);
  rows.push(["Dispositor final", d.final_dispositor ? nm(d.final_dispositor) : "no hay uno único", ""]);
  rows.push(["Fase Sol–Luna", `${PHASE_ES[d.sun_moon_phase.phase]} (${d.sun_moon_phase.angle.toFixed(1)}°)`, ""]);
  $("#t-struct").innerHTML = rows.map(([k, v, n]) => `<div class="srow"><dt>${k}</dt><dd>${v}${n ? `<span class="muted small d-note">${n}</span>` : ""}</dd></div>`).join("");

  const s = chart.sensitivity;
  $("#sens").innerHTML = s.unreliable.length
    ? `<p>Ventana analizada: ${s.window_min === "FULL_DAY" ? "el día completo" : "±" + s.window_min + " minutos"}. Estos datos cambian dentro de esa ventana:</p><ul>` + s.unreliable.map((u) => `<li>${u.field === "aspect" ? u.item.split("|").map((x, i) => i === 2 ? ASP_ES[x].toLowerCase() : nm(x)).join(" · ") + " — " + esc(u.note) : nm(u.item) + ": " + (u.field === "sign" ? "signo " + u.alternatives.map((x) => SIGN_ES[x]).join(" / ") : "casa " + u.alternatives.map((x) => ROMAN[x]).join(" / "))}</li>`).join("") + "</ul>"
    : `<p>Dentro de la ventana de ${s.window_min === "FULL_DAY" ? "un día" : "±" + s.window_min + " minutos"} no cambia ningún signo, casa ni aspecto.</p>`;

  $("#prov").textContent = `${chart.ephemeris.engine}. ${chart.ephemeris.flags}. Casas: ${chart.houses ? chart.houses.system_effective : "no calculadas"}. Nodo verdadero. Política de aspectos ${chart.aspect_policy}. Zona ${f.zone} (${state.payload.birth.offset_source === "MANUAL" ? "desfase manual" : "base IANA del navegador"}). Lugar: ${state.place.source}. Motor ${E.ENGINE_VERSION}.`;

  renderInterpretation();
  V.show($("#fig-eyes"), "verification_eyes", { loop: false });
  $("#result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// ---------- rueda ----------
function wheelSVG(chart) {
  const S = 360, C = S / 2, R1 = 172, R2 = 146, R3 = 110, R4 = 72;
  const asc = chart.houses ? chart.houses.asc : 0;
  const pt = (lon, r) => { const t = (180 + lon - asc) * Math.PI / 180; return [C + r * Math.cos(t), C - r * Math.sin(t)]; };
  let o = `<svg viewBox="-14 -14 ${S + 28} ${S + 28}" role="img" aria-label="Rueda de la carta natal" class="wheel-svg">`;
  o += `<circle cx="${C}" cy="${C}" r="${R1}" class="w-ring"/><circle cx="${C}" cy="${C}" r="${R2}" class="w-ring"/><circle cx="${C}" cy="${C}" r="${R4}" class="w-ring"/>`;
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pt(i * 30, R2), [x2, y2] = pt(i * 30, R1); o += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="w-tick"/>`;
    const [tx, ty] = pt(i * 30 + 15, (R1 + R2) / 2); o += `<text x="${tx}" y="${ty}" class="w-sign" text-anchor="middle" dominant-baseline="central">${g(SIGN_GLYPH[i])}</text>`;
    for (let k = 5; k < 30; k += 5) { const [a, b] = pt(i * 30 + k, R2), [c, d] = pt(i * 30 + k, R2 + (k === 15 ? 6 : 3)); o += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" class="w-tick"/>`; }
  }
  if (chart.houses) {
    chart.houses.cusps.forEach((c, i) => {
      const ang = i === 0 || i === 3 || i === 6 || i === 9;
      const [x1, y1] = pt(c, R4), [x2, y2] = pt(c, ang ? R1 + 6 : R2); o += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${ang ? "w-axis" : "w-cusp"}"/>`;
      const next = chart.houses.cusps[(i + 1) % 12]; const mid = c + (((next - c) % 360 + 360) % 360) / 2;
      const [hx, hy] = pt(mid, R4 - 11); o += `<text x="${hx}" y="${hy}" class="w-house" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
    });
    const [ax, ay] = pt(chart.houses.asc, R1 + 2); o += `<text x="${ax - 14}" y="${ay - 6}" class="w-angle">AC</text>`;
    const [mx, my] = pt(chart.houses.mc, R1 + 2); o += `<text x="${mx + 5}" y="${my + 2}" class="w-angle">MC</text>`;
  }
  // aspectos (entre cuerpos, sin conjunciones ni nodo)
  const by = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  for (const a of chart.aspects) {
    if (a.aspect === "CONJUNCTION" || !by[a.a] || !by[a.b] || a.a === "NORTH_NODE" || a.b === "NORTH_NODE") continue;
    const [x1, y1] = pt(by[a.a].lon, R4), [x2, y2] = pt(by[a.b].lon, R4);
    const cls = a.aspect === "SQUARE" || a.aspect === "OPPOSITION" ? "w-hard" : a.aspect === "QUINCUNX" ? "w-qx" : "w-soft";
    o += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" opacity="${a.orb_class === "TIGHT" ? 0.95 : a.orb_class === "MEDIUM" ? 0.6 : 0.32}"/>`;
  }
  // cuerpos con separación mínima de etiquetas
  const items = chart.bodies.map((b) => ({ id: b.id, lon: b.lon, disp: b.lon })).sort((x, y) => x.lon - y.lon);
  const MIN = 9;
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 0; i < items.length && items.length > 1; i++) {
      const a = items[i], b = items[(i + 1) % items.length];
      const dlt = ((b.disp - a.disp + 540) % 360) - 180; // separación con signo
      if (dlt < MIN) { const push = (MIN - dlt) / 2 + 0.01; a.disp -= push; b.disp += push; moved = true; }
    }
    if (!moved) break;
  }
  for (const it of items) {
    const [px, py] = pt(it.lon, R2 - 2), [qx, qy] = pt(it.lon, R2 - 8); o += `<line x1="${px}" y1="${py}" x2="${qx}" y2="${qy}" class="w-tick"/>`;
    const [lx, ly] = pt(it.disp, R3 + 14);
    o += `<text x="${lx}" y="${ly}" class="w-body${by[it.id].retrograde ? " r" : ""}" text-anchor="middle" dominant-baseline="central"><title>${nm(it.id)} ${by[it.id].deg} ${SIGN_ES[by[it.id].sign]}</title>${g(GLYPH[it.id])}</text>`;
  }
  return o + "</svg>";
}

// ---------- interpretación (desacoplada) ----------
function renderInterpretation() {
  const url = (CONFIG.interpreterUrl || "").trim();
  const connected = !!url || !!CONFIG.demo;
  $("#interp-connected").hidden = !connected;
  $("#interp-missing").hidden = connected;
  $("#demo-note").hidden = !CONFIG.demo;
  if (CONFIG.demo && !$("#demo-which").options.length) $("#demo-which").innerHTML = CONFIG.demoReports.map((r) => `<option value="${esc(r.file)}">${esc(r.label)}</option>`).join("");
  $("#interp-conn-text").hidden = !!CONFIG.demo;
  $("#demo-which-row").hidden = !CONFIG.demo;
  $("#btn-interp").textContent = CONFIG.demo ? "Generar el informe (simulación)" : "Generar el informe";
  $("#payload-view").value = JSON.stringify(state.payload, null, 2);
  $("#report-out").hidden = true; $("#audit-out").hidden = true;
  V.clear($("#fig-reader")); V.clear($("#fig-closure"));
}

async function copyText(text, btn) {
  const orig = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copiado"; }
  catch (e) { const ta = $("#payload-view"); ta.value = text; ta.closest("details").open = true; ta.focus(); ta.select(); btn.textContent = "Seleccionado: copialo manualmente"; }
  setTimeout(() => (btn.textContent = orig), 2500);
}


const AUDIT_NAME = { ...NAME };
const refLabel = (r) => r.type === "aspect" ? `${nm(r.a)} ${ASP_ES[r.aspect].toLowerCase()} ${nm(r.b)}`
  : r.type === "angle" ? `${nm(r.angle)} en ${SIGN_ES[r.sign]} ${r.deg}` : `${nm(r.body)} en ${SIGN_ES[r.sign]} ${r.deg}${r.house != null ? ", casa " + ROMAN[r.house] : ""}`;
function problemText(p) {
  if (p.field === "sign") return `el informe dice ${SIGN_ES[p.report]}; la carta calculada da ${SIGN_ES[p.chart]}`;
  if (p.field === "deg") return `el informe dice ${p.report}; la carta calculada da ${p.chart}`;
  if (p.field === "house") return p.chart == null ? p.note : `el informe dice casa ${ROMAN[p.report]}; la carta calculada da casa ${ROMAN[p.chart]}`;
  return p.note;
}

function renderAudit(a) {
  const box = $("#audit-out");
  box.hidden = false;
  box.className = "note " + (a.ok ? "ok" : "warn");
  box.innerHTML = `<strong>Auditoría técnica: ${a.verified} de ${a.total} referencias coinciden con la carta calculada${a.ok ? "." : `; ${a.issues.length} no coinciden.`}</strong>` +
    (a.ok ? "" : `<ul>${a.issues.map((i) => `<li>${esc(refLabel(i.ref))}: ${(i.problems || [i]).map((p) => esc(problemText(p).replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()))).join("; ")}.</li>`).join("")}</ul>
    <p class="small">Las interpretaciones que dependen de estos datos deberían revisarse antes de entregar el informe. La auditoría compara solo las referencias que el informe declara.</p>`);
}

function renderReport(rep) {
  const out = $("#report-out");
  out.hidden = false;
  out.replaceChildren();
  for (const s of rep.sections) {
    const sec = document.createElement("section"); sec.className = "rep-sec";
    const h = document.createElement("h3"); h.textContent = s.heading; sec.append(h);
    const paras = String(s.body_markdown).split(/\n{2,}/);
    paras.forEach((t, i) => {
      const p = document.createElement("p"); p.textContent = t; sec.append(p);
      if (i === 0 && V.SECTION_ART[s.id]) {
        const fig = document.createElement("figure"); fig.className = "art art-section";
        sec.append(fig); V.show(fig, V.SECTION_ART[s.id], { loop: false });
      }
    });
    out.append(sec);
  }
}

async function obtainReport() {
  if (CONFIG.demo) {
    await new Promise((r) => setTimeout(r, 4000)); // espera simulada
    const which = ($("#demo-which") && $("#demo-which").value) || CONFIG.demoReports[0].file;
    return (await import("./" + which)).DEMO_REPORT;
  }
  const r = await fetch(CONFIG.interpreterUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state.payload) });
  if (!r.ok) throw new Error("El servicio respondió " + r.status);
  return r.json();
}

async function callInterpreter() {
  const out = $("#report-out"), btn = $("#btn-interp"), status = $("#interp-status");
  btn.disabled = true; out.hidden = true; $("#audit-out").hidden = true;
  status.hidden = false; status.textContent = CONFIG.demo ? "Simulando la espera del motor interpretativo…" : "Generando el informe…";
  V.clear($("#fig-closure")); V.show($("#fig-reader"), "report_reader");
  try {
    const rep = await obtainReport();
    if (rep.schema !== "astroinforme.report/v1" || !Array.isArray(rep.sections)) throw new Error("La respuesta no cumple el contrato astroinforme.report/v1");
    V.clear($("#fig-reader")); status.hidden = true;
    const audit = auditReport(rep, state.payload);
    renderAudit(audit);
    renderReport(rep);
    if (audit.ok) V.show($("#fig-closure"), "closure_serendipity");
  } catch (e) { V.clear($("#fig-reader")); status.hidden = false; status.textContent = "No se pudo generar el informe: " + e.message + ". La carta calculada sigue disponible."; }
  btn.disabled = false;
}

// ---------- eventos ----------
function initVisuals() {
  const hero = $("#fig-hero"), btn = $("#btn-hero-anim");
  let animated = false;
  V.show(hero, "hero_levitar");
  const sync = () => { btn.hidden = V.reducedMotion(); if (V.reducedMotion() && animated) { animated = false; V.show(hero, "hero_levitar"); btn.textContent = "Ver portada animada"; } };
  sync(); V.onReducedMotionChange(sync);
  btn.addEventListener("click", () => {
    animated = !animated;
    V.show(hero, animated ? "intro_embroidery" : "hero_levitar");
    btn.textContent = animated ? "Ver portada fija" : "Ver portada animada";
  });
}

function init() {
  initVisuals();
  try { const zones = Intl.supportedValuesOf("timeZone"); $("#tz-list").innerHTML = zones.map((z) => `<option value="${z}">`).join(""); } catch (e) { }
  $("#place-q").addEventListener("focus", () => { loadCities().catch(() => { }); ensureEngine().catch(() => { }); }, { once: true });
  $("#place-form-btn").addEventListener("click", doSearch);
  $("#place-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  async function doSearch() {
    const q = $("#place-q").value; const box = $("#place-results");
    box.hidden = false; box.innerHTML = `<p class="muted small">Cargando la lista de ciudades…</p>`;
    const wf = $("#fig-wait"); let shown = false;
    const t = setTimeout(() => { shown = true; V.show(wf, "analysis_neural"); }, 250);
    try { await loadCities(); } catch (e) { clearTimeout(t); V.clear(wf); box.innerHTML = `<p class="note bad">No se pudo cargar la lista de ciudades. Usá coordenadas manuales.</p>`; return; }
    clearTimeout(t); if (shown) V.clear(wf);
    renderPlaceResults(searchCities(q));
  }
  $("#manual-coords-toggle").addEventListener("change", (e) => { $("#manual-coords").hidden = !e.target.checked; });
  $("#mc-apply").addEventListener("click", () => {
    const lat = parseFloat($("#mc-lat").value.replace(",", ".")), lon = parseFloat($("#mc-lon").value.replace(",", "."));
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) { setStatus($("#form-error"), "bad", "Coordenadas inválidas. Latitud entre −90 y 90 (sur negativa), longitud entre −180 y 180 (oeste negativa)."); return; }
    state.place = { label: $("#mc-label").value.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon, zone: E.zoneFor(lat, lon), source: "MANUAL" };
    showPlace();
  });
  $("#tz").addEventListener("change", () => { if (state.place) state.place.zone = $("#tz").value; });
  $("#use-manual-offset").addEventListener("change", (e) => { $("#manual-offset-row").hidden = !e.target.checked; });
  $("#prec").addEventListener("change", (e) => { $("#btime").disabled = e.target.value === "UNKNOWN"; });
  $("#birth-form").addEventListener("submit", (e) => { e.preventDefault(); $("#ambig").hidden = true; calculate(); });
  $("#btn-copy-json").addEventListener("click", (e) => copyText(JSON.stringify(state.payload, null, 2), e.currentTarget));
  $("#btn-interp").addEventListener("click", callInterpreter);
  $("#btn-example").addEventListener("click", loadExample);
}

function loadExample() {
  $("#fname").value = "Ejemplo"; $("#bdate").value = "1990-07-14"; $("#btime").value = "15:20"; $("#prec").value = "PM15"; $("#btime").disabled = false;
  loadCities().then(() => { const c = searchCities("Hamburg")[0]; if (c) { choosePlace(c); calculate(); } });
}

init();
ensureEngine().catch(() => { });
if (CONFIG.demo && CONFIG.demoBirth) {
  const d = CONFIG.demoBirth;
  $("#fname").value = d.first; $("#bdate").value = d.date; $("#btime").value = d.time; $("#prec").value = d.precision;
  $("#manual-coords-toggle").checked = true; $("#manual-coords").hidden = false;
  $("#mc-lat").value = d.lat; $("#mc-lon").value = d.lon; $("#mc-label").value = d.placeLabel;
  $("#mc-apply").click();
  ensureEngine().then(() => calculate()).catch(() => { });
}
