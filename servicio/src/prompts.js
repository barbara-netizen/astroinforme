// Indicaciones de las fases del motor interpretativo. El protocolo interpretativo NO está acá:
// se guarda aparte (KV "protocol") y nunca se publica en el repositorio.

export const IDIOMA = { es: "español rioplatense, con voseo", de: "alemán, tuteando (du)", en: "inglés británico (ortografía británica: organise, colour)" };

// Tratamiento gramatical elegido por la persona (request.address_gender). Sin indicación: formas sin marca de género.
export const TRATAMIENTO = {
  FEMININE: "Cuando el idioma exija concordancia de género para referirse a la persona, usá el femenino.",
  MASCULINE: "Cuando el idioma exija concordancia de género para referirse a la persona, usá el masculino.",
  NEUTRAL: "La persona prefiere un tratamiento neutro: no uses marcas de género gramatical para referirte a ella. Elegí construcciones que no las requieran (por ejemplo, «tenés tendencia a…» en lugar de «sos propenso/propensa a…»). No uses «e», «x» ni «@» como desinencias.",
  UNSPECIFIED: "No sabés el género de la persona: no uses marcas de género gramatical para referirte a ella. Elegí construcciones que no las requieran (por ejemplo, «tenés tendencia a…» en lugar de «sos propenso/propensa a…»). No uses «e», «x» ni «@» como desinencias.",
};

