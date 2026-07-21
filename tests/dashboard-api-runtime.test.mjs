import test from 'node:test'
import assert from 'node:assert/strict'

import { validateDashboardApiRequest } from '../src/lib/dashboard/api-runtime/request-validator.ts'
import { resolveDashboardSourceData } from '../src/lib/dashboard/api-runtime/source-data-resolver.ts'
import { buildDashboardApiResponse } from '../src/lib/dashboard/api-runtime/dashboard-api-response-builder.ts'
import { buildDashboardApiErrorResponse } from '../src/lib/dashboard/api-runtime/dashboard-api-error-handler.ts'
import { runDashboardApiRuntime } from '../src/lib/dashboard/api-runtime/dashboard-api-runtime.ts'

const makeExecutiveDashboardReport = (score) => ({
  generatedAt: new Date().toISOString(),
  healthSummary: {
    portfolioHealthScore: score,
    averageProjectHealthScore: score - 4,
    activeProjectCount: 4,
    criticalProjectCount: score < 65 ? 2 : 0,
    riskLevel: score < 65 ? 'high' : 'low',
    summary: `Portfolio health at ${score}.`,
  },
  conflictSummary: {
    conflictsDetected: 0,
    criticalConflicts: 0,
    topConflictTypes: [],
    executiveEscalationsRequired: 0,
    summary: '',
  },
  loadSummary: {
    currentBalancingScore: 60,
    operationalRiskLevel: 'low',
    projectedImprovement: 5,
    topBalancingActions: [],
    summary: '',
  },
  decisionSummary: {
    totalDecisionsSimulated: 0,
    approvalsRecommended: 0,
    escalationsRecommended: 0,
    rejectionsRecommended: 0,
    averageConfidenceScore: 0,
    topDecisionItems: [],
    summary: '',
  },
  interventionSummary: {
    totalInterventions: 0,
    criticalInterventions: 0,
    escalationCount: 0,
    topInterventionTypes: [],
    topOwnerLanes: [],
    summary: '',
  },
  topRisks: [],
  topDecisionsNeeded: [],
  executiveAttentionAreas: [],
  portfolioRecommendation: 'Monitor portfolio health.',
  executiveSummary: `Portfolio health is at ${score}.`,
})

const fullSourceData = {
  executiveDashboardReport: makeExecutiveDashboardReport(72),
  interventionReport: {
    totalInterventions: 1,
    criticalInterventions: 0,
    escalationCount: 0,
    recommendedPlan: { id: 'plan-001', title: 'Plan', interventions: [] },
    interventions: [
      {
        id: 'int-001',
        type: 'stakeholder_alignment',
        title: 'Alignment session',
        description: 'Align stakeholders.',
        affectedProjects: ['nexus'],
        urgency: 'medium',
        ownerLane: 'project_manager',
        requiredEvidence: [],
        recommendedCadence: 'Weekly',
        escalationRequired: false,
        status: 'proposed',
        rationale: 'Budget drift.',
      },
    ],
  },
  decisionSimulationReports: [
    {
      decisionId: 'dec-001',
      decisionType: 'resource_reallocation',
      baseline: { portfolioStressScore: 60, averageHealthScore: 72 },
      projection: { portfolioStressDelta: -5, riskLevel: 'low', affectedProjects: ['apollo'] },
      tradeoffs: [],
      recommendation: 'approve',
      recommendationRationale: 'Minor improvement.',
      confidenceScore: 82,
      executiveSummary: 'Approve reallocation.',
    },
  ],
  conflictReport: {
    conflictsDetected: 0,
    criticalConflicts: 0,
    conflicts: [],
  },
}

// ──────────────────────────────────────────────
// 1. Valid request validation
// ──────────────────────────────────────────────

test('validates a minimal valid request with tenantId only', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc' })
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.request?.tenantId, 'tenant-abc')
})

test('validates a full valid request with all optional fields', () => {
  const result = validateDashboardApiRequest({
    tenantId: 'tenant-abc',
    workspaceId: 'ws-1',
    portfolioId: 'pf-1',
    userId: 'user-1',
    includeSignals: true,
    includeMetadata: false,
  })
  assert.equal(result.valid, true)
  assert.equal(result.request?.workspaceId, 'ws-1')
  assert.equal(result.request?.portfolioId, 'pf-1')
  assert.equal(result.request?.userId, 'user-1')
  assert.equal(result.request?.includeSignals, true)
  assert.equal(result.request?.includeMetadata, false)
})

test('unknown fields do not fail validation', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', unknownField: 'value' })
  assert.equal(result.valid, true)
})

// ──────────────────────────────────────────────
// 2. Missing tenantId validation
// ──────────────────────────────────────────────

test('rejects null input with missing_tenant_id error', () => {
  const result = validateDashboardApiRequest(null)
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'missing_tenant_id')
})

test('rejects empty object with missing_tenant_id error', () => {
  const result = validateDashboardApiRequest({})
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'missing_tenant_id')
})

