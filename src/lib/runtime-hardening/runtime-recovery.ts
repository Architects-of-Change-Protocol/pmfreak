type FailureClass =
  | "missing_script"
  | "missing_runtime_module"
  | "invalid_package_json"
  | "replay_integrity_missing"
  | "synchronization_integrity_missing"
  | "governance_boundary_missing"
  | "connector_runtime_missing"
  | "test_contract_missing";

interface RecoveryRecommendation {
  failureClass: FailureClass;
  recommendation: string;
  severity: "critical" | "high" | "medium" | "low";
  isAutomated: false;
}

const RECOVERY_MAP: Record<FailureClass, RecoveryRecommendation> = {
  missing_script: {
    failureClass: "missing_script",
    recommendation: "Add the missing validation script to scripts/ following existing check-*.mjs conventions. Wire it to package.json scripts using a JSON-safe update.",
    severity: "high",
    isAutomated: false,
  },
  missing_runtime_module: {
    failureClass: "missing_runtime_module",
    recommendation: "Create the missing runtime module in the appropriate src/lib/ subdirectory. Ensure it exports the required types and functions per the cognition contract spec.",
    severity: "high",
    isAutomated: false,
  },
  invalid_package_json: {
    failureClass: "invalid_package_json",
    recommendation: "Parse and repair package.json using a JSON parser. Never use string insertion or manual text patching. Run npm run check:package-json after repair.",
    severity: "critical",
    isAutomated: false,
  },
  replay_integrity_missing: {
    failureClass: "replay_integrity_missing",
    recommendation: "Ensure src/lib/connectors/replay/connector-replay.ts exists and exposes integrity/evidence/uncertainty fields. Add tests verifying replay contract coverage.",
    severity: "high",
    isAutomated: false,
  },
  synchronization_integrity_missing: {
    failureClass: "synchronization_integrity_missing",
    recommendation: "Ensure src/lib/connectors/connector-synchronization.ts exists with status/state fields. Verify connector-heartbeat.ts is present for diagnostic support.",
    severity: "high",
    isAutomated: false,
  },
  governance_boundary_missing: {
    failureClass: "governance_boundary_missing",
    recommendation: "Restore governance boundary contracts: governance-core.ts and authority-port.ts must exist in src/lib/governance/authority/runtime/. These are critical invariants.",
    severity: "critical",
    isAutomated: false,
  },
  connector_runtime_missing: {
    failureClass: "connector_runtime_missing",
    recommendation: "Ensure src/lib/connectors/runtime/ folder exists with registry, runtime, and manager files. This is required for external signal federation.",
    severity: "high",
    isAutomated: false,
  },
  test_contract_missing: {
    failureClass: "test_contract_missing",
    recommendation: "Add missing test contract file to tests/ using existing node:test + assert/strict patterns. Tests must be deterministic file/content checks, not runtime module imports.",
    severity: "medium",
    isAutomated: false,
  },
};

export function recommendRuntimeRecovery(failureClass: FailureClass): RecoveryRecommendation {
  return RECOVERY_MAP[failureClass];
}

export function recommendRuntimeRecoveries(
  failureClasses: FailureClass[]
): RecoveryRecommendation[] {
  const seen = new Set<FailureClass>();
  return failureClasses
    .filter((fc) => {
      if (seen.has(fc)) return false;
      seen.add(fc);
      return true;
    })
    .map((fc) => RECOVERY_MAP[fc]);
}
