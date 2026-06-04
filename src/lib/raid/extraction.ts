import type { VaultDocument, VaultOperationalSignal } from "@/lib/vault/intake/types";
import { splitOperationalSentences } from "@/lib/vault/intake/signal-extraction";
import type { ProjectRaidHealth, RaidCategory, RaidItem, RaidOverview, RaidSnapshot } from "./types";

const ASSUMPTION_PATTERNS = [
  /\bassuming\b/i,
  /\bassumption\b/i,
  /\bse asume\b/i,
  /\bassuming availability\b/i,
  /\bexpected\b/i,
  /\bexpected delivery\b/i,
  /\bplanned\b/i,
  /\bplaneado\b/i,
  /\bprevisto\b/i,
];

const EXTRACTION_STRENGTH: Record<RaidCategory, number> = {
  risk: 22,
  issue: 24,
  dependency: 21,
  assumption: 18,
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return dateOnly(date);
}

function nextOccurrence(referenceDate: Date, targetDay: number): string {
  const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  let delta = (targetDay - date.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return dateOnly(date);
}

function normalizeForFingerprint(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(el|la|los|las|the|a|an|de|del|al|to|for|and|y|on|in|until|hasta|se|is|are|will|shall|para)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalRaidFingerprint(category: RaidCategory, text: string): string {
  return `${category}:${normalizeForFingerprint(text)}`;
}

export function detectRaidOwner(text: string): string | null {
  const patterns = [
    /\bAssigned to\s+([A-ZÁÉÍÓÚÑ][\p{L}'-]+)/iu,
    /\bOwner:\s*([A-ZÁÉÍÓÚÑ][\p{L}'-]+)/iu,
    /\b([A-ZÁÉÍÓÚÑ][\p{L}'-]+)\s+(?:will\s+(?:review|update|coordinate|send|prepare)|to\s+\w+)/iu,
    /\b([A-ZÁÉÍÓÚÑ][\p{L}'-]+)\s+(?:actualizará|actualizara|revisará|revisara|coordinará|coordinara|enviará|enviara|preparará|preparara|hará|hara)/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function detectRaidDueDate(text: string, detectedAt: string): string | null {
  const referenceDate = new Date(detectedAt);
  if (Number.isNaN(referenceDate.getTime())) return null;

  const spanish = text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/iu);
  if (spanish?.[1] && spanish[2]) {
    const month = SPANISH_MONTHS[spanish[2].toLowerCase()];
    const day = Number(spanish[1]);
    const year = referenceDate.getUTCFullYear();
    let due = buildDate(year, month, day);
    if (due && due < dateOnly(referenceDate)) due = buildDate(year + 1, month, day);
    return due;
  }

  const english = text.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/iu);
  if (english?.[1] && english[2]) {
    const month = ENGLISH_MONTHS[english[1].toLowerCase()];
    const day = Number(english[2]);
    let due = buildDate(referenceDate.getUTCFullYear(), month, day);
    if (due && due < dateOnly(referenceDate)) due = buildDate(referenceDate.getUTCFullYear() + 1, month, day);
    return due;
  }

  if (/\bnext week\b|\bpr[oó]xima semana\b/i.test(text)) {
    const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
    date.setUTCDate(date.getUTCDate() + 7);
    return dateOnly(date);
  }

  const weekday = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado)\b/iu);
  if (weekday?.[1]) {
    const normalized = weekday[1].toLowerCase();
    return nextOccurrence(referenceDate, WEEKDAYS[normalized] ?? WEEKDAYS[normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "")]);
  }

  return null;
}

function categoryFromSignal(signalType: VaultOperationalSignal["signalType"]): RaidCategory | null {
  if (signalType === "risk" || signalType === "issue" || signalType === "dependency") return signalType;
  return null;
}

function cleanTitle(text: string): string {
  return text
    .replace(/^[-*\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96)
    .replace(/[.;:,\s]+$/, "");
}

function scoreRaidConfidence(input: { category: RaidCategory; text: string; sourceType: VaultDocument["sourceType"]; sourceSignal?: VaultOperationalSignal; occurrenceCount?: number }): number {
  const sourceTypeBoost = ["risk_log", "issue_log", "project_update"].includes(input.sourceType) ? 14 : input.sourceType === "meeting_notes" ? 10 : 7;
  const signalQuality = Math.round((input.sourceSignal?.confidenceScore ?? 0.68) * 38);
  const repetition = Math.min(12, Math.max(0, (input.occurrenceCount ?? 1) - 1) * 4);
  const lengthBoost = input.text.length >= 24 ? 8 : 3;
  return Math.max(0, Math.min(100, sourceTypeBoost + signalQuality + EXTRACTION_STRENGTH[input.category] + repetition + lengthBoost));
}

function toRaidItem(input: {
  document: VaultDocument;
  category: RaidCategory;
  text: string;
  id: string;
  sourceSignal?: VaultOperationalSignal;
}): RaidItem {
  const title = cleanTitle(input.text) || `${input.category} detected`;
  const owner = detectRaidOwner(input.text);
  const dueDate = detectRaidDueDate(input.text, input.document.createdAt);
  return {
    id: input.id,
    workspaceId: input.document.workspaceId,
    projectId: input.document.projectId,
    sourceDocumentId: input.document.id,
    sourceSignalId: input.sourceSignal?.id ?? null,
    category: input.category,
    title,
    description: input.text,
    status: "open",
    confidenceScore: scoreRaidConfidence({ category: input.category, text: input.text, sourceType: input.document.sourceType, sourceSignal: input.sourceSignal }),
    detectedAt: input.document.createdAt,
    lastDetectedAt: input.document.createdAt,
    detectedBy: input.document.createdBy,
    owner,
    dueDate,
    autoGenerated: true,
    fingerprint: canonicalRaidFingerprint(input.category, input.text),
    occurrenceCount: 1,
  };
}

export function extractRaidItems(input: { document: VaultDocument; signals: VaultOperationalSignal[]; idFactory: () => string }): RaidItem[] {
  const items: RaidItem[] = [];
  const seen = new Set<string>();

  for (const signal of input.signals) {
    const category = categoryFromSignal(signal.signalType);
    if (!category) continue;
    const fingerprint = canonicalRaidFingerprint(category, signal.signalText);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    items.push(toRaidItem({ document: input.document, category, text: signal.signalText, id: input.idFactory(), sourceSignal: signal }));
  }

  for (const sentence of splitOperationalSentences(input.document.normalizedContent)) {
    if (!ASSUMPTION_PATTERNS.some((pattern) => pattern.test(sentence))) continue;
    const fingerprint = canonicalRaidFingerprint("assumption", sentence);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    items.push(toRaidItem({ document: input.document, category: "assumption", text: sentence, id: input.idFactory() }));
  }

  return items;
}

export function calculateProjectRaidHealth(items: Array<Pick<RaidItem, "category" | "status" | "confidenceScore">>): ProjectRaidHealth {
  const openItems = items.filter((item) => item.status === "open" || item.status === "monitoring");
  const riskCount = openItems.filter((item) => item.category === "risk").length;
  const issueCount = openItems.filter((item) => item.category === "issue").length;
  const dependencyCount = openItems.filter((item) => item.category === "dependency").length;
  const assumptionCount = openItems.filter((item) => item.category === "assumption").length;
  const criticalRiskCount = openItems.filter((item) => item.category === "risk" && item.confidenceScore >= 80).length;
  const healthScore = Math.max(0, Math.min(100, 100 - riskCount * 8 - issueCount * 10 - dependencyCount * 5 - criticalRiskCount * 7));
  return { riskCount, issueCount, dependencyCount, assumptionCount, criticalRiskCount, healthScore };
}

export function buildRaidSnapshot(items: Array<Pick<RaidItem, "category" | "status">>): RaidSnapshot {
  const openItems = items.filter((item) => item.status === "open" || item.status === "monitoring");
  return {
    risks: openItems.filter((item) => item.category === "risk").length,
    issues: openItems.filter((item) => item.category === "issue").length,
    dependencies: openItems.filter((item) => item.category === "dependency").length,
    assumptions: openItems.filter((item) => item.category === "assumption").length,
  };
}

function titles(items: RaidItem[], category: RaidCategory): string[] {
  return items
    .filter((item) => item.category === category && (item.status === "open" || item.status === "monitoring"))
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3)
    .map((item) => item.title);
}

export function buildRaidOverview(items: RaidItem[]): RaidOverview {
  return {
    topRisks: titles(items, "risk"),
    topIssues: titles(items, "issue"),
    keyDependencies: titles(items, "dependency"),
    keyAssumptions: titles(items, "assumption"),
    health: calculateProjectRaidHealth(items),
    snapshot: buildRaidSnapshot(items),
  };
}
