# Idiomas — ajustes del 31-10-2026

El estado previo de los idiomas está en el documento «ASTROINFORME — diagnóstico de pagos e idiomas». Los 270 textos de la interfaz ya estaban completos en es/de/en; estos son los ajustes que faltaban.

| Ajuste | Archivos |
|---|---|
| La descarga HTML se arma entera en el idioma del informe (títulos, tablas, auditoría, procedencia, pie y fecha), aunque la interfaz esté en otro | `app.js` (`downloadSheet`, `buildDownload`, `provText`) |
| «Guardar PDF»: mientras se imprime, la página pasa al idioma del informe y después vuelve al de la interfaz | `app.js` (`beforeprint` / `afterprint`) |
| Etiquetas de accesibilidad de latitud, longitud y nombre del lugar, antes fijas en español | `page.html`, `i18n.js` (`aria.*`) |
| «Sobre este informe» completo en alemán e inglés (antes estaban resumidos al 64 % y 57 % del largo del español) | `i18n.js` (`about.body`) |
| Comentario y errores del comentario completos en alemán e inglés | `i18n.js` (`fb.note`, `fb.err.*`) |
| Variante de inglés: británico, coherente con las fechas en-GB de la app | `servicio/src/prompts.js` (`IDIOMA.en`) |

## Pruebas
- Suite del servicio: 61 grupos en verde.
- Navegador con la interfaz en español y un informe en alemán:
  - la descarga HTML sale con `lang="de"` y todo en alemán («Technische Daten des Horoskops», «Technische Prüfung: 32 von 32…», «14. Juli 1990»), y la interfaz queda en español;
  - al imprimir, la página pasa a alemán y vuelve a español.

## Pendiente
- **Revisión nativa** de los textos en alemán y en inglés. Bárbara puede revisar el alemán.
- **Nombre del país:** se guarda en el idioma en que se eligió el lugar («Hamburg, Alemania» en una descarga en alemán).
- **Control de estilo:** las listas de frases hechas en alemán e inglés son más cortas que la española.
- **Activación:** alemán e inglés siguen desactivados (`config.languages: ["es"]`) hasta que se decida abrirlos. Antes conviene generar un informe de prueba en cada idioma.
