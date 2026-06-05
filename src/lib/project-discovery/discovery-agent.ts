export type DiscoveryEvidenceContent = {
  id: string;
  evidence_id: string;
  project_id: string;
  workspace_id: string;
  source_file_name: string;
  extracted_text: string;
  created_at?: string;
};

export type EvidenceSourceRef = {
  evidence_id: string;
  source_file_name: string;
  confidence: number;
};

export type StakeholderDiscoveryItem = {
  name: string;
  role: string;
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type DependencyDiscoveryItem = {
  dependency: string;
  type: "external" | "internal" | "approval" | "technical";
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type RiskDiscoveryItem = {
  risk: string;
  category: "execution" | "schedule" | "technical" | "governance" | "vendor";
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type MilestoneDiscoveryItem = {
  milestone: string;
  target_date: string | null;
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type DeliverableDiscoveryItem = {
  deliverable: string;
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type AssumptionDiscoveryItem = {
  assumption: string;
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type UnknownDiscoveryItem = {
  unknown: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  evidence_source: EvidenceSourceRef;
};

export type ProjectDiscoveryModel = {
  stakeholders: StakeholderDiscoveryItem[];
  dependencies: DependencyDiscoveryItem[];
  risks: RiskDiscoveryItem[];
  milestones: MilestoneDiscoveryItem[];
  deliverables: DeliverableDiscoveryItem[];
  assumptions: AssumptionDiscoveryItem[];
  unknowns: UnknownDiscoveryItem[];
  confidence_score: number;
  evidence_count: number;
};

type PatternFinding<T> = {
  pattern: RegExp;
  build: (match: RegExpMatchArray, evidence: DiscoveryEvidenceContent, source: EvidenceSourceRef) => T;
};

const ROLE_KEYWORDS = ["Project Sponsor", "Sponsor", "Project Manager", "PM", "Technical Owner", "Business Owner", "Security Team", "Networking Team", "Network Team", "Finance", "Operations", "MEP", "Vendor", "Customer", "Customer Team", "Steering Committee", "Implementation Team"];
const ORGANIZATION_KEYWORDS = ["Cisco", "Datasys", "Microsoft", "AWS", "Azure", "Google", "Oracle", "Salesforce", "ServiceNow"];

const clampConfidence = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const sentenceCase = (value: string) => {
  const normalized = normalizeWhitespace(value.replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, ""));
  if (!normalized) return "";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};
const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((line) => normalizeWhitespace(line)).filter((line) => line.length >= 8);
const dedupeBy = <T>(items: T[], keyFn: (item: T) => string) => {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item).toLowerCase();
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
};
const sourceFor = (evidence: DiscoveryEvidenceContent, confidence: number): EvidenceSourceRef => ({ evidence_id: evidence.evidence_id, source_file_name: evidence.source_file_name, confidence: clampConfidence(confidence) });
const firstEvidenceSource = (evidence: DiscoveryEvidenceContent[], confidence: number): EvidenceSourceRef => {
  const first = evidence[0];
  return { evidence_id: first?.evidence_id ?? "unknown", source_file_name: first?.source_file_name ?? "canonical evidence set", confidence: clampConfidence(confidence) };
};

const matchPatterns = <T>(evidenceRows: DiscoveryEvidenceContent[], patterns: PatternFinding<T>[]) => {
  const findings: T[] = [];
  for (const evidence of evidenceRows) {
    for (const sentence of splitSentences(evidence.extracted_text)) {
      for (const { pattern, build } of patterns) {
        for (const match of sentence.matchAll(pattern)) {
          const confidence = pattern.source.includes("must|required|blocked|risk|delay|approval") ? 78 : 68;
          findings.push(build(match, evidence, sourceFor(evidence, confidence)));
        }
      }
    }
  }
  return findings;
};

const detectStakeholders = (evidenceRows: DiscoveryEvidenceContent[]): StakeholderDiscoveryItem[] => {
  const findings: StakeholderDiscoveryItem[] = [];
  for (const evidence of evidenceRows) {
    const text = evidence.extracted_text;
    for (const role of ROLE_KEYWORDS) {
      const rolePattern = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (rolePattern.test(text)) findings.push({ name: role, role, confidence: 76, evidence_source: sourceFor(evidence, 76) });
    }
    for (const org of ORGANIZATION_KEYWORDS) {
      const orgPattern = new RegExp(`\\b${org}\\b`, "i");
      if (orgPattern.test(text)) findings.push({ name: org, role: "Organization or vendor", confidence: 82, evidence_source: sourceFor(evidence, 82) });
    }
    for (const sentence of splitSentences(text)) {
      const assignment = sentence.match(/(?:owner|owned by|assigned to|responsible party|contact)\s*:?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/);
      if (assignment?.[1]) findings.push({ name: sentenceCase(assignment[1]), role: "Named owner or contact", confidence: 72, evidence_source: sourceFor(evidence, 72) });
    }
  }
  return dedupeBy(findings, (item) => `${item.name}:${item.role}`).slice(0, 25);
};

function classifyDependency(value: string): DependencyDiscoveryItem["type"] {
  const lower = value.toLowerCase();
  if (/approval|sign[ -]?off|acceptance/.test(lower)) return "approval";
  if (/firewall|vpn|network|license|licensing|tenant|environment|configuration|access/.test(lower)) return "technical";
  if (/vendor|cisco|datasys|supplier|delivery/.test(lower)) return "external";
  return "internal";
}
const dependencyPatterns: PatternFinding<DependencyDiscoveryItem>[] = [
  { pattern: /(?:depends on|dependent on|dependency:?|requires|required from|blocked by)\s+([^.;]+)/gi, build: (m, _e, s) => ({ dependency: sentenceCase(m[1]), type: classifyDependency(m[1]), confidence: s.confidence, evidence_source: s }) },
  { pattern: /((?:customer|client|sponsor|security|finance|vendor)\s+approval[^.;]*)/gi, build: (m, _e, s) => ({ dependency: sentenceCase(m[1]), type: "approval", confidence: s.confidence, evidence_source: s }) },
  { pattern: /((?:firewall|vpn|network|license|licensing|access|environment|tenant)\s+(?:access|readiness|activation|setup|configuration|availability)[^.;]*)/gi, build: (m, _e, s) => ({ dependency: sentenceCase(m[1]), type: classifyDependency(m[1]), confidence: s.confidence, evidence_source: s }) },
];

function classifyRisk(value: string): RiskDiscoveryItem["category"] {
  const lower = value.toLowerCase();
  if (/date|schedule|timeline|delay|late|milestone/.test(lower)) return "schedule";
  if (/firewall|vpn|network|license|environment|technical|configuration|access/.test(lower)) return "technical";
  if (/approval|governance|sign[ -]?off|sponsor|steering/.test(lower)) return "governance";
  if (/vendor|cisco|datasys|supplier/.test(lower)) return "vendor";
  return "execution";
}
const riskPatterns: PatternFinding<RiskDiscoveryItem>[] = [
  { pattern: /(?:risk|concern|issue|blocker)\s*:?\s*([^.;]+)/gi, build: (m, _e, s) => ({ risk: sentenceCase(m[1]), category: classifyRisk(m[1]), confidence: s.confidence, evidence_source: s }) },
  { pattern: /((?:delay|delays|delayed|late|unavailable|incomplete|missing|blocked|constraint|constraints)[^.;]+)/gi, build: (m, _e, s) => ({ risk: sentenceCase(m[1]), category: classifyRisk(m[1]), confidence: s.confidence, evidence_source: s }) },
];

const milestonePatterns: PatternFinding<MilestoneDiscoveryItem>[] = [
  { pattern: /\b(kickoff|workshop|configuration complete|uat|user acceptance testing|go live|go-live|acceptance|deployment|training|handover)\b(?:\s*(?:on|by|target|target date|due)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}))?/gi, build: (m, _e, s) => ({ milestone: sentenceCase(m[1]), target_date: m[2] ? normalizeWhitespace(m[2]) : null, confidence: s.confidence, evidence_source: s }) },
  { pattern: /(?:milestone|phase)\s*:?\s*([^.;]+?)(?:\s+(?:on|by|due)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}))?(?=$|[.;])/gi, build: (m, _e, s) => ({ milestone: sentenceCase(m[1]), target_date: m[2] ? normalizeWhitespace(m[2]) : null, confidence: s.confidence, evidence_source: s }) },
];
const deliverablePatterns: PatternFinding<DeliverableDiscoveryItem>[] = [
  { pattern: /(?:deliverable|output|scope includes|will deliver|to deliver)\s*:?\s*([^.;]+)/gi, build: (m, _e, s) => ({ deliverable: sentenceCase(m[1]), confidence: s.confidence, evidence_source: s }) },
  { pattern: /\b((?:Cisco Umbrella Deployment|Training|Knowledge Transfer|Acceptance Report|deployment package|configuration workbook|runbook|handover document))\b/gi, build: (m, _e, s) => ({ deliverable: sentenceCase(m[1]), confidence: s.confidence, evidence_source: s }) },
];
const assumptionPatterns: PatternFinding<AssumptionDiscoveryItem>[] = [
  { pattern: /(?:assumption|assumes|assumed)\s*:?\s*([^.;]+)/gi, build: (m, _e, s) => ({ assumption: sentenceCase(m[1]), confidence: s.confidence, evidence_source: s }) },
  { pattern: /((?:customer|client|vendor|team)\s+will\s+(?:provide|attend|activate|approve|complete|share)[^.;]+)/gi, build: (m, _e, s) => ({ assumption: sentenceCase(m[1]), confidence: s.confidence, evidence_source: s }) },
];

