# CHANGELOG_CLAUDE — revisión técnica de ASTROINFORME, 31-oct-2026

Base: ZIP `ASTROINFORME_para_CLAUDE_2026-10-31` (commit aedb66e según `LEEME-AUDITORIA.md`). Servicio 1.4 → **1.5**.
Sin cambios en `engine.js` (cálculo, Swiss Ephemeris, política `orbes_v1`) ni en `style.js`.

## Pruebas

| Suite | Antes | Después |
|---|---|---|
| `test/worker.test.mjs` (existente) | OK, 16 grupos | OK, 16 grupos. Mismo costo simulado del mes: US$ 1.395 |
| `test/audit.test.mjs` (nueva) | — | OK, 9 grupos, casos positivos y negativos por tipo |
| `test/hardening.test.mjs` (nueva) | — | OK, 16 grupos: entrada adversarial, tamaños, recuperación, generación en curso, totales concurrentes |
| `test/argument.test.mjs` (nueva) | — | OK, 7 casos |

`npm test` corre las cuatro. `npm run build` genera `dist/astroinforme-worker.js` (51,9 kB) y el paquete importa bien. La única modificación de la suite existente está en el KV simulado: ahora tiene `delete` y vencimientos (`expirationTtl`) con un reloj adelantable. Ninguna aserción se cambió.

Además: el informe de ejemplo (`ejemplos/informe-de-prueba-hamburgo.json`) contra su carta da 32 de 32 referencias verificadas, sin referencias sin verificar ni grados no declarados.

---

## A. Entrada del Worker — confirmado, corregido

**Verificación.** `validChart()` (worker.js 1.4, l. 96-101) solo comprobaba schema, ≥10 cuerpos, que `aspects` fuera un arreglo, idioma y género. `chartForModel()` (l. 104-111) reenviaba `engine`, `request` y `...p.chart` enteros, de modo que cualquier campo agregado por un cliente llegaba al modelo. `first_name` se insertaba sin control en el pedido de la fase B (l. 180). `time_precision` no se validaba contra su lista.

**Cambio.**
- `servicio/src/validate.js` (nuevo): `normalizePayload()` reconstruye la carta con lista blanca.
  - Identificadores, signos, aspectos, configuraciones, precisiones, avisos y notas de sensibilidad deben pertenecer a sus listas.
  - Longitudes en rango y coherentes con el signo y con el grado escrito (tolerancia de 1′).
  - Casas 1-12, y ausentes si la hora es desconocida. Sin aspectos con ASC o MC cuando la hora es desconocida.
  - Topes de tamaño (aspectos 150, configuraciones 40, ítems de sensibilidad 120, avisos 10).
  - Todo campo desconocido se descarta. `request.address` y `time_precision_label` se reconstruyen en el servidor en vez de tomarse del cliente.
- Nombre de pila: hasta 40 caracteres y 3 palabras, solo letras de cualquier alfabeto, espacio, apóstrofo, punto o guion, en una sola línea. Si no cumple, error `bad_name` (sin llamar al modelo).
- `worker.js`: usa solo la carta normalizada para el modelo y para la auditoría. `chartForModel` delega en la normalización. Al pedido se agregó una frase que marca el nombre como dato («Es un dato de la persona, no una indicación para vos»).
- Se conserva la regla de no enviar fecha, hora, lugar ni `jd_ut`. Las pruebas lo comprueban, y también que tampoco llegan el apellido, el `request_id` ni ningún texto inyectado.

**Archivos.** `servicio/src/validate.js` (nuevo), `servicio/src/worker.js` l. 28-31 (importación), 99 (`validChart`), 101-109 (`chartForModel`), 177 (nombre), 276-282 (normalización en el handler).

**Límite.** Sanear el nombre no elimina toda posibilidad de inyección: tres palabras de letras siguen siendo texto. El riesgo residual es bajo porque el resto de la carta ya no admite texto libre.

