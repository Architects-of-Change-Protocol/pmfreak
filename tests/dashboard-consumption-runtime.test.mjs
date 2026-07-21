import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveDashboardConsumptionStatus, isDashboardActionRequired } from '../src/lib/dashboard/consumption/dashboard-state-machine.ts'
import { adaptDashboardViewModel } from '../src/lib/dashboard/consumption/dashboard-view-model-adapter.ts'
import { runDashboardConsumptionRuntime, loadPortfolioDashboardViewModel } from '../src/lib/dashboard/consumption/dashboard-consumption-runtime.ts'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const makeOkApiResponse = (overrides = {}) => ({
  status: 'ok',
  data: {
    portfolioHealthPanel: { score: 82, status: 'healthy', label: 'Healthy', trend: 'stable' },
    executiveSummaryCard: {
      title: 'Portfolio Status',
      summary: 'Portfolio is performing well.',
      status: 'healthy',
      recommendation: 'Maintain current trajectory.',
    },
    topRisksTable: [
      { id: 'r-001', title: 'Budget drift', severity: 'warning', source: 'conflict', affectedProjects: ['apollo'], rationale: 'Overspend.' },
      { id: 'r-002', title: 'Timeline slip', severity: 'critical', source: 'health', affectedProjects: ['beacon'], rationale: 'Delay.' },
    ],
    decisionsWidget: [
      { id: 'd-001', title: 'Approve reallocation', recommendation: 'approve', confidenceScore: 84, severity: 'info' },
    ],
    interventionsQueue: [
      { id: 'i-001', title: 'Stakeholder sync', urgency: 'medium', ownerLane: 'project_manager', cadence: 'Weekly', affectedProjects: ['nexus'] },
    ],
    alertPanel: [
      { id: 'a-001', title: 'Platform overload', type: 'resource', severity: 'warning', description: 'Load imbalance detected.' },
    ],
  },
  warnings: [],
  ...overrides,
})

const makeErrorConsumptionInput = () => ({
  fetchError: { code: 'dashboard_api_network_error', message: 'Network error', recoverable: true },
})

// ── 1. deriveDashboardConsumptionStatus — loading ─────────────────────────────

test('deriveDashboardConsumptionStatus returns loading when loading is true', () => {
  const result = deriveDashboardConsumptionStatus({ loading: true })
  assert.equal(result, 'loading')
})

// ── 2. deriveDashboardConsumptionStatus — idle ────────────────────────────────

test('deriveDashboardConsumptionStatus returns idle when no apiResponse', () => {
  const result = deriveDashboardConsumptionStatus({})
  assert.equal(result, 'idle')
})

// ── 3. deriveDashboardConsumptionStatus — error ───────────────────────────────

test('deriveDashboardConsumptionStatus returns error when fetchError present', () => {
  const result = deriveDashboardConsumptionStatus(makeErrorConsumptionInput())
  assert.equal(result, 'error')
})

test('deriveDashboardConsumptionStatus returns error when apiResponse.status is error', () => {
  const result = deriveDashboardConsumptionStatus({ apiResponse: { status: 'error', data: {}, warnings: [] } })
  assert.equal(result, 'error')
})

test('deriveDashboardConsumptionStatus returns error for unknown apiResponse status', () => {
  const result = deriveDashboardConsumptionStatus({ apiResponse: { status: 'unknown', data: {}, warnings: [] } })
  assert.equal(result, 'error')
})

// ── 4. deriveDashboardConsumptionStatus — empty ───────────────────────────────

test('deriveDashboardConsumptionStatus returns empty when apiResponse.status is empty', () => {
  const result = deriveDashboardConsumptionStatus({ apiResponse: { status: 'empty', data: {}, warnings: [] } })
  assert.equal(result, 'empty')
})

// ── 5. deriveDashboardConsumptionStatus — partial ─────────────────────────────

test('deriveDashboardConsumptionStatus returns partial when apiResponse.status is partial', () => {
  const result = deriveDashboardConsumptionStatus({ apiResponse: { status: 'partial', data: {}, warnings: ['source missing'] } })
  assert.equal(result, 'partial')
})

