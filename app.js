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
const state = { place: null, chart: null, payload: null, engineReady: null, engineInfo: null, engineErr: null, last: null, lastReport: null, lastAudit: null, reportLangTouched: false, heroAnimated: false };

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

function renderPlaceResults(list) {
  const box = $("#place-results");
  if (!list.length) { box.innerHTML = `<p class="muted small">${esc(t("place.none"))}</p>`; box.hidden = false; return; }
  const fmt = new Intl.NumberFormat(LOCALE[L.getLang()]);
  box.innerHTML = list.map((c, i) => `<button type="button" class="place-opt" data-i="${i}"><span class="pn">${esc(c.n)}</span><span class="pm">${esc(country(c.cc))} · ${fmt.format(c.pop)} ${t("place.inhab")} · ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}</span></button>`).join("");
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
  const W = L.getLang() === "es" ? "O" : "W";
  $("#pc-coords").textContent = `${Math.abs(p.lat).toFixed(4)}° ${p.lat >= 0 ? "N" : "S"} · ${Math.abs(p.lon).toFixed(4)}° ${p.lon >= 0 ? "E" : W}`;
  $("#tz").value = p.zone;
}

// ---------- cálculo ----------
class FormError extends Error { constructor(key, params) { super(key); this.key = key; this.params = params; } }
function readForm() {
  const d = $("#bdate").value, tm = $("#btime").value, prec = $("#prec").value;
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
  $("#result").hidden = false;
  const by = Object.fromEntries(chart.bodies.map((b) => [b.id, b]));
  const mark = (ok) => ok === false ? ` <span class="uns" title="${esc(t("r.mark"))}">◇</span>` : "";
  const H = t("r.house");
  const ascTxt = chart.houses ? `${E.fmtDeg(chart.houses.asc)} ${term(E.SIGNS[Math.floor(chart.houses.asc / 30)])}` : t("r.noTime");
  $("#r-title").textContent = f.first ? t("r.titleNamed", { name: f.first }) : t("r.title");
  $("#r-meta").textContent = `${state.payload.birth.local_date}${f.prec === "UNKNOWN" ? " · " + t("r.unknownTime") : " · " + state.payload.birth.local_time + " (" + state.payload.birth.time_precision_label + ")"} · ${state.place.label} · ${fmtOffset(opt.offsetMin)} · ${fmtUtc(opt.utcMs)}`;
  $("#r-big3").innerHTML = [
    [term("SUN"), posStr(by.SUN) + (chart.houses ? ` · ${H} ${ROMAN[by.SUN.house]}` : ""), by.SUN.reliable],
    [term("MOON"), posStr(by.MOON) + (chart.houses ? ` · ${H} ${ROMAN[by.MOON.house]}` : ""), by.MOON.reliable],
    [term("ASC"), ascTxt, !chart.sensitivity.unreliable.some((u) => u.item === "ASC")],
  ].map(([k, v, ok]) => `<div class="b3"><span class="lab">${esc(k)}</span><span class="val">${esc(v)}${mark(ok)}</span></div>`).join("");

  $("#r-warn").innerHTML = warnings.map((w) => `<li><code>${w.code}</code> ${esc(t("w." + w.code, w.params))}</li>`).join("");
  $("#r-warn-box").hidden = !warnings.length;

  $("#wheel").innerHTML = wheelSVG(chart);

  // posiciones: el movimiento va junto al grado (R, est.) para que la tabla entre en el celular
  const motion = (b) => `${b.retrograde ? `<span class="rx" title="${esc(t("r.rx"))}">R</span>` : ""}${b.stationary ? `<span class="rx" title="${esc(t("r.stTitle"))}">${t("r.st")}</span>` : ""}`;
  $("#t-pos").innerHTML = `<thead><tr><th>${t("th.point")}</th><th>${t("th.position")}</th>${chart.houses ? `<th>${t("th.house")}</th>` : ""}</tr></thead><tbody>` +
    chart.bodies.map((b) => `<tr><td><span class="gl">${g(GLYPH[b.id])}</span> ${esc(nm(b.id))}</td><td class="num">${degHTML(b.deg)} ${esc(term(b.sign))}${motion(b)}${mark(b.reliable)}</td>${chart.houses ? `<td class="num">${ROMAN[b.house]}${b.near_next_cusp ? ` <span class='muted' title='${esc(t("r.nearCusp"))}'>↦</span>` : ""}</td>` : ""}</tr>`).join("") +
    `<tr><td><span class="gl">${g("☋")}</span> ${esc(nm("SOUTH_NODE"))}</td><td class="num">${degHTML(chart.south_node.deg)} ${esc(term(chart.south_node.sign))}</td>${chart.houses ? `<td class="num">${ROMAN[chart.south_node.house]}</td>` : ""}</tr></tbody>`;

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

  $("#prov").textContent = t("prov", {
    engine: chart.ephemeris.engine, flags: "SEFLG_SWIEPH|SEFLG_SPEED",
    sys: chart.houses ? chart.houses.system_effective : t("prov.noHouses"), pol: chart.aspect_policy, zone: f.zone,
    src: t(state.payload.birth.offset_source === "MANUAL" ? "prov.manual" : "prov.iana"), place: state.place.source, ver: E.ENGINE_VERSION,
  });

  if (scroll) {
    renderInterpretation();
    V.show($("#fig-eyes"), "verification_eyes", { loop: false });
    $("#result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
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
  $("#demo-note").hidden = !CONFIG.demo;
  $("#interp-conn-text").hidden = !!CONFIG.demo;
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
  const pill = $("#pill-interp");
  pill.className = "pill " + (serviceUrl() ? "ok" : "no");
  pill.dataset.i18n = serviceUrl() ? "pill.conn" : "pill.no";
  pill.textContent = t(pill.dataset.i18n);
}
function renderInterpretation() {
  renderInterpretationChrome();
  loadTurnstile();
  $("#payload-view").value = JSON.stringify(state.payload, null, 2);
  $("#report-out").hidden = true; $("#audit-out").hidden = true; $("#interp-status").hidden = true;
  V.clear($("#fig-reader")); V.clear($("#fig-closure"));
}

async function copyText(text, btn) {
  const orig = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = t("copied"); }
  catch (e) { const ta = $("#payload-view"); ta.value = text; ta.closest("details").open = true; ta.focus(); ta.select(); btn.textContent = t("copyManual"); }
  setTimeout(() => (btn.textContent = orig), 2500);
}

const refLabel = (r) => r.type === "aspect" ? `${nm(r.a)} ${term(r.aspect)} ${nm(r.b)}`
  : r.type === "angle" ? `${nm(r.angle)} ${t("a.in")} ${term(r.sign)} ${r.deg}` : `${nm(r.body)} ${t("a.in")} ${term(r.sign)} ${r.deg}${r.house != null ? ", " + t("r.house") + " " + ROMAN[r.house] : ""}`;
function problemText(p, ref) {
  const H = t("r.house");
  if (p.kind === "missing") return t("a.missing");
  if (p.field === "sign") return t("a.says", { r: term(p.report), c: term(p.chart) });
  if (p.field === "deg") return t("a.says", { r: p.report, c: p.chart });
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
  box.innerHTML = `<strong>${esc(t("a.head", { v: a.verified, t: a.total }))}${a.ok ? "." : esc(t("a.headBad", { n: a.issues.length }))}</strong>` +
    (a.ok ? "" : `<ul>${a.issues.map((i) => `<li>${esc(refLabel(i.ref))}: ${(i.problems || [i]).map((p) => esc(problemText(p, i.ref))).join("; ")}.</li>`).join("")}</ul>
    <p class="small">${esc(t("a.foot"))}</p>`);
}

function renderReport(rep) {
  const out = $("#report-out");
  out.hidden = false;
  out.replaceChildren();
  out.lang = rep.language || "";
  for (const s of rep.sections) {
    const sec = document.createElement("section"); sec.className = "rep-sec" + (s.id === "dedication" ? " rep-dedication" : "");
    const h = document.createElement("h3"); h.textContent = s.heading; sec.append(h);
    const paras = String(s.body_markdown).split(/\n{2,}/);
    paras.forEach((p, i) => {
      const el = document.createElement("p"); el.textContent = p; sec.append(el);
      if (i === 0 && V.SECTION_ART[s.id]) {
        const fig = document.createElement("figure"); fig.className = "art art-section";
        sec.append(fig); V.show(fig, V.SECTION_ART[s.id], { loop: false });
      }
    });
    out.append(sec);
  }
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
  try {
    r = await fetch(serviceUrl(), { method: "POST", headers, body: JSON.stringify(servicePayload(state.payload)) });
  } catch (e) { resetTurnstile(); throw new ServiceError("i.err.upstream"); }
  resetTurnstile(); // cada verificación sirve para un solo pedido
  // el servicio responde en flujo: espacios de mantenimiento y, al final, un único JSON
  let body = null; try { body = JSON.parse((await r.text()).trim()); } catch (e) { }
  if (!r.ok || (body && body.error)) {
    const k = body && body.error ? "i.err." + body.error : null;
    throw k && L.t(k) !== k ? new ServiceError(k) : new ServiceError("i.status", { status: r.status });
  }
  if (!body) throw new ServiceError("i.badContract");
  return { report: body.report || body, remaining: body.remaining };
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
function startProgress(status) {
  const t0 = Date.now();
  const tick = () => {
    const s = Math.round((Date.now() - t0) / 1000), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, "0");
    status.textContent = t("i.generating", { time: `${mm}:${ss}` });
    document.title = `(${mm}:${ss}) ${notify.title}`;
  };
  tick(); notify.timer = setInterval(tick, 1000);
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
    try { if ("Notification" in window && Notification.permission === "granted") new Notification("ASTROINFORME", { body: msg, tag: "astroinforme" }); } catch (e) { }
  }
  const restore = () => { if (!document.hidden) { setTimeout(() => { document.title = notify.title; }, 8000); document.removeEventListener("visibilitychange", restore); } };
  document.addEventListener("visibilitychange", restore); restore();
}

