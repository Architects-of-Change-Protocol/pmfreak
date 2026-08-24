import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  RuntimeInvariant,
  RuntimeInvariantResult,
  RuntimeSubsystem,
} from "./runtime-hardening-types";

const root = process.cwd();
const p = (...parts: string[]) => path.join(root, ...parts);

function safeRead(filePath: string): string {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  } catch {
    return "";
  }
}

function fileContains(filePath: string, pattern: RegExp): boolean {
  return pattern.test(safeRead(p(filePath)));
}

const INVARIANTS: Array<RuntimeInvariant & { check: () => boolean; failureEvidence: string }> = [
  {
    id: "tenant_isolation_represented",
    description: "Tenant isolation must be represented in connector governance",
    subsystem: "external_connectors",
    severity: "critical",
    check: () => fileContains("src/lib/connectors/governance/connector-governance.ts", /workspaceId|tenantId|tenant/i),
    failureEvidence: "connector-governance.ts does not reference workspaceId or tenantId",
  },
  {
    id: "workspace_isolation_represented",
    description: "Workspace isolation must be represented in runtime consumer",
    subsystem: "runtime_authorization",
    severity: "critical",
    check: () => fileContains("src/aoc/runtime-consumer/runtime-authorization.ts", /workspaceId|workspace/i),
    failureEvidence: "runtime-authorization.ts does not reference workspace isolation",
  },
  {
    id: "replay_integrity_represented",
    description: "Replay integrity must be represented in connector replay",
    subsystem: "external_connectors",
    severity: "high",
    check: () => existsSync(p("src/lib/connectors/replay/connector-replay.ts")),
    failureEvidence: "connector-replay.ts is missing",
  },
  {
    id: "governance_boundary_represented",
    description: "Governance boundary must be represented in enterprise runtime",
    subsystem: "governance",
    severity: "critical",
    check: () => existsSync(p("src/lib/governance/authority/runtime/governance-core.ts")),
    failureEvidence: "governance-core.ts is missing from enterprise runtime",
  },
  {
    id: "source_lineage_represented",
    description: "Source lineage must be represented in connector layer",
    subsystem: "external_connectors",
    severity: "high",
    check: () => existsSync(p("src/lib/connectors/operational-source-lineage.ts")),
    failureEvidence: "operational-source-lineage.ts is missing",
  },
  {
    id: "deterministic_validation_scripts_exist",
    description: "Deterministic validation scripts must exist for governance",
    subsystem: "governance",
    severity: "high",
    check: () =>
      existsSync(p("scripts/check-governance-typing.mjs")) &&
      existsSync(p("scripts/check-runtime-contracts.mjs")),
    failureEvidence: "check-governance-typing.mjs or check-runtime-contracts.mjs is missing",
  },
  {
    id: "connector_federation_preserves_lineage",
    description: "Connector federation must preserve source lineage",
    subsystem: "external_connectors",
    severity: "high",
    check: () =>
      fileContains("src/lib/connectors/federation/signal-federation.ts", /lineage|sourceId|source/i),
    failureEvidence: "signal-federation.ts does not reference lineage or source tracking",
  },
  {
    id: "runtime_authorization_centralized",
    description: "Runtime authorization must remain centralized in enterprise runtime",
    subsystem: "runtime_authorization",
    severity: "critical",
    check: () =>
      existsSync(p("src/lib/governance/authority/runtime/authority-port.ts")) &&
      existsSync(p("src/aoc/runtime-consumer/runtime-authorization.ts")),
    failureEvidence: "authority-port.ts or runtime-authorization.ts is missing",
  },
  {
    id: "no_direct_provider_in_api_routes",
    description: "API routes must not directly import provider adapters",
    subsystem: "governance",
    severity: "critical",
    check: () => !fileContains("src/app/api/runtime/authority/route.ts", /in-process-authority-adapter|external-authority-adapter/i),
    failureEvidence: "API route directly imports authority adapter (should use runtime-consumer)",
  },
  {
    id: "package_json_valid",
    description: "package.json must remain valid JSON",
    subsystem: "governance",
    severity: "critical",
    check: () => {
      try {
        JSON.parse(readFileSync(p("package.json"), "utf8"));
        return true;
      } catch {
        return false;
      }
    },
    failureEvidence: "package.json is not valid JSON",
  },
];

export function buildRuntimeInvariants(): ReadonlyArray<RuntimeInvariant> {
  return INVARIANTS.map(({ check: _check, failureEvidence: _fe, ...inv }) => inv);
}

export function evaluateRuntimeInvariants(): RuntimeInvariantResult[] {
  const now = new Date().toISOString();
  return INVARIANTS.map((inv) => {
    let passed = false;
    try {
      passed = inv.check();
    } catch {
      passed = false;
    }
    return {
      invariantId: inv.id,
      subsystem: inv.subsystem,
      status: passed ? "passed" : "failed",
      evidence: passed ? [`Invariant satisfied: ${inv.description}`] : [inv.failureEvidence],
      confidence: passed ? 0.9 : 1.0,
      uncertainty: ["file content may differ from runtime state"],
      governanceBoundaries: ["runtime_invariant", inv.subsystem],
      checkedAt: now,
      failureReason: passed ? undefined : inv.failureEvidence,
    };
  });
}

export function retrieveRuntimeInvariantSummary(): {
  total: number;
  passed: number;
  failed: number;
  criticalFailures: string[];
} {
  const results = evaluateRuntimeInvariants();
  const failed = results.filter((r) => r.status === "failed");
  const criticalIds = new Set(
    INVARIANTS.filter((i) => i.severity === "critical").map((i) => i.id)
  );
  return {
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: failed.length,
    criticalFailures: failed
      .filter((r) => criticalIds.has(r.invariantId))
      .map((r) => r.invariantId),
  };
}
