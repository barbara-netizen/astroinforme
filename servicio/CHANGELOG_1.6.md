# Servicio 1.6 — generación desacoplada de la conexión y registro de costos (31-10-2026)

## Problema
En la versión 1.5, la generación corría dentro del pedido en flujo. Según la documentación de Cloudflare, si el cliente se desconecta, las tareas del pedido pueden cancelarse y `waitUntil()` solo extiende la ejecución 30 s. Un teléfono que se bloquea a mitad de la espera podía cortar la generación. Además, el gasto se registraba solo como total mensual, sin costo por informe.

## Cambio
- **`servicio/src/job.js` (nuevo): clase `ReportJob`** (Durable Object, un objeto por `request_id`).
  - La generación corre en una alarma, con hasta 15 min de duración por ejecución según la documentación de límites de Durable Objects (consultada el 31-10-2026), sin depender de la conexión de la app.
  - Las fases A y B se guardan al terminar. Ante un error transitorio de la API (429, 5xx, red), la alarma se reprograma a los 20 s y retoma desde la última fase guardada, sin volver a pagarla. Hay como máximo 3 ejecuciones por pedido.
  - Si una ejecución se corta sin aviso (por ejemplo, por el límite de 15 min), la siguiente no supera ese máximo.
  - El estado de un pedido con código solo se ve presentando el mismo código.
  - Pasadas 48 h desde el final, el objeto borra todo lo que guardó, incluido el informe.
- **`worker.js`:**
  - nuevos `POST /jobs` y `GET /jobs/<request_id>`;
  - admisión y cierre extraídos a `admit()` y `finalizeJob()`, compartidos por los dos modos;
  - `interpret()` acepta `hooks` para guardar y retomar fases, y registra el costo por fase;
  - `/health` informa `jobs`.
  - El modo en flujo queda igual para la app anterior.
- **Registro de costos `gen:<request_id>`:** 90 días en KV, en los dos modos. Guarda fecha, modelo, modo, costo total y por fase, corrección, resultado, intentos e idioma. No guarda datos personales ni de la carta. Sirve para calcular promedio, mediana y máximo reales antes de fijar un precio.
- **`wrangler.toml`:** binding `REPORT_JOB` y migración `v1` con `new_sqlite_classes` (el único tipo de Durable Object del plan gratuito). **`entry.js`** exporta la clase.
- **App (`app.js`, `i18n.js`, `page.html`):**
  - si el servicio informa `jobs`, crea el trabajo y consulta su estado cada 8 s; tolera cortes de red durante la consulta; espera hasta 30 min;
  - la pantalla de espera dice que se puede bloquear el teléfono;
  - mensajes nuevos `timeout`, `not_found` y `forbidden` en es/de/en;
  - «se verifica cada dato astrológico que cita» corregido a «los datos que el informe declara».

## Pruebas
- `test/jobs.test.mjs` (nuevo, 13 grupos), con un Durable Object simulado:
  - camino feliz con la app desconectada;
  - reintento con el mismo `request_id` sin segundo trabajo ni cobro;
  - acceso al estado con otro código;
  - limpieza a las 48 h;
  - `in_progress` con otro pedido del mismo código;
  - reanudación tras error transitorio, que no vuelve a pagar la fase A;
  - intentos agotados, que liberan la reserva y registran el gasto parcial;
  - ejecución cortada sin aviso;
  - auditoría fallida;
  - acceso público con devolución del cupo del visitante;
  - modo en flujo con registro;
  - falta del binding.
- Suite completa: 16 + 9 + 16 + 7 + 13 grupos en verde.
- Navegador real (ancho de celular, servicio simulado):
  - en modo desacoplado, con un corte de red en la segunda consulta, el informe llega igual, la auditoría muestra 32/32 y el identificador del pedido se borra;
  - en el modo anterior, el comportamiento no cambia.

## Límites y pendientes
- El Durable Object simulado no reproduce todo el comportamiento de Cloudflare. Hay que comprobar en producción la primera publicación con migración y un informe real.
- Si se cierra la página (no solo se bloquea el teléfono), la app no retoma sola: hay que calcular la misma carta y pedir con el mismo código. Así se recupera el mismo trabajo sin cobro.
- Los contadores de cupo siguen en KV (no atómicos). Para la etapa de pagos conviene un Durable Object por derecho de uso.

## Vuelta atrás
Revertir el pull request. La app vuelve sola al modo en flujo si `/health` no informa `jobs`. Los Durable Objects ya creados quedan sin uso y se borran solos a las 48 h.
