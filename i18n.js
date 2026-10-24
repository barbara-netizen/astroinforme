// ASTROINFORME — textos de la interfaz en español (voseo), alemán (du) e inglés.
// Terminología astrológica tomada del glosario aprobado del MVP (i18n/glossary.json).

export const LANGS = ["es", "de", "en"];

const TERMS = {
  SUN: ["Sol", "Sonne", "Sun"], MOON: ["Luna", "Mond", "Moon"], MERCURY: ["Mercurio", "Merkur", "Mercury"],
  VENUS: ["Venus", "Venus", "Venus"], MARS: ["Marte", "Mars", "Mars"], JUPITER: ["Júpiter", "Jupiter", "Jupiter"],
  SATURN: ["Saturno", "Saturn", "Saturn"], URANUS: ["Urano", "Uranus", "Uranus"], NEPTUNE: ["Neptuno", "Neptun", "Neptune"],
  PLUTO: ["Plutón", "Pluto", "Pluto"], CHIRON: ["Quirón", "Chiron", "Chiron"],
  NORTH_NODE: ["Nodo Norte", "Mondknoten ↑", "North Node"], SOUTH_NODE: ["Nodo Sur", "Mondknoten ↓", "South Node"],
  ASC: ["Ascendente", "Aszendent", "Ascendant"], DSC: ["Descendente", "Deszendent", "Descendant"],
  MC: ["Medio Cielo", "Medium Coeli", "Midheaven"], IC: ["Fondo del Cielo", "Imum Coeli", "Imum Coeli"],
  ARIES: ["Aries", "Widder", "Aries"], TAURUS: ["Tauro", "Stier", "Taurus"], GEMINI: ["Géminis", "Zwillinge", "Gemini"],
  CANCER: ["Cáncer", "Krebs", "Cancer"], LEO: ["Leo", "Löwe", "Leo"], VIRGO: ["Virgo", "Jungfrau", "Virgo"],
  LIBRA: ["Libra", "Waage", "Libra"], SCORPIO: ["Escorpio", "Skorpion", "Scorpio"], SAGITTARIUS: ["Sagitario", "Schütze", "Sagittarius"],
  CAPRICORN: ["Capricornio", "Steinbock", "Capricorn"], AQUARIUS: ["Acuario", "Wassermann", "Aquarius"], PISCES: ["Piscis", "Fische", "Pisces"],
  CONJUNCTION: ["conjunción", "Konjunktion", "conjunction"], OPPOSITION: ["oposición", "Opposition", "opposition"],
  SQUARE: ["cuadratura", "Quadrat", "square"], TRINE: ["trígono", "Trigon", "trine"], SEXTILE: ["sextil", "Sextil", "sextile"],
  QUINCUNX: ["quincuncio", "Quinkunx", "quincunx"],
  FIRE: ["Fuego", "Feuer", "Fire"], EARTH: ["Tierra", "Erde", "Earth"], AIR: ["Aire", "Luft", "Air"], WATER: ["Agua", "Wasser", "Water"],
  CARDINAL: ["Cardinal", "Kardinal", "Cardinal"], FIXED: ["Fija", "Fix", "Fixed"], MUTABLE: ["Mutable", "Veränderlich", "Mutable"],
  T_SQUARE: ["Cuadratura en T", "T-Quadrat", "T-square"], GRAND_TRINE: ["Gran trígono", "Großes Trigon", "Grand trine"],
  GRAND_CROSS: ["Gran cruz", "Großes Kreuz", "Grand cross"], YOD: ["Yod", "Yod", "Yod"],
  NEW: ["Nueva", "Neumond", "New"], CRESCENT: ["Creciente", "Sichel", "Crescent"], FIRST_QUARTER: ["Cuarto creciente", "Erstes Viertel", "First quarter"],
  GIBBOUS: ["Gibosa", "Zunehmend (gibbous)", "Gibbous"], FULL: ["Llena", "Vollmond", "Full"],
  DISSEMINATING: ["Diseminante", "Abnehmend (disseminierend)", "Disseminating"], LAST_QUARTER: ["Cuarto menguante", "Letztes Viertel", "Last quarter"],
  BALSAMIC: ["Balsámica", "Balsamisch", "Balsamic"],
};

