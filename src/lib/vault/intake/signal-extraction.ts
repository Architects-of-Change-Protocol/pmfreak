import type { VaultDocumentClassification, VaultOperationalSignal, VaultOperationalSignalType } from "./types";

const MAX_SIGNAL_LENGTH = 360;

const SIGNAL_PATTERNS: Record<VaultOperationalSignalType, RegExp[]> = {
  risk: [/\batraso\b/i, /\bretraso\b/i, /\bblocked\b/i, /\bblocker\b/i, /\bdependency\b/i, /\bwaiting\b/i, /\bissue\b/i, /no entregar[áa]?/i, /\bslip(?:ping)?\b/i, /\bat risk\b/i],
  issue: [/\bfalla\b/i, /\bproblema\b/i, /\bissue\b/i, /\buncertainty\b/i, /\bincertidumbre\b/i, /\boutage\b/i, /\bdefect\b/i, /\berror\b/i, /\bincident\b/i],
  dependency: [/\bdepende\b/i, /\bdependency\b/i, /\brequires\b/i, /\brequiere\b/i, /\bdepends on\b/i, /\bwaiting for\b/i, /\bpending access\b/i],
  action: [/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+(?:hará|actualizará|enviará|coordinará|revisará|preparará)/u, /\b[A-Z][a-z]+\s+(?:will|to)\s+\w+/i, /\bAssigned to\s+[A-Z][a-z]+/i, /\bOwner:\s*[A-Z][a-z]+/i, /\b[A-Z][a-z]+\s+will\s+(?:review|update|coordinate|send|prepare)\b/i, /\bse acuerda\b/i, /\baction item\b/i, /\bdue\b/i, /\bowner\b/i],
  decision: [/se aprobó/i, /se aprobo/i, /se decidió/i, /se decidio/i, /\bapproved\b/i, /\bdecision\b/i, /\bdecided\b/i, /\bsign off\b/i],
};

const CLASSIFICATION_PATTERNS: Record<VaultDocumentClassification, RegExp[]> = {
  operational: [/\b(atraso|retraso|blocked|blocker|dependency|depende|issue|action|cronograma|schedule|instalaci[oó]n)\b/i],
  governance: [/\b(steering|governance|comit[eé]|aprob[oó]|decidi[oó]|approval|decision|escalation)\b/i],
  commercial: [/\b(invoice|payment|po|purchase order|budget|contrato|factura|pago|comercial)\b/i],
  technical: [/\b(firewall|api|technical|t[eé]cnico|defect|outage|integration|deployment|site access)\b/i],
  stakeholder: [/\b(sponsor|stakeholder|cliente|proveedor|vendor|Carlos|Juan|owner|responsable)\b/i],
  mixed: [],
};

export function normalizeVaultContent(rawContent: string): string {
  return rawContent.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitOperationalSentences(normalizedContent: string): string[] {
  return normalizedContent
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function classifyVaultDocument(normalizedContent: string): VaultDocumentClassification {
  const hits = (Object.entries(CLASSIFICATION_PATTERNS) as Array<[VaultDocumentClassification, RegExp[]]>)
    .filter(([classification, patterns]) => classification !== "mixed" && patterns.some((pattern) => pattern.test(normalizedContent)))
    .map(([classification]) => classification);
  if (hits.length > 1) return "mixed";
  return hits[0] ?? "operational";
}

export function extractVaultOperationalSignals(input: {
  documentId: string;
  workspaceId: string;
  projectId: string | null;
  normalizedContent: string;
  createdAt: string;
  idFactory: () => string;
}): VaultOperationalSignal[] {
  const signals: VaultOperationalSignal[] = [];
  const seen = new Set<string>();
  for (const sentence of splitOperationalSentences(input.normalizedContent)) {
    for (const signalType of Object.keys(SIGNAL_PATTERNS) as VaultOperationalSignalType[]) {
      const matched = SIGNAL_PATTERNS[signalType].some((pattern) => pattern.test(sentence));
      if (!matched) continue;
      const signalText = sentence.slice(0, MAX_SIGNAL_LENGTH);
      const key = `${signalType}:${signalText.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push({
        id: input.idFactory(),
        documentId: input.documentId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        signalType,
        signalText,
        confidenceScore: signalType === "action" || signalType === "decision" ? 0.82 : 0.76,
        createdAt: input.createdAt,
      });
    }
  }
  return signals;
}

export function calculateVaultConfidenceScore(signalCount: number, classification: VaultDocumentClassification, extractionFailed = false): number {
  if (extractionFailed) return 35;
  const base = classification === "mixed" ? 72 : 68;
  return Math.max(45, Math.min(94, base + signalCount * 4));
}