export const PROMPT_ANALISIS = (carta, mitosRecientes = []) => `FASE A — ANÁLISIS ESTRUCTURAL (no es el informe).
Leé la carta calculada que sigue y devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma:
{
 "tension_organizadora": "una o dos oraciones",
 "temas": [{"tema": "…", "indicadores": ["referencias técnicas exactas tomadas del JSON"], "peso": "alto|medio|bajo"}],
 "contradicciones": ["…"],
 "datos_no_fiables": ["elementos marcados reliable:false o en sensitivity.unreliable que no deben sostener conclusiones"],
 "jerarquia_de_secciones": ["ids de sección en el orden que conviene"],
 "mito": {"nombre": "…", "por_que": "…", "repeticion": "vacío, salvo que el mito figure entre los usados recientemente (ver abajo)"},
 "pasadas": {"forma_general": "…", "planeta_por_planeta": "…", "diferencias": "…"},
 "forma_de_la_tension": "qué forma tiene (oposición, cadena, triángulo, desproporción, ausencia, ciclo, desfase u otra) y por qué",
 "tesis": [{"id": "t1", "afirmacion": "…", "central": true, "indicators": ["referencias técnicas declaradas como en technical_references_used"],
   "mecanismo": "cómo se vive en una situación concreta: qué se siente, qué se hace, qué se evita",
   "defensa": "qué hace la persona para no sentir el polo incómodo", "costo": "qué pierde o posterga con esa defensa",
   "recurso": "qué capacidad de la misma carta permite sostener la tensión", "especificidad": "qué combinación de esta carta la separa de la lectura de manual de cada posición",
   "lectura_alternativa": "…", "que_la_debilitaria": "…"}],
 "lecturas_descartadas": [{"lectura": "interpretación habitual que esta carta no sostiene", "motivo": "…"}],
 "preguntas_biograficas": ["lo que la carta no puede saber y el informe solo puede preguntar"],
 "mitos_considerados": [{"nombre": "…", "motivo": "…"}]
}
Antes de responder, hacé dos pasadas: forma general de la carta y revisión planeta por planeta. Escribí entre tres y cinco tesis. Toda tesis
central necesita al menos dos indicadores distintos. Una tesis relaciona factores entre sí: una posición aislada no es una tesis. Si no podés
completar "especificidad" sin repetir el significado de manual de una posición, la tesis es genérica: descartala y anotala en
"lecturas_descartadas". No asocies un símbolo con un hecho de la vida (padre, madre, infancia, pérdidas, enfermedad): eso va en
"preguntas_biograficas". El mito se elige después de las tesis y debe condensar la tesis central, no un planeta. Priorizá los aspectos más cerrados y usá chart.derived.structure si existe. Considerá tres
mitos y explicá por qué elegís uno.
Usá exclusivamente los datos del JSON. Nada de memoria ni cálculos propios. Si la hora es desconocida, no uses casas ni ángulos.
Con hora desconocida, la Luna está calculada a las 12:00 y pudo estar unos 6° antes o después: no la cuentes entre los aspectos más cerrados
ni bases una tesis en que un aspecto suyo sea exacto.
Antes de elegir los temas, revisá chart.derived.configurations (cuadraturas en T, grandes cruces, yods, grandes trígonos) y
chart.derived.angular: toda configuración calculada y todo planeta a menos de 3° de un ángulo debe figurar en "temas" o, si decidís
no desarrollarlo, en una nota breve dentro de "contradicciones" que explique por qué pesa menos en esta carta.

${mitosRecientes.length ? `Para el mito, la pertinencia tiene prioridad sobre la novedad. Mitos usados recientemente o en informes de referencia (es información, no una prohibición): ${mitosRecientes.join("; ")}. Si el mito que mejor condensa la tesis central es uno de ellos, o la misma figura con otro nombre (griego o romano), elegilo igual y completá "mito.repeticion" con una razón de esta carta: qué condensa que ninguno de los otros considerados condensa. No elijas un mito menos pertinente solo para no repetir.\n\n` : ""}CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

export const PROMPT_INFORME = ({ idioma, lang, nombre, tratamiento, analisis, carta }) => `FASE B — REDACCIÓN DEL INFORME.
Redactá el informe natal completo siguiendo el protocolo, en ${idioma}, en segunda persona, a partir del análisis estructural
y de la carta calculada. ${nombre}
${tratamiento}
Devolvé SOLO un objeto JSON válido, sin texto antes ni después, con esta forma (contrato astroinforme.report/v1):
{
 "schema": "astroinforme.report/v1",
 "language": "${lang}",
 "title": "…",
 "sections": [{"id": "opening|identity|emotional|central_conflict|saturn|desire|relationships|roots|vocation|neptune|shadow|transformation|resources|synthesis|myth", "heading": "…", "body_markdown": "párrafos separados por una línea en blanco"}],
 "technical_references_used": [
   {"type": "position", "body": "SUN", "sign": "AQUARIUS", "deg": "9°29'", "house": 4},
   {"type": "angle", "angle": "ASC", "sign": "SCORPIO", "deg": "5°42'"},
   {"type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "CONJUNCTION"}
 ],
 "theses": [{"id": "t1", "claim": "…", "sections": ["ids de sección"], "central": true, "indicators": [referencias con el mismo formato de technical_references_used]}]
}
Cada tesis central del análisis debe figurar en "theses" y desarrollarse en al menos una sección, con su mecanismo, defensa, costo y
recurso contados como experiencia concreta. Las lecturas descartadas no aparecen en el informe. Las preguntas biográficas se formulan
como preguntas o posibilidades, nunca como hechos.
Redacción:
- Jerga: en cada párrafo, primero la experiencia; el dato astrológico va después, una sola vez y solo si sostiene la idea. Apuntá a
  15 términos técnicos o menos cada mil palabras. No enumeres posiciones ni recorras cadenas de regencias en el texto.
- Cada sección agrega algo que las anteriores no dijeron. La síntesis integra sin resumir. Si una idea ya se dijo, no la repitas con otras palabras.
- Enumeraciones solo cuando cada elemento nombra algo distinto y propio de esta carta; nada de series de tres adjetivos o sustantivos abstractos.
- Sin muletillas ni modismos de texto genérico (por ejemplo: «no es casualidad», «en definitiva», «de alguna manera», «la clave está en»,
  «te invita a», «un delicado equilibrio», «no solo… sino también»). Sin metáforas de viaje, danza, tapiz, brújula o faro.
- Mecanismo, defensa, costo, recurso y lectura alternativa son herramientas del análisis, no una plantilla de sección: contalos
  solo donde cambian lo que la persona puede entender de sí, integrados en el relato. En todo el informe: como mucho tres
  preguntas y dos lecturas alternativas; no abras párrafos con «La defensa…» ni «El costo…».
- El dato técnico no va siempre al final del párrafo ni con la misma fórmula («…sostiene esta lectura», «…es su fuente»,
  «…condensa…»): variá su lugar o omitilo cuando la idea ya quedó fundada.
- Recuentos por elemento o modalidad («casi todo», «solo un», «predominio»): solo si coinciden con chart.derived.
- Mito: la versión de las fuentes clásicas, solo la escena necesaria. Si dudás de un detalle, omitilo; no agregues hechos ni motivos.
  Si "mito_descartado" figura en el análisis, usá el mito de "mito" y no menciones el descartado.
No incluyas dedicatoria ni ninguna sección dirigida a la persona después del corolario mitológico.
Reglas para technical_references_used: incluí cada posición, ángulo y aspecto que el texto menciona, con los valores exactos del
JSON (deg = grados y minutos de "position"). Omití "house" si no la mencionás o si la casa figura como no fiable. No incluyas
aspectos que no estén en chart.aspects. Con hora desconocida no hay casas ni ángulos.
Con hora desconocida, no escribas que un aspecto de la Luna es cerrado, exacto o firme: su orbe vale solo como referencia de las 12:00.
Si el texto se apoya en una configuración, una regencia, un stellium o un recuento por elemento o modalidad, declaralo también,
copiando los valores de chart.derived (no los deduzcas):
   {"type": "configuration", "configuration": "T_SQUARE", "apex": "MARS", "opposition": ["SUN", "MOON"]}  (GRAND_TRINE y GRAND_CROSS: "bodies"; YOD: "apex" y "base")
   {"type": "rulership", "of": "ASC", "ruler": "SATURN"}  ("of": ASC, DSC, MC, IC, un número de casa o un planeta, según angle_rulers, house_rulers o dispositors)
   {"type": "stellium", "by": "SIGN", "where": "PISCES", "bodies": ["SUN", "VENUS", "NEPTUNE"]}  ("by": SIGN o HOUSE, según stelliums)
   {"type": "distribution", "group": "ELEMENT", "key": "WATER", "count": 4}  ("group": ELEMENT o MODALITY, según elements o modalities)

ANÁLISIS ESTRUCTURAL (fase A):
${analisis}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

export const PROMPT_CORRECCION = ({ problemas, estilo, informe, carta }) => `FASE C — CORRECCIÓN.
${problemas ? `La auditoría comparó las referencias de tu informe con la carta calculada y encontró estos problemas:
${problemas}

Corregí esos pasajes para que digan lo que efectivamente figura en la carta calculada, o quitá la afirmación si el dato no
existe o no es fiable. Actualizá technical_references_used y theses en consecuencia.
` : ""}${estilo ? `
El control de estilo encontró esto:
${estilo}
` : ""}
Cambiá solo los pasajes señalados y mantené el resto del texto. Devolvé SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