const UI = {
  "ui.lang": ["Idioma", "Sprache", "Language"],
  eyebrow: ["Astrología psicológica · cálculo natal", "Psychologische Astrologie · Geburtshoroskop", "Psychological astrology · birth chart"],
  lede: [
    "Calcula la carta natal con Swiss Ephemeris directamente en este dispositivo: posiciones, casas Placidus, aspectos, estructura de la carta y sensibilidad a la hora. El cálculo no envía tus datos a ningún servidor.",
    "Berechnet das Geburtshoroskop mit Swiss Ephemeris direkt auf diesem Gerät: Positionen, Placidus-Häuser, Aspekte, Struktur des Horoskops und Empfindlichkeit gegenüber der Geburtszeit. Für die Berechnung werden keine Daten an einen Server gesendet.",
    "Calculates the birth chart with Swiss Ephemeris directly on this device: positions, Placidus houses, aspects, chart structure and sensitivity to the birth time. The calculation sends no data to any server.",
  ],
  "engine.loading": ["Cargando el motor de cálculo…", "Rechenmodul wird geladen …", "Loading the calculation engine…"],
  "engine.ok": ["{engine} · archivos sepl_18, semo_18, seas_18 cargados", "{engine} · Dateien sepl_18, semo_18, seas_18 geladen", "{engine} · files sepl_18, semo_18, seas_18 loaded"],
  "engine.fail": ["El motor no pudo cargarse en este navegador ({code}).", "Das Rechenmodul konnte in diesem Browser nicht geladen werden ({code}).", "The engine could not be loaded in this browser ({code})."],
  "hero.anim": ["Ver portada animada", "Animiertes Titelbild ansehen", "View animated cover"],
  "hero.still": ["Ver portada fija", "Standbild ansehen", "View still cover"],

  "h.data": ["Datos de nacimiento", "Geburtsdaten", "Birth data"],
  "f.fname": ["Nombre de pila", "Vorname", "First name"],
  "f.fname.hint": ["Opcional. Solo para el encabezado.", "Optional. Nur für die Überschrift.", "Optional. Only used in the heading."],
  "f.fname.ph": ["Ana", "Anna", "Anna"],
  "f.lang": ["Idioma del informe", "Sprache des Berichts", "Report language"],
  "f.lang.hint": ["Se registra en el contrato de datos.", "Wird im Datenvertrag vermerkt.", "Recorded in the data contract."],
  "f.gender": ["Tratamiento en el informe", "Grammatisches Geschlecht im Bericht", "Grammatical gender in the report"],
  "f.gender.hint": ["Opcional. Define las concordancias de género, por ejemplo «sola» o «solo».", "Optional. Bestimmt geschlechtsbezogene Formen, etwa „Künstlerin“ oder „Künstler“.", "Optional. Matters mostly for Spanish and German; English rarely needs it."],
  "gender.UNSPECIFIED": ["Sin indicar (formas sin género)", "Keine Angabe (neutrale Formulierungen)", "Not specified (gender-neutral wording)"],
  "gender.FEMININE": ["Femenino", "Weiblich", "Feminine"],
  "gender.MASCULINE": ["Masculino", "Männlich", "Masculine"],
  "gender.NEUTRAL": ["Neutro", "Neutral", "Neutral"],
  "f.date": ["Fecha", "Datum", "Date"],
  "f.date.hint": ["Calendario gregoriano, 1800–2399.", "Gregorianischer Kalender, 1800–2399.", "Gregorian calendar, 1800–2399."],
  "f.time": ["Hora local del acta", "Ortszeit laut Urkunde", "Local time on the certificate"],
  "f.prec": ["Precisión de la hora", "Genauigkeit der Uhrzeit", "Time accuracy"],
  "prec.EXACT": ["Exacta (±4 min)", "Genau (±4 Min.)", "Exact (±4 min)"],
  "prec.PM15": ["Aproximada ±15 min", "Ungefähr ±15 Min.", "Approximate ±15 min"],
  "prec.PM30": ["Aproximada ±30 min", "Ungefähr ±30 Min.", "Approximate ±30 min"],
  "prec.PM60": ["Aproximada ±60 min", "Ungefähr ±60 Min.", "Approximate ±60 min"],
  "prec.UNKNOWN": ["Desconocida", "Unbekannt", "Unknown"],
  "f.place": ["Lugar de nacimiento", "Geburtsort", "Place of birth"],
  "f.place.hint": [
    "Ciudad o pueblo de más de 1000 habitantes. Para distinguir homónimos: «Córdoba, Argentina».",
    "Stadt oder Ort mit mehr als 1000 Einwohnern. Bei gleichen Namen: „Córdoba, Argentinien“.",
    "City or town with more than 1,000 inhabitants. To tell namesakes apart: “Córdoba, Argentina”.",
  ],
  "f.place.ph": ["Buenos Aires", "Hamburg", "London"],
  "btn.search": ["Buscar", "Suchen", "Search"],
  "f.tz": ["Zona horaria (IANA)", "Zeitzone (IANA)", "Time zone (IANA)"],
  "f.tz.hint": ["Se completa con el lugar. Cambiala solo si sabés que corresponde otra.", "Wird mit dem Ort ausgefüllt. Ändere sie nur, wenn du weißt, dass eine andere gilt.", "Filled in from the place. Change it only if you know another one applies."],
  "f.useOffset": ["Cargar el desfase horario a mano", "UTC-Versatz manuell eingeben", "Enter the UTC offset manually"],
  "f.offset": ["Desfase respecto de UTC", "Versatz gegenüber UTC", "Offset from UTC"],
  "f.offset.hint": ["Ejemplo: -3, +1, -3:30. Reemplaza la base de zonas.", "Beispiel: -3, +1, -3:30. Ersetzt die Zeitzonendatenbank.", "Example: -3, +1, -3:30. Overrides the time zone database."],
  "f.useCoords": ["Cargar coordenadas a mano", "Koordinaten manuell eingeben", "Enter coordinates manually"],
  "ph.lat": ["Latitud, sur negativa: -34.6037", "Breite, Süd negativ: 53.5507", "Latitude, south negative: 51.5072"],
  "ph.lon": ["Longitud, oeste negativa: -58.3816", "Länge, West negativ: 9.9930", "Longitude, west negative: -0.1276"],
  "ph.placeLabel": ["Nombre del lugar (opcional)", "Name des Ortes (optional)", "Place name (optional)"],
  "btn.useCoords": ["Usar coordenadas", "Koordinaten verwenden", "Use coordinates"],
  "btn.calc": ["Calcular la carta", "Horoskop berechnen", "Calculate the chart"],
  "btn.example": ["Ver un ejemplo", "Beispiel ansehen", "See an example"],

  "place.none": [
    "Sin resultados. Probá con el nombre en inglés o en el idioma local, o agregá el país después de una coma (por ejemplo, «Córdoba, Argentina»). También podés cargar coordenadas a mano.",
    "Keine Treffer. Versuche den Namen auf Englisch oder in der Landessprache, oder füge das Land nach einem Komma hinzu (z. B. „Córdoba, Argentinien“). Du kannst auch Koordinaten manuell eingeben.",
    "No results. Try the name in English or in the local language, or add the country after a comma (for example “Córdoba, Argentina”). You can also enter coordinates manually.",
  ],
  "place.inhab": ["hab.", "Einw.", "inhab."],
  "place.loading": ["Cargando la lista de ciudades…", "Ortsliste wird geladen …", "Loading the list of places…"],
  "place.fail": ["No se pudo cargar la lista de ciudades. Usá coordenadas manuales.", "Die Ortsliste konnte nicht geladen werden. Gib die Koordinaten manuell ein.", "The list of places could not be loaded. Enter coordinates manually."],

  "err.date": ["Falta la fecha de nacimiento.", "Das Geburtsdatum fehlt.", "The date of birth is missing."],
  "err.range": ["Los archivos de efemérides cubren de 1800 a 2399.", "Die Ephemeridendateien decken 1800 bis 2399 ab.", "The ephemeris files cover 1800 to 2399."],
  "err.time": ["Falta la hora. Si no la conocés, elegí «Desconocida» en precisión.", "Die Uhrzeit fehlt. Wenn du sie nicht kennst, wähle bei der Genauigkeit „Unbekannt“.", "The time is missing. If you don't know it, choose “Unknown” under accuracy."],
  "err.place": ["Elegí el lugar de nacimiento de la lista o cargá coordenadas.", "Wähle den Geburtsort aus der Liste oder gib Koordinaten ein.", "Choose the place of birth from the list or enter coordinates."],
  "err.tz": ["La zona horaria «{zone}» no es válida.", "Die Zeitzone „{zone}“ ist ungültig.", "The time zone “{zone}” is not valid."],
  "err.offset": ["Desfase manual inválido. Usá un formato como -3, +1 o -3:30.", "Ungültiger Versatz. Verwende ein Format wie -3, +1 oder -3:30.", "Invalid offset. Use a format such as -3, +1 or -3:30."],
  "err.coords": [
    "Coordenadas inválidas. Latitud entre −90 y 90 (sur negativa), longitud entre −180 y 180 (oeste negativa).",
    "Ungültige Koordinaten. Breite zwischen −90 und 90 (Süd negativ), Länge zwischen −180 und 180 (West negativ).",
    "Invalid coordinates. Latitude between −90 and 90 (south negative), longitude between −180 and 180 (west negative).",
  ],
  "err.engine": ["El motor de cálculo no pudo cargarse en este navegador. Probá con una versión actual de Chrome, Firefox o Safari.", "Das Rechenmodul konnte in diesem Browser nicht geladen werden. Versuche eine aktuelle Version von Chrome, Firefox oder Safari.", "The calculation engine could not be loaded in this browser. Try a current version of Chrome, Firefox or Safari."],
  "err.calc": ["Error de cálculo: {code}. No se muestra ninguna carta.", "Rechenfehler: {code}. Es wird kein Horoskop angezeigt.", "Calculation error: {code}. No chart is shown."],

  "time.nonexistent": [
    "La hora {time} no existió en {zone} ese día: cae en un adelanto de reloj. Revisá la hora del acta o cargá el desfase a mano.",
    "Die Uhrzeit {time} gab es an diesem Tag in {zone} nicht: Die Uhr wurde vorgestellt. Prüfe die Uhrzeit in der Urkunde oder gib den Versatz manuell ein.",
    "The time {time} did not exist in {zone} on that day: clocks moved forward. Check the time on the certificate or enter the offset manually.",
  ],
  "time.ambig": [
    "<strong>Esa hora ocurrió dos veces</strong> ese día en {zone} (retraso de reloj). Elegí cuál corresponde:",
    "<strong>Diese Uhrzeit gab es an diesem Tag zweimal</strong> in {zone} (Uhr zurückgestellt). Wähle die zutreffende:",
    "<strong>That time occurred twice</strong> on that day in {zone} (clocks moved back). Choose the right one:",
  ],
  "time.first": ["Primera vez", "Erstes Mal", "First time"],
  "time.second": ["Segunda vez", "Zweites Mal", "Second time"],

  "w.AMBIGUOUS_LOCAL_TIME": ["Hora repetida por cambio de horario; se eligió {offset}.", "Durch Zeitumstellung doppelte Uhrzeit; gewählt wurde {offset}.", "Time repeated by a clock change; {offset} was chosen."],
  "w.PRE_1970_TZ": [
    "Antes de 1970 la base de zonas horarias puede no reflejar el horario oficial de {zone}. Desfase usado: {offset}. Si tenés otra fuente, cargalo a mano.",
    "Vor 1970 bildet die Zeitzonendatenbank die amtliche Zeit von {zone} nicht immer korrekt ab. Verwendeter Versatz: {offset}. Wenn du eine andere Quelle hast, gib ihn manuell ein.",
    "Before 1970 the time zone database may not reflect the official time of {zone}. Offset used: {offset}. If you have another source, enter it manually.",
  ],
  "w.MANUAL_OFFSET": ["Desfase cargado a mano: {offset}.", "Manuell eingegebener Versatz: {offset}.", "Offset entered manually: {offset}."],
  "w.MANUAL_COORDS": ["Coordenadas cargadas a mano.", "Koordinaten manuell eingegeben.", "Coordinates entered manually."],
  "w.PLACIDUS_FAILED": ["Placidus no está definido en esta latitud; las casas se calcularon con Porfirio.", "Placidus ist in dieser Breite nicht definiert; die Häuser wurden nach Porphyrius berechnet.", "Placidus is undefined at this latitude; houses were calculated with Porphyry."],
  "w.UNKNOWN_TIME": [
    "Hora desconocida: carta calculada a las 12:00 locales, sin casas, ángulos ni aspectos con ángulos.",
    "Unbekannte Uhrzeit: Horoskop für 12:00 Ortszeit berechnet, ohne Häuser, Achsen und Aspekte zu den Achsen.",
    "Unknown time: chart calculated for 12:00 local time, without houses, angles or aspects to angles.",
  ],
  "w.TIME_SENSITIVE": ["Con la precisión indicada, {n} dato(s) podrían cambiar (marcados con ◇).", "Bei der angegebenen Genauigkeit könnten sich {n} Angabe(n) ändern (mit ◇ markiert).", "With the stated accuracy, {n} item(s) could change (marked ◇)."],

  "r.eyebrow": ["Ficha técnica calculada", "Berechnete technische Übersicht", "Calculated technical sheet"],
  "r.title": ["Carta natal", "Geburtshoroskop", "Birth chart"],
  "r.titleNamed": ["Carta natal de {name}", "Geburtshoroskop von {name}", "Birth chart of {name}"],
  "r.unknownTime": ["hora desconocida", "Uhrzeit unbekannt", "time unknown"],
  "r.house": ["casa", "Haus", "house"],
  "r.noTime": ["sin hora", "ohne Uhrzeit", "no time"],
  "r.mark": ["Podría cambiar dentro de la precisión horaria", "Könnte sich innerhalb der Zeitgenauigkeit ändern", "Could change within the time accuracy"],
  "r.nearCusp": ["A menos de 2° de la cúspide siguiente", "Weniger als 2° vor der nächsten Häuserspitze", "Less than 2° from the next cusp"],
  "r.rx": ["Retrógrado", "Rückläufig", "Retrograde"],
  "r.st": ["est.", "stat.", "stat."],
  "r.stTitle": ["Estacionario", "Stationär", "Stationary"],
  "th.point": ["Punto", "Punkt", "Point"],
  "th.position": ["Posición", "Position", "Position"],
  "th.house": ["Casa", "Haus", "House"],
  "th.cusp": ["Cúspide", "Spitze", "Cusp"],
  "th.ruler": ["Regente", "Herrscher", "Ruler"],
  "th.aspect": ["Aspecto", "Aspekt", "Aspect"],
  "th.orb": ["Orbe", "Orbis", "Orb"],
  "trad": ["trad.", "trad.", "trad."],
  "asp.app": ["aplic.", "appl.", "appl."],
  "asp.sep": ["separ.", "sep.", "sep."],
  "h.aspects": ["Aspectos", "Aspekte", "Aspects"],
  "aspects.note": ["Política orbes_v1: cinco mayores y quincuncio. En negrita, orbe hasta 2°; atenuados, más de 5°.", "Richtlinie orbes_v1: fünf Hauptaspekte und Quinkunx. Fett: Orbis bis 2°; abgeschwächt: über 5°.", "Policy orbes_v1: five major aspects plus quincunx. Bold: orb up to 2°; faded: over 5°."],
  "h.houses": ["Casas", "Häuser", "Houses"],
  "houses.sys": ["Sistema", "System", "System"],
  "houses.note": ["Regencias modernas con co-regentes tradicionales.", "Moderne Herrscher mit traditionellen Mitherrschern.", "Modern rulers with traditional co-rulers."],
  "houses.placidus": ["Placidus", "Placidus", "Placidus"],
  "houses.porphyry": ["Porfirio (Placidus no definido en esta latitud)", "Porphyrius (Placidus in dieser Breite nicht definiert)", "Porphyry (Placidus undefined at this latitude)"],
  "h.structure": ["Estructura de la carta", "Struktur des Horoskops", "Chart structure"],
  "s.elements": ["Elementos", "Elemente", "Elements"],
  "s.modalities": ["Modalidades", "Qualitäten", "Modalities"],
  "s.hemispheres": ["Hemisferios", "Hemisphären", "Hemispheres"],
  "s.hemi": ["Arriba {u} · abajo {l} · este {e} · oeste {w}", "Oben {u} · unten {l} · Osten {e} · Westen {w}", "Upper {u} · lower {l} · east {e} · west {w}"],
  "s.hemi.note": ["Por casas, Sol a Plutón.", "Nach Häusern, Sonne bis Pluto.", "By house, Sun to Pluto."],
  "s.angular": ["Planetas angulares", "Planeten an den Achsen", "Angular planets"],
  "s.angular.note": ["Hasta 10° de un ángulo.", "Bis 10° von einer Achse.", "Within 10° of an angle."],
  "s.angleRulers": ["Regentes de los ángulos", "Herrscher der Achsen", "Rulers of the angles"],
  "s.angleRuler": ["{angle}: {ruler} en {sign}, casa {house}", "{angle}: {ruler} in {sign}, Haus {house}", "{angle}: {ruler} in {sign}, house {house}"],
  "s.configs": ["Configuraciones", "Konfigurationen", "Configurations"],
  "s.apex": ["ápice", "Spitze", "apex"],
  "s.base": ["base", "Basis", "base"],
  "s.stelliums": ["Stelliums", "Stellien", "Stelliums"],
  "s.stelliums.note": ["Tres o más cuerpos.", "Drei oder mehr Körper.", "Three or more bodies."],
  "s.unaspected": ["Sin aspectos", "Ohne Aspekte", "Unaspected"],
  "s.mutual": ["Recepciones mutuas", "Gegenseitige Rezeptionen", "Mutual receptions"],
  "s.mutual.note": ["Regencias modernas.", "Moderne Herrscher.", "Modern rulerships."],
  "s.finalDisp": ["Dispositor final", "Enddispositor", "Final dispositor"],
  "s.noFinalDisp": ["no hay uno único", "kein eindeutiger", "no single one"],
  "s.phase": ["Fase Sol–Luna", "Sonne-Mond-Phase", "Sun–Moon phase"],
  "h.sensitivity": ["Sensibilidad a la hora", "Empfindlichkeit gegenüber der Uhrzeit", "Sensitivity to the birth time"],
  "sens.changes": ["Ventana analizada: {w}. Estos datos cambian dentro de esa ventana:", "Geprüftes Zeitfenster: {w}. Diese Angaben ändern sich innerhalb dieses Fensters:", "Window checked: {w}. These items change within that window:"],
  "sens.none": ["Dentro de la ventana de {w} no cambia ningún signo, casa ni aspecto.", "Innerhalb von {w} ändert sich kein Zeichen, Haus oder Aspekt.", "Within {w}, no sign, house or aspect changes."],
  "sens.fullDay": ["el día completo", "der ganze Tag", "the whole day"],
  "sens.minutes": ["±{n} minutos", "±{n} Minuten", "±{n} minutes"],
  "sens.sign": ["signo", "Zeichen", "sign"],
  "sens.in": ["podría entrar en orbe", "könnte in den Orbis kommen", "could come into orb"],
  "sens.out": ["podría salir de orbe", "könnte aus dem Orbis fallen", "could fall out of orb"],
  "prov": [
    "{engine}. {flags} (tropical, geocéntrico, posiciones aparentes). Casas: {sys}. Nodo verdadero. Política de aspectos {pol}. Zona {zone} ({src}). Lugar: {place}. Motor {ver}.",
    "{engine}. {flags} (tropisch, geozentrisch, scheinbare Positionen). Häuser: {sys}. Wahrer Mondknoten. Aspektrichtlinie {pol}. Zone {zone} ({src}). Ort: {place}. Version {ver}.",
    "{engine}. {flags} (tropical, geocentric, apparent positions). Houses: {sys}. True node. Aspect policy {pol}. Zone {zone} ({src}). Place: {place}. Engine {ver}.",
  ],
  "prov.noHouses": ["no calculadas", "nicht berechnet", "not calculated"],
  "prov.manual": ["desfase manual", "manueller Versatz", "manual offset"],
  "prov.iana": ["base IANA del navegador", "IANA-Datenbank des Browsers", "browser IANA database"],
  "wheel.aria": ["Rueda de la carta natal", "Horoskopkreis", "Birth chart wheel"],

  "i.eyebrow": ["Informe psicológico", "Psychologischer Bericht", "Psychological report"],
  "i.h": ["Interpretación", "Deutung", "Interpretation"],
  "i.missing": [
    "<strong>El motor interpretativo no está conectado en esta versión.</strong> Redactar el informe requiere un modelo de lenguaje con la calidad que exige el protocolo de ASTROINFORME, y hoy no existe una forma gratuita de ejecutarlo para cualquier persona sin cuenta ni clave de pago. Esta página no genera textos automáticos de reemplazo.",
    "<strong>Das Deutungsmodul ist in dieser Version nicht verbunden.</strong> Für den Bericht braucht es ein Sprachmodell in der Qualität, die das ASTROINFORME-Protokoll verlangt, und dafür gibt es derzeit keinen kostenlosen Weg, der für alle ohne Konto oder bezahlten Schlüssel funktioniert. Diese Seite erzeugt keine automatischen Ersatztexte.",
    "<strong>The interpretation engine is not connected in this version.</strong> Writing the report needs a language model of the quality the ASTROINFORME protocol requires, and there is currently no free way to run one for anyone without an account or a paid key. This page does not generate substitute texts.",
  ],
  "i.missing2": ["Mientras tanto podés llevarte la carta calculada completa en formato de datos (JSON).", "Bis dahin kannst du das vollständige berechnete Horoskop als Daten (JSON) mitnehmen.", "Meanwhile you can take the complete calculated chart with you as data (JSON)."],
  "btn.copyJson": ["Copiar datos (JSON)", "Daten kopieren (JSON)", "Copy data (JSON)"],
  "i.conn": [
    "Motor interpretativo conectado. Para redactar el informe se envían la carta calculada, el nombre de pila si lo cargaste y el tratamiento elegido; nunca la fecha, la hora ni el lugar de nacimiento.",
    "Deutungsmodul verbunden. Für den Bericht werden das berechnete Horoskop, der Vorname (falls angegeben) und die gewählte Anrede gesendet, niemals Geburtsdatum, Uhrzeit oder Geburtsort.",
    "Interpretation engine connected. To write the report, the calculated chart, your first name if you entered one and the chosen grammatical gender are sent; never the date, time or place of birth.",
  ],
  "i.unavailable": [
    "Por ahora no quedan informes disponibles: ya se usó el cupo gratuito del día o del mes. La carta calculada sigue disponible.",
    "Derzeit sind keine Berichte verfügbar: Das kostenlose Tages- oder Monatskontingent ist aufgebraucht. Das berechnete Horoskop bleibt verfügbar.",
    "No reports are available right now: the free daily or monthly allowance has been used. The calculated chart is still available.",
  ],
  "f.code.opt": ["Código de acceso (opcional)", "Zugangscode (optional)", "Access code (optional)"],
  "f.code.hintOpt": ["Solo si te dieron uno: tiene su propio cupo de informes.", "Nur wenn du einen bekommen hast: Er hat ein eigenes Kontingent.", "Only if you were given one: it has its own allowance."],
  "f.code": ["Código de acceso", "Zugangscode", "Access code"],
  "f.code.hint": ["Te lo da quien administra ASTROINFORME. Cada código tiene un número limitado de informes.", "Du bekommst ihn von der Person, die ASTROINFORME betreut. Jeder Code erlaubt eine begrenzte Zahl von Berichten.", "Given to you by whoever runs ASTROINFORME. Each code allows a limited number of reports."],
  "btn.interp": ["Generar el informe", "Bericht erstellen", "Generate the report"],
  "btn.interpDemo": ["Generar el informe (simulación)", "Bericht erstellen (Simulation)", "Generate the report (simulation)"],
  "i.generating": ["Generando el informe. Puede tardar uno o dos minutos…", "Der Bericht wird erstellt. Das kann ein bis zwei Minuten dauern …", "Generating the report. This can take a minute or two…"],
  "i.demoWaiting": ["Simulando la espera del motor interpretativo…", "Wartezeit des Deutungsmoduls wird simuliert …", "Simulating the interpretation engine's wait…"],
  "i.fail": ["No se pudo generar el informe: {msg}. La carta calculada sigue disponible.", "Der Bericht konnte nicht erstellt werden: {msg}. Das berechnete Horoskop bleibt verfügbar.", "The report could not be generated: {msg}. The calculated chart is still available."],
  "i.badContract": ["la respuesta no cumple el contrato astroinforme.report/v1", "die Antwort entspricht nicht dem Vertrag astroinforme.report/v1", "the response does not follow the astroinforme.report/v1 contract"],
  "i.status": ["el servicio respondió {status}", "der Dienst antwortete mit {status}", "the service answered {status}"],
  "i.err.code_required": ["falta el código de acceso", "der Zugangscode fehlt", "the access code is missing"],
  "i.err.code_invalid": ["el código de acceso no es válido", "der Zugangscode ist ungültig", "the access code is not valid"],
  "i.err.quota_exhausted": ["este código ya usó todos sus informes", "dieser Code hat alle Berichte aufgebraucht", "this code has used all its reports"],
  "i.err.budget_exhausted": ["este mes ya se usó todo el cupo gratuito de informes; se renueva el primer día del mes próximo", "das kostenlose Kontingent dieses Monats ist aufgebraucht; es erneuert sich am ersten Tag des nächsten Monats", "this month's free allowance of reports has been used; it renews on the first day of next month"],
  "i.err.visitor_limit": ["ya se pidió un informe hoy desde esta conexión; podés pedir otro mañana", "von dieser Verbindung wurde heute schon ein Bericht angefordert; morgen kannst du einen weiteren anfordern", "a report was already requested from this connection today; you can request another tomorrow"],
  "i.err.daily_limit": ["hoy ya se generaron todos los informes disponibles; probá mañana", "heute wurden schon alle verfügbaren Berichte erstellt; versuche es morgen", "all of today's available reports have been generated; try tomorrow"],
  "i.err.bot_check": ["no se pudo completar la verificación anti-robots; recargá la página y probá de nuevo", "die Prüfung gegen automatisierte Zugriffe ist fehlgeschlagen; lade die Seite neu und versuche es erneut", "the anti-bot check failed; reload the page and try again"],
  "i.err.bot_pending": ["esperá a que termine la verificación anti-robots", "warte, bis die Prüfung gegen automatisierte Zugriffe abgeschlossen ist", "wait for the anti-bot check to finish"],
  "i.err.audit_failed": ["el informe no pasó la auditoría técnica y no se entrega", "der Bericht hat die technische Prüfung nicht bestanden und wird nicht ausgeliefert", "the report failed the technical audit and is not delivered"],
  "i.err.upstream": ["el modelo de lenguaje no respondió; probá de nuevo en unos minutos", "das Sprachmodell hat nicht geantwortet; versuche es in einigen Minuten erneut", "the language model did not respond; try again in a few minutes"],
  "i.err.not_configured": ["el servicio todavía no está configurado", "der Dienst ist noch nicht eingerichtet", "the service is not configured yet"],
  "i.err.forbidden_origin": ["el servicio no acepta pedidos desde esta página", "der Dienst nimmt keine Anfragen von dieser Seite an", "the service does not accept requests from this page"],
  "i.err.bad_request": ["los datos enviados no son válidos", "die gesendeten Daten sind ungültig", "the data sent is not valid"],
  "i.remaining": ["Informes restantes con este código: {n}.", "Verbleibende Berichte mit diesem Code: {n}.", "Reports left on this code: {n}."],
  "demo.note": [
    "<strong>Simulación.</strong> El texto que aparece fue redactado fuera de la app y se carga como si lo devolviera el motor interpretativo; la espera es simulada. La auditoría técnica sí es real: compara las referencias del informe con la carta calculada en esta página.",
    "<strong>Simulation.</strong> Der angezeigte Text wurde außerhalb der App verfasst und so geladen, als käme er vom Deutungsmodul; die Wartezeit ist simuliert. Die technische Prüfung ist echt: Sie vergleicht die Angaben des Berichts mit dem auf dieser Seite berechneten Horoskop.",
    "<strong>Simulation.</strong> The text shown was written outside the app and is loaded as if the interpretation engine had returned it; the wait is simulated. The technical audit is real: it compares the report's references with the chart calculated on this page.",
  ],
  "demo.which": ["Informe a cargar", "Zu ladender Bericht", "Report to load"],
  "i.contract": ["Ver el contrato de datos (astroinforme.chart/v1)", "Datenvertrag ansehen (astroinforme.chart/v1)", "View the data contract (astroinforme.chart/v1)"],
  "i.contract.aria": ["Datos calculados en JSON", "Berechnete Daten als JSON", "Calculated data as JSON"],
  "copied": ["Copiado", "Kopiert", "Copied"],
  "copyManual": ["Seleccionado: copialo manualmente", "Markiert: bitte manuell kopieren", "Selected: copy it manually"],

  "a.head": ["Auditoría técnica: {v} de {t} referencias coinciden con la carta calculada", "Technische Prüfung: {v} von {t} Angaben stimmen mit dem berechneten Horoskop überein", "Technical audit: {v} of {t} references match the calculated chart"],
  "a.headBad": ["; {n} no coinciden.", "; {n} stimmen nicht überein.", "; {n} do not match."],
  "a.foot": [
    "Las interpretaciones que dependen de estos datos deberían revisarse antes de entregar el informe. La auditoría compara solo las referencias que el informe declara.",
    "Deutungen, die auf diesen Angaben beruhen, sollten vor der Weitergabe des Berichts überprüft werden. Die Prüfung vergleicht nur die Angaben, die der Bericht ausweist.",
    "Interpretations that rely on these items should be reviewed before the report is handed over. The audit only compares the references the report declares.",
  ],
  "a.in": ["en", "in", "in"],
  "a.says": ["el informe dice {r}; la carta calculada da {c}", "der Bericht nennt {r}; das berechnete Horoskop ergibt {c}", "the report says {r}; the calculated chart gives {c}"],
  "a.missing": ["no figura en la carta calculada", "kommt im berechneten Horoskop nicht vor", "not present in the calculated chart"],
  "a.noHouses": ["hora desconocida: no hay casas", "Uhrzeit unbekannt: keine Häuser", "time unknown: no houses"],
  "a.noAngles": ["hora desconocida: no hay ángulos", "Uhrzeit unbekannt: keine Achsen", "time unknown: no angles"],
  "a.noAspect": ["no figura en la carta calculada con la política {pol}", "kommt im berechneten Horoskop mit der Richtlinie {pol} nicht vor", "not present in the calculated chart under policy {pol}"],
  "a.unreliable": ["dato marcado como sensible a la precisión horaria", "Angabe ist empfindlich gegenüber der Zeitgenauigkeit", "item is sensitive to the time accuracy"],

  "auto.h": ["Qué funciona por sí solo", "Was ohne weitere Dienste funktioniert", "What works on its own"],
  "auto.1": ["Cálculo de posiciones (Sol a Plutón, Quirón, Nodo verdadero) con Swiss Ephemeris 2.10.03", "Berechnung der Positionen (Sonne bis Pluto, Chiron, wahrer Mondknoten) mit Swiss Ephemeris 2.10.03", "Position calculation (Sun to Pluto, Chiron, true node) with Swiss Ephemeris 2.10.03"],
  "auto.2": ["Casas Placidus (Porfirio en latitudes polares), Ascendente y Medio Cielo", "Placidus-Häuser (Porphyrius in Polarbreiten), Aszendent und Medium Coeli", "Placidus houses (Porphyry at polar latitudes), Ascendant and Midheaven"],
  "auto.3": ["Aspectos, configuraciones, regencias, elementos, hemisferios", "Aspekte, Konfigurationen, Herrscher, Elemente, Hemisphären", "Aspects, configurations, rulerships, elements, hemispheres"],
  "auto.4": ["Zona horaria histórica, horas repetidas o inexistentes", "Historische Zeitzone, doppelte oder fehlende Uhrzeiten", "Historical time zone, repeated or non-existent times"],
  "auto.5": ["Búsqueda de ciudades (lista GeoNames incluida en la página)", "Ortssuche (GeoNames-Liste in der Seite enthalten)", "Place search (GeoNames list included in the page)"],
  "auto.6": ["Sensibilidad de la carta a la precisión de la hora", "Empfindlichkeit des Horoskops gegenüber der Zeitgenauigkeit", "Sensitivity of the chart to the time accuracy"],
  "auto.7": ["Auditoría técnica de informes", "Technische Prüfung von Berichten", "Technical audit of reports"],
  "auto.8": ["Redacción del informe psicológico", "Abfassung des psychologischen Berichts", "Writing of the psychological report"],
  "pill.ok": ["Autónomo", "Eigenständig", "Self-contained"],
  "pill.no": ["No conectado", "Nicht verbunden", "Not connected"],
  "pill.conn": ["Conectado", "Verbunden", "Connected"],

  "don.h": ["Aportes voluntarios", "Freiwillige Beiträge", "Voluntary contributions"],
  "don.text": [
    "ASTROINFORME es gratuito. Cada informe tiene un costo real de redacción, cercano a un dólar, que hoy cubre la autora. Si querés colaborar para que siga disponible, podés hacer un aporte.",
    "ASTROINFORME ist kostenlos. Jeder Bericht verursacht reale Kosten von etwa einem Dollar, die derzeit die Autorin trägt. Wenn du dazu beitragen möchtest, dass es verfügbar bleibt, kannst du etwas beisteuern.",
    "ASTROINFORME is free. Each report has a real writing cost of about one dollar, currently covered by the author. If you would like to help keep it available, you can contribute."],
  "don.note": [
    "El aporte es voluntario y no cambia el acceso: el informe es el mismo para quien aporta y para quien no. El pago se hace en Mercado Pago; esta página no recibe tus datos de pago.",
    "Der Beitrag ist freiwillig und ändert nichts am Zugang: Der Bericht ist für alle gleich. Die Zahlung erfolgt bei Mercado Pago; diese Seite erhält keine Zahlungsdaten.",
    "Contributions are voluntary and do not change access: the report is the same for everyone. Payment happens on Mercado Pago; this page receives no payment data."],
  "don.give": ["Aportar", "Beitragen", "Contribute"],
  "don.alias": ["También por transferencia al alias {alias}.", "Auch per Überweisung an den Alias {alias}.", "Also by bank transfer to the alias {alias}."],
  "footer.credit": ["Ilustraciones:", "Illustrationen:", "Illustrations:"],
  "footer.calc": [
    "Cálculo: Swiss Ephemeris de Astrodienst AG, versión WebAssembly @swisseph/browser (AGPL-3.0). Lugares: GeoNames (CC BY 4.0) vía all-the-cities. Zonas: tz-lookup (CC0) y la base IANA del navegador.",
    "Berechnung: Swiss Ephemeris von Astrodienst AG, WebAssembly-Version @swisseph/browser (AGPL-3.0). Orte: GeoNames (CC BY 4.0) über all-the-cities. Zonen: tz-lookup (CC0) und die IANA-Datenbank des Browsers.",
    "Calculation: Swiss Ephemeris by Astrodienst AG, WebAssembly build @swisseph/browser (AGPL-3.0). Places: GeoNames (CC BY 4.0) via all-the-cities. Zones: tz-lookup (CC0) and the browser's IANA database.",
  ],
  "footer.conv": ["Tropical, geocéntrico, posiciones aparentes, convención de Astro.com. Uso gratuito.", "Tropisch, geozentrisch, scheinbare Positionen, Konvention von Astro.com. Kostenlose Nutzung.", "Tropical, geocentric, apparent positions, Astro.com convention. Free to use."],
  "footer.privacy": ["Privacidad", "Datenschutz", "Privacy"],
  disclaimer: [
    "ASTROINFORME ofrece una lectura simbólica de la carta natal desde la astrología psicológica. No es un diagnóstico ni un consejo profesional, y no reemplaza la atención psicológica o médica.",
    "ASTROINFORME bietet eine symbolische Lesart des Geburtshoroskops aus Sicht der psychologischen Astrologie. Sie ist keine Diagnose und keine fachliche Beratung und ersetzt keine psychologische oder ärztliche Behandlung.",
    "ASTROINFORME offers a symbolic reading of the birth chart from the perspective of psychological astrology. It is not a diagnosis or professional advice, and it does not replace psychological or medical care.",
  ],
  "btn.print": ["Imprimir o guardar en PDF", "Drucken oder als PDF speichern", "Print or save as PDF"],
  "btn.download": ["Descargar (archivo HTML)", "Herunterladen (HTML-Datei)", "Download (HTML file)"],
  "save.h": ["Guardar", "Speichern", "Save"],
  "save.note": [
    "Se guardan la ficha técnica y, si ya lo generaste, el informe. En el celular, «Imprimir» suele estar en el menú Compartir.",
    "Gespeichert werden das technische Datenblatt und, falls schon erstellt, der Bericht. Auf dem Handy findest du „Drucken“ meist im Teilen-Menü.",
    "This saves the technical sheet and, if you have generated it, the report. On a phone, “Print” is usually in the Share menu.",
  ],
  "dl.generated": ["Generado con ASTROINFORME el {date}.", "Erstellt mit ASTROINFORME am {date}.", "Generated with ASTROINFORME on {date}."],
  "footer.code": ["Código fuente", "Quellcode", "Source code"],
};

