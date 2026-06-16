import type {
  OperationalInterventionRecord,
  OperationalMemoryRecord,
  OperationalMemoryScope,
} from "./runtime-memory-types";
import { loadOperationalMemoryRecords, loadOperationalInterventionRecords } from "./runtime-memory-persistence";
import { assertScopeIsolation } from "./runtime-memory-scoping";

const MAX_AGE_DAYS_RESOLVED = 90;
const UNRESOLVED_PRESSURE_RATE = 0.03;

export type OperationalRetrievalInput = {
  scope: OperationalMemoryScope;
  limit?: number;
  unresolvedOnly?: boolean;
  includeInterventions?: boolean;
  now?: string;
};

export type OperationalRetrievalItem = {
  record: OperationalMemoryRecord;
  retrievalScore: number;
  retrievalBasis: string[];
  computedPressureWeight: number;
  agedays: number;
  interventionCount: number;
  failedInterventionCount: number;
};

export type OperationalRetrievalResult = {
  items: OperationalRetrievalItem[];
  unresolvedBlockers: string[];
  unresolvedRisks: string[];
  activeEscalations: string[];
  pendingCommitments: string[];
  diagnostics: {
    totalLoaded: number;
    suppressed: number;
    reasoningBasis: string[];
  };
};

function computeAgeDays(record: OperationalMemoryRecord, nowMs: number): number {
  return Math.max(0, (nowMs - Date.parse(record.firstObservedAt)) / 86400000);
}

export function computePressureWeight(record: OperationalMemoryRecord, ageDays: number): number {
  if (record.resolutionStatus === "resolved" || record.resolutionStatus === "abandoned") {
    return record.weights.unresolvedWeight * 0.1;
  }
  const pressureIncrease = Math.log1p(ageDays) * UNRESOLVED_PRESSURE_RATE;
  return Math.min(1.0, record.weights.unresolvedWeight + pressureIncrease);
}

const TYPE_BASE_SCORES: Record<string, number> = {
  blocker: 30,
  escalation: 28,
  risk: 26,
  governance_gap: 24,
  delivery_pressure: 22,
  dependency: 20,
  commitment: 18,
  timeline_signal: 16,
  stakeholder_signal: 14,
  decision: 12,
  recovery: 6,
};

function scoreRecord(
  record: OperationalMemoryRecord,
  ageDays: number,
  pressureWeight: number,
  scope: OperationalMemoryScope,
): { score: number; basis: string[] } {
  const basis: string[] = [];

  const base = TYPE_BASE_SCORES[record.recordType] ?? 10;
  basis.push(`type_base:${base}`);

  const statusMod =
    record.resolutionStatus === "escalated" ? 20 :
    record.resolutionStatus === "unresolved" ? 15 :
    record.resolutionStatus === "in_progress" ? 8 :
    -10;
  basis.push(`resolution_status:${statusMod}`);

  const recencyScore = Math.max(0, 20 - ageDays * 0.5);
  basis.push(`recency:${recencyScore.toFixed(1)}`);

  const pressureBonus = pressureWeight * 15;
  basis.push(`pressure_weight:${pressureBonus.toFixed(1)}`);

  const continuityBonus = record.weights.continuityWeight * 10;
  basis.push(`continuity_weight:${continuityBonus.toFixed(1)}`);

  const deliveryBonus = record.weights.deliveryImpactWeight * 8;
  basis.push(`delivery_impact:${deliveryBonus.toFixed(1)}`);

  const scopeBonus = record.scope.projectId === scope.projectId && scope.projectId !== null ? 5 : 0;
  if (scopeBonus) basis.push(`project_scope_match:${scopeBonus}`);

  const interventionPressure = Math.min(record.interventionCount * 2, 10);
  basis.push(`intervention_pressure:${interventionPressure}`);

  const score = base + statusMod + recencyScore + pressureBonus + continuityBonus + deliveryBonus + scopeBonus + interventionPressure;
  return { score: Math.max(0, Number(score.toFixed(2))), basis };
}

