# ASTROINFORME — contrato del motor interpretativo

El cálculo y la interpretación están separados. La página calcula la carta en el navegador y produce un JSON `astroinforme.chart/v1`. Un motor interpretativo, cuando exista, recibe ese JSON y devuelve un informe `astroinforme.report/v1`. La página no depende de ningún motor para calcular.

## Conexión

En `config.js`:

```js
export const CONFIG = { interpreterUrl: "https://tu-servicio/interpretar" };
```

Vacío: la sección «Interpretación» muestra «No conectado» y ofrece copiar los datos.
Con valor: aparece el botón «Generar el informe», que hace `POST interpreterUrl` con `Content-Type: application/json` y el cuerpo `astroinforme.chart/v1`.

El servicio debe permitir CORS desde el dominio donde se publique la página. La clave del modelo de lenguaje vive solo en el servicio, nunca en la página.

## Entrada: `astroinforme.chart/v1`

| Campo | Contenido |
|---|---|
| `schema` | `"astroinforme.chart/v1"` |
| `engine` | versión del motor web, efemérides (Swiss Ephemeris 2.10.03, sepl/semo/seas_18), flags, política de aspectos `orbes_v1` |
| `person.first_name` | nombre de pila o `null`. Nunca apellido ni otros datos |
| `request` | `kind: "NATAL_FULL_REPORT"`, `report_language` (`es`/`de`/`en`), `address` (`voseo`/`du`/`you`), `include_myth: true` |
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
    "unreliable_items_used": [],
    "notes": []
  },
  "engine": { "model": "…", "protocol_version": "…" }
}
```

`sections` es obligatorio; los `id` siguen la estructura orientativa del protocolo (apertura, identidad, mundo emocional, conflicto central, Saturno y defensas, deseo y afirmación, vínculos, sombra y proyección, transformación, recursos, síntesis, mito) y pueden variar en orden y cantidad.

## Reglas que el motor interpretativo debe cumplir

1. Usar solo datos presentes en el JSON de entrada. Nada de memoria ni de cálculo propio.
2. Cada referencia técnica del texto figura en `technical_references_used`, y la auditoría verifica que exista en `chart`.
3. Los elementos con `reliable: false` se formulan con cautela o se omiten; si se usan, se listan en `audit.unreliable_items_used`.
4. Con `time_precision = UNKNOWN`: sin Ascendente, Medio Cielo, casas ni cúspides.
5. Protocolo interpretativo: el de ASTROINFORME. No se publica en este repositorio; vive en el servicio interpretativo.

## Opciones para conectarlo (pendiente de decidir)

| Opción | Costo | Autonomía para terceros | Calidad esperada |
|---|---|---|---|
| Servicio propio con la API de Claude (función serverless con la clave guardada en el servidor) | pago por informe | total: cualquier persona usa el enlace | la del protocolo |
| Modelo abierto ejecutado en el navegador | gratis | total | muy por debajo del protocolo: modelos pequeños, descargas de varios GB, no funciona en muchos celulares |

La tercera no se implementó porque no alcanza la calidad requerida.