// Textos alternativos de las ilustraciones (es: del registro del MVP; de/en: registro del MVP).
export const ALT = {
  hero_levitar: ["Pintura de Bárbara Gutiérrez: pequeñas figuras humanas suspendidas en distintas posturas sobre un fondo negro.", "Gemälde von Bárbara Gutiérrez: kleine menschliche Figuren schweben in verschiedenen Haltungen vor schwarzem Grund.", "Painting by Bárbara Gutiérrez: small human figures suspended in different poses against a black ground."],
  intro_embroidery: ["Animación: círculos bordados y dibujados sobre tela; figuras de mujeres aparecen y se desvanecen entre ellos.", "Animation: gestickte und gezeichnete Kreise auf Stoff; Frauenfiguren erscheinen und verblassen zwischen ihnen.", "Animation: embroidered and drawn circles on fabric; figures of women appear and fade among them."],
  analysis_neural: ["Obra sobre pared blanca: un cerebro dibujado del que parte una red de hilos negros con pequeñas flores de colores en los nodos.", "Arbeit auf weißer Wand: ein gezeichnetes Gehirn, von dem ein Netz schwarzer Fäden mit kleinen farbigen Blüten an den Knoten ausgeht.", "Work on a white wall: a drawn brain from which a network of black threads spreads, with small coloured flowers at the nodes."],
  verification_eyes: ["Animación: un rostro dibujado abre los ojos.", "Animation: ein gezeichnetes Gesicht öffnet die Augen.", "Animation: a drawn face opens its eyes."],
  report_reader: ["Animación en blanco y negro: una mujer lee un libro sobre fondo negro.", "Schwarz-weiße Animation: eine Frau liest ein Buch vor schwarzem Grund.", "Black-and-white animation: a woman reads a book against a black ground."],
  closure_serendipity: ["Pintura: una mujer de vestido blanco vuela con los brazos extendidos sobre un cielo celeste con nubes.", "Gemälde: eine Frau in weißem Kleid fliegt mit ausgebreiteten Armen durch einen hellblauen Himmel mit Wolken.", "Painting: a woman in a white dress flies with outstretched arms across a pale blue sky with clouds."],
  identity_biographies: ["Pintura cartográfica: dos rostros enlazados por un mapa rosado con recorridos, corazones y la inscripción «Y entremedio, la vida misma».", "Kartografisches Gemälde: zwei Gesichter, verbunden durch eine rosa Karte mit Wegen, Herzen und der Aufschrift „Y entremedio, la vida misma“.", "Cartographic painting: two faces linked by a pink map with routes, hearts and the inscription “Y entremedio, la vida misma”."],
  emotional_dream: ["Pintura: una mujer dormida con la cabeza apoyada; sobre ella, un grupo de pequeñas figuras de pie.", "Gemälde: eine schlafende Frau mit aufgelegtem Kopf; über ihr eine Gruppe kleiner stehender Figuren.", "Painting: a sleeping woman resting her head; above her, a group of small standing figures."],
  boundaries_wire: ["Pintura de tonos claros: pequeñas figuras de mujeres con vestidos, unidas por líneas que trazan recorridos.", "Gemälde in hellen Tönen: kleine Frauenfiguren in Kleidern, verbunden durch Linien, die Wege zeichnen.", "Pale-toned painting: small figures of women in dresses, joined by lines that trace routes."],
  texture_purple: ["Pintura de flores lilas de pétalos rayados sobre fondo amarillo.", "Gemälde mit fliederfarbenen, gestreiften Blüten auf gelbem Grund.", "Painting of lilac flowers with striped petals on a yellow ground."],
  brand_guardian: ["Papel calado verde agua con una figura masculina tendida con los brazos abiertos; abajo, la inscripción «el guardián del universo».", "Grünblauer Scherenschnitt mit einer liegenden männlichen Figur mit ausgebreiteten Armen; darunter die Aufschrift „el guardián del universo“.", "Teal cut-paper work with a male figure lying with outstretched arms; below, the inscription “el guardián del universo”."],
  relationships_venus: ["Animación: una estatua alada se transforma en una figura femenina de cabello dorado con alas.", "Animation: eine geflügelte Statue verwandelt sich in eine geflügelte Frauenfigur mit goldenem Haar.", "Animation: a winged statue turns into a winged female figure with golden hair."],
  emotional_swimmers: ["Animación: figuras de nadadoras en tonos rosados y naranjas, con una textura de manchas en movimiento.", "Animation: Schwimmerinnen in Rosa- und Orangetönen mit einer bewegten Fleckentextur.", "Animation: swimmers in pink and orange tones with a moving speckled texture."],
};

