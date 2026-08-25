import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  CognitionContractCheck,
  CognitionContractResult,
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

const CONTRACTS: Array<CognitionContractCheck & {
  filePath: string;
  requiredSymbols: string[];
}> = [
  {
    id: "operational_memory_exports",
    description: "operational memory must export core retrieval APIs",
    subsystem: "operational_memory",
    filePath: "src/lib/operational-memory.ts",
    requiredSymbols: ["OperationalMemory", "retrieveOperationalMemory"],
  },
  {
    id: "connector_contract_types",
    description: "connector types must define core contract interfaces",
    subsystem: "external_connectors",
    filePath: "src/lib/connectors/types/connector-types.ts",
    requiredSymbols: ["ConnectorType", "ConnectorStatus"],
  },
  {
    id: "source_lineage_type",
    description: "source lineage type must be defined",
    subsystem: "external_connectors",
    filePath: "src/lib/connectors/operational-source-lineage.ts",
    requiredSymbols: ["sourceId", "connectorType"],
  },
  {
    id: "federation_result_type",
    description: "federation must define a result/output contract",
    subsystem: "external_connectors",
    filePath: "src/lib/connectors/federation/signal-federation.ts",
    requiredSymbols: ["federate", "signal"],
  },
  {
    id: "governance_boundary_type",
    description: "governance boundary must be represented in enterprise runtime",
    subsystem: "governance",
    filePath: "src/lib/governance/authority/runtime/governance-core.ts",
    requiredSymbols: ["workspaceId", "tenantId", "allowed"],
  },
  {
    id: "runtime_authorization_surface",
    description: "runtime authorization surface must expose canonical methods",
    subsystem: "runtime_authorization",
    filePath: "src/lib/governance/authority/runtime/authority-port.ts",
    requiredSymbols: ["authorizeAction", "enforceAuthorization", "evaluateAgentAccess"],
  },
  {
    id: "runtime_consumer_surface",
    description: "runtime consumer must export authorization bridge",
    subsystem: "runtime_authorization",
    filePath: "src/aoc/runtime-consumer/runtime-authorization.ts",
    requiredSymbols: ["authorizeRuntimeAction"],
  },
  {
    id: "connector_governance_type",
    description: "connector governance must define boundary contracts",
    subsystem: "external_connectors",
    filePath: "src/lib/connectors/governance/connector-governance.ts",
    requiredSymbols: ["workspaceId", "governance"],
  },
];

export function evaluateCognitionContracts(): CognitionContractResult[] {
  const now = new Date().toISOString();
  return CONTRACTS.map((contract) => {
    const content = safeRead(p(contract.filePath));
    const fileExists = existsSync(p(contract.filePath));
    if (!fileExists) {
      return {
        contractId: contract.id,
        subsystem: contract.subsystem,
        status: "unsatisfied" as const,
        evidence: [`${contract.filePath} does not exist`],
        confidence: 1.0,
        uncertainty: [],
        governanceBoundaries: ["cognition_contract", contract.subsystem],
        checkedAt: now,
        missingExports: contract.requiredSymbols,
      };
    }
    const missing = contract.requiredSymbols.filter((sym) => !content.includes(sym));
    const status = missing.length === 0 ? "satisfied" : missing.length < contract.requiredSymbols.length ? "partial" : "unsatisfied";
    return {
      contractId: contract.id,
      subsystem: contract.subsystem,
      status,
      evidence: missing.length === 0
        ? [`All required symbols found in ${contract.filePath}`]
        : [`Missing symbols in ${contract.filePath}: ${missing.join(", ")}`],
      confidence: 0.85,
      uncertainty: ["symbol presence does not guarantee correct export semantics"],
      governanceBoundaries: ["cognition_contract", contract.subsystem],
      checkedAt: now,
      missingExports: missing.length > 0 ? missing : undefined,
    };
  });
}

export function retrieveCognitionContractSummary(): {
  total: number;
  satisfied: number;
  partial: number;
  unsatisfied: number;
} {
  const results = evaluateCognitionContracts();
  return {
    total: results.length,
    satisfied: results.filter((r) => r.status === "satisfied").length,
    partial: results.filter((r) => r.status === "partial").length,
    unsatisfied: results.filter((r) => r.status === "unsatisfied").length,
  };
}
