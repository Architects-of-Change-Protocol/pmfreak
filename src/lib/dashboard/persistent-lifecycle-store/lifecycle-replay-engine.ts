import type { DashboardLifecycleReplayResult, DashboardTaskLifecycleEvent, DashboardTaskLifecycleRecord } from './types'

export function replayLifecycleEventStream(input: { lifecycles: DashboardTaskLifecycleRecord[]; events: DashboardTaskLifecycleEvent[] }): DashboardLifecycleReplayResult {
  const warnings: string[] = []
  const grouped = new Map<string, DashboardTaskLifecycleEvent[]>()
  for (const event of input.events) {
    const items = grouped.get(event.lifecycleId) ?? []
    items.push(event)
    grouped.set(event.lifecycleId, items)
  }
  const reconstructed = input.lifecycles.map((lifecycle) => {
    const next = { ...lifecycle }
    const stream = (grouped.get(lifecycle.id) ?? []).slice().sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id.localeCompare(b.id),
    )
    for (const event of stream) {
      if (event.eventType === 'execution_completed') next.status = 'execution_completed'
      else if (event.eventType === 'execution_failed') next.status = 'execution_failed'
      else if (event.eventType === 'retry_scheduled') next.retryCount += 1
      else if (event.eventType === 'approval_approved') next.status = 'approved'
      else if (event.eventType === 'approval_rejected') next.status = 'rejected'
      else if (event.eventType === 'approval_requested') next.status = 'approval_pending'
      else warnings.push(`Unknown event type: ${event.eventType}`)
      next.updatedAt = event.occurredAt
    }
    return next
  })
  return { replayed: input.events.length, reconstructed, warnings }
}
