// ASTROINFORME — interfaz web. Todo el cálculo ocurre en este dispositivo.
import * as E from "./engine.js";
import { CONFIG } from "./config.js";
import * as V from "./visuals.js";
import { auditReport } from "./audit.js";
import * as L from "./i18n.js";

const { t, term } = L;
const $ = (s) => document.querySelector(s);
const VS = "︎";
const GLYPH = { SUN: "☉", MOON: "☽", MERCURY: "☿", VENUS: "♀", MARS: "♂", JUPITER: "♃", SATURN: "♄", URANUS: "♅", NEPTUNE: "♆", PLUTO: "♇", CHIRON: "⚷", NORTH_NODE: "☊", ASC: "AC", MC: "MC" };
const SIGN_GLYPH = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const ASP_GLYPH = { CONJUNCTION: "☌", OPPOSITION: "☍", SQUARE: "□", TRINE: "△", SEXTILE: "⚹", QUINCUNX: "⚻" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const nm = (id) => term(id);
const g = (s) => s + VS;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const posStr = (b) => `${b.deg} ${term(b.sign)}`;
const LOCALE = { es: "es-AR", de: "de-DE", en: "en-GB" };
// grados con los segundos en un <span> que se oculta en pantallas angostas
const degHTML = (deg) => { const m = /^(.*')(\d\d")$/.exec(deg); return m ? `${m[1]}<span class="sec">${m[2]}</span>` : deg; };

let regionName = null;
function setRegionNames() { try { regionName = new Intl.DisplayNames([L.getLang()], { type: "region" }); } catch (e) { regionName = null; } }
const country = (cc) => { try { return regionName ? regionName.of(cc) : cc; } catch (e) { return cc; } };

// ---------- estado ----------
const state = { place: null, chart: null, payload: null, engineReady: null, engineInfo: null, engineErr: null, last: null, lastReport: null, lastAudit: null, reportLangTouched: false };

// ---------- pantallas: datos → carta → informe (con historial, para que «atrás» del celular vuelva un paso) ----------
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function setScreen(s, { push = true, top = true } = {}) {
  if (s === "report" && !state.lastReport) s = state.chart ? "chart" : "form";
  if (s === "chart" && !state.chart) s = "form";
  const prev = document.body.dataset.screen;
  document.body.dataset.screen = s;
  if (push && prev && prev !== s) { try { history.pushState({ screen: s }, ""); } catch (e) { } }
  if (top) window.scrollTo({ top: 0, behavior: "auto" });
}
window.addEventListener("popstate", (e) => setScreen((e.state && e.state.screen) || "form", { push: false }));

function setStatus(el, kind, html) { el.className = "note " + kind; el.innerHTML = html; el.hidden = !html; }

// ---------- motor ----------
function showEngineState() {
  const el = $("#engine-state");
  if (state.engineInfo) { el.textContent = t("engine.ok", { engine: state.engineInfo.engine }); el.dataset.ok = "1"; }
  else if (state.engineErr) { el.textContent = t("engine.fail", { code: state.engineErr }); el.dataset.ok = "0"; }
  else { el.textContent = t("engine.loading"); delete el.dataset.ok; }
}
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
    state.engineReady.then((info) => { state.engineInfo = info; state.engineErr = null; showEngineState(); })
      .catch((e) => { state.engineErr = e.code || e.message; state.engineReady = null; showEngineState(); });
  }
  return state.engineReady;
}

// ---------- ciudades ----------
let cities = null, citiesLoading = null;
const SPECIAL = { "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "ß": "ss", "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ı": "i", "œ": "oe", "þ": "th", "ð": "d" };
const fold = (s) => s.replace(/[øØæÆßłŁđĐıœþð]/g, (c) => SPECIAL[c]).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// nombres usuales en español y alemán → nombre de la lista GeoNames (ya normalizado)
const ALIASES = {
  "ciudad de mexico": "mexico city", "cdmx": "mexico city", "df": "mexico city", "mexiko stadt": "mexico city", "mexiko city": "mexico city",
  "nueva york": "new york city", "new york": "new york city", "londres": "london", "munchen": "munich", "muenchen": "munich", "munich": "munich",
  "colonia": "koln", "cologne": "koln", "koeln": "koln", "francfort": "frankfurt am main", "frankfurt": "frankfurt am main", "hamburgo": "hamburg",
  "viena": "vienna", "wien": "vienna", "roma": "rome", "rom": "rome", "milan": "milan", "mailand": "milan", "florencia": "florence", "florenz": "florence",
  "napoles": "naples", "neapel": "naples", "venecia": "venice", "venedig": "venice", "lisboa": "lisbon", "lissabon": "lisbon",
  "moscu": "moscow", "moskau": "moscow", "atenas": "athens", "athen": "athens", "ginebra": "geneve", "genf": "geneve", "geneva": "geneve",
  "zurich": "zurich", "zuerich": "zurich", "bruselas": "brussels", "brussel": "brussels", "bruessel": "brussels", "estocolmo": "stockholm",
  "copenhague": "copenhagen", "kopenhagen": "copenhagen", "varsovia": "warsaw", "warschau": "warsaw", "praga": "prague", "prag": "prague",
  "pekin": "beijing", "peking": "beijing", "tokio": "tokyo", "el cairo": "cairo", "kairo": "cairo", "la habana": "havana", "havanna": "havana",
  "nueva orleans": "new orleans", "filadelfia": "philadelphia", "san pablo": "sao paulo", "caba": "buenos aires", "capital federal": "buenos aires",
  "nuremberg": "nurnberg", "nuernberg": "nurnberg", "dusseldorf": "dusseldorf", "duesseldorf": "dusseldorf",
};

async function loadCities() {
  if (cities) return cities;
  if (!citiesLoading) citiesLoading = fetch(new URL("./cities.txt", import.meta.url)).then((r) => { if (!r.ok) throw new Error("cities"); return r.text(); }).then((txt) => {
    cities = txt.split("\n").map((l) => { const [n, cc, adm, pop, lat, lon] = l.split("\t"); return { n, f: fold(n), cc, adm, pop: +pop, lat: +lat, lon: +lon }; });
    return cities;
  });
  return citiesLoading;
}
// el filtro de país acepta el código ISO o el nombre en cualquiera de los tres idiomas
const countryNames = {};
function countryMatches(cc, q) {
  if (cc.toLowerCase() === q) return true;
  if (!countryNames[cc]) {
    countryNames[cc] = L.LANGS.map((l) => { try { return fold(new Intl.DisplayNames([l], { type: "region" }).of(cc)); } catch (e) { return ""; } });
  }
  return countryNames[cc].some((n) => n && n.startsWith(q));
}
function searchCities(q) {
  const parts = q.split(",").map(fold);
  let qn = parts[0]; if (!qn) return [];
  if (ALIASES[qn]) qn = ALIASES[qn];
  const ccFilter = parts[1] ? parts[1] : null;
  const exact = [], prefix = [], inner = [];
  for (const c of cities) {
    if (ccFilter && !countryMatches(c.cc, ccFilter)) continue;
    if (c.f === qn) exact.push(c); else if (c.f.startsWith(qn)) prefix.push(c); else if (qn.length > 3 && c.f.includes(qn)) inner.push(c);
    if (exact.length + prefix.length > 400) break;
  }
  return [...exact, ...prefix, ...inner].slice(0, 12);
}

// Provincias argentinas según los códigos admin1 de GeoNames (07 = Ciudad Autónoma de Buenos Aires)
const AR_ADMIN = { "01": "Provincia de Buenos Aires", "02": "Catamarca", "03": "Chaco", "04": "Chubut", "05": "Córdoba", "06": "Corrientes", "07": "CABA", "08": "Entre Ríos", "09": "Formosa", "10": "Jujuy", "11": "La Pampa", "12": "La Rioja", "13": "Mendoza", "14": "Misiones", "15": "Neuquén", "16": "Río Negro", "17": "Salta", "18": "San Juan", "19": "San Luis", "20": "Santa Cruz", "21": "Santa Fe", "22": "Santiago del Estero", "23": "Tierra del Fuego", "24": "Tucumán" };
function placeName(c) {
  if (c.cc === "AR" && c.adm === "07" && c.f === "buenos aires") return { name: t("place.caba"), where: country(c.cc) };
  const prov = c.cc === "AR" ? AR_ADMIN[c.adm] : null;
  return { name: c.n, where: prov && fold(prov) !== c.f ? `${prov}, ${country(c.cc)}` : country(c.cc) };
}
const placeUI = { list: [], active: -1 };
function renderPlaceResults(list) {
  const box = $("#place-results"), q = $("#place-q");
  placeUI.list = list; placeUI.active = list.length ? 0 : -1;
  if (!list.length) { box.innerHTML = `<li class="empty">${esc(t("place.none"))}</li>`; box.hidden = false; q.setAttribute("aria-expanded", "true"); return; }
  box.innerHTML = list.map((c, i) => { const p = placeName(c); return `<li role="option" id="po-${i}"><button type="button" class="place-opt${i === 0 ? " on" : ""}" tabindex="-1" data-i="${i}"><span class="pn">${esc(p.name)}</span> <span class="pm">· ${esc(p.where)}</span></button></li>`; }).join("");
  box.hidden = false; q.setAttribute("aria-expanded", "true");
  box.querySelectorAll(".place-opt").forEach((b) => {
    b.addEventListener("mousedown", (e) => e.preventDefault()); // no quitar el foco del campo antes del clic
    b.addEventListener("click", () => choosePlace(list[+b.dataset.i]));
  });
}
function hidePlaceResults() { $("#place-results").hidden = true; $("#place-q").setAttribute("aria-expanded", "false"); placeUI.active = -1; }
function movePlace(d) {
  const n = placeUI.list.length; if (!n || $("#place-results").hidden) return;
  placeUI.active = (placeUI.active + d + n) % n;
  $("#place-results").querySelectorAll(".place-opt").forEach((b, i) => b.classList.toggle("on", i === placeUI.active));
  $("#place-q").setAttribute("aria-activedescendant", "po-" + placeUI.active);
}

function choosePlace(c) {
  const zone = E.zoneFor(c.lat, c.lon), p = placeName(c);
  state.place = { label: `${p.name}, ${p.where}`, lat: c.lat, lon: c.lon, zone, source: "GeoNames (all-the-cities)" };
  hidePlaceResults();
  $("#place-q").value = state.place.label;
  showPlace();
  setStatus($("#form-error"), "", "");
}
function showPlace() {
  const p = state.place, box = $("#place-chosen");
  if (!p) { box.hidden = true; return; }
  box.hidden = false;
  $("#pc-label").textContent = p.label;
  const W = L.getLang() === "es" ? "O" : "W";
  $("#pc-coords").textContent = `${Math.abs(p.lat).toFixed(4)}° ${p.lat >= 0 ? "N" : "S"} · ${Math.abs(p.lon).toFixed(4)}° ${p.lon >= 0 ? "E" : W}`;
  $("#tz").value = p.zone;
}

// ---------- cálculo ----------
class FormError extends Error { constructor(key, params) { super(key); this.key = key; this.params = params; } }
function readForm() {
  const d = $("#bdate").value, tm = $("#btime").value, prec = $("#no-time").checked ? "UNKNOWN" : $("#prec").value;
  if (!d) throw new FormError("err.date");
  const [y, mo, dd] = d.split("-").map(Number);
  if (y < 1800 || y > 2399) throw new FormError("err.range");
  let h = 12, mi = 0;
  if (prec !== "UNKNOWN") { if (!tm) throw new FormError("err.time"); [h, mi] = tm.split(":").map(Number); }
  if (!state.place) throw new FormError("err.place");
  const zone = $("#tz").value.trim();
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); } catch (e) { throw new FormError("err.tz", { zone }); }
  let manual = null;
  if ($("#use-manual-offset").checked) {
    const v = $("#manual-offset").value.trim().replace(",", ".");
    const m = v.match(/^([+-])?(\d{1,2})(?::(\d{2}))?$/) || v.match(/^([+-])?(\d{1,2}(?:\.\d+)?)$/);
    if (!m) throw new FormError("err.offset");
    const sign = m[1] === "-" ? -1 : 1; const hrs = parseFloat(m[2]); const mins = m[3] ? +m[3] : 0;
    manual = sign * Math.round(hrs * 60 + mins);
  }
  return { first: $("#fname").value.trim(), lang: $("#lang").value, gender: $("#gender").value || "UNSPECIFIED", y, mo, d: dd, h, mi, prec, zone, manual };
}

