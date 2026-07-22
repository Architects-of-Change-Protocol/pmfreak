// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Validation Pipeline
// Sprint 0.5: Foundation Integration
//
//   Real project data
//           ↓
//   Derive structured response   (derive-initial-response.ts)
//           ↓
//   Validate project boundary + epistemic claims + source references
//           (guardrails.validateResponse)
//           ↓
//   Render Project Brain UI, or a neutral fallback on failure
//
// No unsafe claim ever reaches rendering: this is the one place a caller
// should go from "real project data" to "safe to render."
// ─────────────────────────────────────────────────────────────────────────────

import { deriveInitialProjectBrainResponse, type EvidenceSummary, type ProjectSetupSnapshot } from "./derive-initial-response";
import { validateResponse, type GuardrailFailure } from "./guardrails";
import type { ProjectBrainResponse } from "./types";

export type ProjectBrainPipelineResult =
  | { ok: true; response: ProjectBrainResponse }
  | { ok: false; failures: GuardrailFailure[] };

export const PROJECT_BRAIN_FALLBACK_MESSAGE =
  "The Project Brain could not safely summarize the current project context. Your evidence remains stored in Project Memory.";

/**
 * Derives the initial response and validates it before a caller renders
 * anything. On failure, logs only the guardrail failure codes (never the
 * statement text or source content) so a caller can alert on this without
 * leaking project data into logs.
 */
export function buildInitialProjectBrainResponse(input: {
  project: ProjectSetupSnapshot;
  evidence: EvidenceSummary;
  generatedAt: string;
}): ProjectBrainPipelineResult {
  const response = deriveInitialProjectBrainResponse(input);
  const validation = validateResponse(response);

  if (!validation.ok) {
    console.error(
      JSON.stringify({
        event: "project_brain.response_validation_failed",
        projectId: input.project.projectId,
        failureCodes: validation.failures.map((f) => f.code),
      }),
    );
    return { ok: false, failures: validation.failures };
  }

  return { ok: true, response };
}
