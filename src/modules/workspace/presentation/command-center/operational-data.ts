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
  };
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

export function deriveAgents(data: OperationalSummary | undefined, hasBrief: boolean): Agent[] {
  const assurance = data?.assurance;
  const risks = assurance?.unresolvedRisksIssues ?? 0;
  const tasks = assurance?.openRecommendations ?? 0;
  const approvals = assurance?.decisionRequiredCount ?? 0;
  const sources = data?.evidence.length ?? 0;
  const violations = assurance?.violationsCount ?? 0;

  return [
    {
      id: "risk-sentinel",
      name: "Risk Sentinel",
      statusText: risks > 0 ? "Checking blockers..." : "No blockers detected",
      badge: { tone: risks > 0 ? "danger" : "success", label: risks > 0 ? `${risks} warnings` : "Clear" },
      activity: risks > 0 ? "pulsing" : "idle",
      drawer: {
        title: "Risk Sentinel",
        why: "Watches for blockers and delivery risks as new evidence comes in.",
        evidence: [`${risks} unresolved risk/issue signal(s) right now`],
        nextStep: "Paste new notes to refresh what Risk Sentinel is watching.",
      },
    },
    {
      id: "task-builder",
      name: "Task Builder",
      statusText: tasks > 0 ? "Preparing next steps..." : "No pending tasks",
      badge: { tone: "task", label: `${tasks} tasks` },
      activity: tasks > 0 ? "progress" : "idle",
      drawer: {
        title: "Task Builder",
        why: "Turns open recommendations into concrete next steps.",
        evidence: [`${tasks} open recommendation(s)`],
        nextStep: "Review pending recommendations in Needs You.",
      },
    },
    {
      id: "commitment-tracker",
      name: "Commitment Tracker",
      statusText: approvals > 0 ? "Watching open promises..." : "Nothing waiting",
      badge: { tone: approvals > 0 ? "approval" : "success", label: approvals > 0 ? `${approvals} approval` : "Clear" },
      activity: approvals > 0 ? "pulsing" : "idle",
      drawer: {
        title: "Commitment Tracker",
        why: "Keeps track of decisions and promises that still need a human call.",
        evidence: [`${approvals} decision(s) awaiting a reviewer`],
        nextStep: "Confirm which open items are still on track.",
      },
    },
    {
      id: "document-librarian",
      name: "Document Librarian",
      statusText: sources > 0 ? "Indexing project files..." : "No sources yet",
      badge: { tone: "info", label: `${sources} sources` },
      activity: sources > 0 ? "shimmer" : "idle",
      drawer: {
        title: "Document Librarian",
        why: "Keeps every document, email, and note organized and searchable.",
        evidence: [`${sources} evidence record(s) recorded`],
        nextStep: "Paste notes to add more to the project repository.",
      },
    },
    {
      id: "executive-briefing",
      name: "Executive Briefing",
      statusText: hasBrief ? "Draft ready" : "Waiting on evidence",
      badge: { tone: "task", label: hasBrief ? "1 task" : "0 tasks" },
      activity: hasBrief ? "idle" : "idle",
      drawer: {
        title: "Executive Briefing",
        why: "Prepares a short, client-ready summary of project status.",
        evidence: hasBrief ? ["Latest governance brief available"] : ["No governance brief generated yet"],
        nextStep: hasBrief ? "Review the draft brief before sharing it." : "Add project evidence to generate the first brief.",
      },
    },
    {
      id: "governance-guard",
      name: "Governance Guard",
      statusText: violations > 0 ? "Waiting for approval" : "No violations",
      badge: { tone: violations > 0 ? "approval" : "success", label: violations > 0 ? `${violations} approval` : "Clear" },
      activity: violations > 0 ? "pulsing" : "idle",
      drawer: {
        title: "Governance Guard",
        why: "Routes sensitive actions for human approval before anything is sent.",
        evidence: [`${violations} governance violation(s) flagged`],
        nextStep: "Approve or reject the pending action in Needs You.",
      },
    },
  ];
}
