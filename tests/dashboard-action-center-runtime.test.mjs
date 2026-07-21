import test from 'node:test'; import assert from 'node:assert/strict'
import { generateDashboardActions } from '../src/lib/dashboard/action-center/action-generator.ts'
import { assignDashboardActionOwnerLane } from '../src/lib/dashboard/action-center/owner-lane-engine.ts'
import { assignDashboardActionExecutionLane } from '../src/lib/dashboard/action-center/execution-lane-engine.ts'
import { assignDashboardActionSLA } from '../src/lib/dashboard/action-center/sla-engine.ts'
import { buildDashboardActionEscalationRoute } from '../src/lib/dashboard/action-center/escalation-routing-engine.ts'
import { assignDashboardActionPriority, prioritizeDashboardActions } from '../src/lib/dashboard/action-center/action-priority-engine.ts'
import { runDashboardActionCenter } from '../src/lib/dashboard/action-center/action-center-runtime.ts'

const baseInput={dashboardViewModel:{hasCriticalAttention:true,warnings:['warn'],sections:{topRisksTable:[{id:'r1',title:'Critical risk missing input dependency budget',severity:'critical',source:'x',affectedProjects:['p1'],rationale:'client input missing and dependency unblock'}],interventionsQueue:[{id:'iq1',title:'Intervention 1',urgency:'high',ownerLane:'pmo_director',cadence:'Daily',affectedProjects:['p1']}],decisionsWidget:[{id:'d1',title:'Decision 1',recommendation:'escalate',confidenceScore:0.8,severity:'high'}],alertPanel:[{id:'a1',title:'Alert 1',type:'risk',severity:'critical',description:'payment blocked'}]}},cacheRefreshResult:{cacheStatus:'refresh_required',refreshPlan:{refreshRequired:true,refreshRecommended:true,priority:'high',reasonSummary:'rs',actions:[{id:'c1',sourceKind:'executive_dashboard_report',reason:'stale',priority:'high',title:'Refresh source',description:'desc'}]},metadata:{refreshRequired:true,refreshRecommended:true,warnings:['cw']}},hydrationResult:{riskLevel:'high',warnings:[],recoveryPlan:{recoveryRequired:true,actions:['Rehydrate'],fallbackMode:'safe'}},pmoInterventionReport:{interventions:[{id:'p1',type:'x',title:'PMO intervention',affectedProjects:['p2'],urgency:'critical',ownerLane:'project_manager'}]}}

const generated=generateDashboardActions(baseInput)
for (const [i, fn] of Object.entries({
1:()=>assert.equal(generated.some(a=>a.type==='resolve_portfolio_risk'),true),
2:()=>assert.equal(generated.some(a=>a.source==='dashboard_intervention_queue'),true),
3:()=>assert.equal(generated.some(a=>a.source==='pmo_intervention_report'),true),
4:()=>assert.equal(generated.some(a=>a.type==='review_executive_decision'),true),
5:()=>assert.equal(generated.some(a=>a.type==='escalate_dashboard_alert'),true),
6:()=>assert.equal(generated.some(a=>a.type==='refresh_dashboard_source'),true),
7:()=>assert.equal(generated.some(a=>a.type==='recover_dashboard_hydration'),true),
8:()=>assert.equal(generated.some(a=>a.type==='acknowledge_warning'),true),
9:()=>assert.equal(generated.some(a=>a.type==='request_missing_input'),true),
10:()=>assert.equal(generated.some(a=>a.type==='resolve_dependency'),true),
11:()=>assert.equal(generated.some(a=>a.type==='review_financial_exposure'),true),
})) test(`${i}`, fn)

test('12 owner lane',()=>assert.equal(assignDashboardActionOwnerLane({...generated[0],type:'resolve_dependency'}),'technical_lead'))
test('13 execution lane',()=>assert.equal(assignDashboardActionExecutionLane({...generated[0],type:'review_financial_exposure'}),'financial_governance'))
test('14 sla critical',()=>assert.equal(assignDashboardActionSLA({...generated[0],priority:'critical'}).responseDueHours,4))
test('15 sla financial override',()=>assert.equal(assignDashboardActionSLA({...generated[0],type:'review_financial_exposure',priority:'high'}).cadence.includes('finance/logistics'),true))
test('16 escal exec decision',()=>assert.equal(buildDashboardActionEscalationRoute({...generated[0],type:'review_executive_decision',priority:'medium'}).routeTo,'executive_sponsor'))
test('17 escal critical risk',()=>assert.equal(buildDashboardActionEscalationRoute({...generated[0],type:'resolve_portfolio_risk',priority:'critical'}).required,true))
test('18 prio critical',()=>assert.equal(assignDashboardActionPriority({severity:'critical'}),'critical'))
test('19 prio warning',()=>assert.equal(assignDashboardActionPriority({severity:'warning',type:'acknowledge_warning'}),'medium'))
test('20 dedupe',()=>assert.equal(prioritizeDashboardActions([generated[0],{...generated[0]}]).length,1))

const report=runDashboardActionCenter(baseInput)
test('21 runtime counts',()=>assert.equal(report.totalActions>0,true))
test('22 grouped execution',()=>assert.equal(Object.keys(report.actionsByExecutionLane).length>0,true))
test('23 grouped owner',()=>assert.equal(Object.keys(report.actionsByOwnerLane).length>0,true))
test('24 next action',()=>assert.equal(!!report.recommendedNextAction,true))
test('25 empty summary',()=>assert.equal(runDashboardActionCenter({}).executiveSummary.startsWith('No operational actions yet'),true))
test('26 empty-workspace view model yields zero actions',()=>{
  const report=runDashboardActionCenter({dashboardViewModel:{status:'empty',warnings:['Executive dashboard report unavailable; dashboard remains empty until workspace data exists.'],sections:{topRisksTable:[],interventionsQueue:[],decisionsWidget:[],alertPanel:[]}}})
  assert.equal(report.totalActions,0)
  assert.equal(report.criticalActions,0)
  assert.equal(report.escalationRequiredCount,0)
  assert.equal(report.recommendedNextAction,undefined)
})
