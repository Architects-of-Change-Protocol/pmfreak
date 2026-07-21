import { validateDashboardApiRequest } from '../src/lib/dashboard/api-runtime/request-validator.ts'
import { resolveDashboardSourceData } from '../src/lib/dashboard/api-runtime/source-data-resolver.ts'
import { buildDashboardApiResponse } from '../src/lib/dashboard/api-runtime/dashboard-api-response-builder.ts'
import { buildDashboardApiErrorResponse } from '../src/lib/dashboard/api-runtime/dashboard-api-error-handler.ts'
import { runDashboardApiRuntime } from '../src/lib/dashboard/api-runtime/dashboard-api-runtime.ts'

const executiveDashboardReport = {
  generatedAt: new Date().toISOString(),
  healthSummary: {
    portfolioHealthScore: 52,
    averageProjectHealthScore: 58,
    activeProjectCount: 5,
    criticalProjectCount: 2,
    riskLevel: 'high',
    summary: 'Portfolio is under severe delivery pressure across three active tracks.',
  },
  conflictSummary: {
    conflictsDetected: 3,
    criticalConflicts: 1,
    topConflictTypes: ['resource_contention', 'timeline_collision'],
    executiveEscalationsRequired: 2,
    summary: 'Critical resource contention detected between Apollo and Beacon.',
  },
  loadSummary: {
    currentBalancingScore: 41,
    operationalRiskLevel: 'high',
    projectedImprovement: 18,
    recommendedPlanTitle: 'Platform Load Redistribution Plan',
    topBalancingActions: ['Reassign platform engineers', 'Shift beacon delivery window'],
    summary: 'Load imbalance is creating compounding operational risk.',
  },
  decisionSummary: {
    totalDecisionsSimulated: 2,
    approvalsRecommended: 1,
    escalationsRecommended: 1,
    rejectionsRecommended: 0,
    averageConfidenceScore: 77.5,
    topDecisionItems: ['Approve platform reallocation', 'Escalate atlas rebaseline'],
    summary: 'One decision ready for approval; one escalation required.',
  },
  interventionSummary: {
    totalInterventions: 4,
    criticalInterventions: 2,
    escalationCount: 3,
    topInterventionTypes: ['resource_reallocation', 'delivery_rebaseline'],
    topOwnerLanes: ['portfolio_board', 'pmo_executive'],
    summary: 'Two critical interventions require immediate portfolio board attention.',
  },
  topRisks: [
    {
      id: 'risk-001',
      title: 'Critical resource contention between Apollo and Beacon',
      riskLevel: 'critical',
      source: 'conflict',
      affectedProjects: ['apollo', 'beacon'],
      rationale: 'Platform team over-allocated across two delivery-critical tracks.',
    },
  ],
  topDecisionsNeeded: ['Approve platform reallocation'],
  executiveAttentionAreas: ['portfolio_health', 'delivery_conflict'],
  portfolioRecommendation:
    'Immediate executive intervention required. Prioritise resource arbitration.',
  executiveSummary:
    'Portfolio health is at 52 — critical. Two interventions require board escalation.',
}

const interventionReport = {
  totalInterventions: 2,
  criticalInterventions: 1,
  escalationCount: 1,
  recommendedPlan: { id: 'plan-001', title: 'Stabilisation Plan', interventions: [] },
  interventions: [
    {
      id: 'int-001',
      type: 'resource_reassignment',
      title: 'Emergency platform resource reallocation',
      description: 'Reallocate platform engineers from Nexus to Apollo.',
      affectedProjects: ['apollo'],
      urgency: 'critical',
      ownerLane: 'pmo_director',
      requiredEvidence: [],
      recommendedCadence: 'Immediate — within 48 hours',
      escalationRequired: true,
      status: 'proposed',
      rationale: 'Platform team exhaustion threatens apollo delivery date.',
    },
  ],
}

const decisionSimulationReports = [
  {
    decisionId: 'dec-001',
    decisionType: 'resource_reallocation',
    baseline: { portfolioStressScore: 72, averageHealthScore: 58 },
    projection: { portfolioStressDelta: -8, riskLevel: 'moderate', affectedProjects: ['apollo'] },
    tradeoffs: [],
    recommendation: 'approve',
    recommendationRationale: 'Reallocation reduces critical path risk by 22%.',
    confidenceScore: 84,
    executiveSummary: 'Approve platform reallocation to unblock apollo critical path.',
  },
]

const conflictReport = {
  conflictsDetected: 1,
  criticalConflicts: 1,
  conflicts: [
    {
      id: 'c-001',
      type: 'resource_contention',
      severity: 'critical',
      involvedProjects: ['apollo', 'beacon'],
      description: 'Platform team over-allocated across two critical delivery tracks.',
    },
  ],
}

// Validate request validation — valid request
const validResult = validateDashboardApiRequest({ tenantId: 'tenant-abc', workspaceId: 'ws-1' })
if (!validResult.valid) throw new Error('valid request should pass validation')
if (!validResult.request) throw new Error('valid result should have request')
if (validResult.request.tenantId !== 'tenant-abc') throw new Error('tenantId mismatch')
if (validResult.errors.length !== 0) throw new Error('valid request should have no errors')

// Validate request validation — missing tenantId
const missingTenantResult = validateDashboardApiRequest({})
if (missingTenantResult.valid) throw new Error('missing tenantId should fail validation')
if (missingTenantResult.errors[0].code !== 'missing_tenant_id') throw new Error('expected missing_tenant_id error code')

