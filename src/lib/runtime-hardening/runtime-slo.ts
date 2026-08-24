import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RuntimeSLO, RuntimeSLOResult } from "./runtime-hardening-types";

const root = process.cwd();
const p = (...parts: string[]) => path.join(root, ...parts);

const SLOS: Array<RuntimeSLO & { check: () => boolean; evidence: () => string[] }> = [
  {
    id: "package_json_valid",
    description: "package.json exists and is valid",
    subsystem: "governance",
    check: () => {
      try {
        JSON.parse(readFileSync(p("package.json"), "utf8"));
        return true;
      } catch { return false; }
    },
    evidence: () => [existsSync(p("package.json")) ? "package.json exists" : "package.json not found"],
  },
  {
    id: "validation_scripts_present",
    description: "core validation scripts exist",
    subsystem: "governance",
    check: () =>
      existsSync(p("scripts/check-runtime-contracts.mjs")) &&
      existsSync(p("scripts/check-governance-typing.mjs")),
    evidence: () => ["check-runtime-contracts.mjs", "check-governance-typing.mjs"].map(
      (f) => `scripts/${f}: ${existsSync(p("scripts", f)) ? "present" : "absent"}`
    ),
  },
  {
    id: "replay_integrity_present",
    description: "connector replay module exists",
    subsystem: "external_connectors",
    check: () => existsSync(p("src/lib/connectors/replay/connector-replay.ts")),
    evidence: () => [`connector-replay.ts: ${existsSync(p("src/lib/connectors/replay/connector-replay.ts")) ? "present" : "absent"}`],
  },
  {
    id: "synchronization_integrity_present",
    description: "connector synchronization module exists",
    subsystem: "external_connectors",
    check: () => existsSync(p("src/lib/connectors/connector-synchronization.ts")),
    evidence: () => [`connector-synchronization.ts: ${existsSync(p("src/lib/connectors/connector-synchronization.ts")) ? "present" : "absent"}`],
  },
  {
    id: "governance_boundaries_present",
    description: "governance boundary contracts exist",
    subsystem: "governance",
    check: () =>
      existsSync(p("src/lib/governance/authority/runtime/governance-core.ts")) &&
      existsSync(p("src/lib/governance/authority/runtime/authority-port.ts")),
    evidence: () => ["governance-core.ts", "authority-port.ts"].map(
      (f) => `src/lib/governance/authority/runtime/${f}: ${existsSync(p("src/lib/governance/authority/runtime", f)) ? "present" : "absent"}`
    ),
  },
  {
    id: "source_lineage_present",
    description: "source lineage module exists",
    subsystem: "external_connectors",
    check: () => existsSync(p("src/lib/connectors/operational-source-lineage.ts")),
    evidence: () => [`operational-source-lineage.ts: ${existsSync(p("src/lib/connectors/operational-source-lineage.ts")) ? "present" : "absent"}`],
  },
  {
    id: "connector_runtime_present",
    description: "connector runtime folder exists",
    subsystem: "external_connectors",
    check: () => existsSync(p("src/lib/connectors/runtime")),
    evidence: () => [`src/lib/connectors/runtime: ${existsSync(p("src/lib/connectors/runtime")) ? "present" : "absent"}`],
  },
  {
    id: "build_test_contracts_present",
    description: "core contract test files exist",
    subsystem: "governance",
    check: () =>
      existsSync(p("tests/runtime-contracts-canonical-surface.test.mjs")) &&
      existsSync(p("tests/runtime-consumer-boundary.test.mjs")),
    evidence: () => [
      "tests/runtime-contracts-canonical-surface.test.mjs",
      "tests/runtime-consumer-boundary.test.mjs",
    ].map((f) => `${f}: ${existsSync(p(f)) ? "present" : "absent"}`),
  },
];

export function buildRuntimeSLOs(): ReadonlyArray<RuntimeSLO> {
  return SLOS.map(({ check: _c, evidence: _e, ...slo }) => slo);
}

export function evaluateRuntimeSLOs(): RuntimeSLOResult[] {
  const now = new Date().toISOString();
  return SLOS.map((slo) => {
    let met = false;
    try {
      met = slo.check();
    } catch { met = false; }
    const ev = (() => { try { return slo.evidence(); } catch { return []; } })();
    return {
      sloId: slo.id,
      subsystem: slo.subsystem,
      status: met ? "met" : "unmet",
      evidence: ev,
      confidence: met ? 0.9 : 1.0,
      uncertainty: ["SLO check is based on file existence; runtime SLO attainment may differ"],
      governanceBoundaries: ["runtime_slo", slo.subsystem],
      checkedAt: now,
    };
  });
}

export function retrieveOperationalSLOs(): { slos: RuntimeSLO[]; results: RuntimeSLOResult[] } {
  return { slos: [...buildRuntimeSLOs()], results: evaluateRuntimeSLOs() };
}
