# ASTROINFORME — servicio interpretativo

Conecta la app web con la API de Claude **sin exponer la clave**. La app envía la carta calculada; el servicio la interpreta en dos fases (análisis estructural → redacción), audita cada referencia técnica contra la carta y devuelve el informe. Corre en **Cloudflare Workers, plan gratuito**.

## Qué hace

1. Verifica el **código de acceso** de la persona y su cupo de informes.
2. Verifica el **tope mensual** de gasto del servicio.
3. Envía a Claude solo los datos astrológicos y el nombre de pila. **Nunca** la fecha, la hora, el lugar ni el día juliano.
4. Fase A: análisis estructural (JSON). Fase B: redacción (contrato `astroinforme.report/v1`).
5. **Auditoría técnica** (`audit.js`, la misma de la app). Si falla, pide una corrección (fase C) y vuelve a auditar.
6. Si sigue fallando, **no entrega el informe** (`audit_failed`) y no descuenta el cupo de la persona; el gasto queda registrado en el mes.
7. Responde en flujo: manda espacios cada 10 s para que la conexión no se corte y, al final, un único JSON.

La app vuelve a hacer la auditoría al recibir el informe: no confía en la del servicio.

## Por qué Cloudflare Workers

Verificado el 17-10-2026 en la [documentación de límites](https://developers.cloudflare.com/workers/platform/limits/):
- Plan gratuito: 100.000 pedidos por día.
- Sin límite de duración mientras la app siga conectada; la espera de la respuesta de Claude no cuenta como tiempo de CPU (10 ms por pedido en el plan gratuito; el servicio usa mucho menos).
- Variables de hasta 5 KB: el protocolo (unos 9 KB) va en un espacio KV, no en una variable.

Vercel Hobby corta las funciones a los 5 minutos; un informe con corrección puede acercarse a ese tiempo.

## Errores que devuelve

| Código | Significado |
|---|---|
| `code_required` / `code_invalid` | Falta el código o no existe |
| `quota_exhausted` | Ese código ya usó todos sus informes |
| `budget_exhausted` | Se alcanzó el tope mensual (`MONTHLY_USD_LIMIT`) |
| `audit_failed` | El informe no pasó la auditoría después de la corrección |
| `upstream` | La API de Claude no respondió o devolvió algo inválido |
| `not_configured` | Falta la clave, el protocolo o el espacio KV |
| `bad_request` / `forbidden_origin` | Datos inválidos o pedido desde otra página |

La app muestra cada error en el idioma de la interfaz.

## Instalación desde el panel de Cloudflare (sin línea de comandos)

Necesitás: una cuenta gratuita de Cloudflare, la clave de la API del workspace `astroinforme` y el archivo `protocolo.txt` (está en la carpeta del medidor de costo; no está en este repositorio).

1. **Crear el Worker.** Cloudflare → *Workers & Pages* → *Create* → *Create Worker*. Nombre: `astroinforme`. *Deploy*.
2. **Pegar el código.** En el Worker, *Edit code*. Borrá todo, pegá el contenido de `dist/astroinforme-worker.js` y *Deploy*.
3. **Crear el espacio KV.** *Storage & Databases* → *KV* → *Create namespace*, nombre `astroinforme`.
4. **Guardar el protocolo.** En ese namespace, *Add entry*: clave `protocol`, valor = todo el texto de `protocolo.txt`.
5. **Vincular el KV.** En el Worker → *Settings* → *Bindings* → *Add* → *KV namespace*: nombre de variable `ASTRO_KV`, namespace `astroinforme`.
6. **Clave de la API.** Worker → *Settings* → *Variables and Secrets* → *Add*: tipo **Secret**, nombre `ANTHROPIC_API_KEY`, valor = la clave.
7. **Códigos de acceso.** Mismo lugar, tipo **Secret**, nombre `ACCESS_CODES`. Valor: un código por persona con su cupo, separados por coma. Ejemplo: `ANA-7K2Q:3, PEDRO-9X4M:2`. Usá códigos difíciles de adivinar (letras y números, al menos 8 caracteres).
8. **Tope mensual.** Tipo *Text*, nombre `MONTHLY_USD_LIMIT`, valor `10` (o el que elijas, menor o igual al límite del workspace).
9. **Comprobar.** Abrí `https://astroinforme.<tu-subdominio>.workers.dev/health`. Tiene que mostrar `"api_key":true,"protocol":true,"kv":true` y la cantidad de códigos.
10. **Conectar la app.** En `config.js` del repositorio, `interpreterUrl: "https://astroinforme.<tu-subdominio>.workers.dev/"`. Al subir el cambio, GitHub Pages lo publica en uno o dos minutos.

Los nombres de los menús de Cloudflare pueden variar un poco.

### Variables opcionales

| Variable | Por defecto | Uso |
|---|---|---|
| `MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` cuesta la mitad |
| `ALLOWED_ORIGINS` | `https://barbara-netizen.github.io` | Páginas que pueden usar el servicio |
| `AUDIT_STRICT` | `true` | `false` entrega el informe aunque la auditoría falle (la app muestra las discrepancias) |
| `REQUIRE_CODE` | `true` | `false` abre el servicio a cualquiera: no recomendado |

## Administración

- **Agregar a alguien:** sumá `CODIGO:cupo` en `ACCESS_CODES`.
- **Dar más informes a alguien:** subí su cupo en `ACCESS_CODES`. El uso está en el KV, clave `used:CODIGO`.
- **Gasto del mes:** KV, clave `month:AAAA-MM` → `{"reports", "usd", "failed"}`. Es un cálculo con los tokens que informa la API y los precios del 16-10-2026; la cifra exacta está en la Consola de Claude.
- **Cortar todo:** borrá `ACCESS_CODES` o bajá `MONTHLY_USD_LIMIT` a `0`.

El límite de gasto del workspace en la Consola de Claude sigue siendo el tope real: si el servicio fallara, la API deja de responder al alcanzarlo.

## Desarrollo

```
npm install
npm test          # pruebas con la API simulada: códigos, cupos, tope, auditoría, corrección, privacidad
npm run build     # genera dist/astroinforme-worker.js
```

`src/worker.js` usa `../../audit.js` de la app; `npm run build` lo incluye en el archivo único.
