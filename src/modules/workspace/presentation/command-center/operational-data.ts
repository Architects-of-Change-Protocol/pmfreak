"use client";

import useSWR from "swr";
import type { OperationalSummary } from "@/lib/operational-flow/types";
import type { Agent, DetailRow, NeedsYouItem, RepositoryItem, StatusTone, ToneBadge } from "./types";
import { buildCanonicalAttention, selectPendingAttention, type CanonicalAttentionItem } from "./attention-read-model";
import {
  buildExecutionChains,
  isObservationEligibleEvidence,
  observationIdempotencyKey,
  type ExecutionOperation,
  type GovernedExecutionChain,
} from "./execution-read-model";

type AnyRecord = Record<string, unknown>;

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to load operational flow.");
  return payload as OperationalSummary;
};

export function useOperationalFlow(workspaceId: string, projectId: string) {
  const endpoint = `/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`;
  return useSWR<OperationalSummary>(endpoint, fetcher, { refreshInterval: 30000, revalidateOnFocus: true });
}

export async function postOperationalFlow(workspaceId: string, projectId: string, payload: AnyRecord) {
  const response = await fetch("/api/operational-flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, projectId, ...payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Operational flow action failed.");
  return result;
}

export async function captureAndDeriveDemoEvidence(workspaceId: string, projectId: string, input: {
  title: string; content: string; assertionType?: "INFERENCE" | "ASSUMPTION"; classification?: string;
  confidenceScore?: number; missingDataState?: "COMPLETE" | "PARTIAL" | "UNKNOWN";
}) {
  const requestId = crypto.randomUUID();
  const captured = await postOperationalFlow(workspaceId, projectId, {
    operation: "capture_input", sourceKey: "manual-demo:v1", idempotencyKey: `capture:${requestId}`,
    title: input.title, content: input.content, occurredAt: new Date().toISOString(), correlationId: requestId,
  });
  return postOperationalFlow(workspaceId, projectId, {
    operation: "derive_evidence", normalizedEventId: captured.normalizedEvent.id, idempotencyKey: `evidence:${requestId}`,
    assertionType: input.assertionType ?? "ASSUMPTION", classification: input.classification ?? "UNCLASSIFIED",
    confidenceScore: input.confidenceScore ?? 0.5, missingDataState: input.missingDataState ?? "UNKNOWN", evaluatedAt: new Date().toISOString(),
  });
}

export async function postVaultIntake(params: { workspaceId: string; projectId: string; rawContent: string }) {
  const response = await fetch("/api/vault/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, sourceType: "meeting_notes" }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Vault intake failed.");
  return result as {
    raidSnapshot: { risks: number; issues: number; dependencies: number; assumptions: number };
    raidItemsCreated: number;
    raidItemsUpdated: number;
    executiveSynthesisUpdated: boolean;
    recommendedActionsCreated?: number;
  };
}

/** A RAID-derived recommended action (governance_event_id is null for these — they are
 *  decided through /api/recommended-actions/decision, not the governed operational flow). */
export type RaidRecommendedAction = {
  id: string;
  raid_item_id: string | null;
  title: string;
  description: string;
  recommended_action_type: string;
  status: string;
  confidence_score: number;
  impact_level: string;
  recommended_owner: string | null;
  recommended_due_window: string | null;
  evidence_summary: Record<string, unknown> | null;
  created_at: string;
};

const raidActionsFetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to load recommended actions.");
  return (payload.recommendedActions ?? []) as RaidRecommendedAction[];
};

/** Proposed recommended actions materialized from RAID items extracted out of the
 *  project's real notes/documents — the triage queue for extracted intelligence. */
export function useRaidRecommendedActions(projectId: string) {
  const endpoint = `/api/recommended-actions?projectId=${encodeURIComponent(projectId)}&status=proposed`;
  return useSWR<RaidRecommendedAction[]>(projectId ? endpoint : null, raidActionsFetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });
}

export async function postRaidActionDecision(payload: {
  actionId: string;
  decision: DecisionStatus;
  reason?: string;
  deferredUntil?: string;
}) {
  const response = await fetch("/api/recommended-actions/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to record the decision.");
  return result;
}

/** RAID-derived suggested actions have their own bounded decision vocabulary, served by
 *  `/api/recommended-actions/decision`. `deferred` exists here and NOT on the governed path. */
export type DecisionStatus = "accepted" | "rejected" | "deferred";

