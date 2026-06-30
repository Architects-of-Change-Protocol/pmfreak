// ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Registry ───────────
// Pure in-memory store. Does not use Supabase.
// All records are append-only.
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create production tenants, production customers, or mutate external systems.

import { randomUUID } from "node:crypto";
import type {
  BetaReadinessPlanRecord,
  BetaReadinessPlanStatus,
  BetaWorkspaceReadinessRecord,
  DemoDataBundleRecord,
  DemoDataBundleStatus,
  DemoProjectScenarioRecord,
  DemoGovernanceScenarioRecord,
  DemoHandoffScenarioRecord,
  BetaOnboardingChecklistRecord,
  BetaOnboardingChecklistItemRecord,
  BetaOnboardingChecklistItemStatus,
  BetaUserReadinessRecord,
  BetaInvitationReadinessRecord,
  BetaAdminReadinessRecord,
  TenantReadinessValidationRecord,
  BetaReadinessGateRecord,
  BetaReadinessGateStatus,
  BetaReadinessDecisionRecord,
  BetaReadinessBlockerRecord,
  BetaReadinessBlockerStatus,
  BetaReadinessRemediationItemRecord,
  BetaReadinessRemediationItemStatus,
  BetaReadinessExportRecord,
  BetaReadinessEventRecord,
  BetaReadinessEventType,
} from "./agent-pmo-beta-readiness-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const planStore = new Map<string, BetaReadinessPlanRecord>();
const workspaceReadinessStore: BetaWorkspaceReadinessRecord[] = [];
const demoBundleStore = new Map<string, DemoDataBundleRecord>();
const demoProjectScenarioStore: DemoProjectScenarioRecord[] = [];
const demoGovernanceScenarioStore: DemoGovernanceScenarioRecord[] = [];
const demoHandoffScenarioStore: DemoHandoffScenarioRecord[] = [];
const checklistStore = new Map<string, BetaOnboardingChecklistRecord>();
const checklistItemStore: BetaOnboardingChecklistItemRecord[] = [];
const userReadinessStore: BetaUserReadinessRecord[] = [];
const invitationReadinessStore: BetaInvitationReadinessRecord[] = [];
const adminReadinessStore: BetaAdminReadinessRecord[] = [];
const tenantValidationStore: TenantReadinessValidationRecord[] = [];
const gateStore = new Map<string, BetaReadinessGateRecord>();
const decisionStore: BetaReadinessDecisionRecord[] = [];
const blockerStore = new Map<string, BetaReadinessBlockerRecord>();
const remediationItemStore = new Map<string, BetaReadinessRemediationItemRecord>();
const exportStore = new Map<string, BetaReadinessExportRecord>();
const eventStore: BetaReadinessEventRecord[] = [];

const now = () => new Date().toISOString();

// ─── Beta Readiness Plans ─────────────────────────────────────────────────────

