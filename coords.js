// Lectura de coordenadas manuales: decimales, grados y minutos, con signo o con hemisferio.
// Devuelve el número en grados, o null si el texto no se puede interpretar sin duda.
const WORDS = { NORTE: "N", NORD: "N", NORTH: "N", SUR: "S", SÜD: "S", SUED: "S", SOUTH: "S", ESTE: "E", OST: "E", EAST: "E", OESTE: "W", WEST: "W" };

export function parseCoord(text, axis, lang = "es") {
  let s = String(text || "").trim().toUpperCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/''/g, '"');
  if (!s) return null;
  let hemi = null;
  const take = (m) => { if (hemi) return false; hemi = m; return true; };
  // palabra o letra de hemisferio, al principio o al final
  const end = s.match(/\s*([A-ZÜ]+)\.?$/), start = s.match(/^([A-ZÜ]+)\.?\s*/);
  if (end && !/^[\d]/.test(end[1])) { take(end[1]); s = s.slice(0, end.index); }
  else if (start) { take(start[1]); s = s.slice(start[0].length); }
  if (hemi) {
    hemi = WORDS[hemi] || (hemi === "O" ? (lang === "de" ? "E" : "W") : hemi);
    if (!/^[NSEW]$/.test(hemi)) return null;
    if ((axis === "lat") !== /[NS]/.test(hemi)) return null;
  }
  const signed = s.match(/^\s*([-+−]?)\s*/); const neg = /[-−]/.test(signed[1]);
  s = s.slice(signed[0].length).trim();
  let value;
  const m = s.match(/^(\d{1,3}(?:[.,]\d+)?)\s*(?:°|º|D|\s)?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:'|M|\s)?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*"?)?)?$/);
  if (!m) return null;
  const n = (x) => (x === undefined ? 0 : parseFloat(x.replace(",", ".")));
  const [d, mi, se] = [n(m[1]), n(m[2]), n(m[3])];
  if (mi >= 60 || se >= 60 || (m[2] !== undefined && /[.,]/.test(m[1]))) return null;
  value = d + mi / 60 + se / 3600;
  if (hemi && neg) return null; // «-34 S» es ambiguo
  if (hemi === "S" || hemi === "W" || neg) value = -value;
  if (Math.abs(value) > (axis === "lat" ? 90 : 180)) return null;
  return value;
}
