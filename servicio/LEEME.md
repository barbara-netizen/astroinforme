# ASTROINFORME — servicio interpretativo

Conecta la app web con la API de Claude **sin exponer la clave**. La app envía la carta calculada; el servicio la interpreta en dos fases (análisis estructural → redacción), audita cada referencia técnica contra la carta y devuelve el informe. Corre en **Cloudflare Workers, plan gratuito**.

## Qué hace

1. Si está configurado, verifica el control anti-robots de **Cloudflare Turnstile**.
2. Verifica el **código de acceso** y su cupo, o, en **acceso público**, el límite por visitante y por día.
3. Verifica el **tope mensual** de gasto del servicio.
4. Valida la carta y la **reconstruye con una lista blanca** (`src/validate.js`): enums, rangos, coherencia entre longitud, signo y grado, y topes de tamaño. Descarta cualquier campo desconocido y controla el nombre de pila. Envía a Claude solo esos datos astrológicos, el nombre de pila y el tratamiento elegido. **Nunca** la fecha, la hora, el lugar ni el día juliano (la app ya no los envía).
5. Fase A: análisis estructural (JSON). Fase B: redacción (contrato `astroinforme.report/v1`), con el tratamiento gramatical pedido.
6. **Auditoría técnica** (`audit.js`, la misma de la app; verifica solo las referencias que el informe declara) y **control de estilo** (`src/style.js`). Si alguno falla, pide una sola corrección (fase C) que atiende ambos y vuelve a auditar. El estilo nunca bloquea la entrega.
7. Si la auditoría técnica sigue fallando, **no entrega el informe** (`audit_failed`) y no descuenta el cupo; el gasto queda registrado en el mes.
8. Responde en flujo: manda espacios cada 10 s para que la conexión no se corte y, al final, un único JSON.
9. **Recuperación (1.5):** con código, guarda el último informe 48 h junto con el `request_id` del pedido. Un reintento con el mismo `request_id` lo recibe sin generar ni descontar. Mientras una generación está en curso (marca `inflight:<CÓDIGO>`, que vence a los 20 min), otro pedido con ese código recibe `in_progress`. En el modo en flujo, si la app se desconecta, Cloudflare puede cancelar el trabajo 30 s después; en ese caso no queda informe para recuperar y la marca vence sola. El modo desacoplado (punto 10) resuelve ese caso.
10. **Generación desacoplada (1.6):** `POST /jobs` (con `request_id`) crea un trabajo en un Durable Object (`REPORT_JOB`, clase `ReportJob`, almacenamiento SQLite del plan gratuito) y responde enseguida (202). El trabajo corre en una alarma (hasta 15 min por ejecución) aunque la app esté desconectada; la app consulta `GET /jobs/<request_id>` cada 8 s. Las fases A y B se guardan al terminar: ante un error transitorio de la API, se reintenta hasta 3 veces desde la última fase guardada, sin volver a pagarla. El mismo `request_id` devuelve el estado del trabajo existente (no crea otro ni cobra). El estado de un pedido con código solo se ve con ese código. A las 48 h el objeto borra todo lo que guardó. El modo en flujo sigue disponible para la app anterior.
11. **Registro de costos (1.6):** cada pedido deja `gen:<request_id>` en el KV durante 90 días: fecha, modelo, modo, costo total y por fase, si hubo corrección, resultado, intentos e idioma. Sin nombre, sin carta, sin informe.

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
| `daily_limit` | Acceso público: se alcanzó el tope del día (`DAILY_LIMIT`) |
| `visitor_limit` | Acceso público: ese visitante ya usó su cupo del día (`VISITOR_DAILY_LIMIT`) |
| `bot_check` | Falló la verificación de Turnstile |
| `audit_failed` | El informe no pasó la auditoría después de la corrección |
| `upstream` | La API de Claude no respondió o devolvió algo inválido |
| `not_configured` | Falta la clave, el protocolo o el espacio KV |
| `in_progress` | Ese código ya tiene una generación en curso (409) |
| `timeout` (solo en la app) | La consulta de un trabajo superó los 30 minutos |
| `bad_name` | El nombre de pila no cumple el formato (hasta tres palabras, solo letras) |
| `bad_request` / `forbidden_origin` | Datos inválidos o pedido desde otra página |

La app muestra cada error en el idioma de la interfaz.

## Instalación actual (17-10-2026)

- Worker `astroinforme` en la cuenta de Cloudflare de Bárbara: https://astroinforme.gutierrez-barbarita.workers.dev
- Espacio KV `astroinforme` (id `3fe6f27f5f3844df8f90d1e9790291da`) vinculado como `ASTRO_KV`, con las claves `protocol` (protocolo interpretativo) y `style` (guía de estilo, que el servicio 1.1 agrega al final del protocolo). Ninguna de las dos está en este repositorio.
- Faltan: el secreto `ANTHROPIC_API_KEY` y, para acceso público, `REQUIRE_CODE=false` (y si se usa Turnstile, `TURNSTILE_SECRET`).

### Actualizar el código del servicio

Cuando cambia `servicio/src/`, se regenera `dist/astroinforme-worker.js` (`npm run build`) y se sube al repositorio. Para publicarlo: abrir el archivo en GitHub (vista *Raw*), copiar todo, pegarlo en el editor del Worker (Cloudflare → Workers & Pages → astroinforme → *Edit code*) reemplazando lo anterior, y *Deploy*. Las variables, los secretos y el KV no se tocan.

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
| `REQUIRE_CODE` | `true` | `false` = acceso público, con los dos límites siguientes; un código válido sigue funcionando con su cupo |
| `VISITOR_DAILY_LIMIT` | `1` | Informes por visitante por día (acceso público). El visitante se reconoce por un resumen de su IP con sal secreta (seudónimo; quien tenga la sal podría recuperar la IP por fuerza bruta), que vence a los dos días; la IP no se guarda |
| `DAILY_LIMIT` | `8` | Informes por día para todo el servicio (acceso público) |
| `TURNSTILE_SECRET` | — | Secreto. Si existe, exige la verificación de Turnstile. La clave de sitio pública va en `config.js` → `turnstileSiteKey` |
| `VISITOR_SALT` | la clave de la API | Secreto opcional para el resumen de la IP |

## Administración

- **Agregar a alguien:** sumá `CODIGO:cupo` en `ACCESS_CODES`.
- **Dar más informes a alguien:** subí su cupo en `ACCESS_CODES`. El uso está en el KV, clave `used:CODIGO`.
- **Disponibilidad:** `GET /health` → `available` indica si hoy se puede pedir un informe, sin mostrar el gasto.
- **Gasto del mes:** KV, clave `month:AAAA-MM` → `{"reports", "usd", "failed"}`. Es un cálculo con los tokens que informa la API y los precios del 16-10-2026; la cifra exacta está en la Consola de Claude.
- **Cortar todo:** borrá `ACCESS_CODES` o bajá `MONTHLY_USD_LIMIT` a `0`.

El límite de gasto del workspace en la Consola de Claude sigue siendo el tope real: si el servicio fallara, la API deja de responder al alcanzarlo.

## Desarrollo

```
npm install
npm test          # pruebas con la API simulada: códigos, cupos, tope, auditoría, corrección, privacidad,
                  # validación adversarial, recuperación con request_id, generación en curso, auditoría argumental (diseño)
npm run build     # genera dist/astroinforme-worker.js
```

`src/worker.js` usa `../../audit.js` de la app; `npm run build` lo incluye en el archivo único.