let current = "es";
const idx = () => LANGS.indexOf(current);

export function getLang() { return current; }
export function setLang(l) { current = LANGS.includes(l) ? l : "es"; return current; }

/** Texto de la interfaz con parámetros {nombre}. */
export function t(key, params = {}) {
  const row = UI[key];
  let s = row ? row[idx()] ?? row[0] : key;
  for (const [k, v] of Object.entries(params)) s = s.split("{" + k + "}").join(v);
  return s;
}
/** Término astrológico (planeta, signo, aspecto, elemento…). */
export function term(id) { const r = TERMS[id]; return r ? r[idx()] : id; }
export function alt(id) { const r = ALT[id]; return r ? r[idx()] : ""; }

/** Idioma inicial: #es/#de/#en en la dirección, preferencia guardada o idioma del navegador. */
export function initialLang() {
  const h = (location.hash || "").replace("#", "").toLowerCase();
  if (LANGS.includes(h)) return h;
  try { const s = localStorage.getItem("astroinforme.lang"); if (LANGS.includes(s)) return s; } catch (e) { }
  const n = (navigator.language || "es").slice(0, 2).toLowerCase();
  return LANGS.includes(n) ? n : "es";
}
export function rememberLang(l) { try { localStorage.setItem("astroinforme.lang", l); } catch (e) { } }

/** Aplica los textos a los elementos marcados en la página. */
export function applyStatic(root = document) {
  document.documentElement.lang = current;
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}
