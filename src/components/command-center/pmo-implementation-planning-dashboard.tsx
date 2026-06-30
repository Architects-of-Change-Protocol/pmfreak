"use client";

// ─── PMO Implementation Planning Dashboard ─
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts, run dry-runs, or execute rollback.
// This is a planning workspace only.

export function PmoImplementationPlanningDashboard() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-100">
            Controlled Policy Implementation Planning Workspace
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Planning workspace for controlled policy implementation. This workspace does not apply policies,
            change routing, or execute any live system changes.
          </p>
          <div className="mt-3 px-3 py-2 bg-amber-900/30 border border-amber-700/40 rounded text-amber-300 text-xs">
            PLANNING DOCUMENT ONLY — NO POLICY IMPLEMENTATION IS AUTHORIZED FROM THIS WORKSPACE
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Implementation Plan Drafts</h2>
            <p className="text-xs text-zinc-500">Create and review implementation plan drafts for dry-run preparation.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Task Breakdown</h2>
            <p className="text-xs text-zinc-500">View the 10-task implementation planning breakdown.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Pre-Implementation Checklist</h2>
            <p className="text-xs text-zinc-500">18-item checklist to verify readiness for dry-run planning.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Stakeholder Readiness</h2>
            <p className="text-xs text-zinc-500">Track acknowledgment from all required stakeholders.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Change Window Plan</h2>
            <p className="text-xs text-zinc-500">Propose and review change window timing and constraints.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Risk Register</h2>
            <p className="text-xs text-zinc-500">Register and track implementation risks and mitigations.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Rollback Rehearsal Plans</h2>
            <p className="text-xs text-zinc-500">Prepare rollback rehearsal plans for dry-run preparation.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Gate Prerequisites</h2>
            <p className="text-xs text-zinc-500">Evaluate 12 gate prerequisites before approving for dry-run planning.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Decisions &amp; Exports</h2>
            <p className="text-xs text-zinc-500">Record planning decisions and generate markdown/JSON/CSV exports.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
