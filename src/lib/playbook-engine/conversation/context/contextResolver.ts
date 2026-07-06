import { generatePlaybookGovernanceSnapshot } from "../../governance-snapshot-engine";
import type { ProjectContextFacts } from "../../types";
import type { ConversationIntent, ConversationalGatewayInput, ContextResolution, ResolvedProjectContext } from "../types";
import { computeMissingContext } from "./missingContext";

/** A representative sample of `ProjectContextFacts` keys used purely to duck-type
 * `projectState`. `ProjectContextFacts` always carries every one of these keys (even when the
 * value is `null`) — a real caller-supplied context will hit nearly all of them, while an
 * arbitrary/unrelated object won't. */
const PROJECT_CONTEXT_FACT_PROBE_KEYS: (keyof ProjectContextFacts)[] = [
  "phase",
  "hasApprovedCharter",
  "hasApprovedConstitution",
  "hasScopeBaseline",
  "hasWbs",
  "hasScheduleBaseline",
  "hasRiskRegister",
  "hasClosureChecklistStarted",
  "hasFinalInvoiceIssued",
  "hasClientSignoff",
  "openCriticalRisks",
  "hasDeliverablesCompleted",
  "hasTechnicalEvidence",
  "hasClientValidation",
];

const PROJECT_CONTEXT_FACT_PROBE_MIN_HITS = 8;

/**
 * Narrows an unknown `projectState` to `ProjectContextFacts` only when it genuinely looks like
 * one — never guessed, never partially fabricated. A caller that passes an unrelated object (or
 * nothing at all) simply gets "no structured project evidence available" rather than a crash or
 * a made-up context.
 */
function looksLikeProjectContextFacts(value: unknown): value is ProjectContextFacts {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) return false;
  if (typeof record.workspaceId !== "string" || record.workspaceId.trim().length === 0) return false;
  if (typeof record.metadata !== "object" || record.metadata === null) return false;

  const hits = PROJECT_CONTEXT_FACT_PROBE_KEYS.filter((key) => key in record).length;
  return hits >= PROJECT_CONTEXT_FACT_PROBE_MIN_HITS;
}

function resolveProjectContext(input: ConversationalGatewayInput): ResolvedProjectContext {
  const projectId = input.activeProjectId?.trim() || null;
  const projectName = input.activeProjectName?.trim() || null;
  const available = Boolean(projectId);

  const facts = looksLikeProjectContextFacts(input.projectState) ? input.projectState : null;

  let governanceSnapshot: ResolvedProjectContext["governanceSnapshot"] = null;
  if (facts) {
    const result = generatePlaybookGovernanceSnapshot(facts);
    if (result.ok) governanceSnapshot = result.data;
  }

  return { available, projectId, projectName, facts, governanceSnapshot };
}

/**
 * Resolves whatever context is available for a classified intent: whether an active project is
 * known, whether it comes with real structured evidence (`ProjectContextFacts`), and — running
 * the full Sprint 7 governance snapshot chain when it does — what the Playbook Engine already
 * knows about it. Also computes which `MissingContextItem`s remain, and a confidence score for
 * how complete the resolved context is relative to what the intent typically needs.
 */
export function resolveConversationContext(intent: ConversationIntent, input: ConversationalGatewayInput): ContextResolution {
  const project = resolveProjectContext(input);

  // General PM advice is answerable with zero project context by design — never penalize it.
  if (intent === "general_pm_advice") {
    return {
      intent,
      project,
      missingContext: [],
      confidence: 100,
      reasoning: ["General PM advice does not require project-specific context."],
    };
  }

  const messageMatchedSpecificOutput = intent === "communication_draft" && /correo de seguimiento|follow[- ]up email|seguimiento/.test(
    input.message.toLowerCase(),
  );

  const missingContext = computeMissingContext({
    intent,
    project,
    metadata: input.metadata,
    messageMatchedSpecificOutput,
  });

  const reasoning: string[] = [];
  if (project.available) {
    reasoning.push(`Active project resolved: ${project.projectName ?? project.projectId}.`);
    reasoning.push(project.facts ? "Structured project evidence (ProjectContextFacts) is available." : "No structured project evidence was supplied — only the project identity is known.");
  } else {
    reasoning.push("No active project is known for this conversation.");
  }
  if (missingContext.length > 0) {
    reasoning.push(`Missing for this intent: ${missingContext.join(", ")}.`);
  }

  const projectPenalty = missingContext.includes("project") ? 40 : 0;
  const otherMissingPenalty = missingContext.filter((item) => item !== "project").length * 15;
  const evidencePenalty = project.available && !project.facts && !missingContext.includes("project") ? 15 : 0;
  const confidence = Math.max(0, Math.min(100, 100 - projectPenalty - otherMissingPenalty - evidencePenalty));

  return { intent, project, missingContext, confidence, reasoning };
}
