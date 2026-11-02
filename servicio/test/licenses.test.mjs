// Pruebas 1.8: claves de licencia de Gumroad como códigos de acceso.
import assert from "node:assert/strict";
import { carta, informeOk, clone, ANALISIS, env as baseEnv, mockClaude, state, req, run, ledgerState } from "./helpers.mjs";

let n = 0; const group = () => { n++; };
const ok = informeOk();
const KEY = "A1B2C3D4-E5F60718-293A4B5C-6D7E8F90";
const OTHER = "00000000-11111111-22222222-33333333";
const withId = (id, c = carta()) => ({ ...clone(c), request_id: id });
const R1 = "lic-000000000000001", R2 = "lic-000000000000002", R3 = "lic-000000000000003";

/** Gumroad simulado delante de la API de Claude simulada. */
function mockGumroad(db, calls) {
  const claude = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.gumroad.com/")) {
      const p = new URLSearchParams(init.body); calls.push(Object.fromEntries(p));
      if (db === "down") throw new TypeError("network");
      const pu = db[p.get("license_key")];
      if (!pu || p.get("product_id") !== "prod_x") return new Response(JSON.stringify({ success: false, message: "That license does not exist for the provided product." }), { status: 404 });
      return new Response(JSON.stringify({ success: true, uses: 0, purchase: { quantity: 1, refunded: false, chargebacked: false, order_number: 524459935, email: "x@y.z", ...pu } }), { status: 200 });
    }
    return claude(url, init);
  };
}
const env = (over = {}) => baseEnv({ GUMROAD_PRODUCT_ID: "prod_x", ...over });

group("una licencia válida funciona como código de un informe; no suma usos en Gumroad");
{
  const e = env(), calls = [];
  mockClaude([ANALISIS, ok]); mockGumroad({ [KEY]: {} }, calls);
  const r = await run(req(withId(R1), KEY), e);
  assert.ok(r.body.report); assert.equal(r.body.remaining, 0);
  assert.equal(calls[0].increment_uses_count, "false");
  assert.equal((await ledgerState(e, KEY)).used, 1);
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + R1));
  assert.equal(gen.access, "license"); assert.equal(gen.ref, "order:524459935");
  assert.ok(!JSON.stringify(gen).includes("x@y.z"), "el registro no guarda el correo");
  // agotada: otra carta no genera
  const otra = withId(R2); otra.person.first_name = "Otra";
  mockClaude([]); mockGumroad({ [KEY]: {} }, calls);
  assert.equal((await run(req(otra, KEY), e)).body.error, "quota_exhausted");
}

group("la cantidad comprada multiplica el cupo (y REPORTS_PER_LICENSE también)");
{
  const e = env({ REPORTS_PER_LICENSE: "2" }), calls = [];
  mockClaude([ANALISIS, ok]); mockGumroad({ [KEY]: { quantity: 2 } }, calls);
  assert.equal((await run(req(withId(R1), KEY), e)).body.remaining, 3);
}

group("licencia inexistente, de otro producto o con formato que no es de licencia: code_invalid, sin llamar a Claude");
{
  const e = env(), calls = [];
  mockClaude([]); mockGumroad({ [KEY]: {} }, calls);
  assert.equal((await run(req(withId(R1), OTHER), e)).body.error, "code_invalid");
  assert.equal((await run(req(withId(R2), "NO-ES-LICENCIA"), e)).body.error, "code_invalid");
  assert.equal(calls.length, 1, "solo las claves con formato de licencia se consultan");
  assert.equal(state.calls.length, 0);
}

group("compra reembolsada o con contracargo: license_refunded");
{
  const e = env(), calls = [];
  mockClaude([]); mockGumroad({ [KEY]: { refunded: true } }, calls);
  const r = await run(req(withId(R1), KEY), e);
  assert.equal(r.status, 403); assert.equal(r.body.error, "license_refunded");
  const e2 = env();
  mockGumroad({ [KEY]: { chargebacked: true } }, []);
  assert.equal((await run(req(withId(R1), KEY), e2)).body.error, "license_refunded");
}

group("Gumroad caído: license_unavailable (503), sin guardar el resultado");
{
  const e = env(), calls = [];
  mockClaude([]); mockGumroad("down", calls);
  const r = await run(req(withId(R1), KEY), e);
  assert.equal(r.status, 503); assert.equal(r.body.error, "license_unavailable");
  assert.ok(![...e.ASTRO_KV.m.keys()].some((k) => k.startsWith("lic:")));
}

group("el resultado se guarda 10 minutos: la consulta de estado y el reintento no vuelven a llamar a Gumroad");
{
  const e = env(), calls = [];
  mockClaude([ANALISIS, ok]); mockGumroad({ [KEY]: {} }, calls);
  await run(req(withId(R1), KEY), e);
  await run(req(withId(R1), KEY), e);
  assert.equal(calls.length, 1);
  const k = [...e.ASTRO_KV.m.keys()].find((x) => x.startsWith("lic:"));
  assert.ok(k && !k.includes(KEY), "la clave del KV no contiene la licencia");
  assert.ok(!e.ASTRO_KV.m.get(k).includes("x@y.z"));
}

group("sin GUMROAD_PRODUCT_ID, las licencias no se consultan");
{
  const e = baseEnv(), calls = [];
  mockClaude([]); mockGumroad({ [KEY]: {} }, calls);
  assert.equal((await run(req(withId(R3), KEY), e)).body.error, "code_invalid");
  assert.equal(calls.length, 0);
}

group("los códigos de regalo siguen igual y registran el código como referencia");
{
  const e = env();
  mockClaude([ANALISIS, ok]); mockGumroad({}, []);
  await run(req(withId(R1), "LUZ-3M8Q"), e);
  const gen = JSON.parse(await e.ASTRO_KV.get("gen:" + R1));
  assert.equal(gen.access, "code"); assert.equal(gen.ref, "LUZ-3M8Q");
}

console.log(`OK — ${n} grupos de pruebas de licencias (1.8)`);
