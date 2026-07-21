import { deriveDashboardConsumptionStatus, isDashboardActionRequired } from '../src/lib/dashboard/consumption/dashboard-state-machine.ts'
import { adaptDashboardViewModel } from '../src/lib/dashboard/consumption/dashboard-view-model-adapter.ts'
import { runDashboardConsumptionRuntime } from '../src/lib/dashboard/consumption/dashboard-consumption-runtime.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const okApiResponse = {
  status: 'ok',
  data: {
    portfolioHealthPanel: { score: 78, status: 'attention', label: 'Attention Required', trend: 'declining' },
    executiveSummaryCard: {
      title: 'Portfolio Status',
      summary: 'Two tracks are under delivery pressure.',
      status: 'attention',
      recommendation: 'Schedule executive review within 48 hours.',
    },
    topRisksTable: [
      { id: 'r-001', title: 'Resource contention', severity: 'critical', source: 'conflict', affectedProjects: ['apollo', 'beacon'], rationale: 'Platform team over-allocated.' },
      { id: 'r-002', title: 'Delivery slip', severity: 'warning', source: 'health', affectedProjects: ['nexus'], rationale: 'Timeline drift detected.' },
    ],
    decisionsWidget: [
      { id: 'd-001', title: 'Approve platform reallocation', recommendation: 'approve', confidenceScore: 84, severity: 'info' },
    ],
    interventionsQueue: [
      { id: 'i-001', title: 'Emergency platform resource reallocation', urgency: 'critical', ownerLane: 'pmo_director', cadence: 'Immediate', affectedProjects: ['apollo'] },
    ],
    alertPanel: [
      { id: 'a-001', title: 'Critical resource contention', type: 'conflict', severity: 'critical', description: 'Platform team exhausted across two delivery tracks.' },
    ],
  },
  warnings: [],
}

// ── Validate: loading state adapts ────────────────────────────────────────────

const loadingViewModel = adaptDashboardViewModel({ loading: true })
if (loadingViewModel.status !== 'loading') throw new Error(`expected loading status, got ${loadingViewModel.status}`)
if (loadingViewModel.executiveSummary !== 'Loading portfolio dashboard...') throw new Error('loading summary mismatch')

// ── Validate: error state adapts ──────────────────────────────────────────────

const fetchError = { code: 'dashboard_api_network_error', message: 'Network unavailable', recoverable: true }
const errorViewModel = adaptDashboardViewModel({ fetchError })
if (errorViewModel.status !== 'error') throw new Error(`expected error status, got ${errorViewModel.status}`)
if (!errorViewModel.error) throw new Error('error view model missing error field')
if (errorViewModel.error.code !== 'dashboard_api_network_error') throw new Error('error code mismatch')

// ── Validate: empty API response adapts ───────────────────────────────────────

const emptyApiResponse = {
  status: 'empty',
  data: null,
  warnings: ['Executive dashboard report unavailable; dashboard remains empty until workspace data exists.'],
}
const emptyViewModel = adaptDashboardViewModel({ apiResponse: emptyApiResponse })
if (emptyViewModel.status !== 'empty') throw new Error(`expected empty status, got ${emptyViewModel.status}`)
if (emptyViewModel.risksCount !== 0) throw new Error(`expected 0 risks in empty state, got ${emptyViewModel.risksCount}`)
if (emptyViewModel.alertsCount !== 0) throw new Error(`expected 0 alerts in empty state, got ${emptyViewModel.alertsCount}`)
if (emptyViewModel.hasCriticalAttention) throw new Error('empty state must never flag critical attention')
if (emptyViewModel.warnings.length !== 0) throw new Error(`empty view model must carry no warnings-as-content, got ${emptyViewModel.warnings.length}`)

// ── Validate: partial API response adapts ─────────────────────────────────────

const partialApiResponse = { ...okApiResponse, status: 'partial', warnings: ['Intervention report unavailable.'] }
const partialViewModel = adaptDashboardViewModel({ apiResponse: partialApiResponse })
if (partialViewModel.status !== 'partial') throw new Error(`expected partial status, got ${partialViewModel.status}`)
if (partialViewModel.risksCount !== 2) throw new Error(`expected 2 risks in partial state, got ${partialViewModel.risksCount}`)

// ── Validate: ok API response adapts ─────────────────────────────────────────

const okViewModel = adaptDashboardViewModel({ apiResponse: okApiResponse })
if (okViewModel.status !== 'ready') throw new Error(`expected ready status for ok response, got ${okViewModel.status}`)
if (okViewModel.healthScore !== 78) throw new Error(`expected healthScore 78, got ${okViewModel.healthScore}`)
if (okViewModel.healthLabel !== 'Attention Required') throw new Error('healthLabel mismatch')
if (okViewModel.criticalRisksCount !== 1) throw new Error(`expected 1 critical risk, got ${okViewModel.criticalRisksCount}`)
if (!okViewModel.hasCriticalAttention) throw new Error('hasCriticalAttention should be true')

// ── Validate: state machine returns expected statuses ─────────────────────────

const statusCases = [
  [{ loading: true }, 'loading'],
  [{}, 'idle'],
  [{ fetchError }, 'error'],
  [{ apiResponse: { status: 'empty', data: {}, warnings: [] } }, 'empty'],
  [{ apiResponse: { status: 'partial', data: {}, warnings: [] } }, 'partial'],
  [{ apiResponse: okApiResponse }, 'ready'],
  [{ apiResponse: { status: 'error', data: {}, warnings: [] } }, 'error'],
]

for (const [input, expected] of statusCases) {
  const status = deriveDashboardConsumptionStatus(input)
  if (status !== expected) throw new Error(`state machine: expected ${expected}, got ${status}`)
}

// ── Validate: isDashboardActionRequired ───────────────────────────────────────

if (!isDashboardActionRequired(errorViewModel)) throw new Error('action required for error state')
if (!isDashboardActionRequired(emptyViewModel)) throw new Error('action required for empty state')
if (!isDashboardActionRequired(partialViewModel)) throw new Error('action required for partial state')
if (!isDashboardActionRequired(okViewModel)) throw new Error('action required for ok state with critical signals')

// ── Validate: runtime orchestration succeeds ──────────────────────────────────

const runtimeResult = runDashboardConsumptionRuntime({ apiResponse: okApiResponse })
if (runtimeResult.status !== 'ready') throw new Error(`runtime: expected ready, got ${runtimeResult.status}`)
if (runtimeResult.healthScore !== 78) throw new Error(`runtime: healthScore mismatch`)
if (runtimeResult.decisionsCount !== 1) throw new Error(`runtime: decisionsCount mismatch`)
if (runtimeResult.interventionsCount !== 1) throw new Error(`runtime: interventionsCount mismatch`)
if (runtimeResult.alertsCount !== 1) throw new Error(`runtime: alertsCount mismatch`)

const runtimeIdle = runDashboardConsumptionRuntime({})
if (runtimeIdle.status !== 'idle') throw new Error(`runtime idle: expected idle, got ${runtimeIdle.status}`)

const runtimeLoading = runDashboardConsumptionRuntime({ loading: true })
if (runtimeLoading.status !== 'loading') throw new Error(`runtime loading: expected loading, got ${runtimeLoading.status}`)

console.log('[ok] dashboard consumption runtime valid')
