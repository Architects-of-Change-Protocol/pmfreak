"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditReconstructionItem,
  CanonicalOutcomeObservationState,
  CanonicalTaskOutcomeState,
  CompleteLineageProjection,
  LineageStepNode,
  LineageTransition,
  MissingDataState,
  OperationalSummary,
} from "@/lib/operational-flow/types";

type Props = {
  workspaceId: string;
  projectId: string;
};

const short = (value: unknown) => String(value ?? "").slice(0, 8);
const formatPct = (val: number | null | undefined) =>
  val !== null && val !== undefined ? `${(Number(val) * 100).toFixed(1)}%` : "N/A";

const STEP_KIND_LABELS: Record<string, string> = {
  source: "1. Source",
  raw_input: "2. Raw Input",
  normalized_event: "3. Normalized Event",
  evidence: "4. Evidence (Decision Context)",
  finding: "5. Finding / Signal",
  recommendation: "6. Recommendation",
  decision: "7. Decision",
  material_action: "8. Governed Action",
  task: "9. Execution Task",
  internal_execution: "10. State Machine Execution",
  outcome: "11. Expected Outcome",
  observation: "12. Outcome Observation",
};

export function OutcomeReviewLineagePanel({ workspaceId, projectId }: Props) {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"lineage" | "observe" | "audit">("lineage");
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Form state for recording an observation
  const [obsState, setObsState] = useState<CanonicalOutcomeObservationState>("achieved");
  const [obsSummary, setObsSummary] = useState<string>("");
  const [obsConfidence, setObsConfidence] = useState<number>(0.95);
  const [obsMissingData, setObsMissingData] = useState<MissingDataState>("COMPLETE");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(
        `/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Access denied: You do not have permission to view operational flow in this project.");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(String(err.error || "Failed to load operational flow."));
      }
      const data = (await res.json()) as OperationalSummary;
      setSummary(data);
      const firstLineage = data.lineages?.[0];
      if (firstLineage) {
        setSelectedOutcomeId((prev) => prev || firstLineage.outcomeId);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to load operational summary.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedLineage: CompleteLineageProjection | undefined = useMemo(() => {
    return (summary?.lineages ?? []).find((l) => l.outcomeId === selectedOutcomeId);
  }, [summary?.lineages, selectedOutcomeId]);

  const liveEvidenceItems = useMemo(() => {
    return (summary?.evidence ?? []).filter(
      (e) => (e as Record<string, unknown>).fixture_state === "LIVE" || (e as Record<string, unknown>).fixture_state === undefined,
    );
  }, [summary?.evidence]);

  const handleRecordObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutcomeId) {
      setErrorMessage("Please select an Outcome to observe.");
      return;
    }
    if (!obsSummary.trim()) {
      setErrorMessage("Observation summary is required.");
      return;
    }
    if (selectedEvidenceIds.length === 0) {
      setErrorMessage("At least one supporting LIVE evidence item is required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setStatusMessage("");

    const now = new Date().toISOString();
    const correlationId = selectedLineage?.steps.find((s) => s.kind === "outcome")?.correlationId || `corr-obs-${Date.now()}`;
    const idempotencyKey = `obs:${selectedOutcomeId}:${Date.now()}`;

    try {
      const res = await fetch("/api/operational-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "record_outcome_observation",
          workspaceId,
          projectId,
          outcomeId: selectedOutcomeId,
          observationState: obsState,
          summary: obsSummary.trim(),
          evidenceReferenceIds: selectedEvidenceIds,
          confidenceScore: obsConfidence,
          missingDataState: obsMissingData,
          observedAt: now,
          evaluatedAt: now,
          correlationId,
          causationId: selectedOutcomeId,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(String(data.error || "Failed to record observation."));
      }

      setStatusMessage(`Observation recorded successfully (${obsState}). State: ${data.outcomeState ?? "updated"}`);
      setObsSummary("");
      setSelectedEvidenceIds([]);
      await refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record observation.");
    } finally {
      setBusy(false);
    }
  };

  const toggleEvidenceSelection = (id: string) => {
    setSelectedEvidenceIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  if (loading && !summary) {
    return (
      <section aria-labelledby="outcome-lineage-heading" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium">Loading Outcome Review & Complete Lineage...</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="outcome-lineage-heading" className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
              P2-10 Canonical Lineage
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Correlation ≠ Causation
            </span>
          </div>
          <h2 id="outcome-lineage-heading" className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
            Outcome Review & Complete Lineage Experience
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Review observed versus expected Outcomes. Traverse: Evidence → Finding → Recommendation → Decision → Action → Task → Observation with gaps and disputes honestly represented.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={busy || loading}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          Refresh Lineage
        </button>
      </div>

      {/* Invariant callout */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1">
        <p className="font-semibold text-blue-950">Canonical Assurance Invariant:</p>
        <p>
          <strong>Task Completion ≠ Outcome Achievement.</strong> A completed task establishes only execution progress; Outcome achievement strictly requires authorized, evidence-backed observation against LIVE verified evidence. Correlation links are never promoted to causation without explicit causal identifiers.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Notice</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {statusMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {statusMessage}
        </div>
      )}

      {/* Outcome Selector */}
      <div className="space-y-2">
        <label htmlFor="outcome-select" className="block text-sm font-semibold text-zinc-800">
          Select Expected Outcome to Review ({summary?.outcomes?.length ?? 0} registered)
        </label>
        {(!summary?.outcomes || summary.outcomes.length === 0) ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            No Canonical Task Outcomes registered yet in this project scope. Create or dispatch tasks with expected outcomes to explore lineage.
          </div>
        ) : (
          <select
            id="outcome-select"
            value={selectedOutcomeId}
            onChange={(e) => setSelectedOutcomeId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {summary.outcomes.map((o) => {
              const outcomeId = String(o.id);
              const state = String(o.state);
              const expected = String(o.expected_result);
              return (
                <option key={outcomeId} value={outcomeId}>
                  [{state.toUpperCase()}] {expected.slice(0, 60)} ({short(outcomeId)})
                </option>
              );
            })}
          </select>
        )}
      </div>

      {selectedLineage && (
        <div className="space-y-6">
          {/* Outcome Status Banner */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-zinc-500">Outcome State</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedLineage.outcomeState === "achieved"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedLineage.outcomeState === "disputed"
                          ? "bg-rose-100 text-rose-800"
                          : selectedLineage.outcomeState === "inconclusive"
                            ? "bg-amber-100 text-amber-800"
                            : selectedLineage.outcomeState === "partially_achieved"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-zinc-200 text-zinc-800"
                    }`}
                  >
                    {selectedLineage.outcomeState.toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-zinc-800">{selectedLineage.expectedResult}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-zinc-500">Lineage Integrity</span>
                <div className="mt-0.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedLineage.lineageStatus === "complete"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : selectedLineage.lineageStatus === "disputed"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : selectedLineage.lineageStatus === "inconclusive"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                    }`}
                  >
                    {selectedLineage.lineageStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Gaps / Disputes Warning */}
            {selectedLineage.gaps.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Detected Lineage Gaps ({selectedLineage.gaps.length}):</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {selectedLineage.gaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedLineage.disputes.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1">
                <p className="font-semibold">Disputed / Inconclusive Aspects ({selectedLineage.disputes.length}):</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {selectedLineage.disputes.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedLineage.hasCorrelationOnly && (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 text-xs text-indigo-900">
                <strong>Notice:</strong> One or more transitions in this lineage share a correlation identifier without an explicit causal pointer. They are preserved honestly as correlational links.
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-200 gap-4 text-sm font-medium">
            <button
              onClick={() => setActiveTab("lineage")}
              className={`pb-2 transition-colors border-b-2 ${
                activeTab === "lineage"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Complete Lineage Stepper ({selectedLineage.steps.length} Nodes)
            </button>
            <button
              onClick={() => setActiveTab("observe")}
              className={`pb-2 transition-colors border-b-2 ${
                activeTab === "observe"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Record Evidence-Backed Observation
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`pb-2 transition-colors border-b-2 ${
                activeTab === "audit"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Audit Trail Events ({selectedLineage.auditEvents.length})
            </button>
          </div>

          {/* TAB 1: Complete Lineage Stepper */}
          {activeTab === "lineage" && (
            <div className="space-y-4">
              <div className="space-y-3">
                {selectedLineage.steps.map((step, idx) => {
                  const transition = selectedLineage.transitions.find((t) => t.fromKind === step.kind);
                  const isMissing = step.status === "missing";
                  const isDisputed = step.status === "disputed";
                  const isInconclusive = step.status === "inconclusive";
                  const isDegraded = step.status === "degraded";
                  const isFixture = step.isFixture;

                  return (
                    <div key={`${step.kind}-${step.id || idx}`} className="relative">
                      <article
                        className={`rounded-xl border p-4 transition-all ${
                          isMissing
                            ? "border-dashed border-zinc-300 bg-zinc-50/80 text-zinc-500"
                            : isDisputed
                              ? "border-rose-300 bg-rose-50/50"
                              : isInconclusive
                                ? "border-amber-300 bg-amber-50/50"
                                : isDegraded
                                  ? "border-amber-200 bg-amber-50/30"
                                  : isFixture
                                    ? "border-violet-200 bg-violet-50/30"
                                    : "border-zinc-200 bg-white hover:border-zinc-300 shadow-sm"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                              {STEP_KIND_LABELS[step.kind] || step.kind}
                            </span>
                            {isFixture && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
                                FIXTURE
                              </span>
                            )}
                            {step.evidenceAssertionType && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                                {step.evidenceAssertionType}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                step.status === "intact"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : step.status === "missing"
                                    ? "bg-zinc-200 text-zinc-700"
                                    : step.status === "disputed"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {step.status.toUpperCase()}
                            </span>
                          </div>
                          {step.id && (
                            <span className="font-mono text-xs text-zinc-400" title={step.id}>
                              ID: {short(step.id)}
                            </span>
                          )}
                        </div>

                        <h4 className="mt-1 text-sm font-semibold text-zinc-900">{step.title}</h4>
                        <p className="mt-1 text-xs text-zinc-600">{step.summary}</p>

                        {isMissing && step.gapReason && (
                          <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                            <strong>Gap:</strong> {step.gapReason}
                          </p>
                        )}

                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-500 sm:grid-cols-4">
                          {step.occurredAt && (
                            <div>
                              <dt className="font-medium text-zinc-700">Occurred:</dt>
                              <dd>{new Date(step.occurredAt).toLocaleString()}</dd>
                            </div>
                          )}
                          {step.recordedAt && (
                            <div>
                              <dt className="font-medium text-zinc-700">Recorded:</dt>
                              <dd>{new Date(step.recordedAt).toLocaleString()}</dd>
                            </div>
                          )}
                          {step.confidenceScore !== undefined && (
                            <div>
                              <dt className="font-medium text-zinc-700">Confidence:</dt>
                              <dd>{formatPct(step.confidenceScore)}</dd>
                            </div>
                          )}
                          {step.missingDataState && (
                            <div>
                              <dt className="font-medium text-zinc-700">Data State:</dt>
                              <dd>{step.missingDataState}</dd>
                            </div>
                          )}
                        </dl>
                      </article>

                      {/* Transition Link */}
                      {transition && (
                        <div className="my-1.5 flex items-center justify-center">
                          <div
                            className={`flex items-center gap-2 rounded-full border px-3 py-0.5 text-[11px] font-medium shadow-xs ${
                              transition.relationship === "causation"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : transition.relationship === "correlation_only"
                                  ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                                  : transition.relationship === "unlinked"
                                    ? "border-zinc-300 bg-zinc-100 text-zinc-500 border-dashed"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                            }`}
                            title={transition.relationshipExplanation}
                          >
                            <span>↓</span>
                            <span>
                              {transition.relationship === "causation"
                                ? "Causal Link (Verified ID)"
                                : transition.relationship === "correlation_only"
                                  ? "Correlation Only (Correlation ≠ Causation)"
                                  : transition.relationship === "unlinked"
                                    ? "Lineage Gap / Unlinked"
                                    : "Direct Reference"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Record Observation Form */}
          {activeTab === "observe" && (
            <form onSubmit={handleRecordObservation} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Record Canonical Outcome Observation</h3>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Record an evidence-backed observation of the real-world outcome. Requires LIVE verified evidence items.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="obs-state" className="block text-xs font-semibold text-zinc-700">
                    Observation State
                  </label>
                  <select
                    id="obs-state"
                    value={obsState}
                    onChange={(e) => setObsState(e.target.value as CanonicalOutcomeObservationState)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="achieved">Achieved (Full real-world success verified)</option>
                    <option value="partial">Partial (Some criteria met, others unmet)</option>
                    <option value="failed">Failed (Expected result not achieved)</option>
                    <option value="disputed">Disputed (Conflicting evidence or interpretation)</option>
                    <option value="inconclusive">Inconclusive (Insufficient data to confirm)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="obs-confidence" className="block text-xs font-semibold text-zinc-700">
                    Confidence Score ({formatPct(obsConfidence)})
                  </label>
                  <input
                    id="obs-confidence"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={obsConfidence}
                    onChange={(e) => setObsConfidence(Number(e.target.value))}
                    className="mt-2 w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label htmlFor="obs-missing-data" className="block text-xs font-semibold text-zinc-700">
                    Missing Data State
                  </label>
                  <select
                    id="obs-missing-data"
                    value={obsMissingData}
                    onChange={(e) => setObsMissingData(e.target.value as MissingDataState)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="COMPLETE">COMPLETE (All required dimensions captured)</option>
                    <option value="PARTIAL">PARTIAL (Some telemetry missing)</option>
                    <option value="UNKNOWN">UNKNOWN (Coverage completeness undetermined)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="obs-summary" className="block text-xs font-semibold text-zinc-700">
                    Observation Summary & Empirical Rationale
                  </label>
                  <textarea
                    id="obs-summary"
                    rows={3}
                    value={obsSummary}
                    onChange={(e) => setObsSummary(e.target.value)}
                    placeholder="Describe empirical telemetry, metric values, or observations validating or invalidating the outcome criteria..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Supporting LIVE Evidence Selection */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Select Supporting LIVE Evidence Items ({selectedEvidenceIds.length} selected)
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Canonical rule: DEMO_FIXTURE evidence is prohibited for canonical observations. Only verified LIVE evidence can be attached.
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
                    {liveEvidenceItems.length === 0 ? (
                      <p className="p-2 text-xs text-zinc-400">No LIVE evidence items available. Ingest live telemetry or events first.</p>
                    ) : (
                      liveEvidenceItems.map((ev) => {
                        const evId = String(ev.id);
                        const isSelected = selectedEvidenceIds.includes(evId);
                        return (
                          <label
                            key={evId}
                            className={`flex items-start gap-2.5 p-2 rounded cursor-pointer transition-colors ${
                              isSelected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-zinc-50 border border-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleEvidenceSelection(evId)}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-zinc-800">
                                [{String(ev.assertion_type)}] {String(ev.classification)} ({short(evId)})
                              </span>
                              <p className="text-zinc-500 text-[11px]">
                                Confidence: {formatPct(Number(ev.confidence_score))} · Freshness: {String(ev.freshness_state)} · Data: {String(ev.missing_data_state)}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  {busy ? "Recording Observation..." : "Record Canonical Observation"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Audit Trail Events */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <p>Chronological immutable platform audit records associated with this outcome lineage.</p>
              </div>
              {selectedLineage.auditEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                  No linked platform events found for this outcome correlation.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedLineage.auditEvents.map((evt, idx) => {
                    const payload = evt.event_payload as Record<string, unknown> | undefined;
                    return (
                      <article key={String(evt.id || idx)} className="rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-800">
                            {String(evt.event_category)} / {String(evt.event_type)}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(String(evt.occurred_at)).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                          <span>Actor: {String(evt.actor_type || "system")} ({short(evt.actor_id)})</span>
                          <span>Correlation: {short(evt.correlation_id)}</span>
                          {evt.causation_id != null && <span>Causation: {short(evt.causation_id)}</span>}
                          {evt.raw_reference_table != null && <span>Ref: {String(evt.raw_reference_table)}</span>}
                        </div>
                        {payload && Object.keys(payload).length > 0 && (
                          <pre className="mt-2 max-h-24 overflow-y-auto rounded bg-zinc-50 p-2 font-mono text-[10px] text-zinc-700">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
