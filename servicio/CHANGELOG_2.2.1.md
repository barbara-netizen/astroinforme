# Servicio 2.2.1 — pantalla de compra

Correcciones de la prueba con compra de Mercado Pago del 5-nov-2026.

- La espera distingue «Confirmando tu pago» de la escritura. El reloj arranca cuando empieza la generación (`generation_started_at` en la vista pública del pedido), no al volver del pago.
- En una compra el aviso dice «Podés cerrar esta página» y ya no dice «Quedate en esta pantalla».
- El informe comprado informa 7 días con el enlace del correo, no 48 horas con código.