const detectUnknowns = (evidenceRows: DiscoveryEvidenceContent[], partial: Omit<ProjectDiscoveryModel, "unknowns" | "confidence_score" | "evidence_count">): UnknownDiscoveryItem[] => {
  if (!evidenceRows.length) return [];
  const allText = evidenceRows.map((row) => row.extracted_text).join("\n").toLowerCase();
  const source = firstEvidenceSource(evidenceRows, 64);
  const unknowns: UnknownDiscoveryItem[] = [];
  if (partial.stakeholders.length === 0 || !/technical owner|technical lead|solution owner/.test(allText)) unknowns.push({ unknown: "Technical owner not identified", severity: "high", confidence: 70, evidence_source: source });
  if (!/acceptance criteria|acceptance report|sign[ -]?off criteria/.test(allText)) unknowns.push({ unknown: "Acceptance criteria missing", severity: "high", confidence: 72, evidence_source: source });
  if (partial.milestones.every((item) => !/go live|go-live/i.test(item.milestone))) unknowns.push({ unknown: "Go-live date undefined", severity: "medium", confidence: 68, evidence_source: source });
  if (!/support model|hypercare|operations handover|post[- ]go[- ]live support/.test(allText)) unknowns.push({ unknown: "Support model not specified", severity: "medium", confidence: 66, evidence_source: source });
  return unknowns;
};

