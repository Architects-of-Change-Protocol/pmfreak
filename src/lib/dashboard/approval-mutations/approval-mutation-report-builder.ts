import type { DashboardApprovalDecision, DashboardApprovalRequest } from '../approval-workflow/index'
import type { DashboardTaskLifecycleEvent, DashboardTaskLifecycleRecord } from '../task-lifecycle/index'
import type {
  DashboardApprovalMutationAuthorizationResult,
  DashboardApprovalMutationRequest,
  DashboardApprovalMutationResult,
  DashboardApprovalMutationStatus,
} from './types'

export function buildApprovalMutationResult(input: {
  mutation: DashboardApprovalMutationRequest
  status: DashboardApprovalMutationStatus
  approvalRequest?: DashboardApprovalRequest
  lifecycle?: DashboardTaskLifecycleRecord
  decision?: DashboardApprovalDecision
  event?: DashboardTaskLifecycleEvent
  authorization?: DashboardApprovalMutationAuthorizationResult
  errors?: string[]
  warnings?: string[]
}): DashboardApprovalMutationResult {
  const warnings = [...(input.warnings ?? [])]
  if (input.status === 'accepted' && !input.lifecycle) warnings.push('Lifecycle was not available for mutation persistence.')

  return {
    status: input.status,
    requestId: input.mutation.requestId,
    envelopeId: input.mutation.envelopeId,
    lifecycleId: input.lifecycle?.id ?? input.mutation.lifecycleId,
    approvalStatus: input.approvalRequest?.status,
    lifecycleStatus: input.lifecycle?.status,
    decision: input.decision,
    event: input.event,
    authorization: input.authorization,
    errors: input.errors ?? [],
    warnings,
  }
}
