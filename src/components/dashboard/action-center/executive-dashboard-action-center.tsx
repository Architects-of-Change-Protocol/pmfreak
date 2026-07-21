import type { DashboardActionCenterReport } from '@/lib/dashboard/action-center'
import { EmptyOperationalCenter } from '@/components/pmfreak/empty-states'
import { DashboardActionSummary } from './dashboard-action-summary'
import { DashboardNextActionPanel } from './dashboard-next-action-panel'
import { DashboardActionQueue } from './dashboard-action-queue'

export function ExecutiveDashboardActionCenter({ report }: { report: DashboardActionCenterReport }) {
  if (report.totalActions === 0) {
    return <EmptyOperationalCenter />
  }
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Operational Action Center</p>
      <DashboardActionSummary report={report} />
      <DashboardNextActionPanel action={report.recommendedNextAction} />
      <DashboardActionQueue actions={report.actions} />
    </section>
  )
}
