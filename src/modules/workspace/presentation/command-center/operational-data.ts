"use client";

import useSWR from "swr";
import type { OperationalSummary } from "@/lib/operational-flow/types";
import type { Agent, NeedsYouItem, RepositoryItem, StatusTone } from "./types";

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

function severityTone(severity: unknown): StatusTone {
  return severity === "critical" || severity === "high" ? "danger" : "approval";
}

/** Joins the evidence -> signal -> risk -> governance -> recommendation -> decision chain,
 *  mirroring the join logic the operational decision loop used before this redesign. */
function buildChainRows(data: OperationalSummary) {
  return (data.signals ?? []).map((signal) => {
    const evidence = data.evidence.find((item) => item.id === signal.evidence_item_id);
    const risk = data.risksIssues.find((item) => item.signal_id === signal.id);
    const governance = data.governanceEvents.find((item) => item.related_entity_id === risk?.id);
    const recommendation = data.recommendations.find((item) => item.governance_event_id === governance?.id);
    const recommendationDecisions = data.decisions.filter((item) => item.recommendation_id === recommendation?.id);
    const terminalDecision = recommendationDecisions.find((item) => ["accepted", "rejected", "modified"].includes(String(item.decision_status)));
    return { evidence, signal, risk, governance, recommendation, terminalDecision };
  });
}

export type DecisionStatus = "accepted" | "rejected" | "deferred";

/** Builds Needs You cards from real recommendations awaiting a decision. `onDecide` is called with
 *  the recommendation id and chosen status; the caller is responsible for posting it and refreshing. */
export function deriveNeedsYou(
  data: OperationalSummary | undefined,
  onDecide: (recommendationId: string, status: DecisionStatus, authorityRequired: string) => void
): NeedsYouItem[] {
  if (!data) return [];
  const rows = buildChainRows(data);
  return rows
    .filter((row) => row.recommendation && row.recommendation.status === "proposed" && !row.terminalDecision)
    .map((row) => {
      const recommendation = row.recommendation as AnyRecord;
      const recommendationId = String(recommendation.id);
      const tone = severityTone(row.signal.severity);
      const authorityRequired = String(row.governance?.authority_required ?? "an authorized reviewer");
      const authority = (recommendation.actor_authority ?? {}) as Record<string, { allowed?: boolean }>;
      const canDecide = Object.values(authority).some((a) => a?.allowed);
      const evidenceLines = [
        row.evidence ? `${String(row.evidence.source_reference ?? row.evidence.title ?? "Evidence")}` : null,
        row.signal ? String(row.signal.summary ?? "") : null,
      ].filter(Boolean) as string[];
      return {
        id: `rec-${recommendationId}`,
        title: String(recommendation.recommendation ?? "Review recommendation"),
        badge: { tone, label: tone === "danger" ? "Warning" : "Approval" },
        drawer: {
          title: String(recommendation.recommendation ?? "Review recommendation"),
          why: String(row.risk?.rationale ?? row.governance?.explanation ?? "This needs a human decision before it proceeds."),
          evidence: evidenceLines.length ? evidenceLines : ["No linked evidence yet"],
          nextStep: `Requires ${authorityRequired} to accept, reject, or defer.`,
          actions: canDecide
            ? [
                { label: "Accept", onClick: () => onDecide(recommendationId, "accepted", authorityRequired) },
                { label: "Reject", onClick: () => onDecide(recommendationId, "rejected", authorityRequired) },
                { label: "Defer", onClick: () => onDecide(recommendationId, "deferred", authorityRequired) },
              ]
            : [],
          note: canDecide ? undefined : `Requires an authorized decision-maker for: ${authorityRequired}.`,
        },
        recommendationId,
      } satisfies NeedsYouItem;
    });
}

/** Builds Needs You cards from RAID-derived recommended actions awaiting triage.
 *  One card per RAID item (the highest-confidence proposed action), so a single
 *  extracted risk doesn't flood the queue. `onDecide` receives the action id. */
export function deriveRaidNeedsYou(
  actions: RaidRecommendedAction[] | undefined,
  onDecide: (actionId: string, status: DecisionStatus) => void
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
    return {
      id: `raid-action-${action.id}`,
      title: action.title,
      badge: { tone, label: tone === "danger" ? "Warning" : "Suggested" },
      drawer: {
        title: action.title,
        why: action.description,
        evidence: evidenceLines.length ? evidenceLines : ["Extracted from the project's recorded notes."],
        nextStep: nextStepParts.length ? nextStepParts.join(" ") : "Accept, reject, or defer this suggested action.",
        actions: [
          { label: "Accept", onClick: () => onDecide(action.id, "accepted") },
          { label: "Reject", onClick: () => onDecide(action.id, "rejected") },
          { label: "Defer", onClick: () => onDecide(action.id, "deferred") },
        ],
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