export async function createBetaReadinessPlan(
  data: Omit<BetaReadinessPlanRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaReadinessPlanRecord> {
  const record: BetaReadinessPlanRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  planStore.set(record.id, record);
  return record;
}

export async function getBetaReadinessPlanById(id: string): Promise<BetaReadinessPlanRecord | null> {
  return planStore.get(id) ?? null;
}

export async function listBetaReadinessPlans(workspaceId: string): Promise<BetaReadinessPlanRecord[]> {
  return [...planStore.values()].filter((r) => r.workspaceId === workspaceId);
}

export async function updateBetaReadinessPlanStatus(
  id: string,
  status: BetaReadinessPlanStatus,
  extra?: Partial<BetaReadinessPlanRecord>,
): Promise<BetaReadinessPlanRecord | null> {
  const r = planStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  planStore.set(id, updated);
  return updated;
}

// ─── Workspace Readiness ──────────────────────────────────────────────────────

export async function recordBetaWorkspaceReadiness(
  data: Omit<BetaWorkspaceReadinessRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaWorkspaceReadinessRecord> {
  const record: BetaWorkspaceReadinessRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  workspaceReadinessStore.push(record);
  return record;
}

export async function listBetaWorkspaceReadiness(workspaceId: string, planId?: string): Promise<BetaWorkspaceReadinessRecord[]> {
  return workspaceReadinessStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Demo Data Bundles ────────────────────────────────────────────────────────

export async function createDemoDataBundle(
  data: Omit<DemoDataBundleRecord, "id" | "createdAt" | "updatedAt">,
): Promise<DemoDataBundleRecord> {
  const record: DemoDataBundleRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  demoBundleStore.set(record.id, record);
  return record;
}

export async function getDemoDataBundleById(id: string): Promise<DemoDataBundleRecord | null> {
  return demoBundleStore.get(id) ?? null;
}

export async function listDemoDataBundles(workspaceId: string, planId?: string): Promise<DemoDataBundleRecord[]> {
  return [...demoBundleStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

export async function updateDemoDataBundleStatus(
  id: string,
  status: DemoDataBundleStatus,
  extra?: Partial<DemoDataBundleRecord>,
): Promise<DemoDataBundleRecord | null> {
  const r = demoBundleStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  demoBundleStore.set(id, updated);
  return updated;
}

// ─── Demo Project Scenarios ───────────────────────────────────────────────────

export async function createDemoProjectScenario(
  data: Omit<DemoProjectScenarioRecord, "id" | "createdAt" | "updatedAt">,
): Promise<DemoProjectScenarioRecord> {
  const record: DemoProjectScenarioRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  demoProjectScenarioStore.push(record);
  return record;
}

export async function listDemoProjectScenarios(workspaceId: string, bundleId?: string): Promise<DemoProjectScenarioRecord[]> {
  return demoProjectScenarioStore.filter((r) => r.workspaceId === workspaceId && (!bundleId || r.bundleId === bundleId));
}

// ─── Demo Governance Scenarios ────────────────────────────────────────────────

export async function createDemoGovernanceScenario(
  data: Omit<DemoGovernanceScenarioRecord, "id" | "createdAt" | "updatedAt">,
): Promise<DemoGovernanceScenarioRecord> {
  const record: DemoGovernanceScenarioRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  demoGovernanceScenarioStore.push(record);
  return record;
}

export async function listDemoGovernanceScenarios(workspaceId: string, bundleId?: string): Promise<DemoGovernanceScenarioRecord[]> {
  return demoGovernanceScenarioStore.filter((r) => r.workspaceId === workspaceId && (!bundleId || r.bundleId === bundleId));
}

// ─── Demo Handoff Scenarios ───────────────────────────────────────────────────

export async function createDemoHandoffScenario(
  data: Omit<DemoHandoffScenarioRecord, "id" | "createdAt" | "updatedAt">,
): Promise<DemoHandoffScenarioRecord> {
  const record: DemoHandoffScenarioRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  demoHandoffScenarioStore.push(record);
  return record;
}

export async function listDemoHandoffScenarios(workspaceId: string, bundleId?: string): Promise<DemoHandoffScenarioRecord[]> {
  return demoHandoffScenarioStore.filter((r) => r.workspaceId === workspaceId && (!bundleId || r.bundleId === bundleId));
}

// ─── Beta Onboarding Checklists ───────────────────────────────────────────────

export async function createBetaOnboardingChecklist(
  data: Omit<BetaOnboardingChecklistRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaOnboardingChecklistRecord> {
  const record: BetaOnboardingChecklistRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  checklistStore.set(record.id, record);
  return record;
}

export async function getBetaOnboardingChecklistById(id: string): Promise<BetaOnboardingChecklistRecord | null> {
  return checklistStore.get(id) ?? null;
}

export async function listBetaOnboardingChecklists(workspaceId: string, planId?: string): Promise<BetaOnboardingChecklistRecord[]> {
  return [...checklistStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

export async function updateBetaOnboardingChecklistCounts(
  id: string,
  extra: Partial<BetaOnboardingChecklistRecord>,
): Promise<BetaOnboardingChecklistRecord | null> {
  const r = checklistStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, updatedAt: now() };
  checklistStore.set(id, updated);
  return updated;
}

// ─── Checklist Items ──────────────────────────────────────────────────────────

export async function recordBetaOnboardingChecklistItem(
  data: Omit<BetaOnboardingChecklistItemRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaOnboardingChecklistItemRecord> {
  const record: BetaOnboardingChecklistItemRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  checklistItemStore.push(record);
  return record;
}

export async function listBetaOnboardingChecklistItems(workspaceId: string, checklistId?: string): Promise<BetaOnboardingChecklistItemRecord[]> {
  return checklistItemStore.filter((r) => r.workspaceId === workspaceId && (!checklistId || r.checklistId === checklistId));
}

export async function updateBetaOnboardingChecklistItemStatus(
  id: string,
  status: BetaOnboardingChecklistItemStatus,
): Promise<BetaOnboardingChecklistItemRecord | null> {
  const idx = checklistItemStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...checklistItemStore[idx], status, updatedAt: now() };
  checklistItemStore[idx] = updated;
  return updated;
}

// ─── Beta User Readiness ──────────────────────────────────────────────────────

export async function recordBetaUserReadiness(
  data: Omit<BetaUserReadinessRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaUserReadinessRecord> {
  const record: BetaUserReadinessRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  userReadinessStore.push(record);
  return record;
}

export async function listBetaUserReadiness(workspaceId: string, planId?: string): Promise<BetaUserReadinessRecord[]> {
  return userReadinessStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Beta Invitation Readiness ────────────────────────────────────────────────

export async function recordBetaInvitationReadiness(
  data: Omit<BetaInvitationReadinessRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaInvitationReadinessRecord> {
  const record: BetaInvitationReadinessRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  invitationReadinessStore.push(record);
  return record;
}

export async function listBetaInvitationReadiness(workspaceId: string, planId?: string): Promise<BetaInvitationReadinessRecord[]> {
  return invitationReadinessStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Beta Admin Readiness ─────────────────────────────────────────────────────

export async function recordBetaAdminReadiness(
  data: Omit<BetaAdminReadinessRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaAdminReadinessRecord> {
  const record: BetaAdminReadinessRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  adminReadinessStore.push(record);
  return record;
}

export async function listBetaAdminReadiness(workspaceId: string, planId?: string): Promise<BetaAdminReadinessRecord[]> {
  return adminReadinessStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Tenant Readiness Validations ─────────────────────────────────────────────

export async function recordTenantReadinessValidation(
  data: Omit<TenantReadinessValidationRecord, "id" | "createdAt">,
): Promise<TenantReadinessValidationRecord> {
  const record: TenantReadinessValidationRecord = { ...data, id: randomUUID(), createdAt: now() };
  tenantValidationStore.push(record);
  return record;
}

export async function listTenantReadinessValidations(workspaceId: string, planId?: string): Promise<TenantReadinessValidationRecord[]> {
  return tenantValidationStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Beta Readiness Gates ─────────────────────────────────────────────────────

export async function createBetaReadinessGate(
  data: Omit<BetaReadinessGateRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaReadinessGateRecord> {
  const record: BetaReadinessGateRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  gateStore.set(record.id, record);
  return record;
}

export async function getBetaReadinessGateById(id: string): Promise<BetaReadinessGateRecord | null> {
  return gateStore.get(id) ?? null;
}

export async function listBetaReadinessGates(workspaceId: string, planId?: string): Promise<BetaReadinessGateRecord[]> {
  return [...gateStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

export async function updateBetaReadinessGateStatus(
  id: string,
  status: BetaReadinessGateStatus,
  extra?: Partial<BetaReadinessGateRecord>,
): Promise<BetaReadinessGateRecord | null> {
  const r = gateStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  gateStore.set(id, updated);
  return updated;
}

// ─── Beta Readiness Decisions ─────────────────────────────────────────────────

export async function recordBetaReadinessDecision(
  data: Omit<BetaReadinessDecisionRecord, "id" | "createdAt">,
): Promise<BetaReadinessDecisionRecord> {
  const record: BetaReadinessDecisionRecord = { ...data, id: randomUUID(), createdAt: now() };
  decisionStore.push(record);
  return record;
}

export async function listBetaReadinessDecisions(workspaceId: string, gateId?: string): Promise<BetaReadinessDecisionRecord[]> {
  return decisionStore.filter((r) => r.workspaceId === workspaceId && (!gateId || r.gateId === gateId));
}

// ─── Beta Readiness Blockers ──────────────────────────────────────────────────

export async function recordBetaReadinessBlocker(
  data: Omit<BetaReadinessBlockerRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaReadinessBlockerRecord> {
  const record: BetaReadinessBlockerRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  blockerStore.set(record.id, record);
  return record;
}

export async function getBetaReadinessBlockerById(id: string): Promise<BetaReadinessBlockerRecord | null> {
  return blockerStore.get(id) ?? null;
}

export async function listBetaReadinessBlockers(workspaceId: string, planId?: string): Promise<BetaReadinessBlockerRecord[]> {
  return [...blockerStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

export async function updateBetaReadinessBlockerStatus(
  id: string,
  status: BetaReadinessBlockerStatus,
  extra?: Partial<BetaReadinessBlockerRecord>,
): Promise<BetaReadinessBlockerRecord | null> {
  const r = blockerStore.get(id);
  if (!r) return null;
  const updated = { ...r, ...extra, status, updatedAt: now() };
  blockerStore.set(id, updated);
  return updated;
}

// ─── Beta Readiness Remediation Items ────────────────────────────────────────

export async function recordBetaReadinessRemediationItem(
  data: Omit<BetaReadinessRemediationItemRecord, "id" | "createdAt" | "updatedAt">,
): Promise<BetaReadinessRemediationItemRecord> {
  const record: BetaReadinessRemediationItemRecord = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
  remediationItemStore.set(record.id, record);
  return record;
}

export async function listBetaReadinessRemediationItems(workspaceId: string, planId?: string): Promise<BetaReadinessRemediationItemRecord[]> {
  return [...remediationItemStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

export async function updateBetaReadinessRemediationItemStatus(
  id: string,
  status: BetaReadinessRemediationItemStatus,
): Promise<BetaReadinessRemediationItemRecord | null> {
  const r = remediationItemStore.get(id);
  if (!r) return null;
  const updated = { ...r, status, updatedAt: now() };
  remediationItemStore.set(id, updated);
  return updated;
}

// ─── Beta Readiness Exports ───────────────────────────────────────────────────

export async function createBetaReadinessExport(
  data: Omit<BetaReadinessExportRecord, "id" | "createdAt">,
): Promise<BetaReadinessExportRecord> {
  const record: BetaReadinessExportRecord = { ...data, id: randomUUID(), createdAt: now() };
  exportStore.set(record.id, record);
  return record;
}

export async function getBetaReadinessExportById(id: string): Promise<BetaReadinessExportRecord | null> {
  return exportStore.get(id) ?? null;
}

export async function listBetaReadinessExports(workspaceId: string, planId?: string): Promise<BetaReadinessExportRecord[]> {
  return [...exportStore.values()].filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Beta Readiness Events ────────────────────────────────────────────────────

export async function recordBetaReadinessEvent(
  workspaceId: string,
  eventType: BetaReadinessEventType,
  extra?: { planId?: string | null; message?: string | null; actorId?: string | null; safeEventPayloadJson?: Record<string, unknown> },
): Promise<BetaReadinessEventRecord> {
  const record: BetaReadinessEventRecord = {
    id: randomUUID(),
    workspaceId,
    planId: extra?.planId ?? null,
    eventType,
    message: extra?.message ?? null,
    safeEventPayloadJson: extra?.safeEventPayloadJson ?? {},
    actorId: extra?.actorId ?? null,
    createdAt: now(),
  };
  eventStore.push(record);
  return record;
}

export async function listBetaReadinessEvents(workspaceId: string, planId?: string): Promise<BetaReadinessEventRecord[]> {
  return eventStore.filter((r) => r.workspaceId === workspaceId && (!planId || r.planId === planId));
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

export function _clearBetaReadinessStores(): void {
  planStore.clear();
  workspaceReadinessStore.length = 0;
  demoBundleStore.clear();
  demoProjectScenarioStore.length = 0;
  demoGovernanceScenarioStore.length = 0;
  demoHandoffScenarioStore.length = 0;
  checklistStore.clear();
  checklistItemStore.length = 0;
  userReadinessStore.length = 0;
  invitationReadinessStore.length = 0;
  adminReadinessStore.length = 0;
  tenantValidationStore.length = 0;
  gateStore.clear();
  decisionStore.length = 0;
  blockerStore.clear();
  remediationItemStore.clear();
  exportStore.clear();
  eventStore.length = 0;
}