// ── 6. deriveDashboardConsumptionStatus — ok → ready ─────────────────────────

test('deriveDashboardConsumptionStatus returns ready when apiResponse.status is ok', () => {
  const result = deriveDashboardConsumptionStatus({ apiResponse: makeOkApiResponse() })
  assert.equal(result, 'ready')
})

// ── 7. adaptDashboardViewModel — loading state ────────────────────────────────

test('adaptDashboardViewModel returns loading state when loading is true', () => {
  const result = adaptDashboardViewModel({ loading: true })
  assert.equal(result.status, 'loading')
  assert.equal(result.healthScore, 0)
  assert.equal(result.executiveSummary, 'Loading portfolio dashboard...')
  assert.equal(result.error, undefined)
})

// ── 8. adaptDashboardViewModel — fetch error state ────────────────────────────

test('adaptDashboardViewModel returns error state when fetchError provided', () => {
  const fetchError = { code: 'dashboard_api_http_error', message: 'API returned 500', recoverable: false }
  const result = adaptDashboardViewModel({ fetchError })
  assert.equal(result.status, 'error')
  assert.equal(result.healthScore, 0)
  assert.equal(result.executiveSummary, 'API returned 500')
  assert.ok(result.error)
  assert.equal(result.error?.code, 'dashboard_api_http_error')
  assert.equal(result.error?.recoverable, false)
})

// ── 9. adaptDashboardViewModel — empty state (null data) ──────────────────────

test('adaptDashboardViewModel maps empty API response to a truly empty view model', () => {
  const apiResponse = {
    status: 'empty',
    data: null,
    warnings: ['Executive dashboard report unavailable; dashboard remains empty until workspace data exists.'],
  }
  const result = adaptDashboardViewModel({ apiResponse })
  assert.equal(result.status, 'empty')
  assert.equal(result.healthScore, 0)
  assert.equal(result.risksCount, 0)
  assert.equal(result.alertsCount, 0)
  assert.equal(result.hasCriticalAttention, false)
  assert.deepEqual(result.warnings, [], 'empty state must not surface diagnostics as content')
})

// ── 10. adaptDashboardViewModel — partial response ────────────────────────────

test('adaptDashboardViewModel maps partial API response', () => {
  const apiResponse = makeOkApiResponse({ status: 'partial', warnings: ['Intervention report unavailable.'] })
  const result = adaptDashboardViewModel({ apiResponse })
  assert.equal(result.status, 'partial')
  assert.equal(result.risksCount, 2)
  assert.deepEqual(result.warnings, ['Intervention report unavailable.'])
})

// ── 11. adaptDashboardViewModel — ok response ─────────────────────────────────

test('adaptDashboardViewModel maps ok API response to ready view model', () => {
  const result = adaptDashboardViewModel({ apiResponse: makeOkApiResponse() })
  assert.equal(result.status, 'ready')
  assert.equal(result.healthScore, 82)
  assert.equal(result.healthLabel, 'Healthy')
  assert.equal(result.executiveSummary, 'Portfolio is performing well.')
  assert.equal(result.portfolioRecommendation, 'Maintain current trajectory.')
  assert.equal(result.risksCount, 2)
  assert.equal(result.decisionsCount, 1)
  assert.equal(result.interventionsCount, 1)
  assert.equal(result.alertsCount, 1)
  assert.ok(result.sections.topRisksTable.length === 2)
  assert.deepEqual(result.warnings, [])
})

// ── 12. Critical risk count ───────────────────────────────────────────────────

test('adaptDashboardViewModel counts critical risks correctly', () => {
  const result = adaptDashboardViewModel({ apiResponse: makeOkApiResponse() })
  assert.equal(result.criticalRisksCount, 1)
})

// ── 13. hasCriticalAttention from critical risk ────────────────────────────────

test('adaptDashboardViewModel sets hasCriticalAttention true when critical risk present', () => {
  const result = adaptDashboardViewModel({ apiResponse: makeOkApiResponse() })
  assert.equal(result.hasCriticalAttention, true)
})

