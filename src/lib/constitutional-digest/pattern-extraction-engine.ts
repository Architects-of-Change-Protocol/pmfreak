// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Pattern Extraction Engine
// Identifies decision, risk, governance, and outcome patterns from memory text.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DecisionPattern,
  GovernancePattern,
  OutcomePattern,
  PatternExtractionResult,
  RiskPattern,
} from "./types";

// ─── Pattern keyword maps ─────────────────────────────────────────────────────

const DECISION_PATTERNS: Array<[RegExp, DecisionPattern]> = [
  [/\b(?:schedule|cronograma|plazo|fecha|deadline|delay|postpone|reschedul)\b/i, "schedule_change"],
  [/\b(?:scope|alcance|reduc|limit|cut|shrink|descart)\b/i, "scope_reduction"],
  [/\b(?:vendor|proveedor|supplier|replac|cambio\s+de\s+proveedor|switch)\b/i, "vendor_replacement"],
  [/\b(?:resource|recurso|reallocat|reassign|reasigna|personal|staff)\b/i, "resource_reallocation"],
  [/\b(?:budget|presupuesto|cost|costo|financ|fund|payment)\b/i, "budget_adjustment"],
  [/\b(?:priority|prioridad|urgent|critical|escalat)\b/i, "priority_change"],
  [/\b(?:approv|aprobaci[oó]n|sign.off|sign off|autoriza|autorizaci[oó]n)\b/i, "approval_required"],
];

const RISK_PATTERNS: Array<[RegExp, RiskPattern]> = [
  [/\b(?:third.party|tercero|vendor|proveedor|supplier|external|externo|depend)\b/i, "third_party_dependency"],
  [/\b(?:approval.delay|retraso|demora|pending|pendiente|stall|block)\b/i, "approval_delay"],
  [/\b(?:resource.shortage|falta\s+de|sin\s+recurso|understaf|underresourc|capacity)\b/i, "resource_shortage"],
  [/\b(?:technical.complex|complejidad|technical.debt|arquitectura|integr[ae]ci[oó]n)\b/i, "technical_complexity"],
  [/\b(?:regulat|compliance|cumplimiento|normativa|legal|audit[oí])\b/i, "regulatory_compliance"],
  [/\b(?:cost.overrun|sobrecosto|over.budget|exceder|exceso)\b/i, "budget_overrun"],
  [/\b(?:scope.creep|alcance|expand|adicional|agregado|adicion)\b/i, "scope_creep"],
];

const GOVERNANCE_PATTERNS: Array<[RegExp, GovernancePattern]> = [
  [/\b(?:authority.gap|no\s+tiene\s+autoridad|sin\s+autoridad|no\s+autorizado|authority)\b/i, "authority_gap"],
  [/\b(?:late.escalat|escalaci[oó]n\s+tard[íi]a|tardio|t[aá]rdo|escalat)\b/i, "late_escalation"],
  [/\b(?:decision.revers|reversi[oó]n|reverted|annul|anular|revertir|cambio\s+de\s+decisi[oó]n)\b/i, "decision_reversal"],
  [/\b(?:approv.bottleneck|cuello\s+de\s+botella|bottleneck|approval\s+delay|espera\s+de\s+aprobaci[oó]n)\b/i, "approval_bottleneck"],
  [/\b(?:delegat|delegaci[oó]n|conflict|no\s+claro)\b/i, "delegation_conflict"],
  [/\b(?:quorum|mayoria|falta\s+de\s+asistencia|no\s+se\s+reuni[oó])\b/i, "quorum_failure"],
];

const OUTCOME_PATTERNS: Array<[RegExp, OutcomePattern]> = [
  [/\b(?:successful|[eé]xito|completado|entregado|delivered\s+on.time|a\s+tiempo)\b/i, "successful_delivery"],
  [/\b(?:delay|retraso|atraso|late|atrasado|postponed|fuera\s+de\s+plazo)\b/i, "delivery_delay"],
  [/\b(?:cost.overrun|sobrecosto|over.budget|excedi[oó])\b/i, "cost_overrun"],
  [/\b(?:scope.reduc|alcance\s+reduc|scope\s+cut|redujeron)\b/i, "scope_reduction"],
  [/\b(?:cancel|cancelado|abortado|abandoned|suspendido)\b/i, "cancelled"],
  [/\b(?:partial|parcial|incomplete|incompleto)\b/i, "partial_delivery"],
];

// ─── Industry detection ────────────────────────────────────────────────────────

const INDUSTRY_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(?:banco|bank|financ|credit|banca)\b/i, "banking"],
  [/\b(?:salud|health|hospital|clinic|pharma)\b/i, "healthcare"],
  [/\b(?:seguro|insurance|aseguradora)\b/i, "insurance"],
  [/\b(?:teleco|carrier|operadora)\b/i, "telecom"],
  [/\b(?:energ[íi]a|electric|petrol|gas|utility)\b/i, "energy"],
  [/\b(?:gobierno|government|ministerio|agencia|public\s+sector)\b/i, "government"],
  [/\b(?:retail|tienda|comercio|ecommerce)\b/i, "retail"],
  [/\b(?:manufactur|f[áa]brica|industrial)\b/i, "manufacturing"],
  [/\b(?:tecnolog[íi]a|software|tech\s+company|startup)\b/i, "technology"],
  [/\b(?:consulting|consultor[íia]|advisory)\b/i, "consulting"],
];

// ─── Project type detection ────────────────────────────────────────────────────

const PROJECT_TYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(?:infrastructure|infraestructura|network|servidor|server|data.center)\b/i, "infrastructure"],
  [/\b(?:software|desarrollo|development|aplicaci[oó]n|platform|app)\b/i, "software_development"],
  [/\b(?:migration|migraci[oó]n|upgrade|actualizaci[oó]n)\b/i, "migration"],
  [/\b(?:implementation|implementaci[oó]n|deploy|despliegue|rollout)\b/i, "implementation"],
  [/\b(?:integration|integraci[oó]n|API|connector)\b/i, "integration"],
  [/\b(?:consulting|consultor[íia]|advisory|assessment)\b/i, "consulting"],
  [/\b(?:transformation|transformaci[oó]n|change\s+management|cambio)\b/i, "transformation"],
  [/\b(?:audit|auditor[íia]|compliance|review)\b/i, "audit_compliance"],
];

// ─── Extraction function ──────────────────────────────────────────────────────

function matchPatterns<T extends string>(
  text: string,
  map: Array<[RegExp, T]>,
): T[] {
  const found = new Set<T>();
  for (const [re, pattern] of map) {
    if (re.test(text)) found.add(pattern);
  }
  return [...found];
}

function detectFirst<T extends string>(
  text: string,
  map: Array<[RegExp, T]>,
): T | null {
  for (const [re, value] of map) {
    if (re.test(text)) return value;
  }
  return null;
}

export function extractPatterns(text: string): PatternExtractionResult {
  return {
    decisionPatterns: matchPatterns(text, DECISION_PATTERNS),
    riskPatterns: matchPatterns(text, RISK_PATTERNS),
    governancePatterns: matchPatterns(text, GOVERNANCE_PATTERNS),
    outcomePatterns: matchPatterns(text, OUTCOME_PATTERNS),
    industry: detectFirst(text, INDUSTRY_KEYWORDS),
    projectType: detectFirst(text, PROJECT_TYPE_KEYWORDS),
  };
}
