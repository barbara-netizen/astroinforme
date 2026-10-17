# ASTROINFORME — contrato del motor interpretativo

El cálculo y la interpretación están separados. La página calcula la carta en el navegador y produce un JSON `astroinforme.chart/v1`. Un motor interpretativo, cuando exista, recibe ese JSON y devuelve un informe `astroinforme.report/v1`. La página no depende de ningún motor para calcular.

## Conexión

En `config.js`:

```js
export const CONFIG = { interpreterUrl: "https://astroinforme.gutierrez-barbarita.workers.dev/", requireCode: false, turnstileSiteKey: "" };
```

- `interpreterUrl` vacío: la sección «Interpretación» muestra «No conectado» y ofrece copiar los datos.
- `requireCode: true`: cada persona necesita un código. `false`: acceso público; el código es opcional y usa su propio cupo. Debe coincidir con `REQUIRE_CODE` del servicio.
- `turnstileSiteKey`: clave pública de Cloudflare Turnstile. Si está, la página muestra la verificación anti-robots y envía el comprobante.

Con servicio conectado, la página consulta `GET <interpreterUrl>health` al cargar. Si `available` es `false`, avisa que no quedan informes y desactiva el botón (salvo que se cargue un código).

El botón «Generar el informe» hace `POST interpreterUrl` con `Content-Type: application/json`, los encabezados opcionales `x-astro-code` y `x-turnstile-token`, y como cuerpo una **versión reducida** de `astroinforme.chart/v1`: `schema`, `engine`, `person.first_name`, `request`, `birth.time_precision` y `birth.time_precision_label`, `chart` sin `jd_ut` y solo los códigos de `warnings`. La fecha, la hora, el lugar, la zona y el instante UTC no salen del dispositivo.

El servicio de referencia está en `servicio/` (Cloudflare Worker): ver `servicio/LEEME.md`. La clave del modelo de lenguaje y el protocolo interpretativo viven solo en el servicio, nunca en la página ni en este repositorio.

### Respuesta

- Rechazos inmediatos: estado HTTP 4xx/5xx y `{"error": "<código>"}`. Códigos: `code_required`, `code_invalid`, `quota_exhausted`, `budget_exhausted` (tope del mes), `daily_limit` (tope del día en acceso público), `visitor_limit` (un visitante ya usó su cupo del día), `bot_check` (verificación anti-robots fallida), `bad_request`, `forbidden_origin`, `not_configured`.
- Pedido aceptado: estado 200 y respuesta en flujo. Mientras trabaja, el servicio envía espacios cada 10 s; al final, un único JSON:
  - éxito: `{"report": <astroinforme.report/v1>, "remaining": <informes restantes del código>}`
  - fallo: `{"error": "audit_failed" | "upstream"}`

La app descarta los espacios iniciales, interpreta el JSON y muestra los errores en el idioma de la interfaz. Siempre rehace la auditoría técnica, aunque el servicio ya la haya hecho.

### Qué datos recibe el modelo de lenguaje

El servicio reenvía a Claude solo `engine`, `request`, `birth.time_precision`, `chart` (sin `jd_ut`) y los códigos de `warnings`, más el nombre de pila y la indicación de tratamiento en el pedido. Aunque recibiera la carta completa, descarta fecha, hora, lugar, zona e instante UTC.

### Control de estilo

Después de la auditoría técnica, el servicio revisa el texto (`servicio/src/style.js`): la fórmula «no X, sino Y» más de una vez, frases hechas y lenguaje de horóscopo, autoayuda o diagnóstico. Si encuentra algo, la única corrección (fase C) atiende a la vez lo técnico y lo estilístico. El estilo nunca impide la entrega; lo que quede sin resolver figura en `audit.style_issues`.

## Entrada: `astroinforme.chart/v1`

