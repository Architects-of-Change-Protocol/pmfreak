import type { DashboardTaskLifecycleEvent, DashboardTaskLifecycleEventType, DashboardTaskLifecycleTransition } from './types'

export function buildLifecycleEvent(input: {
  lifecycleId: string
  eventType: DashboardTaskLifecycleEventType
  message: string
  actor?: string
  metadata?: Record<string, unknown>
  now: string
}): DashboardTaskLifecycleEvent {
  return {
    id: `lifecycle-event:${input.lifecycleId}:${input.eventType}:${Date.parse(input.now)}`,
    lifecycleId: input.lifecycleId,
    eventType: input.eventType,
    occurredAt: input.now,
    actor: input.actor,
    message: input.message,
    metadata: { ...(input.metadata ?? {}) },
  }
}

export function buildEventFromTransition(input: { transition: DashboardTaskLifecycleTransition; now: string }): DashboardTaskLifecycleEvent {
  return buildLifecycleEvent({
    lifecycleId: input.transition.lifecycleId,
    eventType: input.transition.eventType,
    message: input.transition.reason,
    actor: input.transition.actor,
    metadata: { fromStatus: input.transition.fromStatus, toStatus: input.transition.toStatus },
    now: input.now,
  })
}
