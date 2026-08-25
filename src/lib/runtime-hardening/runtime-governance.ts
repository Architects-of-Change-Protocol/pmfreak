import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (...parts: string[]) => path.join(root, ...parts);

function safeRead(filePath: string): string {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  } catch {
    return "";
  }
}

interface GovernanceIntegrityResult {
  status: "intact" | "partial" | "missing";
  checks: Array<{ id: string; passed: boolean; evidence: string }>;
  checkedAt: string;
}

export function evaluateRuntimeGovernanceIntegrity(): GovernanceIntegrityResult {
  const now = new Date().toISOString();
  const checks: Array<{ id: string; passed: boolean; evidence: string }> = [];

  const govCoreExists = existsSync(p("src/lib/governance/authority/runtime/governance-core.ts"));
  checks.push({
    id: "governance_core_exists",
    passed: govCoreExists,
    evidence: govCoreExists ? "governance-core.ts present" : "governance-core.ts missing",
  });

  const authorityPortExists = existsSync(p("src/lib/governance/authority/runtime/authority-port.ts"));
  checks.push({
    id: "authority_port_exists",
    passed: authorityPortExists,
    evidence: authorityPortExists ? "authority-port.ts present" : "authority-port.ts missing",
  });

  const govCoreContent = safeRead("src/lib/governance/authority/runtime/governance-core.ts");
  const hasBoundaryLanguage = /workspaceId|tenantId|allowed|deny/i.test(govCoreContent);
  checks.push({
    id: "governance_boundary_language",
    passed: hasBoundaryLanguage,
    evidence: hasBoundaryLanguage
      ? "governance-core.ts contains boundary language"
      : "governance-core.ts missing boundary language",
  });

  const runtimeContractsExists = existsSync(p("src/lib/governance/authority/runtime/runtime-contracts.ts"));
  checks.push({
    id: "runtime_contracts_exist",
    passed: runtimeContractsExists,
    evidence: runtimeContractsExists ? "runtime-contracts.ts present" : "runtime-contracts.ts missing",
  });

  const allPassed = checks.every((c) => c.passed);
  const anyPassed = checks.some((c) => c.passed);
  const status = allPassed ? "intact" : anyPassed ? "partial" : "missing";

  return { status, checks, checkedAt: now };
}
