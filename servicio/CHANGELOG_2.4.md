# Servicio 2.4 — auditoría de la prosa y análisis más exigente

Rama `mejora-analisis-2.4`. Sin publicar.

## Auditoría de la prosa (`prose_audit.js`, nuevo, determinista, sin costo)
La auditoría técnica verifica solo lo que el informe declara. Este control lee el texto:

1. **Afirmaciones técnicas en la prosa** (planeta en signo, planeta en casa, aspectos, planeta junto a un ángulo, signo de los ángulos), verificadas contra la carta aunque no estén declaradas. Con hora desconocida, cualquier mención de casas o ángulos es error. Prueba con el informe de muestra y su carta recalculada: 47 afirmaciones revisadas, 0 falsos errores; 7 de 7 errores inyectados detectados.
2. **Biografía afirmada como hecho** (padre, madre, infancia, trauma…) sin modulación. No se aplica al mito.
3. **Jerga**: términos técnicos cada mil palabras, párrafos con cinco o más términos y párrafos que empiezan por el dato técnico.
4. **Vicios de redacción**: lista cerrada de muletillas y modismos de texto generado, «no solo… sino también», enumeraciones parejas de tres o más elementos, palabras sobreusadas, frases repetidas y aperturas de párrafo iguales.
5. **Repetición entre informes**: huella de cada informe (hashes de frases de siete palabras, sin texto ni datos personales; KV `prints:recent`, últimos 20). Tres o más frases compartidas piden reescritura.

Lo que supera los umbrales (`THRESHOLDS`) entra en la única corrección (fase C). Si la corrección agrega datos falsos en la prosa, se conserva la versión anterior. El resultado queda en `report.prose_audit`.

## Mitos
Si el mito elegido en la fase A coincide por nombre propio con uno reciente o de referencia, se toma otro de `mitos_considerados` antes de redactar, sin llamada extra (`avoidRepeatedMyth`). Se registra el mito finalmente usado.

## Fases A y B
- Fase A: cada tesis declara mecanismo, defensa, costo, recurso y especificidad; nuevas listas `lecturas_descartadas` y `preguntas_biograficas`. Una posición aislada no es tesis; la tesis que no supera la prueba de especificidad se descarta.
- Fase B: jerga después de la experiencia y una sola vez por párrafo (objetivo ≤15 cada mil palabras), sin cadenas de regencias, sin repetir ideas entre secciones, sin enumeraciones vacías ni muletillas, mito fiel a las fuentes y sin detalles dudosos.

## Pendiente antes de publicar
- Lectura de Bárbara.
- Generar 3 a 5 informes reales (requiere crédito de API y clave vigente) y medir: frecuencia de la fase C, costo, tiempo, densidad técnica y lectura de calidad.
- Ajustar umbrales con esos informes.
- La guía de estilo cargada en el KV no se modificó.
