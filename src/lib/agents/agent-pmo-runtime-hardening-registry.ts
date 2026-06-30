// ─── PMO End-to-End Governance Runtime Hardening — Registry ──────────────────
// Pure in-memory store. Does not use Supabase.
// All audit records are append-only.
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.

import { randomUUID } from "node:crypto";
import type {
  AgentPmoRuntimeHardeningRunRecord,
  AgentPmoRuntimeHardeningRunStatus,
  AgentPmoLayerIntegrationAuditRecord,
  AgentPmoRouteContractAuditRecord,
  AgentPmoDatabaseContractAuditRecord,
  AgentPmoRlsPolicyAuditRecord,
  AgentPmoWorkspaceIsolationCheckRecord,
  AgentPmoObservabilityCoverageCheckRecord,
  AgentPmoExportSafetyCheckRecord,
  AgentPmoIdempotencyCheckRecord,
  AgentPmoErrorHandlingCheckRecord,
  AgentPmoUiDashboardIntegrationCheckRecord,
  AgentPmoCiSmokeCheckRecord,
  AgentPmoProductionReadinessGateRecord,
  AgentPmoProductionReadinessGateStatus,
  AgentPmoProductionReadinessDecisionRecord,
  AgentPmoRuntimeHardeningBlockerRecord,
  AgentPmoHardeningBlockerStatus,
  AgentPmoRuntimeRemediationItemRecord,
  AgentPmoRemediationItemStatus,
  AgentPmoRuntimeHardeningExportRecord,
  AgentPmoRuntimeHardeningEventRecord,
  AgentPmoRuntimeHardeningEventType,
} from "./agent-pmo-runtime-hardening-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const hardeningRunStore = new Map<string, AgentPmoRuntimeHardeningRunRecord>();
const layerAuditStore: AgentPmoLayerIntegrationAuditRecord[] = [];
const routeContractAuditStore: AgentPmoRouteContractAuditRecord[] = [];
const databaseContractAuditStore: AgentPmoDatabaseContractAuditRecord[] = [];
const rlsPolicyAuditStore: AgentPmoRlsPolicyAuditRecord[] = [];
const workspaceIsolationCheckStore: AgentPmoWorkspaceIsolationCheckRecord[] = [];
const observabilityCoverageCheckStore: AgentPmoObservabilityCoverageCheckRecord[] = [];
const exportSafetyCheckStore: AgentPmoExportSafetyCheckRecord[] = [];
const idempotencyCheckStore: AgentPmoIdempotencyCheckRecord[] = [];
const errorHandlingCheckStore: AgentPmoErrorHandlingCheckRecord[] = [];
const uiDashboardCheckStore: AgentPmoUiDashboardIntegrationCheckRecord[] = [];
const ciSmokeCheckStore: AgentPmoCiSmokeCheckRecord[] = [];
const productionReadinessGateStore = new Map<string, AgentPmoProductionReadinessGateRecord>();
const productionReadinessDecisionStore: AgentPmoProductionReadinessDecisionRecord[] = [];
const hardeningBlockerStore = new Map<string, AgentPmoRuntimeHardeningBlockerRecord>();
const remediationItemStore = new Map<string, AgentPmoRuntimeRemediationItemRecord>();
const hardeningExportStore = new Map<string, AgentPmoRuntimeHardeningExportRecord>();
const hardeningEventStore: AgentPmoRuntimeHardeningEventRecord[] = [];

const now = () => new Date().toISOString();

// ─── Hardening Runs ───────────────────────────────────────────────────────────

