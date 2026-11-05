# Servicio 2.3 — recorrido de regencias y comprobación de alcance

Origen: el informe del 13-9-1960 decía que el gran trígono de fuego «no pasa por la cadena de evaluación», aunque el Ascendente y Urano terminan en Venus. Solo Júpiter quedaba afuera.

- `chart.derived.ruler_chains`: recorrido de regencias modernas de cada planeta, Quirón y ángulo, con su final (domicilio o ciclo), fiabilidad y grupos por final. Lo calcula el servicio con signos validados; no hace falta actualizar la app y lo que envíe el cliente con ese nombre se descarta.
- Fases A y B: regla de comprobación de alcance para afirmaciones del tipo «todo», «solo», «no pasa por» o «termina en».
- Fase B: comparación de apertura, recursos y síntesis antes de cerrar.
- `final_dispositor` y `audit.js` no cambian. La auditoría todavía no coteja las tesis con estos recorridos.
- La guía de estilo (KV `style`) y el protocolo (KV `protocol`) no están en el repositorio y no se tocaron. La regla vive en `prompts.js`.
