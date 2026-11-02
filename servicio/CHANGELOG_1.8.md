# Servicio 1.8 — licencias de Gumroad como códigos (2-nov-2026)

Resto del paso 3 del plan previo al cobro y parte del paso 4. **Apagado** hasta configurar `GUMROAD_PRODUCT_ID`.

## Cómo funciona

- Al comprar en Gumroad, la persona recibe una clave de licencia (`XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`). La carga en la app donde hoy va el código.
- El servicio la verifica en `POST https://api.gumroad.com/v2/licenses/verify` con `increment_uses_count=false`. El cupo lo lleva el libro `CodeLedger`, como con cualquier código.
- **Cupo:** cantidad comprada × `REPORTS_PER_LICENSE`. Por defecto, 1 informe por licencia.
- **Reembolsos:** una compra reembolsada, con contracargo o en disputa responde `license_refunded`.
- **Gumroad no responde:** `license_unavailable` (503). El resultado no se guarda y se puede reintentar.
- **Caché:** el resultado se guarda 10 minutos en `lic:<resumen SHA-256>`, sin correo ni nombre. Así, la consulta de estado y los reintentos no vuelven a llamar a Gumroad.
- Solo se consulta a Gumroad cuando la clave tiene formato de licencia. Los códigos de regalo siguen igual.

## Trazabilidad (paso 4)

El registro de costo `gen:<request_id>` suma dos campos:

- `access`: `code`, `license` o `public`.
- `ref`: número de orden de Gumroad en las licencias (`order:<n>`), o el código en los códigos de regalo.

No se guarda el correo de quien compró.

## Para activarlo

1. Crear el producto en Gumroad y activar «Generate a unique license key per sale».
2. Copiar el `product_id` del producto y cargarlo en Cloudflare como variable `GUMROAD_PRODUCT_ID`.
3. Opcional: `REPORTS_PER_LICENSE`, si una compra debe dar más de un informe.

## Pruebas

`test/licenses.test.mjs`: 8 grupos con Gumroad simulado.
