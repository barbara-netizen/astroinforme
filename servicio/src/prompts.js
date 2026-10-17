// Indicaciones de las fases del motor interpretativo. El protocolo interpretativo NO está acá:
// se guarda aparte (KV "protocol") y nunca se publica en el repositorio.

export const IDIOMA = { es: "español rioplatense, con voseo", de: "alemán, tuteando (du)", en: "inglés" };

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

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

export const PROMPT_INFORME = ({ idioma, lang, nombre, analisis, carta }) => `FASE B — REDACCIÓN DEL INFORME.
Redactá el informe natal completo siguiendo el protocolo, en ${idioma}, en segunda persona, a partir del análisis estructural
y de la carta calculada. ${nombre}
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
 ]
}
Reglas para technical_references_used: incluí cada posición, ángulo y aspecto que el texto menciona, con los valores exactos del
JSON (deg = grados y minutos de "position"). Omití "house" si no la mencionás o si la casa figura como no fiable. No incluyas
aspectos que no estén en chart.aspects. Con hora desconocida no hay casas ni ángulos.

ANÁLISIS ESTRUCTURAL (fase A):
${analisis}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;

export const PROMPT_CORRECCION = ({ problemas, informe, carta }) => `FASE C — CORRECCIÓN TÉCNICA.
La auditoría automática comparó las referencias técnicas de tu informe con la carta calculada y encontró estos problemas:
${problemas}

Corregí el informe: cambiá solo los pasajes que dependen de esos datos, para que digan lo que efectivamente figura en la carta
calculada, o quitá la afirmación si el dato no existe o no es fiable. Mantené el resto del texto. Actualizá
technical_references_used en consecuencia. Devolvé SOLO el objeto JSON completo corregido (contrato astroinforme.report/v1).

INFORME A CORREGIR:
${informe}

CARTA CALCULADA (astroinforme.chart/v1):
${carta}`;
