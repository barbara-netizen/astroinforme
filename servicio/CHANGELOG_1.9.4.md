# Servicio 1.9.4 — menos redacciones repetidas

Causa probable: en Opus 5.5 el pensamiento siempre está activo, se cobra como salida y cuenta dentro de `max_tokens`. Con 32.000, una redacción podía cortarse y se pagaba dos veces.

- Topes por llamada: análisis 24.000 y redacción y corrección 48.000.
- `gen:` guarda cada llamada en `calls`: fase, motivo de cierre, tokens de salida, segundos y problema si se repitió. Sin texto de la carta ni del informe.
- La app consulta el estado apenas la persona vuelve a la pantalla, sin esperar el temporizador.