// Validate request validation — invalid field types
const invalidFieldResult = validateDashboardApiRequest({ tenantId: 'tenant-abc', includeSignals: 'yes' })
if (invalidFieldResult.valid) throw new Error('invalid includeSignals type should fail')
if (invalidFieldResult.errors[0].code !== 'invalid_include_signals') throw new Error('expected invalid_include_signals error')

// Validate unknown fields are ignored
const unknownFieldResult = validateDashboardApiRequest({ tenantId: 'tenant-xyz', unknownField: true })
if (!unknownFieldResult.valid) throw new Error('unknown fields should not fail validation')

// Validate source resolver with full preloaded data
const fullPreload = { executiveDashboardReport, interventionReport, decisionSimulationReports, conflictReport }
const { sourceData: fullSourceData, warnings: fullWarnings } = resolveDashboardSourceData(
  { tenantId: 'tenant-abc' },
  fullPreload,
)
if (fullWarnings.length !== 0) throw new Error('full preloaded data should have no warnings')
if (!fullSourceData.executiveDashboardReport) throw new Error('executiveDashboardReport should be present')

// Validate source resolver warnings with missing data
const { sourceData: emptySourceData, warnings: missingWarnings } = resolveDashboardSourceData(
  { tenantId: 'tenant-abc' },
)
if (missingWarnings.length !== 4) throw new Error(`expected 4 warnings for empty source data, got ${missingWarnings.length}`)
if (!missingWarnings[0].includes('Executive dashboard report unavailable')) throw new Error('expected executive dashboard report warning')

// Validate API response with populated source data
const populatedResponse = buildDashboardApiResponse({
  request: { tenantId: 'tenant-abc', includeMetadata: true },
  sourceData: fullSourceData,
  warnings: [],
})
if (populatedResponse.status !== 'ok') throw new Error(`expected ok status, got ${populatedResponse.status}`)
if (!populatedResponse.data.portfolioHealthPanel) throw new Error('response missing portfolioHealthPanel')
if (!populatedResponse.metadata) throw new Error('response should include metadata when includeMetadata is true')
if (!populatedResponse.metadata.sourceSignals.executiveDashboardReport) throw new Error('source signal should be true')

// Validate API response empty state when executiveDashboardReport missing
const emptyResponse = buildDashboardApiResponse({
  request: { tenantId: 'tenant-abc', includeMetadata: true },
  sourceData: emptySourceData,
  warnings: missingWarnings,
})
if (emptyResponse.status !== 'empty') throw new Error(`expected empty status, got ${emptyResponse.status}`)
if (emptyResponse.data !== null) throw new Error('empty response must carry null data, never a fabricated DTO')
if (!emptyResponse.metadata) throw new Error('empty response should include metadata')
if (emptyResponse.metadata.sourceSignals.executiveDashboardReport) throw new Error('source signal should be false')

// Validate partial status when warnings present with populated data
const partialResponse = buildDashboardApiResponse({
  request: { tenantId: 'tenant-abc' },
  sourceData: fullSourceData,
  warnings: ['PMO intervention report unavailable.'],
})
if (partialResponse.status !== 'partial') throw new Error(`expected partial status, got ${partialResponse.status}`)

// Validate error response
const errorResponse = buildDashboardApiErrorResponse([
  { code: 'missing_tenant_id', message: 'tenantId is required', recoverable: false },
])
if (errorResponse.status !== 'error') throw new Error('error response should have error status')
if (errorResponse.warnings[0] !== 'tenantId is required') throw new Error('error response warnings mismatch')
if (errorResponse.data !== null) throw new Error('error response must carry null data, never a fabricated DTO')

// Validate metadata excluded when includeMetadata is false
const noMetaResponse = buildDashboardApiResponse({
  request: { tenantId: 'tenant-abc', includeMetadata: false },
  sourceData: fullSourceData,
  warnings: [],
})
if (noMetaResponse.metadata !== undefined) throw new Error('metadata should be excluded when includeMetadata is false')

// Validate runtime end-to-end success path
const runtimeSuccess = runDashboardApiRuntime(
  { tenantId: 'tenant-abc', includeMetadata: true },
  fullPreload,
)
if (runtimeSuccess.status !== 'ok') throw new Error(`expected ok from runtime, got ${runtimeSuccess.status}`)
if (!runtimeSuccess.data.portfolioHealthPanel) throw new Error('runtime result missing portfolioHealthPanel')
if (!runtimeSuccess.metadata) throw new Error('runtime result should include metadata')
if (runtimeSuccess.metadata.tenantId !== 'tenant-abc') throw new Error('metadata tenantId mismatch')
if (runtimeSuccess.metadata.runtimeVersion !== '8.2.0') throw new Error('metadata runtimeVersion mismatch')

// Validate runtime end-to-end invalid request path
const runtimeInvalid = runDashboardApiRuntime({})
if (runtimeInvalid.status !== 'error') throw new Error(`expected error from invalid runtime, got ${runtimeInvalid.status}`)
if (!runtimeInvalid.warnings.length) throw new Error('invalid runtime result should have warnings')

// Validate runtime with no preloaded data returns an explicit empty state
const runtimeEmpty = runDashboardApiRuntime({ tenantId: 'tenant-abc' })
if (runtimeEmpty.status !== 'empty') throw new Error(`expected empty status from runtime with no data, got ${runtimeEmpty.status}`)
if (runtimeEmpty.data !== null) throw new Error('runtime empty result must carry null data, never a fabricated alert')

console.log('[ok] dashboard api runtime valid')
