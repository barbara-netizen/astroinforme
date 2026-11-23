# Servicio 2.6.2 — control del correo del informe

- El registro `gen:` de cada informe anota el resultado del correo: `mail` («accepted» o «rejected»), `mail_tries` y, si no salió, `mail_http` (código de Resend, o vacío si no hubo respuesta). Nunca la dirección.
- Fallas pasajeras (sin respuesta, 429, 409 o 5xx): hasta 3 intentos, con esperas de 2 y 6 segundos y la misma clave de idempotencia, para que Resend no lo mande dos veces.
- Un rechazo definitivo (por ejemplo, 422 por dirección inválida) no se reintenta.
- Si el correo no sale, llega un aviso a `ADMIN_EMAIL` con el código, el registro `gen:`, la hora, la respuesta de Resend y los intentos. Sin la dirección de la persona ni el enlace privado.
- El informe se entrega en pantalla igual que antes; la app sigue recibiendo `mailed` (verdadero o falso).
- Pruebas: `test/correo.test.mjs` pasa de 3 a 7 grupos.

Aceptado por Resend no garantiza la llegada a la bandeja: eso se ve en el panel de Resend.
