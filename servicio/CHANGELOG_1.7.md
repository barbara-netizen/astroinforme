# Servicio 1.7 — cupo atómico por código (1-nov-2026)

Paso 2 del plan previo al cobro («AsterOrbis — roast antes de cobrar»).

## Problema

El cupo vivía en el KV, que no tiene operaciones atómicas. Dos pedidos simultáneos con el mismo código leían el cupo antes de que alguno lo reservara, y los dos generaban. Con cobro, eso habría significado entregar más informes que los pagados.

## Cambios

- **Libro de cupo por código** (`src/ledger.js`, Durable Object `CodeLedger`, binding `CODE_LEDGER`, migración `v2`). Tres operaciones atómicas:
  - reservar: una sola generación en curso, nunca por encima del cupo;
  - consumir: al entregar el informe;
  - liberar: si el pedido falla, sin descontar.
- **Consumo idempotente.** Cada reserva tiene una ficha única. Si el cierre de un pedido se repite, no descuenta dos veces.
- **Vencimiento de la reserva: 60 minutos** (antes, 20). Ahora cubre la duración máxima de un trabajo, tres intentos de hasta 15 minutos más las esperas.
- **Migración sin pasos manuales.** La primera vez, el libro toma el cupo usado que ya figuraba en el KV. Cada consumo se copia a `used:<CÓDIGO>` en el KV para poder consultarlo desde el panel. Las marcas `inflight:` del KV dejan de usarse.
- **Modo en flujo anterior apagado.** `POST /` responde `410 app_outdated`, salvo con `LEGACY_STREAM = "true"`, que usan las pruebas. La app actual usa `/jobs` desde la 1.6.
- `/health` informa `ledger: true`.
- Sin el binding `CODE_LEDGER`, los pedidos con código responden `not_configured` en lugar de usar el método anterior, que no era seguro.

## Límite conocido

El tope de gasto mensual sigue siendo una lectura del KV. Pedidos simultáneos de códigos distintos pueden superarlo por el costo de unos pocos informes. Se revisa en el paso 4 (presupuesto y alertas).

## Pruebas

- Reservas simultáneas sobre el libro: solo una prospera. La prueba falla si se quita la serialización.
- Pedidos simultáneos en flujo y en `/jobs` con el mismo código.
- Migración del uso previo, consumo idempotente y binding ausente.

## 1.7.1 — primera parte del paso 3

- **Origen obligatorio.** Fuera de `/health`, se rechaza todo pedido sin `Origin` o con un origen no permitido. Antes, un pedido sin `Origin` (un script) pasaba.
- **Límite de frecuencia.** Binding `RATE_LIMITER` de Cloudflare: 6 pedidos que generan o escriben por minuto y por código, o por visitante si no hay código. Las consultas de estado no cuentan. Es aproximado y se cuenta por ubicación; el cupo exacto sigue en el libro. Sin el binding, no limita.
- **El código se verifica antes de crear el objeto del pedido.** Un código falso ya no crea Durable Objects.
- `/health` ya no informa cuántos códigos hay, solo si hay alguno.
- Pendiente del paso 3: licencias generadas por la plataforma de pago (depende de elegir proveedor).