// ── 14. hasCriticalAttention from critical alert ───────────────────────────────

test('adaptDashboardViewModel sets hasCriticalAttention true from critical alert severity', () => {
  const apiResponse = makeOkApiResponse()
  apiResponse.data.topRisksTable = []
  apiResponse.data.alertPanel = [
    { id: 'a-001', title: 'Critical alert', type: 'risk', severity: 'critical', description: '' },
  ]
  const result = adaptDashboardViewModel({ apiResponse })
  assert.equal(result.criticalRisksCount, 0)
  assert.equal(result.hasCriticalAttention, true)
})

// ── 15. isDashboardActionRequired — error/empty/partial ───────────────────────

test('isDashboardActionRequired returns true for error status', () => {
  const vm = adaptDashboardViewModel(makeErrorConsumptionInput())
  assert.equal(isDashboardActionRequired(vm), true)
})

test('isDashboardActionRequired returns true for empty status', () => {
  const vm = adaptDashboardViewModel({ apiResponse: { status: 'empty', data: {}, warnings: [] } })
  assert.equal(isDashboardActionRequired(vm), true)
})

test('isDashboardActionRequired returns true for partial status', () => {
  const vm = adaptDashboardViewModel({ apiResponse: makeOkApiResponse({ status: 'partial', warnings: ['missing source'] }) })
  assert.equal(isDashboardActionRequired(vm), true)
})

// ── 16. isDashboardActionRequired — healthy ready state ───────────────────────

test('isDashboardActionRequired returns false for healthy ready state with no critical signals', () => {
  const apiResponse = makeOkApiResponse()
  apiResponse.data.topRisksTable = [
    { id: 'r-001', title: 'Minor issue', severity: 'info', source: 'health', affectedProjects: [], rationale: '' },
  ]
  apiResponse.data.alertPanel = []
  apiResponse.data.portfolioHealthPanel.status = 'healthy'
  const vm = adaptDashboardViewModel({ apiResponse })
  assert.equal(vm.status, 'ready')
  assert.equal(vm.hasCriticalAttention, false)
  assert.equal(vm.criticalRisksCount, 0)
  assert.equal(isDashboardActionRequired(vm), false)
})

// ── 17. runDashboardConsumptionRuntime — end-to-end ───────────────────────────

test('runDashboardConsumptionRuntime produces aligned status from state machine', () => {
  const input = { apiResponse: makeOkApiResponse() }
  const result = runDashboardConsumptionRuntime(input)
  assert.equal(result.status, 'ready')
  assert.equal(result.healthScore, 82)
  assert.equal(result.risksCount, 2)
})

test('runDashboardConsumptionRuntime returns idle for empty input', () => {
  const result = runDashboardConsumptionRuntime({})
  assert.equal(result.status, 'idle')
  assert.equal(result.healthScore, 0)
})

test('runDashboardConsumptionRuntime returns loading state correctly', () => {
  const result = runDashboardConsumptionRuntime({ loading: true })
  assert.equal(result.status, 'loading')
  assert.equal(result.executiveSummary, 'Loading portfolio dashboard...')
})

// ── 18. loadPortfolioDashboardViewModel — fetch failure ───────────────────────

test('loadPortfolioDashboardViewModel returns error view model on fetch failure', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('Connection refused')
  }
  try {
    const result = await loadPortfolioDashboardViewModel({ baseUrl: 'http://localhost:3000' })
    assert.equal(result.status, 'error')
    assert.ok(result.error)
    assert.equal(result.error?.code, 'dashboard_api_network_error')
    assert.ok(result.error?.message.includes('Connection refused'))
    assert.equal(result.error?.recoverable, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loadPortfolioDashboardViewModel returns error view model on HTTP error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  })
  try {
    const result = await loadPortfolioDashboardViewModel({ baseUrl: 'http://localhost:3000' })
    assert.equal(result.status, 'error')
    assert.ok(result.error)
    assert.equal(result.error?.code, 'dashboard_api_http_error')
    assert.ok(result.error?.message.includes('503'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
