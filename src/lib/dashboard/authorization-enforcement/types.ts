import type {
  DashboardAuthorizationActor,
  DashboardAuthorizationCapability,
  DashboardAuthorizationDecision,
} from '../role-authorization/index'
import type { DashboardTaskLifecycleRecord } from '../task-lifecycle/index'
import type { DashboardApprovalQueueCard } from '../approval-queue-ui/index'
import type { DashboardApprovalMutationRequest } from '../approval-mutations/index'

export type DashboardEnforcementDecisionStatus =
  | 'allowed'
  | 'unauthenticated'
  | 'unauthorized'
  | 'scope_conflict'
  | 'invalid_context'
  | 'not_found'

export type DashboardEnforcementResourceType =
  | 'approval_mutation'
  | 'approval_queue_card'
  | 'task_lifecycle'
  | 'live_execution'
  | 'manual_push'
  | 'sensitive_read'
  | 'dashboard_read'
  | 'audit_trail'

export interface DashboardScopeContext {
  tenantId?: string
  workspaceId?: string
  resourceTenantId?: string
  resourceWorkspaceId?: string
}

export interface DashboardAuthorizationEnforcementRequest {
  actor?: DashboardAuthorizationActor
  resourceType: DashboardEnforcementResourceType
  requiredCapabilities: DashboardAuthorizationCapability[]
  scope?: DashboardScopeContext
  lifecycle?: DashboardTaskLifecycleRecord
  card?: DashboardApprovalQueueCard
  mutation?: DashboardApprovalMutationRequest
}

export interface DashboardAuthorizationEnforcementResult {
  status: DashboardEnforcementDecisionStatus
  allowed: boolean
  resourceType: DashboardEnforcementResourceType
  decisions: DashboardAuthorizationDecision[]
  errors: string[]
  warnings: string[]
  httpStatus: number
}

export interface DashboardAuthorizationApiError {
  ok: false
  status: DashboardEnforcementDecisionStatus
  error: string
  errors: string[]
  warnings: string[]
}

export interface DashboardActorResolverInput {
  request?: Request
  headers?: Headers
  session?: Record<string, unknown>
  user?: Record<string, unknown>
}

export type DashboardActorResolver = (input: DashboardActorResolverInput) => Promise<DashboardAuthorizationActor | null>
