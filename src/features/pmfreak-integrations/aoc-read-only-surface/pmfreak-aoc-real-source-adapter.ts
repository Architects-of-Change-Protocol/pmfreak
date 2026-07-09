// PMFreak AOC Read-Only Integration Surface v1 — real source adapter (unsupported placeholder)
//
// This repository does contain a real Supabase-backed database (see
// src/lib/db/database-contract.ts, src/lib/supabase/server.ts) and it is
// PMFreak's own operational data store. However, none of its tables are a
// documented, stable contract for the read models this surface defines
// (PMFreakProjectReadModel, PMFreakMilestoneReadModel, etc.) — the closest
// tables (`operational_memory_records`, RAID storage) encode a different
// shape than "projects / agents / milestones / tasks / risks / evidence
// references / approval references / action proposals", and mapping one
// onto the other without a reviewed schema contract would mean inventing
// field mappings, which this PR is explicitly scoped not to do.
//
// So for v1, every real sourceKind ("api" | "database" | "supabase" |
// "unknown") is unsupported: every list* method rejects with a safe
// `unsupported_source_kind` surface error. No network calls, no
// credentials, no schema guesses. See README.md "Source contract
// requirements for a future real adapter" for what a follow-up PR needs to
// wire a real adapter safely.

import { createPMFreakAocSurfaceError } from "./pmfreak-aoc-surface-errors";
import type { PMFreakAocReadOnlySurfaceSourceKind } from "./pmfreak-aoc-read-only-surface-types";
import type { PMFreakAocReadOnlySource } from "./pmfreak-aoc-read-only-source";

export function createUnsupportedPMFreakAocRealReadOnlySource(
  sourceKind: "api" | "database" | "supabase" | "unknown"
): PMFreakAocReadOnlySource {
  const reject = (methodName: string) => async () => {
    throw createPMFreakAocSurfaceError(
      "unsupported_source_kind",
      `PMFreak read-only source kind "${sourceKind}" is not yet supported (${methodName}). No real PMFreak source contract has been wired for this surface version.`,
      { sourceKind, methodName }
    );
  };

  const kind: PMFreakAocReadOnlySurfaceSourceKind = sourceKind;

  return {
    sourceKind: kind,
    listProjects: reject("listProjects"),
    listAgents: reject("listAgents"),
    listMilestones: reject("listMilestones"),
    listTasks: reject("listTasks"),
    listRisks: reject("listRisks"),
    listEvidenceReferences: reject("listEvidenceReferences"),
    listApprovalReferences: reject("listApprovalReferences"),
    listActionProposals: reject("listActionProposals"),
  };
}
