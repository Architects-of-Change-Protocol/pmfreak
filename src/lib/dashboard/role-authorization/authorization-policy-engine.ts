import type { DashboardApprovalApproverLane } from '../approval-workflow/index'
import type { DashboardActorRole, DashboardAuthorizationActor, DashboardSensitiveItemType } from './types'

export function isActorInRequiredLane ({ actor, requiredLanes }: { actor: DashboardAuthorizationActor; requiredLanes: DashboardApprovalApproverLane[] }): boolean {
  if (requiredLanes.length === 0) return true
  if (actor.roles.includes('admin')) return true
  if (actor.lanes?.some(lane => requiredLanes.includes(lane))) return true
  if (actor.roles.some(role => requiredLanes.includes(role as DashboardApprovalApproverLane))) return true
  if (actor.roles.includes('pmo_director') && requiredLanes.some(l => ['project_manager', 'technical_lead', 'finance_lead', 'security_owner'].includes(l))) return true
  if (actor.roles.includes('executive_sponsor') && requiredLanes.includes('executive_sponsor')) return true
  return false
}

export function canActorAccessSensitiveType ({ actor, sensitiveType }: { actor: DashboardAuthorizationActor; sensitiveType: DashboardSensitiveItemType }): boolean {
  if (sensitiveType === 'none') return true
  const roles = new Set(actor.roles)
  const allow = (required: string[]) => required.some(role => roles.has(role as DashboardActorRole))
  if (sensitiveType === 'financial') return allow(['finance_lead', 'pmo_director', 'executive_sponsor', 'admin'])
  if (sensitiveType === 'executive') return allow(['executive_sponsor', 'pmo_director', 'admin'])
  if (sensitiveType === 'security') return allow(['security_owner', 'pmo_director', 'admin'])
  if (sensitiveType === 'system') return allow(['system_owner', 'pmo_director', 'admin'])
  if (sensitiveType === 'client') return allow(['project_manager', 'pmo_director', 'executive_sponsor', 'admin'])
  return false
}