| Campo | Contenido |
|---|---|
| `schema` | `"astroinforme.chart/v1"` |
| `engine` | versión del motor web, efemérides (Swiss Ephemeris 2.10.03, sepl/semo/seas_18), flags, política de aspectos `orbes_v1` |
| `person.first_name` | nombre de pila o `null`. Nunca apellido ni otros datos |
| `request` | `kind: "NATAL_FULL_REPORT"`, `report_language` (`es`/`de`/`en`), `address` (`voseo`/`du`/`you`), `address_gender` (`FEMININE`, `MASCULINE`, `NEUTRAL`, `UNSPECIFIED`; sin indicar se escribe sin marcas de género), `include_myth: true` |
| `birth` | fecha y hora locales, `time_precision` (`EXACT`, `PM15`, `PM30`, `PM60`, `UNKNOWN`), lugar con coordenadas y fuente, zona IANA, desfase usado y su fuente (`IANA`/`MANUAL`), instante UTC |
| `chart.bodies[]` | `id`, `longitude`, `sign`, `position` (grados del signo), `house`, `speed`, `retrograde`, `stationary`, `near_next_cusp`, `reliable` |
| `chart.south_node` | derivado: Nodo Norte + 180° |
| `chart.houses` | `system` efectivo (`PLACIDUS` o `PORPHYRY`), `asc`, `mc`, `cusps[]`. `null` si la hora es desconocida |
| `chart.aspects[]` | `a`, `b`, `aspect`, `orb`, `max_orb`, `orb_class` (`TIGHT` ≤2°, `MEDIUM` ≤5°, `WIDE`), `applying` (`null` con ángulos), `reliable` |
| `chart.derived` | elementos, modalidades, hemisferios, angulares (≤10°), regentes de ángulos y casas, dispositores, recepciones mutuas, stelliums, configuraciones (cuadratura en T, gran trígono, gran cruz, yod), planetas sin aspectos, fase Sol–Luna |
| `chart.sensitivity` | ventana horaria analizada y lista `unreliable` de signos, casas y aspectos que cambian dentro de ella |
| `warnings[]` | `code` + `text`: `PRE_1970_TZ`, `AMBIGUOUS_LOCAL_TIME`, `MANUAL_OFFSET`, `MANUAL_COORDS`, `PLACIDUS_FAILED`, `UNKNOWN_TIME`, `TIME_SENSITIVE` |

Identificadores internos en inglés (`SUN`, `SQUARE`, `SCORPIO`…). La traducción la hace el motor interpretativo según `report_language`.

## Salida: `astroinforme.report/v1`

```json
{
  "schema": "astroinforme.report/v1",
  "language": "es",
  "title": "…",
  "sections": [
    { "id": "opening", "heading": "Apertura", "body_markdown": "…" },
    { "id": "myth", "heading": "Corolario mitológico", "body_markdown": "…" }
  ],
  "technical_references_used": [ { "type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "SQUARE" } ],
  "audit": {
    "all_references_present_in_chart": true,
    "verified": 24, "total": 24,
    "corrected": false,
    "style_issues": []
  },
  "engine": { "model": "…", "protocol_version": "…", "service": "1.1" }
}
```

`sections` es obligatorio; los `id` siguen la estructura orientativa del protocolo (apertura, identidad, mundo emocional, conflicto central, Saturno y defensas, deseo y afirmación, vínculos, sombra y proyección, transformación, recursos, síntesis, mito) y pueden variar en orden y cantidad.

## Reglas que el motor interpretativo debe cumplir

1. Usar solo datos presentes en el JSON de entrada. Nada de memoria ni de cálculo propio.
2. Cada referencia técnica del texto figura en `technical_references_used`, y la auditoría verifica que exista en `chart`.
3. Los elementos con `reliable: false` se formulan con cautela o se omiten; la auditoría marca los que se usan como dato firme.
4. Con `time_precision = UNKNOWN`: sin Ascendente, Medio Cielo, casas ni cúspides.
5. Protocolo interpretativo: el de ASTROINFORME. No se publica en este repositorio; vive en el servicio interpretativo.

## Opciones que se evaluaron

| Opción | Costo | Autonomía para terceros | Calidad esperada |
|---|---|---|---|
| Servicio propio con la API de Claude (función serverless con la clave guardada en el servidor) | pago por informe | total: cualquier persona usa el enlace | la del protocolo |
| Modelo abierto ejecutado en el navegador | gratis | total | muy por debajo del protocolo: modelos pequeños, descargas de varios GB, no funciona en muchos celulares |

Se eligió la primera, implementada en `servicio/`. La segunda no se implementó porque no alcanza la calidad requerida.
