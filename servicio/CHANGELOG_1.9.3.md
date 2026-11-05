# Servicio 1.9.3 — correcciones de la auditoría del 5-nov-2026

- Si falla el descuento del cupo, el informe terminado se entrega igual. Se reintenta y, si sigue fallando, `gen:` lo marca con `quota_unsettled`.
- Si el trabajo no arranca, se libera la reserva: el código ya no queda trabado una hora.
- Al modelo ya no llega `engine.version`. Solo recibe la política de aspectos.
- Un fallo del registro mensual ya no cambia el resultado de un informe rechazado por la auditoría.
