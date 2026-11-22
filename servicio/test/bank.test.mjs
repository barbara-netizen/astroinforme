// Banco de informes (servicio 2.5): solo con permiso, anónimo, en repositorio privado; comentarios vinculados; vencimiento.
import assert from "node:assert/strict";
import { anonymize, bankId, bankEntry, purgeOld, validBankId, BANK_MONTHS } from "../src/bank.js";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, req, run, ORIGIN } from "./helpers.mjs";
import worker from "../src/worker.js";

const REPO = "barbara-netizen/asterorbis-banco";
const bankEnv = (over = {}) => baseEnv({ BANK_GITHUB_TOKEN: "ghp_test", BANK_REPO: REPO, ...over });
const decode = (b64) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));

/** Claude simulado + GitHub simulado: registra lo que se escribe en el repositorio. */
function mockAll(seq) {
  mockClaude(seq);
  const claude = globalThis.fetch, files = new Map(), gh = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.startsWith("https://api.github.com/")) return claude(url, init);
    gh.push({ url: u, method: init.method || "GET", headers: init.headers });
    const path = u.split("/contents/")[1];
    if ((init.method || "GET") === "PUT") { if (files.has(path)) return new Response("{}", { status: 422 }); files.set(path, decode(JSON.parse(init.body).content)); return new Response("{}", { status: 201 }); }
    return new Response("[]");
  };
  return { files, gh };
}

const conNombre = () => { const c = carta(); c.person = { first_name: "Lucía" }; return c; };
const conPermiso = (c) => { c.request.bank_consent = true; return c; };
const ok = informeOk(); ok.title = "Lucía: el deseo que da la cara"; ok.sections[0].body_markdown += "\n\nLucía, lo que querés tiene peso.";

// 1. anonimización y número estable
const an = anonymize(ok, "Lucía");
assert.doesNotMatch(JSON.stringify(an), /Lucía/); assert.match(an.title, /^\[nombre\]:/);
assert.equal(anonymize({ title: "Luciano y Lucía" }, "Lucía").title, "Luciano y [nombre]", "no toca palabras que solo empiezan igual");
const id = await bankId(ok); assert.ok(validBankId(id)); assert.equal(id, await bankId(clone(ok)));

// 2. sin permiso: no se escribe nada en el banco
let e = bankEnv(); let m = mockAll([ANALISIS, ok]);
let r = await run(req(conNombre(), "ANA-7K2"), e);
assert.equal(r.status, 200); assert.equal(r.body.report.bank_id, undefined); assert.equal(m.gh.length, 0);

// 3. con permiso: una entrada anónima en informes/AAAA/MM/<número>.json, y el número llega en el informe
e = bankEnv(); m = mockAll([ANALISIS, ok]);
r = await run(req(conPermiso(conNombre()), "ANA-7K2"), e);
assert.equal(r.status, 200); assert.ok(validBankId(r.body.report.bank_id));
const [path, entry] = [...m.files][0];
assert.match(path, new RegExp(`^informes/\\d{4}/\\d{2}/${r.body.report.bank_id}\\.json$`));
assert.equal(m.gh[0].headers.authorization, "Bearer ghp_test"); assert.ok(m.gh[0].url.startsWith(`https://api.github.com/repos/${REPO}/`));
const dump = JSON.stringify(entry);
assert.doesNotMatch(dump, /Lucía|ANA-7K2|local_date|place|utc|zone|jd_ut|bank_consent/i);
assert.equal(entry.schema, "asterorbis.bank/v1"); assert.equal(entry.had_first_name, true); assert.match(entry.month, /^\d{4}-\d{2}$/);
assert.ok(entry.chart.chart.bodies.length >= 10); assert.ok(entry.report.prose_audit && entry.report.audit);
// al modelo no le llega el permiso
assert.doesNotMatch(state.calls.map((c) => c.messages[0].content).join("\n"), /bank_consent/);

// 4. comentario de esa persona: se suma con el mismo número; con un número desconocido, no
const fb = (body) => worker.fetch(new Request("https://astro.example.workers.dev/feedback", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-astro-code": "ANA-7K2" }, body: JSON.stringify(body) }), e, {});
const texto = "Me sirvió mucho. ".repeat(20);
assert.equal((await fb({ text: texto, bank_id: r.body.report.bank_id })).status, 200);
assert.ok([...m.files.keys()].some((k) => k.startsWith("comentarios/") && k.includes(r.body.report.bank_id)));
const antes = m.files.size;
assert.equal((await fb({ text: texto, bank_id: "AO-AAAAAAAA" })).status, 200);
assert.equal(m.files.size, antes, "número sin permiso registrado: no se guarda en el banco");

// 5. banco sin configurar o caído: el informe se entrega igual, sin número
e = baseEnv(); m = mockAll([ANALISIS, ok]);
r = await run(req(conPermiso(conNombre()), "ANA-7K2"), e);
assert.equal(r.status, 200); assert.equal(r.body.report.bank_id, undefined); assert.equal(m.gh.length, 0);
e = bankEnv(); mockClaude([ANALISIS, ok]); { const c = globalThis.fetch; globalThis.fetch = async (u, i) => (String(u).includes("github") ? new Response("{}", { status: 500 }) : c(u, i)); }
r = await run(req(conPermiso(conNombre()), "ANA-7K2"), e);
assert.equal(r.status, 200); assert.equal(r.body.report.bank_id, undefined);

// 6. vencimiento: borra carpetas con más de BANK_MONTHS meses, una vez por mes
e = bankEnv(); const deleted = [];
globalThis.fetch = async (url, init = {}) => {
  const p = String(url).split("/contents/")[1];
  if (init.method === "DELETE") { deleted.push(p); return new Response("{}"); }
  const tree = { informes: [{ type: "dir", name: "2024" }, { type: "dir", name: "2026" }], "informes/2024": [{ type: "dir", name: "10" }, { type: "dir", name: "12" }],
    "informes/2024/10": [{ type: "file", path: "informes/2024/10/AO-X.json", sha: "1" }], "informes/2024/12": [{ type: "file", path: "informes/2024/12/AO-Y.json", sha: "2" }],
    "informes/2026": [{ type: "dir", name: "11" }], "informes/2026/11": [{ type: "file", path: "informes/2026/11/AO-Z.json", sha: "3" }], comentarios: [] };
  return new Response(JSON.stringify(tree[p] || []));
};
assert.equal(BANK_MONTHS, 24);
assert.equal(await purgeOld(e, Date.UTC(2026, 10, 22)), 1); assert.deepEqual(deleted, ["informes/2024/10/AO-X.json"]);
assert.equal(await purgeOld(e, Date.UTC(2026, 10, 23)), 0, "una vez por mes");

// 7. la entrada no conserva el número dentro del informe ni datos de contacto
const en = bankEntry({ id, report: { ...clone(ok), bank_id: id }, payload: conPermiso(conNombre()), chart: {}, usd: 1.23456, service: "2.5", model: "m" });
assert.equal(en.report.bank_id, undefined); assert.equal(en.usd, 1.2346);

console.log("OK — banco de informes 2.5: 7 grupos");