export async function createAgentPmoRuntimeHardeningRun(
  data: Omit<AgentPmoRuntimeHardeningRunRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoRuntimeHardeningRunRecord> {
  const record: AgentPmoRuntimeHardeningRunRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  hardeningRunStore.set(record.id, record);
  return record;
}

export async function getAgentPmoRuntimeHardeningRunById(id: string): Promise<AgentPmoRuntimeHardeningRunRecord | null> {
  return hardeningRunStore.get(id) ?? null;
}

export async function listAgentPmoRuntimeHardeningRuns(workspaceId: string): Promise<AgentPmoRuntimeHardeningRunRecord[]> {
  return [...hardeningRunStore.values()].filter((r) => r.workspaceId === workspaceId);
}

export async function updateAgentPmoRuntimeHardeningRunStatus(
  id: string,
  status: AgentPmoRuntimeHardeningRunStatus,
  extra?: Partial<AgentPmoRuntimeHardeningRunRecord>,
): Promise<AgentPmoRuntimeHardeningRunRecord | null> {
  const r = hardeningRunStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  hardeningRunStore.set(id, updated);
  return updated;
}

// ─── Layer Integration Audits ─────────────────────────────────────────────────

export async function createAgentPmoLayerIntegrationAudit(
  data: Omit<AgentPmoLayerIntegrationAuditRecord, "id" | "createdAt">,
): Promise<AgentPmoLayerIntegrationAuditRecord> {
  const record: AgentPmoLayerIntegrationAuditRecord = { ...data, id: randomUUID(), createdAt: now() };
  layerAuditStore.push(record);
  return record;
}

export async function listAgentPmoLayerIntegrationAudits(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoLayerIntegrationAuditRecord[]> {
  return layerAuditStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Route Contract Audits ────────────────────────────────────────────────────

export async function createAgentPmoRouteContractAudit(
  data: Omit<AgentPmoRouteContractAuditRecord, "id" | "createdAt">,
): Promise<AgentPmoRouteContractAuditRecord> {
  const record: AgentPmoRouteContractAuditRecord = { ...data, id: randomUUID(), createdAt: now() };
  routeContractAuditStore.push(record);
  return record;
}

export async function listAgentPmoRouteContractAudits(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRouteContractAuditRecord[]> {
  return routeContractAuditStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Database Contract Audits ─────────────────────────────────────────────────

export async function createAgentPmoDatabaseContractAudit(
  data: Omit<AgentPmoDatabaseContractAuditRecord, "id" | "createdAt">,
): Promise<AgentPmoDatabaseContractAuditRecord> {
  const record: AgentPmoDatabaseContractAuditRecord = { ...data, id: randomUUID(), createdAt: now() };
  databaseContractAuditStore.push(record);
  return record;
}

export async function listAgentPmoDatabaseContractAudits(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoDatabaseContractAuditRecord[]> {
  return databaseContractAuditStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── RLS Policy Audits ────────────────────────────────────────────────────────

export async function createAgentPmoRlsPolicyAudit(
  data: Omit<AgentPmoRlsPolicyAuditRecord, "id" | "createdAt">,
): Promise<AgentPmoRlsPolicyAuditRecord> {
  const record: AgentPmoRlsPolicyAuditRecord = { ...data, id: randomUUID(), createdAt: now() };
  rlsPolicyAuditStore.push(record);
  return record;
}

export async function listAgentPmoRlsPolicyAudits(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRlsPolicyAuditRecord[]> {
  return rlsPolicyAuditStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Workspace Isolation Checks ───────────────────────────────────────────────

export async function createAgentPmoWorkspaceIsolationCheck(
  data: Omit<AgentPmoWorkspaceIsolationCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoWorkspaceIsolationCheckRecord> {
  const record: AgentPmoWorkspaceIsolationCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  workspaceIsolationCheckStore.push(record);
  return record;
}

export async function listAgentPmoWorkspaceIsolationChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoWorkspaceIsolationCheckRecord[]> {
  return workspaceIsolationCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Observability Coverage Checks ───────────────────────────────────────────

export async function createAgentPmoObservabilityCoverageCheck(
  data: Omit<AgentPmoObservabilityCoverageCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoObservabilityCoverageCheckRecord> {
  const record: AgentPmoObservabilityCoverageCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  observabilityCoverageCheckStore.push(record);
  return record;
}

export async function listAgentPmoObservabilityCoverageChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoObservabilityCoverageCheckRecord[]> {
  return observabilityCoverageCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Export Safety Checks ─────────────────────────────────────────────────────

export async function createAgentPmoExportSafetyCheck(
  data: Omit<AgentPmoExportSafetyCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoExportSafetyCheckRecord> {
  const record: AgentPmoExportSafetyCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  exportSafetyCheckStore.push(record);
  return record;
}

export async function listAgentPmoExportSafetyChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoExportSafetyCheckRecord[]> {
  return exportSafetyCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Idempotency Checks ───────────────────────────────────────────────────────

export async function createAgentPmoIdempotencyCheck(
  data: Omit<AgentPmoIdempotencyCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoIdempotencyCheckRecord> {
  const record: AgentPmoIdempotencyCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  idempotencyCheckStore.push(record);
  return record;
}

export async function listAgentPmoIdempotencyChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoIdempotencyCheckRecord[]> {
  return idempotencyCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Error Handling Checks ────────────────────────────────────────────────────

export async function createAgentPmoErrorHandlingCheck(
  data: Omit<AgentPmoErrorHandlingCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoErrorHandlingCheckRecord> {
  const record: AgentPmoErrorHandlingCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  errorHandlingCheckStore.push(record);
  return record;
}

export async function listAgentPmoErrorHandlingChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoErrorHandlingCheckRecord[]> {
  return errorHandlingCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── UI Dashboard Integration Checks ─────────────────────────────────────────

export async function createAgentPmoUiDashboardIntegrationCheck(
  data: Omit<AgentPmoUiDashboardIntegrationCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoUiDashboardIntegrationCheckRecord> {
  const record: AgentPmoUiDashboardIntegrationCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  uiDashboardCheckStore.push(record);
  return record;
}

export async function listAgentPmoUiDashboardIntegrationChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoUiDashboardIntegrationCheckRecord[]> {
  return uiDashboardCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── CI Smoke Checks ──────────────────────────────────────────────────────────

export async function createAgentPmoCiSmokeCheck(
  data: Omit<AgentPmoCiSmokeCheckRecord, "id" | "createdAt">,
): Promise<AgentPmoCiSmokeCheckRecord> {
  const record: AgentPmoCiSmokeCheckRecord = { ...data, id: randomUUID(), createdAt: now() };
  ciSmokeCheckStore.push(record);
  return record;
}

export async function listAgentPmoCiSmokeChecks(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoCiSmokeCheckRecord[]> {
  return ciSmokeCheckStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Production Readiness Gates ───────────────────────────────────────────────

export async function createAgentPmoProductionReadinessGate(
  data: Omit<AgentPmoProductionReadinessGateRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProductionReadinessGateRecord> {
  const record: AgentPmoProductionReadinessGateRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  productionReadinessGateStore.set(record.id, record);
  return record;
}

export async function getAgentPmoProductionReadinessGateById(id: string): Promise<AgentPmoProductionReadinessGateRecord | null> {
  return productionReadinessGateStore.get(id) ?? null;
}

export async function listAgentPmoProductionReadinessGates(workspaceId: string): Promise<AgentPmoProductionReadinessGateRecord[]> {
  return [...productionReadinessGateStore.values()].filter((r) => r.workspaceId === workspaceId);
}

export async function updateAgentPmoProductionReadinessGateStatus(
  id: string,
  status: AgentPmoProductionReadinessGateStatus,
  extra?: Partial<AgentPmoProductionReadinessGateRecord>,
): Promise<AgentPmoProductionReadinessGateRecord | null> {
  const r = productionReadinessGateStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  productionReadinessGateStore.set(id, updated);
  return updated;
}

export async function recordAgentPmoProductionReadinessDecision(
  data: Omit<AgentPmoProductionReadinessDecisionRecord, "id" | "createdAt">,
): Promise<AgentPmoProductionReadinessDecisionRecord> {
  const record: AgentPmoProductionReadinessDecisionRecord = { ...data, id: randomUUID(), createdAt: now() };
  productionReadinessDecisionStore.push(record);
  return record;
}

export async function listAgentPmoProductionReadinessDecisions(workspaceId: string, gateId?: string): Promise<AgentPmoProductionReadinessDecisionRecord[]> {
  return productionReadinessDecisionStore.filter((r) => r.workspaceId === workspaceId && (!gateId || r.gateId === gateId));
}

// ─── Hardening Blockers ───────────────────────────────────────────────────────

export async function recordAgentPmoRuntimeHardeningBlocker(
  data: Omit<AgentPmoRuntimeHardeningBlockerRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoRuntimeHardeningBlockerRecord> {
  const record: AgentPmoRuntimeHardeningBlockerRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  hardeningBlockerStore.set(record.id, record);
  return record;
}

export async function listAgentPmoRuntimeHardeningBlockers(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRuntimeHardeningBlockerRecord[]> {
  return [...hardeningBlockerStore.values()].filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

export async function updateAgentPmoRuntimeHardeningBlockerStatus(
  id: string,
  status: AgentPmoHardeningBlockerStatus,
): Promise<AgentPmoRuntimeHardeningBlockerRecord | null> {
  const r = hardeningBlockerStore.get(id);
  if (!r) return null;
  const updated = { ...r, status, updatedAt: now() };
  hardeningBlockerStore.set(id, updated);
  return updated;
}

// ─── Remediation Items ────────────────────────────────────────────────────────

export async function recordAgentPmoRuntimeRemediationItem(
  data: Omit<AgentPmoRuntimeRemediationItemRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoRuntimeRemediationItemRecord> {
  const record: AgentPmoRuntimeRemediationItemRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  remediationItemStore.set(record.id, record);
  return record;
}

export async function listAgentPmoRuntimeRemediationItems(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRuntimeRemediationItemRecord[]> {
  return [...remediationItemStore.values()].filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

export async function updateAgentPmoRuntimeRemediationItemStatus(
  id: string,
  status: AgentPmoRemediationItemStatus,
): Promise<AgentPmoRuntimeRemediationItemRecord | null> {
  const r = remediationItemStore.get(id);
  if (!r) return null;
  const updated = { ...r, status, updatedAt: now() };
  remediationItemStore.set(id, updated);
  return updated;
}

// ─── Hardening Exports ────────────────────────────────────────────────────────

export async function createAgentPmoRuntimeHardeningExport(
  data: Omit<AgentPmoRuntimeHardeningExportRecord, "id" | "createdAt">,
): Promise<AgentPmoRuntimeHardeningExportRecord> {
  const record: AgentPmoRuntimeHardeningExportRecord = { ...data, id: randomUUID(), createdAt: now() };
  hardeningExportStore.set(record.id, record);
  return record;
}

export async function getAgentPmoRuntimeHardeningExportById(id: string): Promise<AgentPmoRuntimeHardeningExportRecord | null> {
  return hardeningExportStore.get(id) ?? null;
}

export async function listAgentPmoRuntimeHardeningExports(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRuntimeHardeningExportRecord[]> {
  return [...hardeningExportStore.values()].filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Hardening Events ─────────────────────────────────────────────────────────

export async function recordAgentPmoRuntimeHardeningEvent(
  data: Omit<AgentPmoRuntimeHardeningEventRecord, "id" | "createdAt">,
): Promise<AgentPmoRuntimeHardeningEventRecord> {
  const record: AgentPmoRuntimeHardeningEventRecord = { ...data, id: randomUUID(), createdAt: now() };
  hardeningEventStore.push(record);
  return record;
}

export async function listAgentPmoRuntimeHardeningEvents(workspaceId: string, hardeningRunId?: string): Promise<AgentPmoRuntimeHardeningEventRecord[]> {
  return hardeningEventStore.filter((r) => r.workspaceId === workspaceId && (!hardeningRunId || r.hardeningRunId === hardeningRunId));
}

// ─── Test Helper ──────────────────────────────────────────────────────────────

export function _clearRuntimeHardeningStores(): void {
  hardeningRunStore.clear();
  layerAuditStore.length = 0;
  routeContractAuditStore.length = 0;
  databaseContractAuditStore.length = 0;
  rlsPolicyAuditStore.length = 0;
  workspaceIsolationCheckStore.length = 0;
  observabilityCoverageCheckStore.length = 0;
  exportSafetyCheckStore.length = 0;
  idempotencyCheckStore.length = 0;
  errorHandlingCheckStore.length = 0;
  uiDashboardCheckStore.length = 0;
  ciSmokeCheckStore.length = 0;
  productionReadinessGateStore.clear();
  productionReadinessDecisionStore.length = 0;
  hardeningBlockerStore.clear();
  remediationItemStore.clear();
  hardeningExportStore.clear();
  hardeningEventStore.length = 0;
}
