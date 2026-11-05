# Servicio 2.2 — Mercado Pago por API de Orders

- Checkout Pro pasa de Preferences a Orders, porque Mercado Pago avisa que Preferences será descontinuada.
- El aviso de pago se configura en el panel de la aplicación (evento Order).
- La conciliación y el reembolso también usan Orders.
- Falta confirmar con una compra de prueba la ruta de reembolso y que `payer` no sea obligatorio.