test('rejects empty string tenantId with invalid_tenant_id error', () => {
  const result = validateDashboardApiRequest({ tenantId: '   ' })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_tenant_id')
})

test('rejects numeric tenantId with invalid_tenant_id error', () => {
  const result = validateDashboardApiRequest({ tenantId: 42 })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_tenant_id')
})

// ──────────────────────────────────────────────
// 3. Invalid optional field validation
// ──────────────────────────────────────────────

test('rejects numeric workspaceId with invalid_workspace_id error', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', workspaceId: 99 })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_workspace_id')
})

test('rejects numeric portfolioId with invalid_portfolio_id error', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', portfolioId: true })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_portfolio_id')
})

test('rejects numeric userId with invalid_user_id error', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', userId: 123 })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_user_id')
})

test('rejects string includeSignals with invalid_include_signals error', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', includeSignals: 'yes' })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_include_signals')
})

test('rejects string includeMetadata with invalid_include_metadata error', () => {
  const result = validateDashboardApiRequest({ tenantId: 'tenant-abc', includeMetadata: 1 })
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].code, 'invalid_include_metadata')
})

// ──────────────────────────────────────────────
// 4. Source resolver with full preloaded data
// ──────────────────────────────────────────────

test('source resolver returns no warnings with full preloaded data', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, fullSourceData)
  assert.equal(warnings.length, 0)
})

test('source resolver returns all source data fields when preloaded', () => {
  const { sourceData } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, fullSourceData)
  assert.ok(sourceData.executiveDashboardReport)
  assert.ok(sourceData.interventionReport)
  assert.ok(sourceData.decisionSimulationReports)
  assert.ok(sourceData.conflictReport)
})

// ──────────────────────────────────────────────
// 5. Source resolver warnings with missing data
// ──────────────────────────────────────────────

test('source resolver warns about all missing fields when no preloaded data provided', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' })
  assert.equal(warnings.length, 4)
})

test('source resolver warns about missing executiveDashboardReport', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, {})
  assert.ok(warnings.some((w) => w.includes('Executive dashboard report unavailable')))
})

test('source resolver warns about missing interventionReport', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, {})
  assert.ok(warnings.some((w) => w.includes('PMO intervention report unavailable')))
})

test('source resolver warns about missing decisionSimulationReports', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, {})
  assert.ok(warnings.some((w) => w.includes('Decision simulation reports unavailable')))
})

test('source resolver warns about missing conflictReport', () => {
  const { warnings } = resolveDashboardSourceData({ tenantId: 'tenant-abc' }, {})
  assert.ok(warnings.some((w) => w.includes('Conflict report unavailable')))
})

test('source resolver warns about empty decisionSimulationReports array', () => {
  const { warnings } = resolveDashboardSourceData(
    { tenantId: 'tenant-abc' },
    { executiveDashboardReport: makeExecutiveDashboardReport(80), decisionSimulationReports: [] },
  )
  assert.ok(warnings.some((w) => w.includes('Decision simulation reports unavailable')))
})

// ──────────────────────────────────────────────
// 6. API response with populated source data
// ──────────────────────────────────────────────

test('builds ok response with populated source data and no warnings', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: fullSourceData,
    warnings: [],
  })
  assert.equal(response.status, 'ok')
  assert.equal(response.warnings.length, 0)
})

test('ok response includes all six dashboard DTO panels', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: fullSourceData,
    warnings: [],
  })
  assert.ok(response.data.portfolioHealthPanel)
  assert.ok(response.data.executiveSummaryCard)
  assert.ok(Array.isArray(response.data.topRisksTable))
  assert.ok(Array.isArray(response.data.decisionsWidget))
  assert.ok(Array.isArray(response.data.interventionsQueue))
  assert.ok(Array.isArray(response.data.alertPanel))
})

test('builds partial response when warnings present with populated data', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: fullSourceData,
    warnings: ['PMO intervention report unavailable.'],
  })
  assert.equal(response.status, 'partial')
  assert.equal(response.warnings.length, 1)
})

// ──────────────────────────────────────────────
// 7. API response empty state when executiveDashboardReport missing
// ──────────────────────────────────────────────

test('builds empty status response when executiveDashboardReport is absent', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: {},
    warnings: ['Executive dashboard report unavailable; dashboard remains empty until workspace data exists.'],
  })
  assert.equal(response.status, 'empty')
})

test('empty response carries null data — never a fabricated dashboard DTO', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: {},
    warnings: [],
  })
  assert.equal(response.data, null)
})

test('empty response still includes metadata and warnings for diagnostics', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc', includeMetadata: true },
    sourceData: {},
    warnings: ['Executive dashboard report unavailable; dashboard remains empty until workspace data exists.'],
  })
  assert.ok(response.metadata)
  assert.equal(response.warnings.length, 1)
})

// ──────────────────────────────────────────────
// 8. Error response fallback
// ──────────────────────────────────────────────

test('buildDashboardApiErrorResponse returns error status', () => {
  const response = buildDashboardApiErrorResponse([
    { code: 'missing_tenant_id', message: 'tenantId is required', recoverable: false },
  ])
  assert.equal(response.status, 'error')
})

