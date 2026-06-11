import type { DetectedSignal, SignalType } from "./types";

type Rule = {
  signalType: SignalType;
  terms: RegExp[];
  severity: DetectedSignal["severity"];
  confidence: number;
  summary: string;
};

const RULES: Rule[] = [
  { signalType: "scope_creep", terms: [/out(?:side| of) scope/i, /fuera de (?:alcance|scope)/i, /additional (?:work|activity|request)/i, /actividad adicional/i, /not in (?:the )?scope/i], severity: "high", confidence: 92, summary: "Work outside the agreed scope was requested." },
  { signalType: "missing_approval", terms: [/without (?:formal )?approval/i, /no (?:formal )?approval/i, /sin aprobaci[oó]n/i, /pending approval/i, /not approved/i], severity: "high", confidence: 95, summary: "Required approval is absent or unresolved." },
  { signalType: "schedule_risk", terms: [/delay(?:ed)?/i, /behind schedule/i, /fecha.*riesgo/i, /deadline.*(?:miss|risk)/i, /late delivery/i], severity: "high", confidence: 84, summary: "The evidence indicates schedule exposure." },
  { signalType: "cost_risk", terms: [/cost overrun/i, /over budget/i, /budget.*risk/i, /sobrecosto/i, /presupuesto.*riesgo/i], severity: "high", confidence: 86, summary: "The evidence indicates cost exposure." },
  { signalType: "quality_risk", terms: [/quality (?:issue|risk)/i, /defect/i, /rework/i, /calidad.*riesgo/i], severity: "medium", confidence: 80, summary: "The evidence indicates a quality concern." },
  { signalType: "stakeholder_blocker", terms: [/stakeholder.*block/i, /client.*block/i, /sponsor.*unavailable/i, /bloqueo.*(?:cliente|stakeholder)/i], severity: "high", confidence: 85, summary: "A stakeholder is blocking progress or alignment." },
  { signalType: "delivery_impediment", terms: [/blocked/i, /impediment/i, /cannot proceed/i, /no podemos avanzar/i, /bloquead[oa]/i], severity: "high", confidence: 88, summary: "Delivery cannot proceed normally." },
  { signalType: "billing_risk", terms: [/invoice.*(?:risk|dispute)/i, /billing.*(?:risk|dispute)/i, /facturaci[oó]n.*riesgo/i, /unbillable/i], severity: "high", confidence: 88, summary: "Billing or recoverability is at risk." },
  { signalType: "decision_needed", terms: [/decision (?:is )?needed/i, /requires? a decision/i, /se requiere decisi[oó]n/i, /decidir antes/i], severity: "medium", confidence: 82, summary: "A human decision is needed to proceed." },
  { signalType: "governance_gap", terms: [/no owner/i, /without owner/i, /sin responsable/i, /governance gap/i, /no process/i], severity: "medium", confidence: 78, summary: "A governance responsibility or control is missing." },
];

export const SIGNAL_DETECTOR_KEY = "system/deterministic:governance_signal_detector_v1";

export function detectOperationalSignals(input: { title: string; content: string }): DetectedSignal[] {
  const corpus = `${input.title}\n${input.content}`;
  return RULES.filter((rule) => rule.terms.some((term) => term.test(corpus))).map((rule) => ({
    signalType: rule.signalType,
    severity: rule.severity,
    confidenceScore: rule.confidence,
    summary: rule.summary,
    rationale: `Deterministic rule matched explicit language in the recorded evidence. Detector: ${SIGNAL_DETECTOR_KEY}.`,
  }));
}