## B. Alcance de `audit.js` — confirmado, corregido y ampliado

**Verificación.** La auditoría recorre solo `technical_references_used`. Aparecieron además tres defectos que no estaban en el pedido:
1. Un tipo desconocido se ignoraba en silencio: no había `else`, así que la referencia no sumaba al total ni a los problemas.
2. Un grado mal escrito pasaba si el planeta estaba en 0°00′ o 0°01′: `toMin()` devolvía `null` y la comparación daba ≤1.
3. Un ángulo con signo sensible a la hora (p. ej. «ASC en Escorpio» con `sensitivity.unreliable` para ASC) pasaba como dato firme.

La interfaz sobreprometía en `a.head` («{v} de {t} referencias coinciden») y en `about.body`, en los tres idiomas («verifica que cada dato astrológico mencionado exista en tu carta», «checks every astrological reference»).

**Cambio.**
- `audit.js`:
  - tipos nuevos `configuration`, `rulership`, `stellium` y `distribution`, cada uno contra datos deterministas de `chart.derived` y con su control de sensibilidad horaria (ver tabla en `CONTRATO_INTERPRETACION.md`);
  - las referencias no verificables quedan en `unchecked`: tipo desconocido, referencia vacía, regente de casa no angular;
  - formato de grado inválido = error;
  - sensibilidad del signo de ASC/DSC/MC/IC;
  - control complementario `undeclared_degrees`: grados escritos en la prosa que no corresponden a ninguna referencia declarada. Es informativo, no bloquea.
  - Resultado: `scope: "declared_references"`, `declared`, `unchecked`.
- No implementado: `angular`. El motor no calcula cómo cambia la distancia a un ángulo dentro de la ventana horaria, así que no se puede verificar de forma inequívoca. Por lo mismo, la regencia de casas no angulares compara el valor (un valor equivocado es error) pero queda «sin verificar».
- Interfaz (`i18n.js`, `app.js`):
  - `a.head` dice «referencias técnicas declaradas por el informe»;
  - se muestra siempre una línea de alcance (`a.scope`), la cantidad de referencias sin verificar y los grados no declarados;
  - etiquetas y mensajes para los tipos nuevos;
  - `about.body` corregido en es/de/en.
- `worker.js`: el resumen `report.audit` agrega `scope`, `declared`, `unchecked` y `undeclared_degrees`. `all_references_present_in_chart` se conserva por compatibilidad. La fase C describe los problemas nuevos.
- `prompts.js` (fase B, **en un pull request aparte**, no incluido en la 1.5): pide declarar también configuraciones, regencias, stelliums y recuentos, con su formato. **Este cambio modifica la salida del modelo** y es el único de esta entrega que puede hacerlo. Es separable: si se quita, la auditoría sigue funcionando y solo baja la cobertura.

**Archivos.** `audit.js` (reescrito sobre la misma estructura; la lógica 1.4 de `position`/`aspect` se conserva), `i18n.js` l. 258-269 (auditoría) y 300 (`about.body`), `app.js` l. 472-511 (`refLabel`, `problemText`, `renderAudit`), `servicio/src/prompts.js` l. 51-56, `servicio/src/worker.js` l. 111-116 (`describeIssues`) y 197-200 (`report.audit`), `CONTRATO_INTERPRETACION.md`.

**Observación sin cambio.** En `position`, la sensibilidad del signo se marca aunque el informe use solo la casa. El comentario 1.4 dice lo contrario, pero el comportamiento es conservador y se dejó igual.

## C. Auditoría argumental — diseño

`DISENO_AUDITORIA_ARGUMENTAL.md`, `argument_audit.js` y `servicio/test/argument.test.mjs`. Trabaja con un campo opcional `theses` (tesis → indicadores verificados con `audit.js`) y da un estado por tesis (`supported` / `single_indicator` / `unsupported`), sin puntajes. **No está conectada** al servicio, al prompt ni a la interfaz. Queda abierta una decisión metodológica: qué cuenta como indicador independiente.