test('error response maps error messages to warnings', () => {
  const response = buildDashboardApiErrorResponse([
    { code: 'missing_tenant_id', message: 'tenantId is required', recoverable: false },
    { code: 'invalid_workspace_id', message: 'workspaceId must be a string', recoverable: false },
  ])
  assert.equal(response.warnings.length, 2)
  assert.equal(response.warnings[0], 'tenantId is required')
  assert.equal(response.warnings[1], 'workspaceId must be a string')
})

test('error response carries null data — never a fabricated dashboard DTO', () => {
  const response = buildDashboardApiErrorResponse([
    { code: 'missing_tenant_id', message: 'tenantId is required', recoverable: false },
  ])
  assert.equal(response.data, null)
})

// ──────────────────────────────────────────────
// 9. Metadata source signals
// ──────────────────────────────────────────────

test('metadata is included by default when includeMetadata is not set', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc' },
    sourceData: fullSourceData,
    warnings: [],
  })
  assert.ok(response.metadata)
})

test('metadata is excluded when includeMetadata is false', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc', includeMetadata: false },
    sourceData: fullSourceData,
    warnings: [],
  })
  assert.equal(response.metadata, undefined)
})

test('metadata source signals reflect true when all inputs present', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc', includeMetadata: true },
    sourceData: fullSourceData,
    warnings: [],
  })
  const signals = response.metadata?.sourceSignals
  assert.equal(signals?.executiveDashboardReport, true)
  assert.equal(signals?.interventionReport, true)
  assert.equal(signals?.decisionSimulationReports, true)
  assert.equal(signals?.conflictReport, true)
})

test('metadata source signals reflect false when all inputs absent', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc', includeMetadata: true },
    sourceData: {},
    warnings: [],
  })
  const signals = response.metadata?.sourceSignals
  assert.equal(signals?.executiveDashboardReport, false)
  assert.equal(signals?.interventionReport, false)
  assert.equal(signals?.decisionSimulationReports, false)
  assert.equal(signals?.conflictReport, false)
})

test('metadata contains tenantId, runtimeVersion, and generatedAt', () => {
  const response = buildDashboardApiResponse({
    request: { tenantId: 'tenant-abc', workspaceId: 'ws-1' },
    sourceData: fullSourceData,
    warnings: [],
  })
  assert.equal(response.metadata?.tenantId, 'tenant-abc')
  assert.equal(response.metadata?.workspaceId, 'ws-1')
  assert.equal(response.metadata?.runtimeVersion, '8.2.0')
  assert.ok(response.metadata?.generatedAt)
})

// ──────────────────────────────────────────────
// 10. Runtime end-to-end success path
// ──────────────────────────────────────────────

test('runtime returns ok status with full preloaded source data', () => {
  const result = runDashboardApiRuntime(
    { tenantId: 'tenant-abc', includeMetadata: true },
    fullSourceData,
  )
  assert.equal(result.status, 'ok')
})

test('runtime result includes all six dashboard panels', () => {
  const result = runDashboardApiRuntime({ tenantId: 'tenant-abc' }, fullSourceData)
  assert.ok(result.data.portfolioHealthPanel)
  assert.ok(result.data.executiveSummaryCard)
  assert.ok(Array.isArray(result.data.topRisksTable))
  assert.ok(Array.isArray(result.data.decisionsWidget))
  assert.ok(Array.isArray(result.data.interventionsQueue))
  assert.ok(Array.isArray(result.data.alertPanel))
})

test('runtime result metadata has correct tenantId and runtimeVersion', () => {
  const result = runDashboardApiRuntime(
    { tenantId: 'tenant-abc', includeMetadata: true },
    fullSourceData,
  )
  assert.equal(result.metadata?.tenantId, 'tenant-abc')
  assert.equal(result.metadata?.runtimeVersion, '8.2.0')
})

// ──────────────────────────────────────────────
// 11. Runtime end-to-end invalid request path
// ──────────────────────────────────────────────

test('runtime returns error status for null input', () => {
  const result = runDashboardApiRuntime(null)
  assert.equal(result.status, 'error')
  assert.ok(result.warnings.length > 0)
})

test('runtime returns error status for empty object input', () => {
  const result = runDashboardApiRuntime({})
  assert.equal(result.status, 'error')
})

test('runtime error response carries null data', () => {
  const result = runDashboardApiRuntime({})
  assert.equal(result.data, null)
})

test('runtime returns empty status when request valid but no source data provided', () => {
  const result = runDashboardApiRuntime({ tenantId: 'tenant-abc' })
  assert.equal(result.status, 'empty')
})

// ──────────────────────────────────────────────
// 12. Empty state never fabricates dashboard content
// ──────────────────────────────────────────────

test('runtime empty result carries null data — no fabricated alerts, health, or summary', () => {
  const result = runDashboardApiRuntime({ tenantId: 'tenant-abc' })
  assert.equal(result.status, 'empty')
  assert.equal(result.data, null)
})