async function callInterpreter() {
  const out = $("#report-out"), btn = $("#btn-interp"), status = $("#interp-status");
  btn.disabled = true; // un informe anterior queda visible hasta que llegue el nuevo
  prepareNotice();
  status.hidden = false;
  if (CONFIG.demo) status.textContent = t("i.demoWaiting"); else startProgress(status);
  $("#about-report").open = true;
  V.clear($("#fig-closure")); V.show($("#fig-reader"), "report_reader");
  let ok = false;
  try {
    const { report: rep, remaining } = await obtainReport();
    if (!rep || rep.schema !== "astroinforme.report/v1" || !Array.isArray(rep.sections)) throw new ServiceError("i.badContract");
    V.clear($("#fig-reader"));
    // la auditoría se rehace siempre aquí, aunque el servicio ya la haya hecho
    const audit = auditReport(rep, state.payload);
    state.lastReport = rep; state.lastAudit = audit;
    renderAudit(audit);
    renderReport(rep);
    ok = true;
    clearInterval(notify.timer);
    status.textContent = t("i.doneTitle") + (remaining != null ? " " + t("i.remaining", { n: remaining }) : ""); status.hidden = false;
    if (audit.ok) V.show($("#fig-closure"), "closure_serendipity");
  } catch (e) {
    clearInterval(notify.timer);
    V.clear($("#fig-reader")); status.hidden = false;
    status.textContent = t("i.fail", { msg: e instanceof ServiceError ? t(e.key, e.params) : e.message });
  }
  if (!CONFIG.demo) finishProgress(ok);
  $("#about-report").open = false;
  if (ok) showFeedback();
  if (ok) { try { status.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { } }
  btn.disabled = false;
  if (serviceUrl() && !CONFIG.demo) checkService();
}

// ---------- guardar: imprimir o descargar ----------
function printSheet() { window.print(); }

function downloadSheet() {
  if (!state.chart || !state.last) return;
  const { f } = state.last, chart = state.chart, rep = state.lastReport, H = t("r.house");
  const lang = rep && rep.language ? rep.language : L.getLang();
  const row = (cells, tag = "td") => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
  const pos = chart.bodies.map((b) => row([esc(nm(b.id)), esc(`${b.deg} ${term(b.sign)}${b.retrograde ? " R" : ""}`), chart.houses ? ROMAN[b.house] : ""]));
  const asp = chart.aspects.map((a) => row([esc(`${nm(a.a)} ${term(a.aspect)} ${nm(a.b)}`), `${a.orb.toFixed(2)}°`]));
  const reportHTML = rep ? rep.sections.map((s) => `<h2>${esc(s.heading)}</h2>` + String(s.body_markdown).split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")).join("") : "";
  const audit = state.lastAudit ? `<p class="m">${esc(t("a.head", { v: state.lastAudit.verified, t: state.lastAudit.total }))}${state.lastAudit.ok ? "." : esc(t("a.headBad", { n: state.lastAudit.issues.length }))}</p>` : "";
  const ascLine = chart.houses ? `${term("ASC")} ${E.fmtDeg(chart.houses.asc)} ${term(E.SIGNS[Math.floor(chart.houses.asc / 30)])} · ${term("MC")} ${E.fmtDeg(chart.houses.mc)} ${term(E.SIGNS[Math.floor(chart.houses.mc / 30)])}` : t("r.noTime");
  const title = rep && rep.title ? rep.title : $("#r-title").textContent;
  const doc = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.6 Georgia,serif;color:#1c2230;background:#fff;max-width:44rem;margin:0 auto;padding:24px 16px}h1{font-weight:500;line-height:1.15}h2{font-weight:500;margin-top:1.8em}.m{font:13px/1.5 ui-monospace,Menlo,monospace;color:#5d6573}table{border-collapse:collapse;width:100%;font:13px/1.4 ui-monospace,Menlo,monospace}td,th{border-bottom:1px solid #ccc;padding:4px 8px 4px 0;text-align:left}details{margin:1.5em 0}footer{margin-top:3em;border-top:1px solid #ccc;padding-top:12px;font-size:13px;color:#5d6573}</style></head><body>
<h1>${esc(title)}</h1>
<p class="m">${esc($("#r-meta").textContent)}</p>
<p class="m">${esc(ascLine)}</p>
${reportHTML}
${audit}
<details${rep ? "" : " open"}><summary>${esc(t("r.eyebrow"))}</summary>
<table>${row([t("th.point"), t("th.position"), chart.houses ? t("th.house") : ""], "th")}${pos.join("")}</table>
<h3>${esc(t("h.aspects"))}</h3><table>${row([t("th.aspect"), t("th.orb")], "th")}${asp.join("")}</table>
<p class="m">${esc($("#prov").textContent)}</p></details>
<footer><p>${esc(t("disclaimer"))}</p><p>${esc(t("footer.credit"))} Bárbara Gutiérrez · barbaragutierrez.art</p><p>${esc(t("dl.generated", { date: new Date().toLocaleDateString(LOCALE[L.getLang()]) }))} https://barbara-netizen.github.io/astroinforme/</p></footer>
</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  const slug = (f.first || "carta").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "carta";
  a.href = URL.createObjectURL(blob); a.download = `astroinforme-${slug}-${state.payload.birth.local_date}.html`;
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
  $("#btn-hero-anim").textContent = t(state.heroAnimated ? "hero.still" : "hero.anim");
  showEngineState();
  renderInterpretationChrome();
  if (state.place) showPlace();
  if (state.chart) render(false);
  if (state.lastAudit) renderAudit(state.lastAudit);
  $("#privacy-link").href = "privacidad.html#" + lang;
  renderDonation();
}

// ---------- eventos ----------
function initVisuals() {
  if (CONFIG.pilot) { $("#pilot").hidden = false; V.show($("#fig-pilot"), "pilot_rabbit"); }
  const hero = $("#fig-hero"), btn = $("#btn-hero-anim");
  // la portada animada se ve de entrada; quien pidió menos movimiento en su sistema ve la imagen fija
  state.heroAnimated = !V.reducedMotion();
  V.show(hero, state.heroAnimated ? "intro_embroidery" : "hero_levitar");
  btn.textContent = t(state.heroAnimated ? "hero.still" : "hero.anim");
  const sync = () => { btn.hidden = V.reducedMotion(); if (V.reducedMotion() && state.heroAnimated) { state.heroAnimated = false; V.show(hero, "hero_levitar"); btn.textContent = t("hero.anim"); } };
  sync(); V.onReducedMotionChange(sync);
  btn.addEventListener("click", () => {
    state.heroAnimated = !state.heroAnimated;
    V.show(hero, state.heroAnimated ? "intro_embroidery" : "hero_levitar");
    btn.textContent = t(state.heroAnimated ? "hero.still" : "hero.anim");
  });
}

function limitLanguages() {
  const allowed = (CONFIG.languages && CONFIG.languages.length) ? CONFIG.languages.filter((l) => L.LANGS.includes(l)) : L.LANGS;
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
  const more = document.querySelector(".more-tech"); let wasOpen = false;
  window.addEventListener("beforeprint", () => { if (more) { wasOpen = more.open; more.open = true; } });
  window.addEventListener("afterprint", () => { if (more) more.open = wasOpen; });
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
  $("#place-q").addEventListener("focus", () => { loadCities().catch(() => { }); ensureEngine().catch(() => { }); }, { once: true });
  $("#place-form-btn").addEventListener("click", doSearch);
  $("#place-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  async function doSearch() {
    const q = $("#place-q").value; const box = $("#place-results");
    box.hidden = false; box.innerHTML = `<p class="muted small">${esc(t("place.loading"))}</p>`;
    const wf = $("#fig-wait"); let shown = false;
    const timer = setTimeout(() => { shown = true; V.show(wf, "analysis_neural"); }, 250);
    try { await loadCities(); } catch (e) { clearTimeout(timer); V.clear(wf); box.innerHTML = `<p class="note bad">${esc(t("place.fail"))}</p>`; return; }
    clearTimeout(timer); if (shown) V.clear(wf);
    renderPlaceResults(searchCities(q));
  }
  $("#manual-coords-toggle").addEventListener("change", (e) => { $("#manual-coords").hidden = !e.target.checked; });
  $("#mc-apply").addEventListener("click", () => {
    const lat = parseFloat($("#mc-lat").value.replace(",", ".")), lon = parseFloat($("#mc-lon").value.replace(",", "."));
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) { setStatus($("#form-error"), "bad", esc(t("err.coords"))); return; }
    state.place = { label: $("#mc-label").value.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon, zone: E.zoneFor(lat, lon), source: "MANUAL" };
    showPlace();
  });
  $("#tz").addEventListener("change", () => { if (state.place) state.place.zone = $("#tz").value; });
  $("#use-manual-offset").addEventListener("change", (e) => { $("#manual-offset-row").hidden = !e.target.checked; });
  $("#prec").addEventListener("change", (e) => { $("#btime").disabled = e.target.value === "UNKNOWN"; });
  $("#birth-form").addEventListener("submit", (e) => { e.preventDefault(); $("#ambig").hidden = true; calculate(); });
  $("#btn-copy-json").addEventListener("click", (e) => copyText(JSON.stringify(state.payload, null, 2), e.currentTarget));
  $("#btn-interp").addEventListener("click", callInterpreter);
  $("#btn-print").addEventListener("click", printSheet);
  $("#btn-download").addEventListener("click", downloadSheet);
  $("#access-code").addEventListener("input", renderInterpretationChrome);
  $("#btn-example").addEventListener("click", loadExample);
}

function loadExample() {
  $("#fname").value = t("f.fname.ph"); $("#bdate").value = "1990-07-14"; $("#btime").value = "15:20"; $("#prec").value = "PM15"; $("#btime").disabled = false;
  loadCities().then(() => { const c = searchCities("Hamburg")[0]; if (c) { choosePlace(c); calculate(); } });
}

init();
ensureEngine().catch(() => { });
checkService();
// demostración con varias cartas de prueba: un selector arriba del formulario
function loadDemoCase(c) {
  $("#fname").value = c.first; $("#bdate").value = c.date; $("#btime").value = c.time || ""; $("#prec").value = c.precision;
  $("#btime").disabled = c.precision === "UNKNOWN";
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
