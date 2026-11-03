# Servicio 1.9 — método de análisis

Publicado con autorización de Bárbara.

- `engine.js`: `chart.derived.structure` calcula grupos conectados, puentes, cantidad de aspectos por tipo y aspectos más cerrados entre Sol y Plutón.
- Fase A: dos pasadas, forma de la tensión, tesis con indicadores, lectura alternativa, debilidad de la tesis y tres mitos considerados.
- Fase B: campo `theses`.
- `argument_audit.js`: conectada al servicio. Si una tesis central no tiene dos indicadores válidos, pide una corrección.
- Mitos recientes: el KV guarda en `myths:recent` los últimos 12 nombres de mitos, sin datos de personas.
- Control de estilo: agrega fórmulas detectadas en pruebas.

Normaliza referencias de casa escritas como texto y evita los mitos de referencia además de los recientes. La guía v4 va en la clave `style` del KV.