function labelize(value: string | null): string | null {
  return value ? value.replaceAll("_", " ") : null;
}

function describeEvidenceQuality(quality: CanonicalAttentionItem["evidenceQuality"]): DetailRow[] {
  const rows: DetailRow[] = [];
  if (quality.evidenceConfidence !== null) {
    rows.push({ label: "Evidence confidence", value: `${Math.round(quality.evidenceConfidence * 100)}% (recorded at derivation)` });
  }
  if (quality.ruleMatchScore !== null) {
    // Explicitly not an "AI confidence": the detector is a deterministic rule engine.
    rows.push({ label: "Rule match score", value: `${quality.ruleMatchScore}% (deterministic rule, not a model score)` });
  }
  if (quality.missingDataState) rows.push({ label: "Missing data", value: String(labelize(quality.missingDataState)) });
  if (quality.freshnessState) rows.push({ label: "Freshness", value: String(labelize(quality.freshnessState)) });
  if (quality.lifecycle) rows.push({ label: "Evidence lifecycle", value: String(labelize(quality.lifecycle)) });
  if (quality.staleAt) rows.push({ label: "Stale after", value: quality.staleAt });
  if (quality.degradedReason) rows.push({ label: "Degraded reason", value: quality.degradedReason });
  if (quality.fixtureState) rows.push({ label: "Data state", value: quality.isFixture ? "DEMO / FIXTURE" : "Live" });
  if (rows.length === 0) rows.push({ label: "Evidence quality", value: "Not recorded for this evidence item." });
  return rows;
}

function describeProvenance(item: CanonicalAttentionItem): DetailRow[] {
  const p = item.provenance;
  const rows: DetailRow[] = [];
  if (p.sourceType) rows.push({ label: "Source type", value: String(labelize(p.sourceType)) });
  if (p.sourceReference) rows.push({ label: "Source reference", value: p.sourceReference });
  if (p.evidenceTitle) rows.push({ label: "Evidence", value: p.evidenceTitle });
  if (p.assertionType) rows.push({ label: "Assertion type", value: p.assertionType });
  if (p.classification) rows.push({ label: "Classification", value: String(labelize(p.classification)) });
  if (p.occurredAt) rows.push({ label: "Occurred at", value: p.occurredAt });
  if (p.recordedAt) rows.push({ label: "Recorded at", value: p.recordedAt });
  if (p.evaluatedAt) rows.push({ label: "Evaluated at", value: p.evaluatedAt });
  if (rows.length === 0) rows.push({ label: "Provenance", value: "No linked evidence provenance is recorded." });
  return rows;
}

function describeReferences(item: CanonicalAttentionItem): DetailRow[] {
  const rows: DetailRow[] = [{ label: "Recommendation ID", value: item.recommendationId }];
  if (item.governanceEventId) rows.push({ label: "Governance event ID", value: item.governanceEventId });
  if (item.riskIssueId) rows.push({ label: "Risk / Issue ID", value: item.riskIssueId });
  if (item.signalId) rows.push({ label: "Finding / Signal ID", value: item.signalId });
  for (const evidenceId of item.evidenceIds) rows.push({ label: "Evidence ID", value: evidenceId });
  if (item.provenance.normalizedEventId) rows.push({ label: "Normalized event ID", value: item.provenance.normalizedEventId });
  if (item.provenance.rawInputId) rows.push({ label: "Raw input ID", value: item.provenance.rawInputId });
  if (item.provenance.evidenceHashShort) rows.push({ label: "Evidence digest", value: `sha256 ${item.provenance.evidenceHashShort}` });
  return rows;
}

/**
 * Builds Needs You cards from canonical governed Recommendations awaiting a human Decision.
 *
 * `onDecide` receives the canonical Recommendation id, the canonical Decision status and the
 * PM's rationale, and must reject on failure so the drawer can keep the input and show the error.
 */
export function deriveNeedsYou(
  data: OperationalSummary | undefined,
  onDecide: (recommendationId: string, status: string, rationale: string) => Promise<void>
): NeedsYouItem[] {
  return selectPendingAttention(buildCanonicalAttention(data)).map((item) => toNeedsYouItem(item, onDecide));
}

/** Projects every governed Recommendation — pending and already decided — so an open drawer can
 *  reconcile against persisted state instead of showing a stale snapshot. */
