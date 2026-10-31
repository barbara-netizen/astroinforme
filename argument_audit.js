// ASTROINFORME — auditoría argumental (DISEÑO, versión 0; todavía no conectada al servicio ni a la interfaz).
//
// Separada de la auditoría técnica: no pregunta si un dato coincide con la carta, sino si cada tesis central que el
// propio informe declara enumera más de un indicador válido, como pide el protocolo. No evalúa la verdad psicológica de
// la tesis ni la calidad de la redacción, y no produce puntajes: solo trazabilidad (tesis → indicadores → verificación).
// Contrato propuesto (campo opcional de astroinforme.report/v1, compatible hacia atrás): ver DISENO_AUDITORIA_ARGUMENTAL.md.

import { auditReport, refText } from "./audit.js";

export const ARGUMENT_AUDIT_VERSION = "0";

/**
 * report.theses = [{ id, claim, sections: [ids], central: bool, indicators: [referencias técnicas como en technical_references_used] }]
 * Devuelve { declared: bool, theses: [{ id, status, verified, failed, unchecked, missing_sections }], ok }.
 * status: "supported" (≥2 indicadores distintos verificados) | "single_indicator" (1) | "unsupported" (0).
 * ok: todas las tesis centrales están en "supported". Una tesis no central con un solo indicador no hace fallar.
 */
export function argumentAudit(report, payload) {
  const theses = Array.isArray(report && report.theses) ? report.theses : null;
  if (!theses || !theses.length) return { declared: false, theses: [], ok: null };
  const sectionIds = new Set((report.sections || []).map((s) => s && s.id));
  const out = theses.map((t, i) => {
    const indicators = Array.isArray(t && t.indicators) ? t.indicators : [];
    // indicadores repetidos cuentan una sola vez
    const unique = [...new Map(indicators.map((r) => [refText(r), r])).values()];
    const a = auditReport({ technical_references_used: unique, sections: [] }, payload);
    const failed = a.issues.map((x) => refText(x.ref));
    const verified = a.verified;
    return {
      id: (t && t.id) || `t${i + 1}`, central: !!(t && t.central),
      status: verified >= 2 ? "supported" : verified === 1 ? "single_indicator" : "unsupported",
      verified, failed, unchecked: a.unchecked.length,
      missing_sections: ((t && t.sections) || []).filter((s) => !sectionIds.has(s)),
    };
  });
  return { declared: true, theses: out, ok: out.every((t) => !t.central || t.status === "supported") };
}