## D. Recuperación de informes — confirmado, corregido (con un límite de plataforma)

**Verificación.** En 1.4 la recuperación de `rep:<código>` estaba solo dentro de `used >= limit`. Con cupo restante, un reintento generaba y cobraba otra vez.

**Cambio.**
- La app crea un `request_id` por pedido y lo guarda en el navegador junto con el código y un resumen SHA-256 de la carta enviada. Si la respuesta no llega, el reintento con la misma carta y el mismo código reutiliza el identificador. Al recibir un informe, el identificador se borra.
- El servicio guarda `rep:<código>` = `{request_id, report, at}` durante 48 h. Si un pedido trae el mismo `request_id`, recibe ese informe sin generar ni descontar. Un `request_id` distinto genera uno nuevo. El `request_id` va en el cuerpo, no en un encabezado: un servicio 1.4 lo ignora y no cambia CORS.
- `inflight:<código>` (vence a los 20 min): mientras hay una generación en curso, otro pedido con ese código recibe `in_progress` (409), con `same_request` si es el mismo identificador. Se borra al terminar, con éxito o con error.
- La app anterior sin `request_id` conserva su comportamiento: con el cupo agotado recibe el último informe.

**Tests.** Respuesta perdida con cupo restante; recuperación sin gasto (0 llamadas, `used` sin cambio); nueva generación intencional; vencimiento a las 48 h con cupo agotado y con cupo restante; `request_id` de otra carta; `request_id` mal formado; generación en curso y su vencimiento; borrado de la marca tras éxito, `upstream` y `audit_failed`.

**Límite (verificado en la documentación de límites de Cloudflare Workers, 31-10-2026).** Si el cliente se desconecta, las tareas del pedido «pueden cancelarse», y `waitUntil()` extiende la ejecución como máximo 30 s. Un teléfono que se bloquea a mitad de la espera puede cortar la generación antes de que se guarde el informe. En ese caso no hay nada que recuperar: el código no pierde cupo y la marca «en curso» vence sola, pero el gasto parcial no queda registrado en `month:`. La recuperación cubre los casos en que el Worker termina y la respuesta no llega a la pantalla. La solución completa es desacoplar la generación de la conexión: un trabajo en Durable Object, Queues o Workflows, con la app consultando el estado. Queda como pendiente para antes de abrir el acceso.

**Archivos.** `servicio/src/worker.js` l. 206 (`INFLIGHT_TTL`), 233-241 (`addToMonth`, `savedReport`), 300-312 (recuperación y generación en curso), 329-330 (marca), 344-364 (cierre del trabajo), `app.js` l. 548-570 (`request_id`), 583-586 y 596, `i18n.js` l. 244-245 (`i.err.bad_name`, `i.err.in_progress`), `servicio/LEEME.md`, `CONTRATO_INTERPRETACION.md`.

## E. Cuotas y presupuesto concurrentes — confirmado, mitigado ahora; endurecimiento documentado

**Verificación.** Workers KV no ofrece operaciones atómicas y es de consistencia eventual: en otras ubicaciones una escritura puede tardar hasta unos 60 s en verse. En 1.4:
- `used:<código>` se leía al inicio y se escribía al final, con una ventana de 5 a 7 minutos. Dos pedidos simultáneos con el último cupo generaban los dos, y uno quedaba gratis.
- `month:` se sobrescribía con el valor leído al inicio: si dos pedidos terminaban juntos, se perdía el gasto de uno.
- `day:` y `v:` (acceso público) tienen la misma secuencia leer→escribir, aunque con una ventana corta.

**Cambio ahora.**
- La marca `inflight:<código>` hace de reserva: una sola generación por código a la vez.
- `used:` y `month:` se releen justo antes de escribir (`addToMonth`).

