import type { DashboardApprovalMutationDecision, DashboardApprovalMutationValidationResult } from './types'

const MUTATION_DECISIONS: DashboardApprovalMutationDecision[] = ['approve', 'reject', 'request_changes', 'defer']

export function validateApprovalMutationRequest(input: unknown): DashboardApprovalMutationValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: ['requestId is required.', 'envelopeId is required.', 'decision is invalid.', 'actor is required.'],
      warnings,
    }
  }

  const mutation = input as Record<string, unknown>

  if (typeof mutation.requestId !== 'string' || mutation.requestId.trim().length === 0) errors.push('requestId is required.')
  if (typeof mutation.envelopeId !== 'string' || mutation.envelopeId.trim().length === 0) errors.push('envelopeId is required.')
  if (!MUTATION_DECISIONS.includes(mutation.decision as DashboardApprovalMutationDecision)) errors.push('decision is invalid.')

  if (!mutation.actor || typeof mutation.actor !== 'object') {
    errors.push('actor is required.')
  } else {
    const actor = mutation.actor as Record<string, unknown>
    if (typeof actor.id !== 'string' || actor.id.trim().length === 0) errors.push('actor.id is required.')
    if (!Array.isArray(actor.roles) || actor.roles.length === 0) errors.push('actor.roles are required.')
  }

  if (mutation.decidedAt !== undefined) {
    const date = new Date(mutation.decidedAt as string)
    if (typeof mutation.decidedAt !== 'string' || Number.isNaN(date.getTime())) errors.push('decidedAt must be a valid ISO date.')
  }

  if (mutation.lifecycleId !== undefined && typeof mutation.lifecycleId !== 'string') errors.push('lifecycleId must be a string.')
  if (mutation.comment !== undefined && typeof mutation.comment !== 'string') errors.push('comment must be a string.')

  if ((mutation.decision === 'reject' || mutation.decision === 'request_changes' || mutation.decision === 'defer') && !mutation.comment) {
    warnings.push(`comment missing for ${mutation.decision}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}
