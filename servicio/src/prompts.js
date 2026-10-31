// Indicaciones de las fases del motor interpretativo. El protocolo interpretativo NO está acá:
// se guarda aparte (KV "protocol") y nunca se publica en el repositorio.

export const IDIOMA = { es: "español rioplatense, con voseo", de: "alemán, tuteando (du)", en: "inglés" };

// Tratamiento gramatical elegido por la persona (request.address_gender). Sin indicación: formas sin marca de género.
export const TRATAMIENTO = {
  FEMININE: "Cuando el idioma exija concordancia de género para referirse a la persona, usá el femenino.",
  MASCULINE: "Cuando el idioma exija concordancia de género para referirse a la persona, usá el masculino.",
  NEUTRAL: "La persona prefiere un tratamiento neutro: no uses marcas de género gramatical para referirte a ella. Elegí construcciones que no las requieran (por ejemplo, «tenés tendencia a…» en lugar de «sos propenso/propensa a…»). No uses «e», «x» ni «@» como desinencias.",
  UNSPECIFIED: "No sabés el género de la persona: no uses marcas de género gramatical para referirte a ella. Elegí construcciones que no las requieran (por ejemplo, «tenés tendencia a…» en lugar de «sos propenso/propensa a…»). No uses «e», «x» ni «@» como desinencias.",
};

export const PROMPT_ANALISIS = (carta) => `FASE A — ANÁLISIS ESTRUCTURAL (no es el informe).
Leé la carta calculada que sigue y devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma:
{
 "tension_organizadora": "una o dos oraciones",
 "temas": [{"tema": "…", "indicadores": ["referencias técnicas exactas tomadas del JSON"], "peso": "alto|medio|bajo"}],
 "contradicciones": ["…"],
 "datos_no_fiables": ["elementos marcados reliable:false o en sensitivity.unreliable que no deben sostener conclusiones"],
 "jerarquia_de_secciones": ["ids de sección en el orden que conviene"],
 "mito": {"nombre": "…", "por_que": "…"}
}
Usá exclusivamente los datos del JSON. Nada de memoria ni cálculos propios. Si la hora es desconocida, no uses casas ni ángulos.
Antes de elegir los temas, revisá chart.derived.configurations (cuadraturas en T, grandes cruces, yods, grandes trígonos) y
chart.derived.angular: toda configuración calculada y todo planeta a menos de 3° de un ángulo debe figurar en "temas" o, si decidís
no desarrollarlo, en una nota breve dentro de "contradicciones" que explique por qué pesa menos en esta carta.

CARTA CALCULADA (astroinforme.chart/v1):
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
 "sections": [{"id": "opening|identity|emotional|central_conflict|saturn|desire|relationships|roots|vocation|neptune|shadow|transformation|resources|synthesis|myth|dedication", "heading": "…", "body_markdown": "párrafos separados por una línea en blanco"}],
 "technical_references_used": [
   {"type": "position", "body": "SUN", "sign": "AQUARIUS", "deg": "9°29'", "house": 4},
   {"type": "angle", "angle": "ASC", "sign": "SCORPIO", "deg": "5°42'"},
   {"type": "aspect", "a": "SUN", "b": "SATURN", "aspect": "CONJUNCTION"}
 ]
}
Reglas para technical_references_used: incluí cada posición, ángulo y aspecto que el texto menciona, con los valores exactos del
JSON (deg = grados y minutos de "position"). Omití "house" si no la mencionás o si la casa figura como no fiable. No incluyas
aspectos que no estén en chart.aspects. Con hora desconocida no hay casas ni ángulos.
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
${problemas ? `La auditoría técnica comparó las referencias de tu informe con la carta calculada y encontró estos problemas:
${problemas}

Corregí esos pasajes para que digan lo que efectivamente figura en la carta calculada, o quitá la afirmación si el dato no
existe o no es fiable. Actualizá technical_references_used en consecuencia.
` : ""}${estilo ? `
El control de estilo encontró esto:
${estilo}
` : ""}
Cambiá solo los pasajes señalados y mantené el resto del texto. Devolvé SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
