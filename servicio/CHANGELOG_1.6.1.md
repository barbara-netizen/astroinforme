# Servicio 1.6.1 y app — correcciones previas al cobro (1-nov-2026)

Corrige los errores que afectaban a usuarios, detectados en la revisión del 1-nov («AsterOrbis — roast antes de cobrar»).

## Servicio

- **Pedido fallido bloqueado 48 h.** Al reenviar un pedido que falló, el servicio devolvía el fallo viejo. Ahora lo marca con `retry: true`; la app pide de nuevo con un identificador nuevo. Un fallo nunca descuenta cupo.
- **Informe de otra carta con el código agotado** (introducido en el PR #9). La copia guardada lleva una huella de los datos del pedido (SHA-256 de carta, idioma, tratamiento y nombre). Con el cupo agotado, solo se entrega si la huella coincide. Las copias anteriores, sin huella, se aceptan hasta que venzan (48 h).
- **Errores transitorios no reintentados.** Un error dentro del flujo (por ejemplo `overloaded_error`) llegaba con estado 200 y el trabajo fallaba. Ahora se traduce al estado equivalente (529, 429, 500, 504). Un corte de red o un flujo sin final quedan sin estado. En los dos casos el trabajo se reintenta desde la última fase guardada.

## App

- Un pedido fallido o rechazado de forma definitiva (código inválido, cupo agotado) borra el identificador pendiente.
- Si la página se recarga durante la espera, el formulario avisa que hay un informe en preparación. Explica que, con los mismos datos y el mismo código, la app retoma la espera sin generar otro informe ni descontar cupo.
- Logo con la paleta elegida: aro #5F8FAE, flor #C4473E, centro #F4E9D9 y nombre #1F3A50 (en modo oscuro, el nombre usa el color de texto). Íconos regenerados.

## Pruebas

Tres grupos nuevos en `jobs.test.mjs`: otra carta con código agotado, reintento de pedido fallido y clasificación de errores transitorios. Se corrigieron dos comentarios de `hardening.test.mjs` que contradecían su prueba.
