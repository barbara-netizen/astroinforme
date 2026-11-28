# Servicio 2.6.3 — mitos: la pertinencia antes que la novedad

Decisión de Bárbara (28-nov-2026), durante la etapa de estabilización de la 2.6.2.

## Problema
- La 2.4 reemplazaba automáticamente el mito elegido si coincidía con uno reciente o de referencia. Si no quedaba otro considerado, el análisis pasaba a la redacción sin nombre de mito, y la fase B elegía libremente sin la lista.
- La coincidencia se detectaba solo por nombre propio: «Proserpina» no coincidía con «Perséfone».
- Evidencia (archivo `asterorbis-banco`, 10 informes de noviembre): 4 mitos coinciden con la lista de referencia (Odiseo, Psique, Penélope y Proserpina = Perséfone) aunque la regla debía evitarlos; Proserpina y Arethusa usan el mismo pasaje de Metamorfosis V en dos informes del 23-nov generados con 15 minutos de diferencia. Verificación de fidelidad del 28-nov: los 10 mitos son fieles a sus fuentes. Inés (Psique, 2.6.2) destacó el mito como lo más recordado.

## Cambio
- Fase A: la lista de mitos recientes y de referencia pasa a ser información, no prohibición. Si el mito más pertinente para la tesis central está en la lista, se elige igual y se explica en `mito.repeticion` qué condensa que ninguno de los otros considerados condensa. No se elige un mito menos pertinente solo para no repetir.
- `avoidRepeatedMyth`: con una explicación de al menos 30 caracteres, el mito repetido se conserva (`mito_repetido.justificado: true`). Sin explicación, se toma otro considerado, como antes. Si no hay otro, se conserva el elegido (`justificado: false`) en lugar de dejar el mito sin nombre.
- `repeatedMyth`: la misma figura con su nombre griego, romano o inglés cuenta como repetida (Proserpina = Perséfone, Ulises = Odiseo, Cupido = Eros, Arethusa = Aretusa, entre otros).
- Sin llamada extra a la API. Sin cambios en la fase B, la app, el correo ni el banco.

## Cómo comprobar la mejora (hasta el 18-dic)
- Revisar en el banco los mitos de los informes 2.6.3: cuántos repiten figura, si la repetición está justificada en esta carta y si la escena elegida sirve a la tesis.
- Verificar fidelidad de los mitos nuevos contra las fuentes, como el 28-nov.
- Efecto secundario a vigilar: más repetición de figuras conocidas (Perséfone, Psique, Odiseo).

## Límite
- El protocolo interpretativo vive en el KV (clave `protocol`) y no se revisó en este cambio. Si dice que los mitos no pueden repetirse, contradice esta regla y hay que actualizarlo.

Pruebas: `test/prose.test.mjs` suma los casos de figura con otro nombre, repetición justificada, repetición sin justificar con alternativa y sin alternativa.
