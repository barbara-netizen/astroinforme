# Servicio 2.5 — banco de informes (sobre 2.4)

Rama `banco-informes` (parte de `mejora-analisis-2.4`). Sin publicar.

## Qué hace
- Casilla opcional y desmarcada al pedir el informe (ES/DE/EN): autoriza guardar una copia anónima. Sin permiso no se guarda nada.
- Con permiso, al entregar el informe el servicio guarda en un repositorio privado de GitHub `informes/AAAA/MM/AO-XXXXXXXX.json`: informe con el nombre reemplazado por «[nombre]», carta tal como la recibe el modelo, auditorías (técnica, argumental y de prosa), costo, versión, modelo y mes. Nunca correo, código, pedido, IP ni fecha exacta.
- El número `AO-XXXXXXXX` se muestra al pie del informe y sirve para pedir la baja. Es estable: si el cierre se repite, no se duplica.
- Los comentarios de esa persona en los 7 días siguientes se guardan en `comentarios/AAAA/MM/` con el mismo número, sin código.
- Vencimiento: el control periódico borra una vez por mes las carpetas con más de 24 meses.
- Si el banco no está configurado o GitHub falla, el informe se entrega igual y sin número.
- El permiso no se envía al modelo.
- Privacidad actualizada en los tres idiomas (sección «Banco de informes», plazos en «Tus derechos»).

## Configuración (la hace Bárbara)
1. Crear en GitHub el repositorio **privado** `asterorbis-banco`.
2. Crear un token de acceso fino (fine-grained) con acceso solo a ese repositorio y permiso «Contents: Read and write».
3. En Cloudflare, Worker `astroinforme` → Variables y secretos: `BANK_GITHUB_TOKEN` (secreto) y `BANK_REPO` = `barbara-netizen/asterorbis-banco`.

## Pruebas
`test/bank.test.mjs`: 7 grupos (anonimización, sin permiso, con permiso, comentarios, banco caído, vencimiento, contenido de la entrada).
