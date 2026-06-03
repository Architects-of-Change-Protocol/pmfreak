import { applyDashboardApprovalDecision, deriveDashboardEnvelopeExecutionGate } from '../approval-workflow/index'
import { mergeApprovalIntoLifecycle } from '../task-lifecycle/index'
import type { DashboardTaskLifecycleEvent, DashboardTaskLifecycleRecord } from '../task-lifecycle/index'
import type { DashboardApprovalDecision, DashboardApprovalRequest } from '../approval-workflow/index'
import { buildApprovalDecisionFromMutation } from './approval-decision-builder'
import type { DashboardApprovalMutationRequest } from './types'

export function applyApprovalMutation(input: {
  mutation: DashboardApprovalMutationRequest
  approvalRequest: DashboardApprovalRequest
  lifecycle: DashboardTaskLifecycleRecord
  now: string
}): {
  updatedApprovalRequest: DashboardApprovalRequest
  updatedLifecycle: DashboardTaskLifecycleRecord
  decision: DashboardApprovalDecision
  event: DashboardTaskLifecycleEvent
} {
  const decision = buildApprovalDecisionFromMutation({ mutation: input.mutation, now: input.now })
  const updatedApprovalRequest = applyDashboardApprovalDecision({ request: input.approvalRequest, decision, now: input.now })
  let updatedLifecycle = mergeApprovalIntoLifecycle({
    lifecycle: input.lifecycle,
    approvalRequest: updatedApprovalRequest,
    approvalDecisions: [...input.lifecycle.approvalDecisions, decision],
    now: input.now,
  })

  const gate = deriveDashboardEnvelopeExecutionGate(updatedApprovalRequest)
  if (updatedApprovalRequest.status === 'rejected') updatedLifecycle = { ...updatedLifecycle, status: 'rejected', updatedAt: input.now }
  else if (updatedApprovalRequest.status === 'changes_requested') updatedLifecycle = { ...updatedLifecycle, status: 'changes_requested', updatedAt: input.now }
  else if (gate.executable) updatedLifecycle = { ...updatedLifecycle, status: 'ready_for_execution', updatedAt: input.now }

  const eventType =
    input.mutation.decision === 'approve'
      ? 'approval_approved'
      : input.mutation.decision === 'reject'
        ? 'approval_rejected'
        : 'approval_changes_requested'

  const event: DashboardTaskLifecycleEvent = {
    id: `event:${updatedLifecycle.id}:${input.now}:approval_mutation`,
    lifecycleId: updatedLifecycle.id,
    eventType,
    occurredAt: input.now,
    actor: input.mutation.actor.id,
    message: `Approval decision applied: ${input.mutation.decision}.`,
    metadata: {
      requestId: input.mutation.requestId,
      envelopeId: input.mutation.envelopeId,
      lifecycleId: updatedLifecycle.id,
      decision: input.mutation.decision,
      actorId: input.mutation.actor.id,
      approvalStatus: updatedApprovalRequest.status,
      lifecycleStatus: updatedLifecycle.status,
    },
  }

  return { updatedApprovalRequest, updatedLifecycle, decision, event }
}
