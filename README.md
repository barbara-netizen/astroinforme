# ASTROINFORME

Carta natal calculada en el navegador con Swiss Ephemeris. Ilustraciones: [Bárbara Gutiérrez](https://barbaragutierrez.art).

Aplicación: https://barbara-netizen.github.io/astroinforme/

Página estática que calcula la carta natal en el navegador de quien la abre. No necesita servidor propio, base de datos, cuenta de Claude ni clave de API.

## Qué es autónomo y qué no

| Función | Estado |
|---|---|
| Posiciones (Sol a Plutón, Quirón, Nodo verdadero), Swiss Ephemeris 2.10.03 con archivos sepl/semo/seas_18 | Autónomo |
| Casas Placidus (Porfirio dentro de los círculos polares), Ascendente, Medio Cielo | Autónomo |
| Aspectos `orbes_v1`, configuraciones, regencias, elementos, hemisferios, dispositores | Autónomo |
| Zona horaria histórica (base IANA del navegador), horas repetidas e inexistentes, desfase manual | Autónomo |
| Búsqueda de lugares: 135.233 localidades de GeoNames incluidas en la página; coordenadas manuales | Autónomo |
| Sensibilidad de la carta a la precisión horaria | Autónomo |
| Redacción del informe psicológico | **No conectado.** Contrato listo en `CONTRATO_INTERPRETACION.md` |
| Auditoría técnica del informe (`audit.js`): compara cada referencia declarada con la carta calculada | Autónomo |

## Validación

- Mismo motor que el MVP local: Swiss Ephemeris 2.10.03. Comparado contra pysweph 2.10.3.6 en 8 cartas (Buenos Aires, Hamburgo, Ciudad de México, Fráncfort, Ushuaia, Tromsø, Sídney, Madrid el 1-1-2000 a las 0:00 UTC): diferencia máxima en planetas, cúspides, ASC y MC menor a 0,000001″.
- Resolución horaria comparada con `zoneinfo` de Python en 9 casos, incluidos Argentina 1963, 1974, 1991, 2008 y 2009, Berlín 1945 y 1990, Ciudad de México 1975: coincidencia total, con detección de horas repetidas e inexistentes.
- Sin validar todavía contra cartas nuevas de Astro.com desde esta versión; el MVP local ya coincidió con Astro.com en CASO-10 usando el mismo motor.

## Publicarla en internet (gratis)

Todos los archivos de esta carpeta tienen que quedar juntos en la misma ubicación. `index.html` es la entrada.

**GitHub Pages** (requiere una cuenta gratuita de GitHub):
1. Crear un repositorio nuevo, por ejemplo `astroinforme`.
2. «Add file» → «Upload files» → arrastrar todos los archivos de la carpeta → «Commit changes».
3. «Settings» → «Pages» → «Deploy from a branch» → rama `main`, carpeta `/ (root)` → «Save».
4. Al cabo de uno o dos minutos la dirección queda en esa misma pantalla: `https://<usuario>.github.io/astroinforme/`.

Netlify o Cloudflare Pages también sirven: cualquier hosting de archivos estáticos que entregue `.wasm` y `.js` funciona.

Para probarla en la computadora sin publicar: en esta carpeta, `python -m http.server 8000` y abrir `http://localhost:8000`. Abrir `index.html` con doble clic no funciona: los navegadores bloquean los módulos y el WASM desde archivos locales.

## Ilustraciones

Obra de Bárbara Gutiérrez (https://barbaragutierrez.art), integrada según las decisiones del MVP (`docs/ASSETS.md` del MVP local). Crédito en cada pieza y en el pie: «Ilustraciones: Bárbara Gutiérrez», con enlace al sitio. Publicación abierta autorizada por la autora el 16-oct-2026.

| Momento | Pieza |
|---|---|
| Portada | «Levitar» fija; botón para ver «Soñé que bordaba» animada (oculto con movimiento reducido) |
| Espera real (carga del motor o de la lista de lugares, más de 0,25 s) | «Neuronales» |
| Ficha técnica calculada | «Abre los ojos», una vez, termina con los ojos abiertos |
| Generación del informe | «Lectora», mientras espera (solo con motor interpretativo conectado) |
| Informe terminado | «Serendipia Blanca», solo si la auditoría del informe da bien (ídem) |

- Ilustraciones por sección del informe (`SECTION_ART` en `visuals.js`): identidad «Biografías», mundo emocional «Sueño Contigo», Saturno «Glamur Atado con Alambre», vínculos «Venus Angel», raíces «Moradotas», Neptuno «Nadadoras», mito «Guardián del Universo». Dentro del informe las animaciones se reproducen una vez.
- «Serendipia Blanca» aparece solo si la auditoría técnica no encuentra discrepancias.
- «Familia Puzzle» excluida por decisión de la autora. «As de Espadas» y «Fondo florido» no se incluyen.
- Animaciones: WebM (VP9) recodificado desde el MP4 original, con el MP4 como alternativa; si ninguna se reproduce queda el fotograma fijo. Silenciadas, se pausan con la pestaña oculta.
- Archivos en `assets/`, copias sin modificar de las del MVP salvo los `.webm`.

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | página (generada desde `page.html` con `build.sh`) |
| `app.js` | interfaz |
| `engine.js` | motor de cálculo: lugar, tiempo, carta, aspectos, derivados, sensibilidad |
| `config.js` | dirección del motor interpretativo (vacía) |
| `swisseph-browser.js`, `swisseph.js`, `swisseph.wasm` | Swiss Ephemeris compilado a WebAssembly (`@swisseph/browser` 1.4.0) |
| `sepl_18.se1.b64.txt`, `semo_18.se1.b64.txt`, `seas_18.se1.b64.txt` | efemérides 1800–2399 (planetas, Luna, Quirón), en base64 |
| `tzlookup.js` | zona horaria a partir de coordenadas (`@photostructure/tz-lookup` 11.7.0) |
| `audit.js` | auditoría técnica de informes |
| `visuals.js`, `assets/` | capa visual e ilustraciones |
| `cities.txt` | localidades de más de 1000 habitantes (GeoNames vía `all-the-cities` 3.1.0) |

## Licencias

- Código: AGPL-3.0 (archivo `LICENSE`), por depender de Swiss Ephemeris.
- Swiss Ephemeris y `@swisseph/browser`: AGPL-3.0. Si la página se publica para otras personas, la AGPL exige ofrecerles el código fuente completo. Esta carpeta es ese código: alcanza con publicarla tal cual (en GitHub Pages el repositorio público ya cumple esa función) y conservar `LICENSE-swisseph-browser.txt`. Para uso comercial sin abrir el código hace falta la licencia profesional de Astrodienst. Esto es una lectura de la licencia, no asesoramiento legal.
- Ilustraciones (`assets/`): © Bárbara Gutiérrez, todos los derechos reservados. No están cubiertas por la AGPL ni por ninguna otra licencia de este repositorio.
- GeoNames: CC BY 4.0 (atribución en el pie de la página). tz-lookup: CC0.

## Privacidad

Los datos de nacimiento no salen del navegador. La página solo descarga sus propios archivos y las tipografías de Google Fonts. No guarda nada.

## Limitaciones conocidas

- Zonas horarias anteriores a 1970: la base IANA puede no coincidir con el horario oficial de la época; la página lo avisa y permite cargar el desfase a mano.
- Zona según coordenadas: en localidades muy cercanas a una frontera horaria conviene revisar la zona propuesta.
- Nombres de lugares: la lista usa el nombre de GeoNames (inglés o idioma local). Hay equivalencias para las ciudades más comunes en español («Múnich», «Ciudad de México», «Londres»…); si una búsqueda no encuentra el lugar, probar con el nombre local o cargar coordenadas.
- Interfaz solo en español; el idioma del informe (es/de/en) queda registrado en el contrato.
- Primera carga: unos 8 MB (efemérides, WASM y lista de lugares). Después el navegador los guarda en caché.