function fmtOffset(min) { const s = min < 0 ? "−" : "+"; const a = Math.abs(min); return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ":" + String(a % 60).padStart(2, "0") : ""}`; }
function fmtUtc(ms) { return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
const pad = (n) => String(n).padStart(2, "0");

async function calculate(chosenUtc = null) {
  const err = $("#form-error"); setStatus(err, "", "");
  let f;
  try { f = readForm(); } catch (e) { setStatus(err, "bad", esc(t(e.key, e.params))); return; }
  const waitFig = $("#fig-wait");
  let waiting = false;
  const timer = setTimeout(() => { waiting = true; V.show(waitFig, "analysis_neural"); }, 250); // solo si la espera es real
  try { await ensureEngine(); } catch (e) { clearTimeout(timer); V.clear(waitFig); setStatus(err, "bad", esc(t("err.engine"))); return; }
  clearTimeout(timer); if (waiting) V.clear(waitFig);

  const warnings = []; // {code, params}
  let opt, res;
  if (f.prec === "UNKNOWN") {
    res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: 12, mi: 0 }, f.zone, f.manual);
    if (!res.options.length) res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: 13, mi: 0 }, f.zone, f.manual);
    opt = res.options[0];
  } else {
    res = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h: f.h, mi: f.mi }, f.zone, f.manual);
    if (res.status === "NONEXISTENT") { setStatus(err, "bad", esc(t("time.nonexistent", { time: `${pad(f.h)}:${pad(f.mi)}`, zone: f.zone }))); return; }
    if (res.status === "AMBIGUOUS" && chosenUtc === null) {
      const box = $("#ambig");
      box.innerHTML = `<p>${t("time.ambig", { zone: esc(f.zone) })}</p>` +
        res.options.map((o, i) => `<button type="button" class="btn ghost" data-u="${o.utcMs}">${t(i === 0 ? "time.first" : "time.second")} · ${fmtOffset(o.offsetMin)} · ${fmtUtc(o.utcMs)}</button>`).join("");
      box.hidden = false;
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { box.hidden = true; calculate(+b.dataset.u); }));
      return;
    }
    opt = chosenUtc !== null ? res.options.find((o) => o.utcMs === chosenUtc) : res.options[0];
    if (res.status === "AMBIGUOUS") warnings.push({ code: "AMBIGUOUS_LOCAL_TIME", params: { offset: fmtOffset(opt.offsetMin) } });
  }
  if (f.manual === null && f.y < 1970) warnings.push({ code: "PRE_1970_TZ", params: { zone: f.zone, offset: fmtOffset(opt.offsetMin) } });
  if (f.manual !== null) warnings.push({ code: "MANUAL_OFFSET", params: { offset: fmtOffset(f.manual) } });
  if (state.place.source === "MANUAL") warnings.push({ code: "MANUAL_COORDS", params: {} });

  const dayEdge = (h, mi) => { const r = E.resolveLocalTime({ y: f.y, mo: f.mo, d: f.d, h, mi }, f.zone, f.manual); return (r.options[0] || opt).utcMs; };
  let chart;
  try {
    chart = E.buildChart({ utcMs: opt.utcMs, lat: state.place.lat, lon: state.place.lon, precision: f.prec, zoneNoonUtcMs: opt.utcMs, dayStartUtcMs: dayEdge(0, 0), dayEndUtcMs: dayEdge(23, 59) });
  } catch (e) { setStatus(err, "bad", esc(t("err.calc", { code: e.code || e.message }))); return; }
  if (chart.houses && chart.houses.warning) warnings.push({ code: chart.houses.warning, params: {} });
  if (f.prec === "UNKNOWN") warnings.push({ code: "UNKNOWN_TIME", params: {} });
  if (chart.sensitivity.unreliable.length) warnings.push({ code: "TIME_SENSITIVE", params: { n: chart.sensitivity.unreliable.length } });

  state.chart = chart;
  state.payload = buildPayload(f, opt, res.source, chart, warnings);
  state.last = { f, opt, warnings };
  state.lastReport = null; state.lastAudit = null;
  render(true);
  setScreen("chart");
}

// ---------- contrato de datos ----------
function buildPayload(f, opt, source, chart, warnings) {
  const precLabel = { EXACT: "±4 min", PM15: "±15 min", PM30: "±30 min", PM60: "±60 min", UNKNOWN: "unknown" }[f.prec];
  return {
    schema: "astroinforme.chart/v1",
    generated_at: new Date().toISOString(),
    engine: { name: "ASTROINFORME web", version: E.ENGINE_VERSION, ephemeris: chart.ephemeris, aspect_policy: chart.aspect_policy },
    person: { first_name: f.first || null },
    request: { kind: "NATAL_FULL_REPORT", report_language: f.lang, address: f.lang === "de" ? "du" : f.lang === "es" ? "voseo" : "you", address_gender: f.gender, include_myth: true },
    birth: {
      local_date: `${f.y}-${pad(f.mo)}-${pad(f.d)}`,
      local_time: f.prec === "UNKNOWN" ? null : `${pad(f.h)}:${pad(f.mi)}`,
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
    // los avisos van con su código; el texto, en el idioma del informe
    warnings: warnings.map((w) => ({ code: w.code, params: w.params, text: textIn(f.lang, "w." + w.code, w.params) })),
  };
}
function textIn(lang, key, params) { const cur = L.getLang(); L.setLang(lang); const s = t(key, params); L.setLang(cur); return s; }

// ---------- render ----------
function render(scroll = false) {
  if (!state.chart || !state.last) return;
  const { f, opt, warnings } = state.last;
  const chart = state.chart;
  const by = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  const mark = (ok) => ok === false ? ` <span class="uns" title="${esc(t("r.mark"))}">◇</span>` : "";
  const H = t("r.house");
  const ascTxt = chart.houses ? `${E.fmtDeg(chart.houses.asc)} ${term(E.SIGNS[Math.floor(chart.houses.asc / 30)])}` : t("r.noTime");
  $("#r-title").textContent = f.first || t("r.title");
  $("#r-title").previousElementSibling.hidden = !f.first;
  $("#r-meta").textContent = humanBirth(f);
  const ascSign = chart.houses ? term(E.SIGNS[Math.floor(chart.houses.asc / 30)]) : t("r.noTime");
  $("#r-big3").innerHTML = [
    [term("SUN"), term(by.SUN.sign), chart.houses ? `${H} ${by.SUN.house}` : by.SUN.deg.replace(/\d\d"$/, ""), by.SUN.reliable],
    [term("MOON"), term(by.MOON.sign), chart.houses ? `${H} ${by.MOON.house}` : by.MOON.deg.replace(/\d\d"$/, ""), by.MOON.reliable],
    [term("ASC"), ascSign, chart.houses ? E.fmtDeg(chart.houses.asc).replace(/\d\d"$/, "") : "", !chart.sensitivity.unreliable.some((u) => u.item === "ASC")],
  ].map(([k, v, sub, ok]) => `<div class="b3"><span class="lab">${esc(k)}${mark(ok)}</span><span class="val">${esc(v)}</span><span class="sub">${esc(sub)}</span></div>`).join("");

  $("#r-warn").innerHTML = warnings.map((w) => `<li>${esc(t("w." + w.code, w.params))}</li>`).join("");
  $("#r-warn-box").hidden = !warnings.length;

  $("#wheel").innerHTML = wheelSVG(chart);

  // posiciones: el movimiento va junto al grado (R, est.) para que la tabla entre en el celular
  const motion = (b) => `${b.retrograde ? `<span class="rx" title="${esc(t("r.rx"))}">R</span>` : ""}${b.stationary ? `<span class="rx" title="${esc(t("r.stTitle"))}">${t("r.st")}</span>` : ""}`;
  const shortDeg = (d) => d.replace(/\d\d"$/, "");
  const prow = (glyph, id, sign, house, deg, extra, ok) => `<div class="prow"><span class="gl" aria-hidden="true">${g(glyph)}</span><span>${t("r.in", { body: `<strong>${esc(nm(id))}</strong>`, sign: esc(term(sign)) })}${house ? `<span class="ph">, ${H} ${house}</span>` : ""}${mark(ok)}</span><span class="pd">${shortDeg(deg)}${extra}</span></div>`;
  $("#t-pos").innerHTML = chart.bodies.map((b) => prow(GLYPH[b.id], b.id, b.sign, chart.houses ? b.house : null, b.deg, motion(b), b.reliable)).join("") +
    prow("☋", "SOUTH_NODE", chart.south_node.sign, chart.houses ? chart.south_node.house : null, chart.south_node.deg, "", true) +
    (chart.houses ? prow("", "MC", E.SIGNS[Math.floor(chart.houses.mc / 30)], null, E.fmtDeg(chart.houses.mc), "", !chart.sensitivity.unreliable.some((u) => u.item === "MC")) : "");
  $("#pos-note").textContent = t(chart.houses ? "r.posNote" : "r.posNoteNoTime", { sys: chart.houses ? t(chart.houses.system_effective === "PLACIDUS" ? "houses.placidus" : "houses.porphyry") : "" });

  $("#houses-block").hidden = !chart.houses;
  if (chart.houses) {
    $("#t-houses").innerHTML = `<thead><tr><th>${t("th.house")}</th><th>${t("th.cusp")}</th><th>${t("th.ruler")}</th></tr></thead><tbody>` + chart.houses.cusps.map((c, i) => {
      const r = chart.derived.house_rulers[i];
      return `<tr><td>${ROMAN[i + 1]}${i === 0 ? " · AC" : i === 9 ? " · MC" : ""}</td><td class="num">${degHTML(E.fmtDeg(c))} ${esc(term(E.SIGNS[Math.floor(c / 30)]))}</td><td>${esc(nm(r.ruler))}${r.traditional_coregent ? ` <span class="muted">(${t("trad")} ${esc(nm(r.traditional_coregent))})</span>` : ""}</td></tr>`;
    }).join("") + "</tbody>";
    $("#houses-sys").textContent = t(chart.houses.system_effective === "PLACIDUS" ? "houses.placidus" : "houses.porphyry");
  }

  $("#t-asp").innerHTML = `<thead><tr><th>${t("th.aspect")}</th><th>${t("th.orb")}</th><th></th></tr></thead><tbody>` + chart.aspects.map((a) =>
    `<tr class="${a.orb_class.toLowerCase()}"><td>${esc(nm(a.a))} <span class="gl">${g(ASP_GLYPH[a.aspect])}</span> ${esc(nm(a.b))} <span class="muted small">${esc(term(a.aspect))}</span>${mark(a.reliable)}</td><td class="num">${a.orb.toFixed(2)}°</td><td class="small muted">${a.applying === null ? "" : t(a.applying ? "asp.app" : "asp.sep")}</td></tr>`).join("") + "</tbody>";

  const d = chart.derived;
  const list = (arr) => arr.length ? arr.map(nm).join(", ") : "—";
  const rows = [];
  rows.push([t("s.elements"), Object.entries(d.elements).map(([k, v]) => `${term(k)} ${v.length}`).join(" · "), Object.entries(d.elements).map(([k, v]) => `${term(k)}: ${list(v)}`).join("<br>")]);
  rows.push([t("s.modalities"), Object.entries(d.modalities).map(([k, v]) => `${term(k)} ${v.length}`).join(" · "), Object.entries(d.modalities).map(([k, v]) => `${term(k)}: ${list(v)}`).join("<br>")]);
  if (d.hemispheres) rows.push([t("s.hemispheres"), t("s.hemi", { u: d.hemispheres.UPPER_7_12.length, l: d.hemispheres.LOWER_1_6.length, e: d.hemispheres.EASTERN_10_3.length, w: d.hemispheres.WESTERN_4_9.length }), t("s.hemi.note")]);
  if (d.angular) rows.push([t("s.angular"), d.angular.length ? d.angular.map((x) => `${nm(x.body)} (${x.angle}, ${x.distance.toFixed(1)}°)`).join(", ") : "—", t("s.angular.note")]);
  if (d.angle_rulers) rows.push([t("s.angleRulers"), Object.entries(d.angle_rulers).map(([k, v]) => t("s.angleRuler", { angle: k, ruler: nm(v.ruler), sign: term(v.ruler_sign), house: ROMAN[v.ruler_house] })).join("<br>"), ""]);
  rows.push([t("s.configs"), d.configurations.length ? d.configurations.map((c) => c.type === "T_SQUARE" ? `${term(c.type)}: ${nm(c.opposition[0])}–${nm(c.opposition[1])}, ${t("s.apex")} ${nm(c.apex)}` : c.type === "YOD" ? `${term(c.type)}: ${t("s.base")} ${nm(c.base[0])}–${nm(c.base[1])}, ${t("s.apex")} ${nm(c.apex)}` : `${term(c.type)}: ${c.bodies.map(nm).join(", ")}`).join("<br>") : "—", ""]);
  rows.push([t("s.stelliums"), d.stelliums.length ? d.stelliums.map((s) => `${s.by === "SIGN" ? term(s.where) : H + " " + ROMAN[s.where]}: ${list(s.bodies)}`).join("<br>") : "—", t("s.stelliums.note")]);
  rows.push([t("s.unaspected"), list(d.unaspected), ""]);
  rows.push([t("s.mutual"), d.mutual_receptions.length ? d.mutual_receptions.map((r) => `${nm(r.a)}–${nm(r.b)}`).join(", ") : "—", t("s.mutual.note")]);
  rows.push([t("s.finalDisp"), d.final_dispositor ? nm(d.final_dispositor) : t("s.noFinalDisp"), ""]);
  rows.push([t("s.phase"), `${term(d.sun_moon_phase.phase)} (${d.sun_moon_phase.angle.toFixed(1)}°)`, ""]);
  $("#t-struct").innerHTML = rows.map(([k, v, n]) => `<div class="srow"><dt>${esc(k)}</dt><dd>${v}${n ? `<span class="muted small d-note">${n}</span>` : ""}</dd></div>`).join("");

  const s = chart.sensitivity;
  const win = s.window_min === "FULL_DAY" ? t("sens.fullDay") : t("sens.minutes", { n: s.window_min });
  const noteKey = (n) => /entrar/.test(n) ? "sens.in" : /salir/.test(n) ? "sens.out" : null;
  $("#sens").innerHTML = s.unreliable.length
    ? `<p>${esc(t("sens.changes", { w: win }))}</p><ul>` + s.unreliable.map((u) => `<li>${u.field === "aspect"
      ? u.item.split("|").map((x, i) => i === 2 ? term(x) : nm(x)).join(" · ") + " — " + esc(noteKey(u.note) ? t(noteKey(u.note)) : u.note)
      : nm(u.item) + ": " + (u.field === "sign" ? t("sens.sign") + " " + u.alternatives.map((x) => term(x)).join(" / ") : H + " " + u.alternatives.map((x) => ROMAN[x]).join(" / "))}</li>`).join("") + "</ul>"
    : `<p>${esc(t("sens.none", { w: win }))}</p>`;

  $("#prov").textContent = provText(f, opt, chart);

  if (scroll) renderInterpretation();
}
/** Línea de procedencia del cálculo, en el idioma activo (la usa también la descarga, en el idioma del informe). */
function provText(f, opt, chart) {
  return `${fmtOffset(opt.offsetMin)} · ${fmtUtc(opt.utcMs)} · ${state.place.lat.toFixed(4)}, ${state.place.lon.toFixed(4)}. ` + t("prov", {
    engine: chart.ephemeris.engine, flags: "SEFLG_SWIEPH|SEFLG_SPEED",
    sys: chart.houses ? chart.houses.system_effective : t("prov.noHouses"), pol: chart.aspect_policy, zone: f.zone,
    src: t(state.payload.birth.offset_source === "MANUAL" ? "prov.manual" : "prov.iana"), place: state.place.source, ver: E.ENGINE_VERSION,
  });
}
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function humanBirth(f) {
  let date;
  try { date = new Intl.DateTimeFormat(LOCALE[L.getLang()], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(f.y, f.mo - 1, f.d)); }
  catch (e) { date = `${f.d} de ${MONTHS[f.mo - 1]} de ${f.y}`; }
  const time = f.prec === "UNKNOWN" ? t("r.unknownTime") : `${pad(f.h)}:${pad(f.mi)}${f.prec === "EXACT" ? "" : " (" + state.payload.birth.time_precision_label + ")"}`;
  return `${date}, ${time} · ${state.place.label}`;
}

// ---------- rueda ----------
function wheelSVG(chart) {
  const S = 360, C = S / 2, R1 = 172, R2 = 146, R3 = 110, R4 = 72;
  const asc = chart.houses ? chart.houses.asc : 0;
  const pt = (lon, r) => { const a = (180 + lon - asc) * Math.PI / 180; return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
  let o = `<svg viewBox="-14 -14 ${S + 28} ${S + 28}" role="img" aria-label="${esc(t("wheel.aria"))}" class="wheel-svg">`;
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
    o += `<text x="${lx}" y="${ly}" class="w-body${by[it.id].retrograde ? " r" : ""}" text-anchor="middle" dominant-baseline="central"><title>${esc(nm(it.id))} ${by[it.id].deg} ${esc(term(by[it.id].sign))}</title>${g(GLYPH[it.id])}</text>`;
  }
  return o + "</svg>";
}

// ---------- interpretación (desacoplada) ----------
const serviceUrl = () => (CONFIG.interpreterUrl || "").trim();
const publicAccess = () => CONFIG.requireCode === false;
// estado del servicio (GET /health): si hoy quedan informes disponibles
async function checkService() {
  if (!serviceUrl() || CONFIG.demo) return;
  try { const r = await fetch(new URL("health", serviceUrl()), { cache: "no-store" }); state.health = await r.json(); }
  catch (e) { state.health = null; }
  renderInterpretationChrome();
}
// verificación anti-robots (Cloudflare Turnstile), solo si hay clave de sitio configurada
const ts = { loading: null, widget: null, token: null };
function loadTurnstile() {
  if (!CONFIG.turnstileSiteKey || !serviceUrl() || CONFIG.demo) return;
  if (!ts.loading) ts.loading = new Promise((ok, fail) => {
    const sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.async = true;
    sc.onload = ok; sc.onerror = fail; document.head.append(sc);
  });
  ts.loading.then(() => {
    if (ts.widget !== null || !window.turnstile) return;
    const box = $("#ts-box"); box.hidden = false;
    ts.widget = window.turnstile.render(box, { sitekey: CONFIG.turnstileSiteKey, language: L.getLang(), callback: (tok) => { ts.token = tok; }, "expired-callback": () => { ts.token = null; }, "error-callback": () => { ts.token = null; } });
  }).catch(() => { });
}
function resetTurnstile() { ts.token = null; try { if (ts.widget !== null && window.turnstile) window.turnstile.reset(ts.widget); } catch (e) { } }
function renderInterpretationChrome() {
  const connected = !!serviceUrl() || !!CONFIG.demo;
  $("#interp-connected").hidden = !connected;
  $("#interp-missing").hidden = connected;
  // copia sin servicio (por ejemplo, la publicada dentro de Claude): el informe se pide en la app pública
  if (!connected) $("#interp-missing").innerHTML = CONFIG.reportUrl ? t("i.elsewhere", { url: esc(CONFIG.reportUrl) }) : t("i.missing");
  $("#demo-note").hidden = !CONFIG.demo;
  $("#demo-which-row").hidden = !CONFIG.demo;
  $("#code-row").hidden = !serviceUrl() || !!CONFIG.demo;
  $("#code-label").dataset.i18n = publicAccess() ? "f.code.opt" : "f.code"; $("#code-label").textContent = t($("#code-label").dataset.i18n);
  $("#code-hint").dataset.i18n = publicAccess() ? "f.code.hintOpt" : "f.code.hint"; $("#code-hint").textContent = t($("#code-hint").dataset.i18n);
  const unavailable = !!(state.health && state.health.available === false);
  $("#interp-unavail").hidden = !unavailable;
  $("#btn-interp").disabled = unavailable && !($("#access-code").value || "").trim();
  if (CONFIG.demo) {
    const reports = state.demoReports || CONFIG.demoReports || [];
    const sig = reports.map((r) => r.file).join("|");
    if ($("#demo-which").dataset.sig !== sig) { $("#demo-which").innerHTML = reports.map((r) => `<option value="${esc(r.file)}">${esc(r.label)}</option>`).join(""); $("#demo-which").dataset.sig = sig; }
  }
  $("#btn-interp").textContent = t(CONFIG.demo ? "btn.interpDemo" : "btn.interp");
  $("#btn-back-report").hidden = !state.lastReport;
}
function renderInterpretation() {
  renderInterpretationChrome();
  loadTurnstile();
  $("#payload-view").value = JSON.stringify(state.payload, null, 2);
  $("#interp-status").hidden = true;
}

async function copyText(text, btn) {
  const orig = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = t("copied"); }
  catch (e) { const ta = $("#payload-view"); ta.value = text; ta.closest("details").open = true; ta.focus(); ta.select(); btn.textContent = t("copyManual"); }
  setTimeout(() => (btn.textContent = orig), 2500);
}

const refLabel = (r) => r.type === "aspect" ? `${nm(r.a)} ${term(r.aspect)} ${nm(r.b)}`
  : r.type === "angle" ? `${nm(r.angle)} ${t("a.in")} ${term(r.sign)} ${r.deg}`
  : r.type === "configuration" ? `${term(r.configuration)}: ${[r.apex, ...(r.opposition || r.base || r.bodies || [])].filter(Boolean).map(nm).join(", ")}`
  : r.type === "rulership" ? `${t("a.ruler")} ${typeof r.of === "number" ? t("r.house") + " " + ROMAN[r.of] : nm(r.of)}: ${nm(r.ruler)}`
  : r.type === "stellium" ? `Stellium ${t("a.in")} ${r.by === "HOUSE" ? t("r.house") + " " + ROMAN[r.where] : term(r.where)}`
  : r.type === "distribution" ? `${term(r.key)}${r.count != null ? ": " + r.count : ""}${r.bodies ? " (" + r.bodies.map(nm).join(", ") + ")" : ""}`
  : `${nm(r.body)} ${t("a.in")} ${term(r.sign)} ${r.deg}${r.house != null ? ", " + t("r.house") + " " + ROMAN[r.house] : ""}`;
function problemText(p, ref) {
  const H = t("r.house");
  if (p.kind === "missing") return t("a.missing");
  if (p.field === "sign") return t("a.says", { r: term(p.report), c: term(p.chart) });
  if (p.field === "deg") return t("a.says", { r: p.report, c: p.chart });
  if (p.field === "format") return t("a.badFormat", { r: p.report });
  if (p.field === "configuration") return t("a.noConfig");
  if (p.field === "stellium") return t("a.noStellium");
  if (p.field === "ruler") return t("a.says", { r: nm(p.report), c: p.chart ? nm(p.chart) : "—" });
  if (p.field === "count" || p.field === "group") return t("a.says", { r: p.report, c: p.chart });
  if (p.field === "house") return p.chart == null ? t("a.noHouses") : t("a.says", { r: `${H} ${ROMAN[p.report]}`, c: `${H} ${ROMAN[p.chart]}` });
  if (p.field === "angle") return t("a.noAngles");
  if (p.field === "aspect") return t("a.noAspect", { pol: state.payload.engine.aspect_policy });
  if (p.field === "reliability") return t("a.unreliable");
  return p.note || "";
}

function renderAudit(a) {
  const box = $("#audit-out");
  box.hidden = false;
  box.className = "note " + (a.ok ? "ok" : "warn");
  // el alcance se muestra siempre: la auditoría cubre las referencias declaradas, no todo el texto
  const unchecked = (a.unchecked || []).length, undeclared = a.undeclared_degrees || [];
  box.innerHTML = `<strong>${esc(t("a.head", { v: a.verified, t: a.total }))}${a.ok ? "." : esc(t("a.headBad", { n: a.issues.length }))}</strong>` +
    (a.ok ? "" : `<ul>${a.issues.map((i) => `<li>${esc(refLabel(i.ref))}: ${(i.problems || [i]).map((p) => esc(problemText(p, i.ref))).join("; ")}.</li>`).join("")}</ul>
    <p class="small">${esc(t("a.foot"))}</p>`) +
    (unchecked ? `<p class="small">${esc(t("a.unchecked", { n: unchecked }))}</p>` : "") +
    (undeclared.length ? `<p class="small">${esc(t("a.undeclared", { list: undeclared.map((u) => u.text).join(", ") }))}</p>` : "") +
    `<p class="small">${esc(t("a.scope"))}</p>`;
}

function renderReport(rep) {
  const out = $("#report-out"), list = $("#rep-index-list");
  const f = state.last && state.last.f;
  out.replaceChildren(); list.replaceChildren();
  $("#reading").lang = rep.language || "";
  $("#rep-for").textContent = f && f.first ? t("rep.for", { name: f.first }) : t("rep.forAnon");
  $("#rep-title").textContent = rep.title || t("i.h");
  $("#rep-meta").textContent = f ? humanBirth(f) : "";
  rep.sections.forEach((s, n) => {
    const sec = document.createElement("section");
    sec.className = "rep-sec" + (s.id === "dedication" ? " rep-dedication" : s.id === "myth" ? " rep-myth" : "");
    sec.id = "sec-" + n;
    if (V.SECTION_ART[s.id] && s.id !== "dedication") {
      const fig = document.createElement("figure"); fig.className = "art";
      sec.append(fig); V.show(fig, V.SECTION_ART[s.id], { loop: false });
    }
    const h = document.createElement("h2"); h.textContent = s.heading; sec.append(h);
    for (const p of String(s.body_markdown).split(/\n{2,}/)) { const el = document.createElement("p"); el.textContent = p; sec.append(el); }
    out.append(sec);
    if (s.id !== "dedication") {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = "#sec-" + n; a.textContent = s.heading;
      a.addEventListener("click", (e) => { e.preventDefault(); $("#rep-index").open = false; sec.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }); });
      li.append(a); list.append(li);
    }
  });
  $("#rep-index-sum").textContent = t("rep.index", { n: list.children.length });
}

// Al servicio solo viaja lo necesario para interpretar: la fecha, la hora, el lugar y el día juliano no salen del dispositivo.
function servicePayload(p) {
  return {
    schema: p.schema, engine: p.engine, person: { first_name: p.person.first_name }, request: p.request,
    birth: { time_precision: p.birth.time_precision, time_precision_label: p.birth.time_precision_label },
    chart: { ...p.chart, jd_ut: undefined },
    warnings: p.warnings.map((w) => ({ code: w.code })),
  };
}
// Identificador del pedido (servicio 1.5): si la respuesta no llega, el reintento con la misma carta y el mismo código
// reutiliza el identificador y el servicio devuelve el informe ya generado sin descontar otro. Se olvida al recibir
// un informe; una carta o un código distintos generan un identificador nuevo. Vale 48 horas, como la copia del servicio.
const PENDING_KEY = "astroinforme.pending", PENDING_MS = 48 * 3600 * 1000;
async function payloadHash(body) {
  try {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
    return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) { return null; }
}
function newRequestId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { }
  const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function pendingRequestId(code, hash) {
  let p = null; try { p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch (e) { }
  if (p && hash && p.code === code && p.hash === hash && Date.now() - p.at < PENDING_MS) return p.id;
  const id = newRequestId();
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ id, code, hash, at: Date.now() })); } catch (e) { }
  return id;
}
function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch (e) { } }
class ServiceError extends Error { constructor(key, params) { super(key); this.key = key; this.params = params; } }
async function obtainReport() {
  if (CONFIG.demo) {
    await new Promise((r) => setTimeout(r, 4000)); // espera simulada
    const which = ($("#demo-which") && $("#demo-which").value) || (state.demoReports || CONFIG.demoReports)[0].file;
    return { report: (await import("./" + which)).DEMO_REPORT };
  }
  const code = ($("#access-code").value || "").trim();
  if (!publicAccess() && !code) throw new ServiceError("i.err.code_required");
  if (CONFIG.turnstileSiteKey && !ts.token) throw new ServiceError("i.err.bot_pending");
  try { localStorage.setItem("astroinforme.code", code); } catch (e) { }
  let r;
  const headers = { "content-type": "application/json", ...(code ? { "x-astro-code": code } : {}), ...(ts.token ? { "x-turnstile-token": ts.token } : {}) };
  const chartBody = JSON.stringify(servicePayload(state.payload));
  const request_id = pendingRequestId(code, await payloadHash(chartBody));
  // servicio 1.6: la generación sigue aunque el teléfono se bloquee; la app consulta el estado
  if (state.health && state.health.jobs) return obtainReportJob(headers, chartBody, request_id, code);
  try {
    r = await fetch(serviceUrl(), { method: "POST", headers, body: JSON.stringify({ ...JSON.parse(chartBody), request_id }) });
  } catch (e) { resetTurnstile(); throw new ServiceError("i.err.upstream"); }
  resetTurnstile(); // cada verificación sirve para un solo pedido
  // el servicio responde en flujo: espacios de mantenimiento y, al final, un único JSON
  let body = null; try { body = JSON.parse((await r.text()).trim()); } catch (e) { }
  if (!r.ok || (body && body.error)) {
    const k = body && body.error ? "i.err." + body.error : null;
    throw k && L.t(k) !== k ? new ServiceError(k) : new ServiceError("i.status", { status: r.status });
  }
  if (!body) throw new ServiceError("i.badContract");
  clearPending();
  return { report: body.report || body, remaining: body.remaining, recovered: !!body.recovered };
}

// Generación desacoplada (servicio 1.6): POST /jobs crea el trabajo (o devuelve el estado de uno ya creado con el mismo
// request_id) y después se consulta GET /jobs/<id>. Si el teléfono se bloquea, los temporizadores se pausan y la consulta
// sigue al volver; el servicio no depende de la conexión. Un error de red durante la consulta no corta la espera.
const JOB_POLL_MS = 8000, JOB_MAX_MS = 30 * 60 * 1000;
const serviceError = (status, body) => {
  const k = body && body.error ? "i.err." + body.error : null;
  return k && L.t(k) !== k ? new ServiceError(k) : new ServiceError("i.status", { status });
};
async function obtainReportJob(headers, chartBody, request_id, code) {
  let r, body = null;
  try { r = await fetch(serviceUrl() + "jobs", { method: "POST", headers, body: JSON.stringify({ ...JSON.parse(chartBody), request_id }) }); }
  catch (e) { resetTurnstile(); throw new ServiceError("i.err.upstream"); }
  resetTurnstile();
  try { body = await r.json(); } catch (e) { }
  const t0 = Date.now();
  for (;;) {
    if (body && body.report) { clearPending(); return { report: body.report, remaining: body.remaining, recovered: !!body.recovered }; }
    if (body && body.status === "failed") throw serviceError(r.status, body);
    if (!body || (body.error && !body.status)) throw serviceError(r ? r.status : 0, body);
    if (Date.now() - t0 > JOB_MAX_MS) throw new ServiceError("i.err.timeout");
    await new Promise((res) => setTimeout(res, JOB_POLL_MS));
    try {
      r = await fetch(serviceUrl() + "jobs/" + encodeURIComponent(request_id), { headers: code ? { "x-astro-code": code } : {}, cache: "no-store" });
      body = await r.json();
    } catch (e) { body = { status: "pending" }; } // sin conexión por un momento: se vuelve a consultar
  }
}

// ---------- comentario de quien probó el informe (versión piloto) ----------
const FB_MIN = 200;
function initFeedback() {
  const ta = $("#fb-text"), btn = $("#btn-fb"), cnt = $("#fb-count");
  const upd = () => { const n = ta.value.trim().length; btn.disabled = n < FB_MIN; cnt.textContent = t(n < FB_MIN ? "fb.count" : "fb.countOk", { n, min: FB_MIN }); };
  ta.addEventListener("input", upd); upd();
  btn.addEventListener("click", sendFeedback);
}
function showFeedback() {
  if (!CONFIG.pilot || !serviceUrl() || CONFIG.demo) return;
  // el servicio recibe comentarios desde la versión 1.3; con una versión anterior el recuadro no se muestra
  const v = String((state.health && state.health.version) || "0").split(".").map(Number);
  if (v[0] < 1 || (v[0] === 1 && (v[1] || 0) < 3)) return;
  $("#feedback-box").hidden = false; $("#fb-status").hidden = true;
  $("#fb-text").dispatchEvent(new Event("input"));
}
async function sendFeedback() {
  const ta = $("#fb-text"), btn = $("#btn-fb"), st = $("#fb-status");
  const text = ta.value.trim(); if (text.length < FB_MIN) return;
  const code = ($("#access-code").value || "").trim();
  btn.disabled = true; st.hidden = false; st.textContent = t("fb.sending");
  try {
    const r = await fetch(serviceUrl() + "feedback", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-astro-code": code } : {}) },
      body: JSON.stringify({ text, report_title: (state.lastReport && state.lastReport.title) || "" }) });
    const body = await r.json().catch(() => null);
    if (r.ok && body && body.ok) { st.textContent = t("fb.thanks"); ta.value = ""; ta.disabled = true; $("#fb-count").textContent = ""; return; }
    const err = body && body.error;
    st.textContent = err === "feedback_short" ? t("fb.err.feedback_short", { min: FB_MIN }) : err === "feedback_limit" ? t("fb.err.feedback_limit") : (err === "code_invalid" || err === "code_required") ? t("fb.err.code") : t("fb.err.generic");
  } catch (e) { st.textContent = t("fb.err.generic"); }
  btn.disabled = false;
}

// ---------- aviso al terminar: contador, título de la pestaña, sonido, vibración y notificación ----------
const notify = { title: document.title, timer: null, audio: null };
function prepareNotice() {
  // se llama desde el clic: los navegadores solo permiten sonido y permisos tras un gesto de la persona
  try { notify.audio = notify.audio || new (window.AudioContext || window.webkitAudioContext)(); notify.audio.resume(); } catch (e) { }
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => { }); } catch (e) { }
}
function startProgress() {
  const t0 = Date.now(), clock = $("#wait-clock");
  const tick = () => {
    const s = Math.round((Date.now() - t0) / 1000), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, "0");
    clock.textContent = `${mm}:${ss}`;
    document.title = `(${mm}:${ss}) ${notify.title}`;
  };
  tick(); notify.timer = setInterval(tick, 1000);
}
// mientras se escribe el informe, la pantalla no se apaga (donde el navegador lo permite)
const wake = { lock: null, want: false };
async function keepAwake(on) {
  wake.want = on;
  try {
    if (on && "wakeLock" in navigator && !wake.lock) { wake.lock = await navigator.wakeLock.request("screen"); wake.lock.addEventListener("release", () => { wake.lock = null; }); $("#wait-awake").hidden = false; }
    if (!on && wake.lock) { await wake.lock.release(); wake.lock = null; }
  } catch (e) { wake.lock = null; }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && wake.want) keepAwake(true); });
function openWait() {
  const f = state.last && state.last.f;
  $("#wait-who").textContent = f && f.first ? t("wait.who", { name: f.first }) : t("wait.whoAnon");
  $("#wait-awake").hidden = true;
  // con el servicio 1.6 la generación no depende de la conexión: el aviso cambia
  const job = !!(state.health && state.health.jobs && !CONFIG.demo);
  $("#wait-stay").dataset.i18n = job ? "wait.stayJob" : "wait.stay"; $("#wait-stay").textContent = t($("#wait-stay").dataset.i18n);
  $("#wait-stay-text").dataset.i18n = job ? "wait.stayTextJob" : "wait.stayText"; $("#wait-stay-text").textContent = t($("#wait-stay-text").dataset.i18n);
  $("#about-report").open = false;
  $("#wait").hidden = false;
  document.documentElement.style.overflow = "hidden";
  V.show($("#fig-reader"), CONFIG.pilot ? "pilot_rabbit" : "report_reader");
  keepAwake(true);
}
function closeWait() {
  $("#wait").hidden = true;
  document.documentElement.style.overflow = "";
  V.clear($("#fig-reader"));
  keepAwake(false);
}
function chime() {
  const ctx = notify.audio; if (!ctx) return;
  try {
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + i * 0.22;
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.55);
    });
  } catch (e) { }
}
function finishProgress(ok) {
  clearInterval(notify.timer); notify.timer = null;
  const msg = t(ok ? "i.doneTitle" : "i.failTitle");
  document.title = `${ok ? "✓" : "✗"} ${msg} · ${notify.title}`;
  chime();
  try { navigator.vibrate && navigator.vibrate(ok ? [200, 100, 200] : [400]); } catch (e) { }
  if (document.hidden) {
    try { if ("Notification" in window && Notification.permission === "granted") new Notification("AsterOrbis", { body: msg, tag: "astroinforme" }); } catch (e) { }
  }
  const restore = () => { if (!document.hidden) { setTimeout(() => { document.title = notify.title; }, 8000); document.removeEventListener("visibilitychange", restore); } };
  document.addEventListener("visibilitychange", restore); restore();
}

async function callInterpreter() {
  const btn = $("#btn-interp"), status = $("#interp-status");
  // los errores que se detectan antes de enviar se muestran sin abrir la espera
  if (!CONFIG.demo && !publicAccess() && !($("#access-code").value || "").trim()) {
    status.hidden = false; status.textContent = t("i.fail", { msg: t("i.err.code_required") }); $("#access-code").focus(); return;
  }
  btn.disabled = true;
  prepareNotice();
  status.hidden = true;
  openWait();
  if (CONFIG.demo) $("#wait-clock").textContent = "…"; else startProgress();
  let ok = false;
  try {
    const { report: rep, remaining, recovered } = await obtainReport();
    if (!rep || rep.schema !== "astroinforme.report/v1" || !Array.isArray(rep.sections)) throw new ServiceError("i.badContract");
    // la auditoría se rehace siempre aquí, aunque el servicio ya la haya hecho
    const audit = auditReport(rep, state.payload);
    state.lastReport = rep; state.lastAudit = audit;
    clearInterval(notify.timer);
    renderReport(rep);
    renderAudit(audit);
    V.clear($("#fig-closure"));
    if (audit.ok) V.show($("#fig-closure"), "closure_serendipity");
    const rs = $("#report-status");
    rs.textContent = recovered ? t("i.recovered") : (remaining != null ? t("i.remaining", { n: remaining }) : ""); rs.hidden = !rs.textContent;
    ok = true;
  } catch (e) {
    clearInterval(notify.timer);
    status.hidden = false;
    status.textContent = t("i.fail", { msg: e instanceof ServiceError ? t(e.key, e.params) : e.message });
  }
  closeWait();
  if (!CONFIG.demo) finishProgress(ok);
  if (ok) { showFeedback(); setScreen("report"); }
  else { try { status.scrollIntoView({ behavior: "auto", block: "center" }); } catch (e) { } }
  btn.disabled = false;
  renderInterpretationChrome();
  if (serviceUrl() && !CONFIG.demo) checkService();
}

// ---------- guardar: imprimir o descargar ----------
function printSheet() { document.querySelectorAll(".more-tech").forEach((d) => { d.dataset.was = d.open ? "1" : ""; d.open = true; }); window.print(); }

// La descarga se arma entera en el idioma del informe (si no hay informe, en el de la interfaz), aunque la interfaz
// esté en otro: así no quedan títulos en un idioma y texto en otro.
function downloadSheet() {
  if (!state.chart || !state.last) return;
  const rep = state.lastReport;
  const ui = L.getLang(), lang = rep && L.LANGS.includes(rep.language) ? rep.language : ui;
  L.setLang(lang);
  try { buildDownload(lang); } finally { L.setLang(ui); }
}
function buildDownload(lang) {
  const { f, opt } = state.last, chart = state.chart, rep = state.lastReport;
  const row = (cells, tag = "td") => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
  const pos = chart.bodies.map((b) => row([esc(nm(b.id)), esc(`${b.deg} ${term(b.sign)}${b.retrograde ? " R" : ""}`), chart.houses ? ROMAN[b.house] : ""]));
  const asp = chart.aspects.map((a) => row([esc(`${nm(a.a)} ${term(a.aspect)} ${nm(a.b)}`), `${a.orb.toFixed(2)}°`]));
  const reportHTML = rep ? rep.sections.map((s) => `<h2>${esc(s.heading)}</h2>` + String(s.body_markdown).split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")).join("") : "";
  const audit = state.lastAudit ? `<p class="m">${esc(t("a.head", { v: state.lastAudit.verified, t: state.lastAudit.total }))}${state.lastAudit.ok ? "." : esc(t("a.headBad", { n: state.lastAudit.issues.length }))}</p>` : "";
  const ascLine = chart.houses ? `${term("ASC")} ${E.fmtDeg(chart.houses.asc)} ${term(E.SIGNS[Math.floor(chart.houses.asc / 30)])} · ${term("MC")} ${E.fmtDeg(chart.houses.mc)} ${term(E.SIGNS[Math.floor(chart.houses.mc / 30)])}` : t("r.noTime");
  const title = rep && rep.title ? rep.title : (f.first ? t("r.titleNamed", { name: f.first }) : t("r.title"));
  const doc = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.6 Georgia,serif;color:#1c2230;background:#fff;max-width:44rem;margin:0 auto;padding:24px 16px}h1{font-weight:500;line-height:1.15}h2{font-weight:500;margin-top:1.8em}.m{font:13px/1.5 ui-monospace,Menlo,monospace;color:#5d6573}table{border-collapse:collapse;width:100%;font:13px/1.4 ui-monospace,Menlo,monospace}td,th{border-bottom:1px solid #ccc;padding:4px 8px 4px 0;text-align:left}details{margin:1.5em 0}footer{margin-top:3em;border-top:1px solid #ccc;padding-top:12px;font-size:13px;color:#5d6573}</style></head><body>
<h1>${esc(title)}</h1>
<p class="m">${esc(humanBirth(f))}</p>
<p class="m">${esc(ascLine)}</p>
${reportHTML}
${audit}
<details${rep ? "" : " open"}><summary>${esc(t("dl.tech"))}</summary>
<table>${row([t("th.point"), t("th.position"), chart.houses ? t("th.house") : ""], "th")}${pos.join("")}</table>
<h3>${esc(t("h.aspects"))}</h3><table>${row([t("th.aspect"), t("th.orb")], "th")}${asp.join("")}</table>
<p class="m">${esc(provText(f, opt, chart))}</p></details>
<footer><p>${esc(t("disclaimer"))}</p><p>${esc(t("footer.credit"))} Bárbara Gutiérrez · barbaragutierrez.art</p><p>${esc(t("dl.generated", { date: new Date().toLocaleDateString(LOCALE[lang]) }))} https://barbara-netizen.github.io/astroinforme/</p></footer>
</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  const slug = (f.first || "carta").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "carta";
  a.href = URL.createObjectURL(blob); a.download = `asterorbis-${slug}-${state.payload.birth.local_date}.html`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- idioma ----------
function applyLanguage(lang, { remember = true } = {}) {
  L.setLang(lang);
  if (remember) L.rememberLang(lang);
  setRegionNames();
  V.setLang(lang);
  L.applyStatic();
  $("#ui-lang").value = lang;
  if (!state.reportLangTouched) $("#lang").value = lang;
  showEngineState();
  renderInterpretationChrome();
  if (state.place) showPlace();
  if (state.chart) render(false);
  if (state.lastReport) renderReport(state.lastReport);
  if (state.lastAudit) renderAudit(state.lastAudit);
  $("#privacy-link").href = "privacidad.html#" + lang;
  document.title = t("app.title");
  try { notify.title = document.title; } catch (e) { } // el aviso de fin restaura este título
  renderDonation();
}

// ---------- eventos ----------
function initVisuals() {
  if (CONFIG.pilot) { $("#pilot").hidden = false; V.show($("#fig-pilot"), "pilot_rabbit"); }
  // la portada animada se ve de entrada; con movimiento reducido, V.show muestra su fotograma fijo
  V.show($("#fig-hero"), "intro_embroidery");
  V.show($("#fig-offer"), "report_reader");
}

function limitLanguages() {
  // enlace de prueba: con ?idiomas=todos en la dirección se muestran los tres idiomas aunque la configuración pública
  // tenga solo uno (para revisar textos e informes en alemán e inglés antes de abrirlos)
  let test = false; try { test = new URLSearchParams(location.search).get("idiomas") === "todos"; } catch (e) { }
  const allowed = test ? L.LANGS : (CONFIG.languages && CONFIG.languages.length) ? CONFIG.languages.filter((l) => L.LANGS.includes(l)) : L.LANGS;
  for (const sel of [$("#ui-lang"), $("#lang")]) for (const o of [...sel.options]) if (!allowed.includes(o.value)) o.remove();
  $(".langsel").hidden = allowed.length < 2;
  return allowed;
}

function renderDonation() {
  const d = CONFIG.donation || {};
  const links = (d.links || []).filter((x) => x && x.url);
  const box = $("#donation");
  box.hidden = !links.length && !d.alias;
  if (box.hidden) return;
  $("#donation-links").innerHTML = links.map((x) => `<a class="btn ghost" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.amount || t("don.give"))}</a>`).join("");
  $("#donation-alias").hidden = !d.alias;
  if (d.alias) $("#donation-alias").textContent = t("don.alias", { alias: d.alias });
}

function init() {
  // al imprimir, los datos técnicos plegados se incluyen completos
  window.addEventListener("beforeprint", () => document.querySelectorAll(".more-tech").forEach((d) => { if (d.dataset.was === undefined) d.dataset.was = d.open ? "1" : ""; d.open = true; }));
  window.addEventListener("afterprint", () => document.querySelectorAll(".more-tech").forEach((d) => { d.open = d.dataset.was === "1"; delete d.dataset.was; }));
  // impresión (Guardar PDF) en el idioma del informe: la página cambia de idioma mientras se imprime y después vuelve
  window.addEventListener("beforeprint", () => {
    const rl = state.lastReport && state.lastReport.language;
    if (rl && L.LANGS.includes(rl) && rl !== L.getLang()) { state.printLangRestore = L.getLang(); applyLanguage(rl, { remember: false }); }
  });
  window.addEventListener("afterprint", () => {
    if (state.printLangRestore) { const back = state.printLangRestore; state.printLangRestore = null; applyLanguage(back, { remember: false }); }
  });
  setScreen("form", { push: false, top: false });
  try { history.replaceState({ screen: "form" }, ""); } catch (e) { }
  const allowed = limitLanguages();
  const first = L.initialLang();
  L.setLang(allowed.includes(first) ? first : allowed[0]);
  setRegionNames();
  V.setLang(L.getLang());
  initVisuals();
  initFeedback();
  applyLanguage(L.getLang(), { remember: false });
  try { $("#access-code").value = localStorage.getItem("astroinforme.code") || ""; } catch (e) { }
  $("#ui-lang").addEventListener("change", (e) => applyLanguage(e.target.value));
  $("#lang").addEventListener("change", () => { state.reportLangTouched = true; });
  $("#gender").addEventListener("change", (e) => {
    if (!state.payload) return;
    state.payload.request.address_gender = e.target.value; state.last.f.gender = e.target.value;
    $("#payload-view").value = JSON.stringify(state.payload, null, 2);
  });
  try { const zones = Intl.supportedValuesOf("timeZone"); $("#tz-list").innerHTML = zones.map((z) => `<option value="${z}">`).join(""); } catch (e) { }
  const pq = $("#place-q");
  pq.addEventListener("focus", () => { loadCities().catch(() => { }); ensureEngine().catch(() => { }); }, { once: true });
  let searchTimer = null, searchSeq = 0;
  async function doSearch() {
    const q = pq.value.trim(), box = $("#place-results"), seq = ++searchSeq;
    if (q.length < 2) { hidePlaceResults(); return; }
    if (!cities) { box.hidden = false; box.innerHTML = `<li class="empty">${esc(t("place.loading"))}</li>`; }
    try { await loadCities(); } catch (e) { box.hidden = false; box.innerHTML = `<li class="empty">${esc(t("place.fail"))}</li>`; return; }
    if (seq !== searchSeq) return; // llegó una búsqueda más nueva
    renderPlaceResults(searchCities(q).slice(0, 8));
  }
  pq.addEventListener("input", () => {
    if (state.place && state.place.source !== "MANUAL") { state.place = null; showPlace(); }
    clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 120);
  });
  pq.addEventListener("keydown", (e) => {
    const open = !$("#place-results").hidden && placeUI.list.length;
    if (e.key === "ArrowDown" && open) { e.preventDefault(); movePlace(1); }
    else if (e.key === "ArrowUp" && open) { e.preventDefault(); movePlace(-1); }
    else if (e.key === "Enter") { e.preventDefault(); if (open && placeUI.active >= 0) choosePlace(placeUI.list[placeUI.active]); else doSearch(); }
    else if (e.key === "Escape") hidePlaceResults();
  });
  pq.addEventListener("blur", () => setTimeout(hidePlaceResults, 150));
  $("#manual-coords-toggle").addEventListener("change", (e) => { $("#manual-coords").hidden = !e.target.checked; });
  $("#mc-apply").addEventListener("click", () => {
    const lat = parseFloat($("#mc-lat").value.replace(",", ".")), lon = parseFloat($("#mc-lon").value.replace(",", "."));
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) { setStatus($("#form-error"), "bad", esc(t("err.coords"))); return; }
    state.place = { label: $("#mc-label").value.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon, zone: E.zoneFor(lat, lon), source: "MANUAL" };
    showPlace();
  });
  $("#tz").addEventListener("change", () => { if (state.place) state.place.zone = $("#tz").value; });
  $("#use-manual-offset").addEventListener("change", (e) => { $("#manual-offset-row").hidden = !e.target.checked; });
  const syncTime = () => { const unk = $("#no-time").checked; $("#btime").disabled = unk; };
  $("#no-time").addEventListener("change", (e) => { if (e.target.checked) $("#prec").value = "UNKNOWN"; else if ($("#prec").value === "UNKNOWN") $("#prec").value = "PM15"; syncTime(); });
  $("#prec").addEventListener("change", (e) => { $("#no-time").checked = e.target.value === "UNKNOWN"; syncTime(); });
  $("#birth-form").addEventListener("submit", (e) => { e.preventDefault(); $("#ambig").hidden = true; calculate(); });
  $("#btn-copy-json").addEventListener("click", (e) => copyText(JSON.stringify(state.payload, null, 2), e.currentTarget));
  $("#btn-interp").addEventListener("click", callInterpreter);
  $("#btn-print").addEventListener("click", printSheet);
  $("#btn-print-2").addEventListener("click", printSheet);
  $("#btn-print-chart").addEventListener("click", printSheet);
  $("#btn-edit").addEventListener("click", () => setScreen("form"));
  $("#btn-to-chart").addEventListener("click", () => setScreen("chart"));
  $("#btn-back-report").addEventListener("click", () => setScreen("report"));
  $("#brand").addEventListener("click", (e) => { e.preventDefault(); setScreen("form"); });
  $("#btn-download").addEventListener("click", downloadSheet);
  $("#access-code").addEventListener("input", renderInterpretationChrome);
  $("#btn-example").addEventListener("click", loadExample);
}

function loadExample() {
  $("#fname").value = t("f.fname.ph"); $("#bdate").value = "1990-07-14"; $("#btime").value = "15:20"; $("#prec").value = "PM15"; $("#no-time").checked = false; $("#btime").disabled = false;
  loadCities().then(() => { const c = searchCities("Hamburg")[0]; if (c) { choosePlace(c); calculate(); } });
}

init();
ensureEngine().catch(() => { });
checkService();
// demostración con varias cartas de prueba: un selector arriba del formulario
function loadDemoCase(c) {
  $("#fname").value = c.first; $("#bdate").value = c.date; $("#btime").value = c.time || ""; $("#prec").value = c.precision;
  $("#btime").disabled = c.precision === "UNKNOWN"; $("#no-time").checked = c.precision === "UNKNOWN";
  $("#manual-coords-toggle").checked = true; $("#manual-coords").hidden = false;
  $("#mc-lat").value = c.lat; $("#mc-lon").value = c.lon; $("#mc-label").value = c.placeLabel;
  $("#mc-apply").click();
  state.demoReports = c.reports;
  ensureEngine().then(() => calculate()).catch(() => { });
}
if (CONFIG.demo && CONFIG.demoCases) {
  const wrap = document.createElement("label"); wrap.className = "f demo-case";
  wrap.innerHTML = `<span>Carta de prueba</span><select id="demo-case">${CONFIG.demoCases.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join("")}</select>`;
  $("#birth-form").prepend(wrap);
  $("#demo-case").addEventListener("change", (e) => loadDemoCase(CONFIG.demoCases[+e.target.value]));
  loadDemoCase(CONFIG.demoCases[0]);
} else if (CONFIG.demo && CONFIG.demoBirth) {
  const d = CONFIG.demoBirth;
  $("#fname").value = d.first; $("#bdate").value = d.date; $("#btime").value = d.time; $("#prec").value = d.precision;
  $("#manual-coords-toggle").checked = true; $("#manual-coords").hidden = false;
  $("#mc-lat").value = d.lat; $("#mc-lon").value = d.lon; $("#mc-label").value = d.placeLabel;
  $("#mc-apply").click();
  ensureEngine().then(() => calculate()).catch(() => { });
}
