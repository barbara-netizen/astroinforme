# Auditoría argumental — diseño (versión 0)

Estado: contrato y pruebas. **No está conectada** al servicio, al prompt ni a la interfaz. `argument_audit.js` es una función pura con pruebas (`servicio/test/argument.test.mjs`).

## Para qué

El protocolo pide que una conclusión psicológica central esté sostenida, siempre que sea posible, por más de un indicador de la carta. La auditoría técnica no comprueba eso: confirma que los datos mencionados coinciden con el cálculo, no que una tesis tenga más de un apoyo.

Dos capas separadas:

| Capa | Pregunta | Archivo |
|---|---|---|
| Auditoría técnica | ¿Los datos astrológicos declarados coinciden con la carta calculada? | `audit.js` |
| Auditoría argumental | ¿Cada tesis central declarada por el informe enumera más de un indicador válido? | `argument_audit.js` |

## Qué no hace

- No juzga si una tesis es psicológicamente acertada.
- No lee la prosa ni infiere tesis: trabaja solo con lo que el informe declara.
- No produce puntajes ni porcentajes.
- No toca la biografía de la persona.

## Contrato propuesto

Campo opcional de `astroinforme.report/v1`, compatible hacia atrás (un informe sin `theses` sigue siendo válido):

```json
"theses": [
  {
    "id": "t1",
    "claim": "Una oración que resume la tesis, tal como el informe la sostiene.",
    "central": true,
    "sections": ["central_conflict", "saturn"],
    "indicators": [
      { "type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "OPPOSITION" },
      { "type": "stellium", "by": "SIGN", "where": "CAPRICORN" },
      { "type": "rulership", "of": "MC", "ruler": "SUN" }
    ]
  }
]
```

- `indicators` usa los mismos tipos que `technical_references_used`, así que se verifica con `audit.js`.
- `central: true` marca las tesis que organizan el informe (la tensión central y sus reapariciones).

## Reglas de evaluación

1. Los indicadores repetidos cuentan una vez.
2. Cada indicador se verifica con la auditoría técnica, incluida la sensibilidad horaria. Uno que falla no suma y se informa.
3. Estado por tesis:
   - `supported`: dos o más indicadores distintos verificados;
   - `single_indicator`: uno;
   - `unsupported`: ninguno.
4. `ok` es verdadero si todas las tesis centrales están en `supported`. Una tesis no central con un solo indicador no hace fallar el conjunto. El protocolo admite esa situación si la tesis se formula con cautela, y la cautela de la redacción no se audita automáticamente.
5. Se informan las secciones citadas que no existen en el informe.

## Límite conocido

Dos indicadores distintos pueden expresar el mismo factor: una posición y un aspecto del mismo planeta cuentan como dos. Definir qué cuenta como «indicador independiente» es una decisión metodológica, no técnica. Queda abierta para que la decida la autora antes de cualquier regla más fina.

## Pasos siguientes, si se adopta

1. Agregar al pedido de la fase B la instrucción de declarar `theses` (cambia la salida del modelo: probar primero con informes reales).
2. Decidir el uso del resultado: informativo en la interfaz, motivo de corrección (fase C) o solo registro para revisión de la autora. La propuesta es empezar por el registro, sin bloquear la entrega.
3. Decidir la regla de independencia entre indicadores (ver «Límite conocido»).
