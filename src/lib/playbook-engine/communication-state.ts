import type { PlaybookEngineResult } from "./types";
import type { CommunicationDraft, CommunicationDraftStatus } from "./communication-types";

/**
 * Allowed status transitions for a `CommunicationDraft`. Mirrors the pattern in
 * `recommendation-state.ts`: a static graph validated before every transition. `discarded` and
 * `sent_manually` are terminal — a discarded draft can never later be sent, and a sent draft can
 * never move again. There is deliberately no path that reaches `sent_manually` or `copied`
 * without passing through `approved` first, and no automated transition exists anywhere in this
 * module: every state change requires an explicit human call.
 */
export const COMMUNICATION_DRAFT_TRANSITIONS: Readonly<Record<CommunicationDraftStatus, readonly CommunicationDraftStatus[]>> = {
  draft: ["reviewed", "discarded"],
  reviewed: ["approved", "discarded"],
  approved: ["copied", "sent_manually", "discarded"],
  copied: ["sent_manually", "discarded"],
  sent_manually: [],
  discarded: [],
};

function transitionCommunicationDraft(
  draft: CommunicationDraft,
  targetStatus: CommunicationDraftStatus,
): PlaybookEngineResult<CommunicationDraft> {
  const allowedTargets = COMMUNICATION_DRAFT_TRANSITIONS[draft.status];

  if (!allowedTargets.includes(targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition communication draft from '${draft.status}' to '${targetStatus}'. Allowed: ${
        allowedTargets.length > 0 ? allowedTargets.join(", ") : "(none — terminal state)"
      }.`,
      failureClass: "validation_failed",
    };
  }

  return { ok: true, data: { ...draft, status: targetStatus, updatedAt: new Date().toISOString() } };
}

/** A human has reviewed the draft's content. */
export function markDraftReviewed(draft: CommunicationDraft): PlaybookEngineResult<CommunicationDraft> {
  return transitionCommunicationDraft(draft, "reviewed");
}

/** A human has approved the draft as ready to use. Never sends anything. */
export function approveDraft(draft: CommunicationDraft): PlaybookEngineResult<CommunicationDraft> {
  return transitionCommunicationDraft(draft, "approved");
}

/** A human has copied the approved draft's content elsewhere (e.g. into their email client). */
export function markDraftCopied(draft: CommunicationDraft): PlaybookEngineResult<CommunicationDraft> {
  return transitionCommunicationDraft(draft, "copied");
}

/** A human has sent the draft's content themselves, outside PMFreak. Terminal. */
export function markDraftSentManually(draft: CommunicationDraft): PlaybookEngineResult<CommunicationDraft> {
  return transitionCommunicationDraft(draft, "sent_manually");
}

/** A human has discarded the draft. Terminal — it can never later be sent. */
export function discardDraft(draft: CommunicationDraft): PlaybookEngineResult<CommunicationDraft> {
  return transitionCommunicationDraft(draft, "discarded");
}