export async function retrieveOperationalContinuity(
  input: OperationalRetrievalInput,
): Promise<OperationalRetrievalResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 24, 48));
  const nowMs = Date.parse(input.now ?? new Date().toISOString());

  const records = await loadOperationalMemoryRecords(input.scope, {
    limit: limit * 3,
    unresolvedOnly: input.unresolvedOnly,
  });

  const scored: OperationalRetrievalItem[] = [];
  let suppressed = 0;

  for (const record of records) {
    try {
      assertScopeIsolation(record.scope, input.scope);
    } catch {
      suppressed++;
      continue;
    }

    const ageDays = computeAgeDays(record, nowMs);
    if (ageDays > MAX_AGE_DAYS_RESOLVED && record.resolutionStatus === "resolved") {
      suppressed++;
      continue;
    }

    const computedPressureWeight = computePressureWeight(record, ageDays);
    const { score, basis } = scoreRecord(record, ageDays, computedPressureWeight, input.scope);

    let interventionCount = record.interventionCount;
    let failedInterventionCount = 0;

    if (input.includeInterventions) {
      const interventions = await loadOperationalInterventionRecords(record.id, record.scope.companyId);
      interventionCount = interventions.length;
      failedInterventionCount = interventions.filter((i) => i.outcome === "failed").length;
    }

    scored.push({
      record,
      retrievalScore: score,
      retrievalBasis: basis,
      computedPressureWeight,
      agedays: ageDays,
      interventionCount,
      failedInterventionCount,
    });
  }

  scored.sort(
    (a, b) =>
      b.retrievalScore - a.retrievalScore ||
      Date.parse(b.record.lastObservedAt) - Date.parse(a.record.lastObservedAt),
  );

  const bounded = scored.slice(0, limit);

  return {
    items: bounded,
    unresolvedBlockers: bounded
      .filter((i) => i.record.recordType === "blocker" && i.record.resolutionStatus !== "resolved")
      .map((i) => i.record.summary)
      .slice(0, 5),
    unresolvedRisks: bounded
      .filter((i) => i.record.recordType === "risk" && i.record.resolutionStatus !== "resolved")
      .map((i) => i.record.summary)
      .slice(0, 5),
    activeEscalations: bounded
      .filter((i) => i.record.recordType === "escalation" && i.record.resolutionStatus !== "resolved")
      .map((i) => i.record.summary)
      .slice(0, 5),
    pendingCommitments: bounded
      .filter((i) => i.record.recordType === "commitment" && i.record.resolutionStatus === "unresolved")
      .map((i) => i.record.summary)
      .slice(0, 5),
    diagnostics: {
      totalLoaded: records.length,
      suppressed,
      reasoningBasis: [
        "Unresolved items accumulate pressure weight over time at 3% per day.",
        "Escalated records receive highest base priority (score +20).",
        "Scope isolation enforced per company/workspace/project.",
        `Loaded ${records.length} records, suppressed ${suppressed} cross-scope or stale items.`,
      ],
    },
  };
}

export async function retrieveOperationalPressure(
  scope: OperationalMemoryScope,
  limit = 12,
): Promise<OperationalRetrievalItem[]> {
  const result = await retrieveOperationalContinuity({ scope, limit: limit * 2, unresolvedOnly: true });
  return result.items
    .filter((i) => i.computedPressureWeight >= 0.6)
    .sort((a, b) => b.computedPressureWeight - a.computedPressureWeight)
    .slice(0, limit);
}

export async function retrieveInterventionLineage(
  scope: OperationalMemoryScope,
  memoryRecordId: string,
): Promise<{
  record: OperationalMemoryRecord | null;
  interventions: OperationalInterventionRecord[];
  unresolvedCount: number;
  failedCount: number;
}> {
  const records = await loadOperationalMemoryRecords(scope, { limit: 64 });
  const record = records.find((r) => r.id === memoryRecordId) ?? null;

  if (!record) return { record: null, interventions: [], unresolvedCount: 0, failedCount: 0 };

  const interventions = await loadOperationalInterventionRecords(memoryRecordId, scope.companyId);
  return {
    record,
    interventions,
    unresolvedCount: interventions.filter((i) => i.outcome === "pending").length,
    failedCount: interventions.filter((i) => i.outcome === "failed").length,
  };
}
