# Servicio 2.6 — informe completo por correo (pedidos con código)

- Campo opcional «Tu correo» junto al código. Si se completa, al terminar el informe el servicio manda un correo con el informe completo (HTML y texto) y un enlace privado `?informe=<id>#k=<clave>` que abre el informe en la app, con ilustraciones y PDF.
- El correo no depende de que la app siga abierta: lo manda el servicio al cerrar el trabajo.
- La dirección se guarda solo mientras dura la generación y se borra al mandar el correo (no queda en el trabajo ni en el KV).
- Copia detrás del enlace: KV `lnk:<id>`, 7 días, con el informe y la carta sin el nombre; la clave se guarda como hash. `GET /links/<id>` con `x-link-key`.
- Las compras no cambian: siguen recibiendo su correo con enlace.
- En la espera, si hay correo, el aviso dice que se puede cerrar la página.
- Privacidad actualizada en ES/DE/EN.
- Pruebas: `test/correo.test.mjs` (3 grupos). 16 grupos en total, OK.
