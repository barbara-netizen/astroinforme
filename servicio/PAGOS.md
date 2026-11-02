# AsterOrbis — pagos (servicio 2.0)

Estado al 2-nov-2026: **todo apagado**. El servicio funciona en modo `pilot` (códigos). Nada de esto cobra hasta cambiar el modo y cargar credenciales, con autorización explícita de Bárbara.

## Modos

| Dónde | Variable | Valores |
|---|---|---|
| App | `config.js` → `mode` | `pilot` (por defecto), `paid`, `disabled` |
| Servicio | `SERVICE_MODE` (variable de Cloudflare) | `pilot` (por defecto), `paid`, `disabled` |

- `pilot`: informes gratuitos con códigos. La franja de piloto y los comentarios están activos.
- `paid`: se venden informes con checkout y confirmación automática. Los códigos siguen valiendo como cortesía.
- `disabled`: no se aceptan pedidos nuevos. Los trabajos en curso terminan y se pueden consultar, y los avisos de pago se siguen procesando.

## Flujo de un pedido pago

1. La carta se calcula en el dispositivo. Fecha, hora y lugar no salen de ahí.
2. `POST /orders`: la app envía la carta calculada, el proveedor elegido, el consentimiento y una clave de idempotencia. El servicio fija el precio, crea el pedido (`ord-…`, un Durable Object `OrderDO`) y pide el enlace de pago al proveedor. Al proveedor solo le llegan el producto, el precio y el identificador del pedido.
3. La persona paga en la plataforma.
4. `POST /webhooks/<proveedor>`: el servicio verifica la firma y consulta el pago en la API del proveedor. Después compara importe, moneda y producto con lo esperado.
5. Si todo coincide, el pedido pasa a `paid` y **el servidor** arranca la generación. Usa el mismo trabajo (`ReportJob`), el mismo cupo (`CodeLedger`, código `ORDER:<id>`, límite 1) y el mismo cierre (`finalizeJob`) que un pedido con código.
6. La app vuelve del checkout con `?pedido=<id>`, consulta `GET /orders/<id>` con la clave del pedido y muestra el informe. Volver a consultar no genera de nuevo: el informe queda guardado 48 h.

Garantías probadas (`test/orders.test.mjs`, `test/payments.test.mjs`):
- avisos repetidos o simultáneos no generan dos informes;
- un importe, una moneda o un producto incorrecto no genera nada y deja el pedido en la cola de excepciones;
- un pago pendiente, rechazado o reembolsado no genera nada;
- una generación fallida va a la cola de excepciones y el reintento genera una sola vez;
- un pedido sin pagar vence a los 7 días y pierde la carta;
- al proveedor nunca le llega la carta.

## Estados del pedido

- **Pago:** `created` → `pending` → `paid` | `failed` | `cancelled` | `mismatch`, y desde `paid` → `refunded`. `mismatch` y `refunded` no vuelven a habilitar la generación.
- **Generación:** `none` → `starting` → `running` → `delivered` | `failed`, y desde `failed` → `starting` si se reintenta.

## Administración (sin leer informes)

Con `ADMIN_TOKEN` configurado (cabecera `Authorization: Bearer <token>`):
- `GET /admin/exceptions`: pedidos que necesitan atención (importe incorrecto, generación fallida). No incluye la carta ni el informe.
- `POST /admin/orders/<id>/retry`: reintenta la generación de un pedido pago.
- `POST /admin/orders/<id>/refund`: pide el reembolso al proveedor. El estado `refunded` llega después por aviso.

## Variables de Cloudflare

| Variable | Tipo | Para qué |
|---|---|---|
| `SERVICE_MODE` | variable | `pilot` / `paid` / `disabled` |
| `PRICE_ARS` | variable | precio para Mercado Pago, p. ej. `15000.00` |
| `PRICE_USD` | variable | precio para Dodo, p. ej. `15.00` |
| `ADMIN_TOKEN` | secreto | acceso a `/admin/` |
| `MP_ACCESS_TOKEN` | secreto | Mercado Pago (de prueba: `TEST-…`) |
| `MP_WEBHOOK_SECRET` | secreto | clave secreta de Webhooks de la aplicación de Mercado Pago |
| `MP_USE_SANDBOX_POINT` | variable | `true` para usar `sandbox_init_point` |
| `DODO_API_KEY` | secreto | Dodo (no cargar hasta la aprobación) |
| `DODO_WEBHOOK_SECRET` | secreto | secreto del webhook de Dodo (`whsec_…`) |
| `DODO_PRODUCT_ID` | variable | producto de pago único creado en Dodo |
| `DODO_ENV` | variable | `test` (por defecto) o `live` |
| `PAYMENTS_SIM`, `SIM_WEBHOOK_SECRET` | variable / secreto | simulador; **nunca en producción** |

Binding nuevo en `wrangler.toml`: `ORDERS` (clase `OrderDO`, migración `v3`). Se crea en el primer despliegue.

## Antes de activar `paid` (lista de control)

- [ ] Términos de compra publicados. Al publicarlos, actualizar `TERMS_VERSIONS` en `orders.js` y `termsVersion` en `config.js`.
- [ ] Política de reembolsos definida (borrador en el documento «AsterOrbis — política de errores y reembolsos»).
- [ ] Identificación de quien vende, en la página de privacidad y en los términos.
- [ ] Plazo de conservación del registro de pedidos (contador).
- [ ] Consulta con el contador: monotributo, actividad, Factura C o E, contraparte con un Merchant of Record.
- [ ] Mercado Pago probado en modo de prueba con avisos reales. Confirmar la firma (ver abajo).
- [ ] Dodo: aprobación escrita y payout a Argentina confirmados antes de cargar claves.
- [ ] Precios cargados (`PRICE_ARS`, `PRICE_USD`).
- [ ] El modo `paid` en la app y en el servicio a la vez.

## Pendiente de confirmar con pruebas reales

- **Mercado Pago:** la plantilla de firma `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (HMAC-SHA256 en hexadecimal) figura en la documentación, pero la página consultada no muestra el paso manual completo. Hay que confirmarla con un aviso real en modo de prueba.
- **Dodo:**
  - la URL base de producción (se asume `https://live.dodopayments.com`);
  - los nombres de los campos de `GET /payments/{id}`;
  - si `total_amount` incluye impuestos o precio en moneda local;
  - el evento de reembolso.
- **Endurecimiento pendiente (revisión independiente del 2-nov, riesgo bajo):**
  - la firma de Mercado Pago no limita la antigüedad de `ts`; antes de fijar una ventana, ver cómo firma Mercado Pago los reintentos;
  - los avisos IPN antiguos (`?topic=payment&id=`) no se aceptan, porque solo se usan los webhooks firmados;
  - `/admin` no pasa por el límite de frecuencia;
  - el simulador no debe activarse nunca en producción, porque su página de pago no tiene autenticación.
- **Gumroad (servicio 1.8):** queda apagado. Según el documento de opciones de cobro, prohíbe vender servicios de IA que se cumplen fuera de Gumroad, que es el caso de AsterOrbis. Decidir si se borra.
