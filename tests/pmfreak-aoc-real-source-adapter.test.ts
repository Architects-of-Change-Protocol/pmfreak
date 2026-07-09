import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocReadOnlySurfaceConfig,
  createUnsupportedPMFreakAocRealReadOnlySource,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

const config = createPMFreakAocReadOnlySurfaceConfig({ sourceKind: "supabase" });

test("unsupported real source adapter fails safely for every method and every real source kind", async () => {
  const kinds = ["api", "database", "supabase", "unknown"] as const;

  for (const kind of kinds) {
    const source = createUnsupportedPMFreakAocRealReadOnlySource(kind);
    assert.equal(source.sourceKind, kind);

    const methods = [
      "listProjects",
      "listAgents",
      "listMilestones",
      "listTasks",
      "listRisks",
      "listEvidenceReferences",
      "listApprovalReferences",
      "listActionProposals",
    ] as const;

    for (const method of methods) {
      await assert.rejects(() => source[method](config), (error: unknown) => {
        const surfaceError = error as { safe?: boolean; code?: string };
        assert.equal(surfaceError.safe, true);
        assert.equal(surfaceError.code, "unsupported_source_kind");
        return true;
      });
    }
  }
});

test("unsupported real source adapter never requires env vars or credentials", () => {
  assert.doesNotThrow(() => createUnsupportedPMFreakAocRealReadOnlySource("database"));
});