export function deriveAllGovernedAttention(
  data: OperationalSummary | undefined,
  onDecide: (recommendationId: string, status: string, rationale: string) => Promise<void>
): NeedsYouItem[] {
  return buildCanonicalAttention(data).map((item) => toNeedsYouItem(item, onDecide));
}

/**
 * P2-12 — dispatch one governed continuation operation.
 *
 * Every branch calls an operation that existed before P2-12; none of them is a composite
 * command collapsing canonical transitions. Each rejects on failure so the calling panel
 * surfaces the real server error instead of reporting optimistic success.
 */
export async function runExecutionOperation(
  workspaceId: string,
  projectId: string,
  operation: ExecutionOperation
): Promise<void> {
  if (operation.kind === "material_action") {
    const now = new Date();
    await postOperationalFlow(workspaceId, projectId, {
      operation: "propose_material_action",
      decisionId: operation.decisionId,
      // Deterministic per Decision: retrying reconciles to the same Action instead of
      // creating a second one (P2-06 idempotency key).
      idempotencyKey: `p2-12:material-action:${operation.decisionId}`,
      // P2-06 derives `materiality` — and therefore the governance state — from these
      // four. They are the authorized human's classification of their own action; the
      // experience never assumes them.
      actionClass: operation.draft.actionClass,
      risk: operation.draft.risk,
      reversibility: operation.draft.reversibility,
      sideEffect: operation.draft.sideEffect,
      actionType: operation.draft.actionType,
      intendedEffect: operation.draft.intendedEffect,
      // Factual, not assumed: P2-06 persists an inert authorization (`canExecute` is
      // always false), and the action concerns the project this chain belongs to.
      intendedOperation: "propose_only",
      targetResourceType: "project",
      targetResourceId: projectId,
      // The recorded human Decision is the justification for acting.
      justification: operation.justification,
      createdAt: now.toISOString(),
      evaluationTime: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });
    return;
  }

  if (operation.kind === "task") {
    await postOperationalFlow(workspaceId, projectId, {
      operation: "dispatch_material_action_to_task",
      actionId: operation.actionId,
    });
    return;
  }

  if (operation.kind === "execution") {
    const response = await fetch("/api/execution-tasks/internal-execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: operation.taskId, command: operation.command }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(result.error ?? "Execution command failed."));
    // A denied transition returns 200 with a disposition, so it is checked explicitly
    // rather than inferred from the HTTP status alone.
    if (result.disposition === "denied" || result.disposition === "conflict") {
      throw new Error(String(result.reason ?? result.failureClass ?? "Execution command was not accepted."));
    }
    return;
  }

  if (operation.kind === "outcome") {
    await postOperationalFlow(workspaceId, projectId, {
      operation: "ensure_expected_outcome",
      taskId: operation.taskId,
      expectedResult: operation.expectedResult,
      successCriteria: [operation.expectedResult],
      // The chain's persisted correlation, carried forward from the Action (P2-08 copies
      // the Action's correlation onto the Execution). A fresh id here would detach the
      // Outcome from the very chain that produced it.
      correlationId: operation.correlationId,
    });
    return;
  }

  const now = new Date().toISOString();
  await postOperationalFlow(workspaceId, projectId, {
    operation: "record_outcome_observation",
    outcomeId: operation.outcomeId,
    observationState: operation.observationState,
    summary: operation.summary,
    evidenceReferenceIds: operation.evidenceReferenceIds,
    // Epistemic state is the observer's, never assumed to be certain.
    confidenceScore: operation.quality.confidenceScore,
    missingDataState: operation.quality.missingDataState,
    observedAt: now,
    evaluatedAt: now,
    correlationId: operation.correlationId,
    // Derived from the submission's content AND its attempt token, so a retry reconciles
    // to the same canonical Observation while a later genuine re-observation with
    // identical content is recorded as its own event.
    idempotencyKey: await observationIdempotencyKey({
      outcomeId: operation.outcomeId,
      observationState: operation.observationState,
      summary: operation.summary,
      evidenceReferenceIds: operation.evidenceReferenceIds,
      attemptNonce: operation.attemptNonce,
    }),
  });
}

/**
 * Canonical evidence a PM can cite when recording an Observation.
 *
 * Filtered to what P2-09 will actually accept: offering fixture or degraded evidence
 * would present a control the server always rejects with
 * `observation_evidence_scope_invalid`.
 */
export function deriveEvidenceOptions(data: OperationalSummary | undefined): Array<{ id: string; title: string }> {
  return (data?.evidence ?? [])
    .filter((row) => isObservationEligibleEvidence(row))
    .map((row) => ({
      id: String(row.id),
      title: String(row.title ?? row.id),
    }));
}

/**
 * P2-12 — governed chains that continue past a recorded Decision. Rejected Decisions are
 * included so the surface shows honestly that they stop here, rather than hiding them.
 */
export function deriveExecutionChains(data: OperationalSummary | undefined): GovernedExecutionChain[] {
  return buildExecutionChains(data);
}

function toNeedsYouItem(
  item: CanonicalAttentionItem,
  onDecide: (recommendationId: string, status: string, rationale: string) => Promise<void>
): NeedsYouItem {
  const decided = item.state === "decided";
  const badge: ToneBadge = decided
    ? { tone: "success", label: "Decision recorded" }
    : { tone: item.tone, label: "Governed · decision required" };

  const chain: DetailRow[] = [
    { label: "Evidence", value: item.provenance.evidenceTitle ?? item.provenance.sourceReference ?? "No linked evidence" },
    { label: "Finding", value: labelize(item.signalType) ?? "No detected signal" },
    { label: "Risk / Issue", value: labelize(item.riskIssueType) ?? "Not created" },
    { label: "Governance", value: labelize(item.governance.ruleKey) ?? "Pending" },
    { label: "Authority required", value: item.governance.authorityRequired },
    { label: "Recommendation", value: `${item.title} · ${labelize(item.recommendationStatus)}` },
    {
      label: "Decision",
      value: item.terminalDecision
        ? `${labelize(item.terminalDecision.decisionStatus)} · recorded`
        : "Not yet recorded — a human decision is required",
    },
  ];

  const evidenceLines = [
    item.provenance.sourceReference ?? item.provenance.evidenceTitle,
    item.evidenceQuality.evidenceMissing ? "No supporting evidence is linked to this recommendation." : null,
    item.evidenceQuality.isFixture ? "DEMO / FIXTURE evidence — not live project data." : null,
  ].filter(Boolean) as string[];

  const readOnlyNote = item.anyDecisionAllowed
    ? null
    : `You can review this item, but your role cannot record a Decision on it. This governance rule requires: ${item.governance.authorityRequired}.`;

  return {
    id: item.id,
    kind: "governed_recommendation",
    title: item.title,
    badge,
    recommendationId: item.recommendationId,
    drawer: {
      title: item.title,
      badge,
      kindSummary:
        "Governed Recommendation — system output produced by the evidence chain. It is a proposal, not a decision, and not an action.",
      why: item.why,
      evidence: evidenceLines.length ? evidenceLines : ["No linked evidence yet"],
      nextStep: decided
        ? "A Decision is already recorded. Any governed Action is a separate, later step."
        : `Requires ${item.governance.authorityRequired}. Recording a Decision does not create an Action, Task or Outcome.`,
      chain,
      sections: [
        { id: "provenance", title: "Provenance", rows: describeProvenance(item) },
        { id: "evidence-quality", title: "Evidence quality", rows: describeEvidenceQuality(item.evidenceQuality) },
        {
          id: "governance",
          title: "Governance",
          rows: [
            { label: "Rule", value: labelize(item.governance.ruleKey) ?? "Not recorded" },
            { label: "Status", value: labelize(item.governance.governanceStatus) ?? "Not recorded" },
            { label: "Authority required", value: item.governance.authorityRequired },
            { label: "Explanation", value: item.governance.explanation ?? "Not recorded" },
          ],
        },
        { id: "references", title: "Canonical references", rows: describeReferences(item) },
      ],
      decisionPanel: {
        kind: "governed_recommendation",
        subjectId: item.recommendationId,
        writePathLabel: "Records a canonical operational_decision_records entry with a frozen evidence snapshot.",
        controls: item.decisionOptions.map((option) => ({
          status: option.status,
          label: option.label,
          effect: option.effect,
          terminal: option.terminal,
          allowed: option.allowed,
          deniedExplanation: option.deniedExplanation,
        })),
        anyAllowed: item.anyDecisionAllowed,
        readOnlyNote,
        blockedReason: item.evidenceQuality.evidenceMissing
          ? "This Decision cannot be safely evaluated because the supporting evidence is missing."
          : null,
        requiresRationale: true,
        onDecide: (status, rationale) => onDecide(item.recommendationId, status, rationale),
        decisions: item.decisions.map((decision) => ({
          decisionId: decision.decisionId,
          decisionStatus: decision.decisionStatus,
          terminal: decision.terminal,
          rationale: decision.rationale,
          decidedBy: decision.decidedBy,
          recordedAt: decision.recordedAt,
          authorityBasis: decision.authorityBasis,
          evidenceSnapshot: decision.evidenceSnapshotHashShort
            ? `sha256 ${decision.evidenceSnapshotHashShort}${decision.evidenceSnapshotVersion ? ` · v${decision.evidenceSnapshotVersion}` : ""}`
            : null,
        })),
      },
    },
  } satisfies NeedsYouItem;
}

/** Builds Needs You cards from RAID-derived recommended actions awaiting triage.
 *  One card per RAID item (the highest-confidence proposed action), so a single
 *  extracted risk doesn't flood the queue. `onDecide` receives the action id. */
export function deriveRaidNeedsYou(
  actions: RaidRecommendedAction[] | undefined,
  onDecide: (actionId: string, status: DecisionStatus, reason: string) => Promise<void>
): NeedsYouItem[] {
  if (!actions || actions.length === 0) return [];
  const bestPerRaidItem = new Map<string, RaidRecommendedAction>();
  for (const action of actions) {
    if (action.status !== "proposed") continue;
    const key = action.raid_item_id ?? action.id;
    const current = bestPerRaidItem.get(key);
    if (!current || Number(action.confidence_score) > Number(current.confidence_score)) {
      bestPerRaidItem.set(key, action);
    }
  }
  return [...bestPerRaidItem.values()].map((action) => {
    const impact = String(action.impact_level);
    const tone: StatusTone = impact === "critical" || impact === "high" ? "danger" : "task";
    const summary = (action.evidence_summary ?? {}) as Record<string, unknown>;
    const raidTitle = typeof summary.raidTitle === "string" ? summary.raidTitle : null;
    const raidCategory = typeof summary.raidCategory === "string" ? summary.raidCategory : null;
    const evidenceLines = [
      raidTitle ? `Detected from your project notes: "${raidTitle}"` : null,
      raidCategory ? `RAID category: ${raidCategory}` : null,
    ].filter(Boolean) as string[];
    const nextStepParts = [
      action.recommended_owner ? `Suggested owner: ${action.recommended_owner}.` : null,
      action.recommended_due_window ? `Suggested timing: ${action.recommended_due_window}.` : null,
    ].filter(Boolean);
    // Deliberately different badge, kind summary and write-path language from the governed
    // chain above: this is extracted intelligence in a bounded workflow, not a governed
    // Recommendation, and deciding it does NOT write an operational_decision_records row.
    const badge: ToneBadge = { tone, label: "Suggestion · extracted intelligence" };
    return {
      id: `raid-action-${action.id}`,
      kind: "raid_suggestion",
      title: action.title,
      badge,
      drawer: {
        title: action.title,
        badge,
        kindSummary:
          "RAID-derived suggested action — extracted from your notes in a bounded workflow. It is not a governed Recommendation and carries no governance authority requirement.",
        why: action.description,
        evidence: evidenceLines.length ? evidenceLines : ["Extracted from the project's recorded notes."],
        nextStep: nextStepParts.length ? nextStepParts.join(" ") : "Triage this suggested action.",
        sections: [
          {
            id: "raid-detail",
            title: "Suggestion detail",
            rows: [
              { label: "Action type", value: String(labelize(action.recommended_action_type) ?? action.recommended_action_type) },
              { label: "Impact", value: impact },
              { label: "Extraction confidence", value: `${Math.round(Number(action.confidence_score) * 100)}%` },
              { label: "Suggested action ID", value: action.id },
              ...(action.raid_item_id ? [{ label: "RAID item ID", value: action.raid_item_id }] : []),
            ],
          },
        ],
        decisionPanel: {
          kind: "raid_suggestion",
          subjectId: action.id,
          writePathLabel:
            "Triage only — updates this suggested action through /api/recommended-actions/decision. No canonical operational Decision record is created.",
          controls: [
            { status: "accepted", label: "Accept", effect: "Marks this suggested action as accepted for triage.", terminal: true, allowed: true, deniedExplanation: null },
            { status: "rejected", label: "Reject", effect: "Dismisses this suggested action.", terminal: true, allowed: true, deniedExplanation: null },
            { status: "deferred", label: "Defer", effect: "Snoozes this suggested action for a week.", terminal: false, allowed: true, deniedExplanation: null },
          ],
          anyAllowed: true,
          readOnlyNote: null,
          blockedReason: null,
          requiresRationale: false,
          onDecide: (status, reason) => onDecide(action.id, status as DecisionStatus, reason),
          decisions: [],
        },
      },
    } satisfies NeedsYouItem;
  });
}

export function deriveRepository(data: OperationalSummary | undefined): RepositoryItem[] {
  const counts = { documents: 0, emails: 0, meetingNotes: 0, chats: 0, attachments: 0 };
  for (const item of data?.evidence ?? []) {
    const type = String(item.source_type ?? "");
    if (type === "document_reference") counts.documents += 1;
    else if (type === "email") counts.emails += 1;
    else if (type === "meeting_minutes") counts.meetingNotes += 1;
    else if (type === "conversation") counts.chats += 1;
    else if (type === "ticket") counts.attachments += 1;
  }
  return [
    { id: "documents", label: "Documents", icon: "document", count: counts.documents },
    { id: "emails", label: "Emails", icon: "mail", count: counts.emails },
    { id: "meeting-notes", label: "Meeting notes", icon: "notes", count: counts.meetingNotes },
    { id: "chats", label: "Chats", icon: "chat", count: counts.chats },
    { id: "attachments", label: "Attachments", icon: "attachment", count: counts.attachments },
    { id: "decisions", label: "Decisions", icon: "decision", count: data?.decisions.length ?? 0 },
    {
      id: "commitments",
      label: "Commitments",
      icon: "commitment",
      count: (data?.decisions ?? []).filter((d) => d.decision_status === "accepted").length,
    },
    { id: "evidence", label: "Evidence", icon: "evidence", count: data?.evidence.length ?? 0 },
  ];
}

/** Counts real signals of the given type(s) and reports the highest severity among them
 *  (undefined when none exist) — the deterministic basis for every specialist agent below. */
function signalSlice(data: OperationalSummary | undefined, types: string[]) {
  const matches = (data?.signals ?? []).filter((signal) => types.includes(String(signal.signal_type)));
  const severityRank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  let topSeverity: string | undefined;
  for (const signal of matches) {
    const severity = String(signal.severity ?? "");
    if (!topSeverity || (severityRank[severity] ?? -1) > (severityRank[topSeverity] ?? -1)) topSeverity = severity;
  }
  return { count: matches.length, topSeverity };
}

type SpecialistDef = {
  id: string;
  name: string;
  types: string[];
  busyLabel: string;
  clearLabel: string;
  why: string;
  nextStep: string;
};

/** The AI Specialist Team — one agent per PMFreak signal family, named to match the
 *  discipline a PM would delegate that concern to. Every count below comes straight from
 *  `data.signals`, grouped by the real `signal_type` PMFreak already detects from evidence —
 *  no invented personas or fixture data. */
const SPECIALISTS: SpecialistDef[] = [
  {
    id: "risk-agent",
    name: "Risk Agent",
    types: ["governance_gap"],
    busyLabel: "Watching for new risk signals...",
    clearLabel: "No open risk signals",
    why: "Watches for blockers and delivery risks as new evidence comes in.",
    nextStep: "Paste new notes to refresh what the Risk Agent is watching.",
  },
  {
    id: "schedule-agent",
    name: "Schedule Agent",
    types: ["schedule_risk", "delivery_impediment"],
    busyLabel: "Tracking schedule pressure...",
    clearLabel: "Schedule looks clear",
    why: "Watches for slipping dates and delivery impediments across the project.",
    nextStep: "Review the flagged schedule signals in Needs You.",
  },
  {
    id: "scope-agent",
    name: "Scope Agent",
    types: ["scope_creep"],
    busyLabel: "Watching for scope drift...",
    clearLabel: "Scope holding steady",
    why: "Flags scope creep as it shows up in notes, emails, and requests.",
    nextStep: "Confirm whether the flagged scope changes are approved.",
  },
  {
    id: "budget-agent",
    name: "Budget Agent",
    types: ["cost_risk", "billing_risk"],
    busyLabel: "Watching cost signals...",
    clearLabel: "No cost pressure detected",
    why: "Watches for cost and billing risk as it's mentioned in project evidence.",
    nextStep: "Review the flagged cost signals before they escalate.",
  },
  {
    id: "stakeholder-agent",
    name: "Stakeholder Agent",
    types: ["stakeholder_blocker"],
    busyLabel: "Watching stakeholder blockers...",
    clearLabel: "No stakeholder blockers",
    why: "Tracks stakeholders who are blocking or slowing down the project.",
    nextStep: "Reach out to the stakeholders flagged as blockers.",
  },
  {
    id: "quality-agent",
    name: "Quality Agent",
    types: ["quality_risk"],
    busyLabel: "Watching quality signals...",
    clearLabel: "No quality risk detected",
    why: "Watches for quality risk called out in reviews, tickets, and notes.",
    nextStep: "Review the flagged quality risk before it affects delivery.",
  },
  {
    id: "change-agent",
    name: "Change Agent",
    types: ["decision_needed", "missing_approval"],
    busyLabel: "Tracking pending decisions...",
    clearLabel: "No changes waiting on you",
    why: "Tracks decisions and approvals a change needs before it can proceed.",
    nextStep: "Decide the pending items waiting in Needs You.",
  },
];

export function deriveAgents(data: OperationalSummary | undefined, hasBrief: boolean): Agent[] {
  const assurance = data?.assurance;

  const specialistAgents: Agent[] = SPECIALISTS.map((spec) => {
    const { count, topSeverity } = signalSlice(data, spec.types);
    const tone = count === 0 ? "success" : topSeverity === "critical" || topSeverity === "high" ? "danger" : "task";
    return {
      id: spec.id,
      name: spec.name,
      statusText: count > 0 ? spec.busyLabel : spec.clearLabel,
      badge: { tone, label: count > 0 ? `${count} signal${count === 1 ? "" : "s"}` : "Clear" },
      activity: count === 0 ? "idle" : tone === "danger" ? "pulsing" : "progress",
      drawer: {
        title: spec.name,
        why: spec.why,
        evidence: [count > 0 ? `${count} ${spec.name.toLowerCase()} signal(s) detected right now` : "No matching signals recorded yet"],
        nextStep: count > 0 ? spec.nextStep : "Paste project notes to give this agent something to watch.",
      },
    };
  });

  // Dependency Agent: no dedicated signal type exists yet, so it's grounded in the same
  // evidence-chain-completeness data the assurance summary already tracks, rather than a
  // fabricated dependency count.
  const incompleteChains = assurance?.incompleteChainCount ?? 0;
  const dependencyAgent: Agent = {
    id: "dependency-agent",
    name: "Dependency Agent",
    statusText: incompleteChains > 0 ? "Checking incomplete evidence chains..." : "No broken dependencies",
    badge: { tone: incompleteChains > 0 ? "task" : "success", label: incompleteChains > 0 ? `${incompleteChains} incomplete` : "Clear" },
    activity: incompleteChains > 0 ? "progress" : "idle",
    drawer: {
      title: "Dependency Agent",
      why: "Watches for evidence chains that stall partway through — an early signal of a blocked dependency.",
      evidence: [incompleteChains > 0 ? `${incompleteChains} incomplete evidence chain(s)` : "Every evidence chain currently resolves cleanly"],
      nextStep: incompleteChains > 0 ? "Review the incomplete chains to see what's blocking them." : "Paste project notes to give this agent something to watch.",
    },
  };

  // Portfolio Agent: the executive rollup across everything above — the closest thing to a
  // single-project "portfolio health" read, grounded in the real governance brief and
  // assurance counters rather than any cross-project fixture data.
  const totalEvents = assurance?.totalGovernanceEvents ?? 0;
  const portfolioAgent: Agent = {
    id: "portfolio-agent",
    name: "Portfolio Agent",
    statusText: hasBrief ? "Executive brief ready" : "Waiting on evidence",
    badge: { tone: "task", label: hasBrief ? "1 brief" : "0 briefs" },
    activity: "idle",
    drawer: {
      title: "Portfolio Agent",
      why: "Rolls up this project's governance activity into a short, client-ready summary.",
      evidence: [
        hasBrief ? "Latest governance brief available" : "No governance brief generated yet",
        `${totalEvents} governance event(s) recorded`,
      ],
      nextStep: hasBrief ? "Review the draft brief before sharing it." : "Add project evidence to generate the first brief.",
    },
  };

  return [...specialistAgents, dependencyAgent, portfolioAgent];
}
