import type { DashboardAction, DashboardActionCenterInput, DashboardActionType } from './types'
import type { DashboardViewModel } from '../consumption/types'

const mk = (id: string, type: DashboardActionType, title: string, description: string, source: string, sourceId?: string, signal: Record<string, unknown> = {}, affectedProjects: string[] = [], rationale = '', evidenceRequired: string[] = []): DashboardAction => ({
  id, type, title, description, priority: 'medium', status: 'proposed', ownerLane: 'project_manager', executionLane: 'portfolio_governance', affectedProjects, source, sourceId, sla: { responseDueHours: 24, resolutionDueHours: 120, cadence: 'Twice weekly follow-up' }, escalationRoute: { required: false }, evidenceRequired, rationale, signal,
})

export function generateDashboardActions(input: DashboardActionCenterInput): DashboardAction[] {
  const actions: DashboardAction[] = []
  const vm = input.dashboardViewModel as DashboardViewModel | undefined
  const pmoReport = input.pmoInterventionReport as { interventions?: Record<string, unknown>[] } | undefined
  const cacheResult = input.cacheRefreshResult as { refreshPlan?: { actions?: Record<string, unknown>[] }; metadata?: { warnings?: string[] } } | undefined
  const hydrationResult = input.hydrationResult as { recoveryPlan?: { actions?: string[] }; riskLevel?: string } | undefined
  type Row = Record<string, unknown>
  for (const r of (vm?.sections?.topRisksTable ?? []) as Row[]) if (['high','critical'].includes(String(r.severity).toLowerCase())) actions.push(mk(`risk-${r.id}`,'resolve_portfolio_risk',String(r.title ?? ''),String(r.rationale ?? `Resolve portfolio risk: ${r.title}`),'dashboard_risk',String(r.id ?? ''),{severity:r.severity,hasCriticalAttention:vm?.hasCriticalAttention},(r.affectedProjects as string[] | undefined) ?? [],String(r.rationale ?? ''),['Risk rationale','Affected project list','Proposed mitigation','Owner confirmation']))
  for (const i of (vm?.sections?.interventionsQueue ?? []) as Row[]) actions.push(mk(`queue-${i.id}`,'execute_pmo_intervention',String(i.title ?? ''),`Execute intervention cadence: ${i.cadence}`,'dashboard_intervention_queue',String(i.id ?? ''),{urgency:i.urgency,ownerLane:i.ownerLane,hasCriticalAttention:vm?.hasCriticalAttention},(i.affectedProjects as string[] | undefined) ?? [],String(i.title ?? ''),['Intervention description','Owner lane confirmation','Cadence confirmation','Completion evidence']))
  for (const i of (pmoReport?.interventions ?? []) as Row[]) actions.push(mk(`pmo-${i.id}`,'execute_pmo_intervention',String(i.title ?? ''),String(i.rationale ?? `Execute PMO intervention ${i.type}`),'pmo_intervention_report',String(i.id ?? ''),{urgency:i.urgency,ownerLane:i.ownerLane},(i.affectedProjects as string[] | undefined) ?? [],String(i.rationale ?? ''),((i.requiredEvidence as string[] | undefined)?.length ? (i.requiredEvidence as string[]) : ['Intervention description','Owner lane confirmation','Cadence confirmation','Completion evidence'])))
  for (const d of (vm?.sections?.decisionsWidget ?? []) as Row[]) if (['escalate','reject','approve_with_conditions'].includes(String(d.recommendation).toLowerCase())) actions.push(mk(`decision-${d.id}`,'review_executive_decision',String(d.title ?? ''),`Review executive recommendation: ${d.recommendation}`,'dashboard_decision',String(d.id ?? ''),{severity:d.severity,recommendation:d.recommendation},[],String(d.title ?? ''),['Decision rationale','Confidence score','Impact summary','Executive approval record']))
  for (const a of (vm?.sections?.alertPanel ?? []) as Row[]) if (['high','critical'].includes(String(a.severity).toLowerCase())) actions.push(mk(`alert-${a.id}`,'escalate_dashboard_alert',String(a.title ?? ''),String(a.description ?? ''),'dashboard_alert',String(a.id ?? ''),{severity:a.severity},[],String(a.description ?? ''),['Alert description','Severity confirmation','Resolution owner','Closeout note']))
  for (const c of (cacheResult?.refreshPlan?.actions ?? []) as Row[]) actions.push(mk(`refresh-${c.id}`,'refresh_dashboard_source',String(c.title ?? ''),String(c.description ?? ''),'cache_refresh_plan',String(c.id ?? ''),{refreshPriority:c.priority,severity:c.priority},[],String(c.reason ?? ''),['Refresh reason','Source kind','Refresh completion timestamp','Rehydration confirmation']))
  for (const [idx,h] of (hydrationResult?.recoveryPlan?.actions ?? []).entries()) actions.push(mk(`hydration-${idx}`,'recover_dashboard_hydration',`Recover hydration: ${h}`,h,'hydration_recovery_plan',String(idx),{hydrationRisk:hydrationResult?.riskLevel,severity:hydrationResult?.riskLevel},[],h,['Recovery action completed','Source regenerated','Fallback mode cleared','Hydration risk reduced']))

  const warn1 = vm?.warnings ?? []; if (warn1.length <= 10) warn1.forEach((w: string, i: number)=>actions.push(mk(`warn-d-${i}`,'acknowledge_warning',`Acknowledge dashboard warning ${i+1}`,w,'dashboard_warning',String(i),{severity:'warning',warningKind:'operational'},[],w,['Warning acknowledgement','Owner acknowledgement note'])))
  const warn2 = cacheResult?.metadata?.warnings ?? []; if (warn2.length <= 10) warn2.forEach((w: string, i: number)=>actions.push(mk(`warn-c-${i}`,'acknowledge_warning',`Acknowledge cache warning ${i+1}`,w,'cache_metadata_warning',String(i),{severity:'warning',warningKind:'operational'},[],w,['Warning acknowledgement','Owner acknowledgement note'])))

  const extra: DashboardAction[] = []
  for (const a of actions) {
    const text = `${a.title} ${a.rationale}`.toLowerCase()
    if (text.includes('missing input') || text.includes('client input')) extra.push(mk(`${a.id}-missing`,'request_missing_input',`Request missing input for: ${a.title}`,a.description,a.source,a.sourceId,{...a.signal,severity:a.signal?.severity ?? 'high'},a.affectedProjects,a.rationale,['Client input request record','Expected input checklist']))
    if (text.includes('dependency') || text.includes('unblock')) extra.push(mk(`${a.id}-dep`,'resolve_dependency',`Resolve dependency for: ${a.title}`,a.description,a.source,a.sourceId,{...a.signal,severity:a.signal?.severity ?? 'high'},a.affectedProjects,a.rationale,['Dependency map','Unblocker owner confirmation']))
    if (text.includes('financial') || text.includes('budget') || text.includes('po') || text.includes('invoice') || text.includes('payment')) extra.push(mk(`${a.id}-fin`,'review_financial_exposure',`Review financial exposure: ${a.title}`,a.description,a.source,a.sourceId,{...a.signal,severity:a.signal?.severity ?? 'high'},a.affectedProjects,a.rationale,['Budget impact analysis','Finance owner confirmation']))
  }
  const dedup = new Map<string, DashboardAction>()
  for (const a of [...actions, ...extra]) dedup.set(`${a.type}::${a.source}::${a.sourceId ?? ''}::${a.title}`, a)
  return [...dedup.values()]
}
