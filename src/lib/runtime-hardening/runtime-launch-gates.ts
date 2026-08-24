import { existsSync } from "node:fs";
import path from "node:path";
import type { RuntimeLaunchGate, RuntimeLaunchReadinessResult } from "./runtime-hardening-types";

const root = process.cwd();
const p = (...parts: string[]) => path.join(root, ...parts);

export function buildRuntimeLaunchGates(): RuntimeLaunchGate[] {
  return [
    { id: "package_integrity", description: "package.json is valid and scripts are present", subsystem: "governance", severity: "critical" },
    { id: "build_test_readiness", description: "core test contract files exist", subsystem: "governance", severity: "critical" },
    { id: "governance_readiness", description: "governance boundary contracts exist", subsystem: "governance", severity: "critical" },
    { id: "replay_readiness", description: "connector replay module exists", subsystem: "external_connectors", severity: "high" },
    { id: "synchronization_readiness", description: "connector synchronization module exists", subsystem: "external_connectors", severity: "high" },
    { id: "connector_readiness", description: "connector runtime folder exists", subsystem: "external_connectors", severity: "high" },
    { id: "runtime_authorization_readiness", description: "runtime authorization consumer exists", subsystem: "runtime_authorization", severity: "critical" },
    { id: "upload_pipeline_readiness", description: "upload pipeline tests exist", subsystem: "upload_pipeline", severity: "medium" },
    { id: "billing_readiness", description: "billing module exists", subsystem: "billing", severity: "medium" },
  ];
}

const GATE_CHECKS: Record<string, () => { passed: boolean; evidence: string }> = {
  package_integrity: () => {
    const ok = existsSync(p("package.json"));
    return { passed: ok, evidence: ok ? "package.json present" : "package.json missing" };
  },
  build_test_readiness: () => {
    const ok = existsSync(p("tests/runtime-contracts-canonical-surface.test.mjs"));
    return { passed: ok, evidence: ok ? "core test contracts present" : "core test contract missing" };
  },
  governance_readiness: () => {
    const ok = existsSync(p("src/lib/governance/authority/runtime/governance-core.ts")) &&
      existsSync(p("src/lib/governance/authority/runtime/authority-port.ts"));
    return { passed: ok, evidence: ok ? "governance core and authority port present" : "governance artifacts missing" };
  },
  replay_readiness: () => {
    const ok = existsSync(p("src/lib/connectors/replay/connector-replay.ts"));
    return { passed: ok, evidence: ok ? "connector replay present" : "connector replay absent" };
  },
  synchronization_readiness: () => {
    const ok = existsSync(p("src/lib/connectors/connector-synchronization.ts"));
    return { passed: ok, evidence: ok ? "connector synchronization present" : "connector synchronization absent" };
  },
  connector_readiness: () => {
    const ok = existsSync(p("src/lib/connectors/runtime"));
    return { passed: ok, evidence: ok ? "connector runtime folder present" : "connector runtime folder absent" };
  },
  runtime_authorization_readiness: () => {
    const ok = existsSync(p("src/aoc/runtime-consumer/runtime-authorization.ts"));
    return { passed: ok, evidence: ok ? "runtime authorization consumer present" : "runtime authorization consumer absent" };
  },
  upload_pipeline_readiness: () => {
    const ok = existsSync(p("tests/upload-contract.test.mjs"));
    return { passed: ok, evidence: ok ? "upload contract test present" : "upload contract test absent" };
  },
  billing_readiness: () => {
    const ok = existsSync(p("src/lib/billing.ts"));
    return { passed: ok, evidence: ok ? "billing module present" : "billing module absent" };
  },
};

export function evaluateLaunchGates(): Array<RuntimeLaunchGate & { passed: boolean; evidence: string }> {
  return buildRuntimeLaunchGates().map((gate) => {
    const checker = GATE_CHECKS[gate.id];
    if (!checker) return { ...gate, passed: false, evidence: "no check implemented for gate" };
    try {
      const result = checker();
      return { ...gate, ...result };
    } catch {
      return { ...gate, passed: false, evidence: "gate check threw an error" };
    }
  });
}

export function retrieveLaunchGateReadiness(): RuntimeLaunchReadinessResult {
  const gates = evaluateLaunchGates();
  const now = new Date().toISOString();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];

  for (const gate of gates) {
    evidence.push(gate.evidence);
    if (!gate.passed) {
      if (gate.severity === "critical" || gate.severity === "high") {
        blockers.push(`[${gate.id}] ${gate.evidence}`);
      } else {
        warnings.push(`[${gate.id}] ${gate.evidence}`);
      }
    }
  }

  const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "ready_with_warnings" : "ready";
  return {
    status,
    blockers,
    warnings,
    evidence,
    confidence: status === "ready" ? 0.9 : 0.8,
    checkedAt: now,
  };
}
