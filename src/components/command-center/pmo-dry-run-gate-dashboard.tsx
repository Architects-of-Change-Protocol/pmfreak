"use client";

// ─── PMO Dry-Run Gate Dashboard ─
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts or execute rollback.
// Does NOT call LLMs, external APIs, or send communications.
// Dry-run simulation only — no live policy mutation.

export function PmoDryRunGateDashboard() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-100">
            Controlled Policy Implementation Gate & Dry-Run Change Executor
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Simulates implementation behavior from an approved planning workspace.
            Does not apply policies, change routing, change scoring, execute adapters, or activate policy versions.
          </p>
          <div className="mt-3 px-3 py-2 bg-amber-900/30 border border-amber-700/40 rounded text-amber-300 text-xs">
            DRY-RUN SIMULATION ONLY — NO LIVE POLICY MUTATION — NO ACTIVATION AUTHORIZED
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Dry-Run Requests</h2>
            <p className="text-xs text-zinc-500">Create dry-run execution requests from approved planning workspaces.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Pre-Flight Validation</h2>
            <p className="text-xs text-zinc-500">Run deterministic pre-flight checks before gate review.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Gate Approval</h2>
            <p className="text-xs text-zinc-500">Create gate approvals for dry-run only. Does not authorize live activation.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Gate Decisions</h2>
            <p className="text-xs text-zinc-500">Record gate decisions (approve for dry-run only, reject, request changes, block).</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Dry-Run Change Set</h2>
            <p className="text-xs text-zinc-500">Generate simulated change sets. Changes are not applied.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Simulated Policy Version</h2>
            <p className="text-xs text-zinc-500">Generate what a future policy version could look like. Not a live policy version.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Dry-Run Execution</h2>
            <p className="text-xs text-zinc-500">Run deterministic dry-run simulation. No adapters, no external APIs, no policy mutation.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Simulated Impacts</h2>
            <p className="text-xs text-zinc-500">View simulated impacts across 10 domains. No runtime changes are made.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Evidence Package</h2>
            <p className="text-xs text-zinc-500">Assemble safe summarized evidence. No raw payloads, no secrets.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Blockers</h2>
            <p className="text-xs text-zinc-500">Record and track blockers preventing future activation readiness.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Operator Review</h2>
            <p className="text-xs text-zinc-500">Record operator reviews of dry-run results. Does not activate policy.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Dry-Run Decision</h2>
            <p className="text-xs text-zinc-500">Record final dry-run decision. Pass for future activation planning only — does not activate.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">Safe Export</h2>
            <p className="text-xs text-zinc-500">Generate and download safe dry-run exports (markdown, json, csv). Excludes secrets and raw payloads.</p>
          </div>
        </div>

        <div className="mt-8 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-500 space-y-1">
          <div className="font-medium text-zinc-400">Non-goals — this page does NOT provide:</div>
          <div>Apply Policy · Deploy Policy · Activate Policy · Run Live Implementation · Change Routing Now · Change Risk Score Now</div>
          <div>Create Jira Ticket · Create GitHub Issue · Schedule Change Window · Send Email · Send Slack · Execute Rollback · Authorize Activation</div>
        </div>
      </div>
    </div>
  );
}
