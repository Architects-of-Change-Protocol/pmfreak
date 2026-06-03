import type { DashboardTaskLifecycleRecord } from './types'
import type { DashboardApprovalDecision } from '../approval-workflow/index'

export interface PersistentLifecycleRecord {
  tenant_id: string
  workspace_id: string | null
  lifecycle_id: string
  envelope_id: string
  action_id: string
  adapter: string
  status: string
  external_task_id: string | null
  retry_count: number
  created_at: string
  updated_at: string
  payload_json: unknown
  approval_request_json: unknown
  approval_decisions_json: DashboardApprovalDecision[]
}

export function mapLifecycleToPersistentRecord(input: {
  tenantId: string
  workspaceId?: string
  lifecycle: DashboardTaskLifecycleRecord
}): PersistentLifecycleRecord {
  const { tenantId, workspaceId, lifecycle } = input
  return {
    tenant_id: tenantId,
    workspace_id: workspaceId ?? null,
    lifecycle_id: lifecycle.id,
    envelope_id: lifecycle.envelopeId,
    action_id: lifecycle.actionId,
    adapter: lifecycle.adapter,
    status: lifecycle.status,
    external_task_id: lifecycle.externalTaskId ?? null,
    retry_count: lifecycle.retryCount,
    created_at: lifecycle.createdAt,
    updated_at: lifecycle.updatedAt,
    payload_json: lifecycle.envelope,
    approval_request_json: lifecycle.approvalRequest ?? null,
    approval_decisions_json: lifecycle.approvalDecisions,
  }
}

export function mapPersistentRecordToLifecycle(record: PersistentLifecycleRecord): DashboardTaskLifecycleRecord {
  return {
    id: record.lifecycle_id,
    envelopeId: record.envelope_id,
    actionId: record.action_id,
    adapter: record.adapter,
    status: record.status as DashboardTaskLifecycleRecord['status'],
    envelope: record.payload_json as unknown as DashboardTaskLifecycleRecord['envelope'],
    approvalRequest: (record.approval_request_json ?? undefined) as unknown as DashboardTaskLifecycleRecord['approvalRequest'],
    approvalDecisions: (record.approval_decisions_json ?? []) as DashboardTaskLifecycleRecord['approvalDecisions'],
    externalTaskId: record.external_task_id ?? undefined,
    retryCount: record.retry_count ?? 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export function buildLifecycleScopeFilter(tenantId: string, workspaceId?: string) {
  return { tenant_id: tenantId, workspace_id: workspaceId ?? null }
}