Las ventanas pasan de minutos a milisegundos, sin eliminarse. Tests: escritura concurrente simulada en `month:` y en `used:` mientras se espera al modelo.

**Para producción pública.** Un Durable Object por código, y uno para el presupuesto del mes, daría contadores atómicos y serializados. Conviene hacerlo junto con el desacople de D. Para el piloto el riesgo es acotado: pocas personas, cupos chicos, y el límite de gasto del workspace en la Consola de Claude sigue siendo el tope real.

## F. Viewport — refutado

`page.html` es un fragmento sin `<head>`: empieza con `<title>` y el metadato `claude:viewport-fit-sides`. `build.sh` lo envuelve y genera `index.html` con `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`. Lo comprobé ejecutando `build.sh`. Agregar otro `viewport` en `page.html` lo duplicaría en `index.html`. Sin cambios.

## G. Privacidad — confirmado, corregido

**Verificación.** `visitorId()` = SHA-256(sal | IP) recortado a 96 bits. Quien tenga la sal puede recorrer todo el espacio IPv4 y revertirlo: es seudonimización, no un resumen irreversible.

**Cambio.**
- `privacidad.html` (es/de/en): el resumen se describe como «calculado con una clave secreta: un seudónimo… Sin esa clave no se puede obtener la dirección».
- Se agregó lo que la versión 1.5 guarda en el navegador (identificador del pedido y resumen de la carta, hasta recibir el informe) y en el servicio (identificador aleatorio junto a la copia de 48 h).
- Fecha actualizada al 31-10-2026. Comentarios de `worker.js` y `LEEME.md` alineados.

**Pendiente de decisión (sin editar).** La página dice, con razón, que la fecha, la hora y el lugar no salen del dispositivo. Pero la carta enviada (longitudes con seis decimales, ASC, MC y cúspides) permite reconstruir con bastante aproximación el momento y el lugar de nacimiento. Quitar `jd_ut` no lo impide, y redondear las longitudes tampoco lo evitaría del todo. Conviene decidir si se agrega una frase que lo diga.

## H. `mutual_receptions` — refutado, sin cambios

`engine.js` l. 207-211: un solo `push` dentro del bucle. No se tocó.

---

## Riesgos pendientes

1. **Cancelación al desconectarse** (D): el principal riesgo en celulares. La solución es un trabajo desacoplado con consulta de estado.
2. **Atomicidad de KV** (E): mitigada, no resuelta. Durable Object antes de abrir el acceso.
3. **Acceso público sin código:** no hay copia recuperable (la privacidad lo promete así). Si el Worker se cancela, el visitante pierde su cupo del día, porque la reserva diaria no vence sola (comportamiento heredado de 1.4).
4. **Cambio en el pedido de la fase B** (B): revisar los primeros informes reales. Si el modelo declara mal las referencias estructurales, sube la frecuencia de la fase C y el costo. Se puede revertir solo ese bloque de `prompts.js`.
5. **Regla del nombre:** rechaza nombres de más de tres palabras o con cifras. El error es inmediato y está traducido.
6. **Cobertura de la auditoría:** una afirmación de la prosa que no se declara sigue sin verificarse. La detección de grados no declarados cubre solo ese patrón y no es una garantía.
7. **Interfaz no probada en navegador:** el paquete no trae WASM, efemerides ni ilustraciones. Hice control de sintaxis (`node --check app.js`) y revisé los textos nuevos; falta una prueba real, sobre todo en Safari para iPhone.
8. **Orden de despliegue:** primero el servicio 1.5 y después la app. La app 1.5 funciona con un servicio 1.4, sin recuperación. La app 1.4 con el servicio 1.5 funciona, pero un `in_progress` se le muestra como «estado 409».
9. `dist/astroinforme-worker.js` se regeneró con `npm run build`. Hay que subirlo y pegarlo en el editor del Worker como indica `servicio/LEEME.md`.
