/**
 * Founder Circle Program — decision gate (docs/founder-program/12).
 *
 * The software summarizes evidence (participant/activation counts are
 * computed from real records at decision time); a HUMAN operator ratifies
 * the decision. Records are append-only — there is no update or delete path.
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { FOUNDER_ACCESS_STATES } from "@/lib/founder-program/lifecycle";

export const FOUNDER_PROGRAM_DECISIONS = ["continue", "continue_with_remediation", "pause", "stop", "expand_cohort"] as const;
export type FounderProgramDecision = (typeof FOUNDER_PROGRAM_DECISIONS)[number];

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

const cap = (value: unknown, max: number): string | null | undefined => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed || null : undefined;
};

const isoDate = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
};

export type RecordProgramDecisionResult =
  | { readonly ok: true; readonly decisionId: string }
  | { readonly ok: false; readonly field?: string; readonly code: "invalid_input" | "record_failed" };

export async function recordFounderProgramDecision(
  input: { operatorUserId: string; body: Record<string, unknown> },
  deps: { client?: SupabaseLike } = {},
): Promise<RecordProgramDecisionResult> {
  const b = input.body;
  const decision = typeof b.decision === "string" && (FOUNDER_PROGRAM_DECISIONS as readonly string[]).includes(b.decision)
    ? (b.decision as FounderProgramDecision)
    : null;
  if (!decision) return { ok: false, field: "decision", code: "invalid_input" };

  const decidedOn = isoDate(b.decidedOn);
  const windowStart = isoDate(b.evidenceWindowStart);
  const windowEnd = isoDate(b.evidenceWindowEnd);
  if (!decidedOn) return { ok: false, field: "decidedOn", code: "invalid_input" };
  if (!windowStart) return { ok: false, field: "evidenceWindowStart", code: "invalid_input" };
  if (!windowEnd || windowEnd < windowStart) return { ok: false, field: "evidenceWindowEnd", code: "invalid_input" };
  const nextReviewOn = b.nextReviewOn === undefined || b.nextReviewOn === null || b.nextReviewOn === "" ? null : isoDate(b.nextReviewOn);
  if (nextReviewOn === undefined) return { ok: false, field: "nextReviewOn", code: "invalid_input" };

  const rationale = cap(b.rationale, 8000);
  if (!rationale) return { ok: false, field: "rationale", code: "invalid_input" };

  const textFields: Record<string, unknown> = {};
  for (const [key, column, max] of [
    ["positiveSignals", "positive_signals", 4000],
    ["negativeSignals", "negative_signals", 4000],
    ["criticalDefects", "critical_defects", 4000],
    ["requestedCapabilities", "requested_capabilities", 4000],
    ["securityIncidents", "security_incidents", 4000],
    ["dataQualityLimitations", "data_quality_limitations", 4000],
    ["requiredRemediation", "required_remediation", 4000],
  ] as const) {
    const value = cap(b[key], max);
    if (value === undefined) return { ok: false, field: key, code: "invalid_input" };
    textFields[column] = value;
  }

  const client = deps.client ?? createFounderProgramDbClient({ operation: "record_program_decision", actorUserId: input.operatorUserId });

  // Evidence counts are computed from real records at ratification time —
  // the operator cannot type in a participant count that the data does not
  // support.
  const { data: participants } = await client.from("founder_participants").select("id, lifecycle_state, activated_at");
  const participantRows = participants ?? [];
  const participantCount = participantRows.length;
  const activationCount = participantRows.filter(
    (p) => p.activated_at || (FOUNDER_ACCESS_STATES as readonly string[]).includes(String(p.lifecycle_state)),
  ).length;
  const retentionEvidenceAvailable = participantRows.some(
    (p) => p.activated_at && Date.now() - new Date(String(p.activated_at)).getTime() >= 24 * 60 * 60 * 1000,
  );

  const { data: row, error } = await client
    .from("founder_program_decisions")
    .insert({
      decision,
      decided_on: decidedOn,
      decision_owner_user_id: input.operatorUserId,
      evidence_window_start: windowStart,
      evidence_window_end: windowEnd,
      participant_count: participantCount,
      activation_count: activationCount,
      retention_evidence_available: retentionEvidenceAvailable,
      rationale,
      next_review_on: nextReviewOn,
      ...textFields,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, code: "record_failed" };

  await recordFounderProgramEvent({
    eventName: "founder_program_decision_recorded",
    properties: { decision },
  });

  return { ok: true, decisionId: row.id };
}

export async function listFounderProgramDecisions(
  operatorUserId: string,
  deps: { client?: SupabaseLike } = {},
): Promise<readonly Record<string, unknown>[]> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "list_program_decisions", actorUserId: operatorUserId });
  const { data } = await client
    .from("founder_program_decisions")
    .select(
      "id, decision, decided_on, decision_owner_user_id, evidence_window_start, evidence_window_end, participant_count, activation_count, retention_evidence_available, positive_signals, negative_signals, critical_defects, requested_capabilities, security_incidents, data_quality_limitations, rationale, required_remediation, next_review_on, created_at",
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}