const scoreDiscoveryConfidence = (model: Omit<ProjectDiscoveryModel, "confidence_score">) => {
  const evidenceVolume = Math.min(25, model.evidence_count * 8);
  const stakeholderClarity = Math.min(20, model.stakeholders.length * 5);
  const dependencyClarity = Math.min(20, model.dependencies.length * 5);
  const milestoneCoverage = Math.min(15, model.milestones.length * 4);
  const deliverableCoverage = Math.min(10, model.deliverables.length * 3);
  const consistency = model.unknowns.length <= 2 ? 10 : Math.max(0, 10 - model.unknowns.length * 2);
  const base = model.evidence_count > 0 ? 12 : 0;
  return clampConfidence(base + evidenceVolume + stakeholderClarity + dependencyClarity + milestoneCoverage + deliverableCoverage + consistency);
};

export const PROJECT_DISCOVERY_AGENT_SYSTEM_PROMPT = `You are a senior PMO analyst.

Your objective is not to summarize.

Your objective is to reconstruct project execution structure.

Identify:
* stakeholders
* dependencies
* risks
* milestones
* deliverables
* assumptions
* unknowns

Every finding must be tied to evidence.
Do not invent information.
If uncertain: mark confidence low.`;

export function generateProjectDiscovery(evidenceRows: DiscoveryEvidenceContent[]): ProjectDiscoveryModel {
  const orderedEvidence = [...evidenceRows].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const stakeholders = detectStakeholders(orderedEvidence);
  const dependencies = dedupeBy(matchPatterns(orderedEvidence, dependencyPatterns), (item) => item.dependency).slice(0, 30);
  const risks = dedupeBy(matchPatterns(orderedEvidence, riskPatterns), (item) => item.risk).slice(0, 30);
  const milestones = dedupeBy(matchPatterns(orderedEvidence, milestonePatterns), (item) => item.milestone).slice(0, 30);
  const deliverables = dedupeBy(matchPatterns(orderedEvidence, deliverablePatterns), (item) => item.deliverable).slice(0, 30);
  const assumptions = dedupeBy(matchPatterns(orderedEvidence, assumptionPatterns), (item) => item.assumption).slice(0, 30);
  const partial = { stakeholders, dependencies, risks, milestones, deliverables, assumptions };
  const unknowns = detectUnknowns(orderedEvidence, partial);
  const evidence_count = orderedEvidence.length;
  const scoreInput = { ...partial, unknowns, evidence_count };
  return { ...scoreInput, confidence_score: scoreDiscoveryConfidence(scoreInput) };
}
