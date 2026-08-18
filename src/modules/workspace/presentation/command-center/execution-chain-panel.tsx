"use client";

/**
 * P2-12 — the PM Execution Center continuation surface.
 *
 * Renders what happens AFTER a Decision is recorded, as one continuous story:
 *   governed Material Action -> canonical Task -> internal Execution
 *   -> expected Outcome -> evidence-backed Observation -> review and lineage
 *
 * Every control calls an operation that already existed before P2-12. This component
 * defines no aggregate, mints no canonical id, invents no status, and never reports
 * success before the authoritative server write returns. Stage gating comes from
 * `execution-read-model.ts`, which derives it from persisted rows and the server's own
 * eligibility rules — never from a client-side role name.
 */

import { useId, useRef, useState } from "react";
import {
  createAttemptTracker,
  MATERIAL_ACTION_CLASSES,
  MATERIAL_ACTION_RISKS,
  MATERIAL_ACTION_REVERSIBILITY,
  MATERIAL_ACTION_SIDE_EFFECTS,
  MISSING_DATA_STATES,
  type ExecutionOperation,
  type GovernedExecutionChain,
  type ExecutionStageKey,
} from "./execution-read-model";

/** Plain-language help for the P2-06 classification the human must supply. */
const MISSING_DATA_HELP: Record<string, string> = {
  COMPLETE: "All the data needed to judge this was available.",
  PARTIAL: "Some of the data needed was missing.",
  UNKNOWN: "It is not known whether data was missing.",
};

function Choice({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  hint?: string;
}) {
  return (
    <div className="mt-2">
      <label htmlFor={id} className="text-[11px] font-medium text-zinc-400">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 focus:border-sky-500/40 focus:outline-none"
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{hint}</p>}
    </div>
  );
}

const OBSERVATION_STATES: ReadonlyArray<{ value: string; label: string; hint: string }> = [
  { value: "achieved", label: "Achieved", hint: "Evidence supports the expected outcome." },
  { value: "partial", label: "Partially achieved", hint: "Evidence supports only part of the expected outcome." },
  { value: "failed", label: "Not achieved", hint: "Evidence shows the expected outcome did not happen." },
  { value: "disputed", label: "Disputed", hint: "Evidence conflicts. Recorded as disputed, not resolved." },
  { value: "inconclusive", label: "Inconclusive", hint: "Evidence cannot settle whether it happened." },
];

function labelize(value: string | null): string {
  return value ? value.replaceAll("_", " ") : "—";
}

function StageRow({
  stage,
  children,
}: {
  stage: GovernedExecutionChain["stages"][number];
  children?: React.ReactNode;
}) {
  const stateLabel = stage.state === "complete" ? "Complete" : stage.state === "present" ? "Recorded" : "Not started";
  return (
    <li className="border-t border-white/10 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-zinc-200">{stage.label}</h4>
        {/* State is conveyed as text, never by colour alone. */}
        <span className="text-[11px] text-zinc-400">{stateLabel}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{stage.effect}</p>
      {stage.blockedReason && (
        <p className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-400">
          {stage.blockedReason}
        </p>
      )}
      {children}
    </li>
  );
}

export function ExecutionChainPanel({
  chain,
  onRun,
  evidenceOptions,
}: {
  chain: GovernedExecutionChain;
  /** Must reject on failure so this panel can surface the real error and keep input. */
  onRun: (operation: ExecutionOperation) => Promise<void>;
  /** Canonical evidence ids available to back an Observation. */
  evidenceOptions: Array<{ id: string; title: string }>;
}) {
  const headingId = useId();
  const expectedId = useId();
  const summaryId = useId();
  const stateId = useId();
  const actionFormId = useId();
  const qualityId = useId();

  const [pending, setPending] = useState<ExecutionStageKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Survives re-renders without causing one; the token must be read synchronously at
   *  submit time, so a ref rather than state. */
  const attempt = useRef(createAttemptTracker());
  const [expectedResult, setExpectedResult] = useState("");
  const [observationState, setObservationState] = useState("achieved");
  const [observationSummary, setObservationSummary] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  // P2-06 classification, supplied by the authorized human. No value is pre-selected:
  // materiality — and therefore the governance outcome — is derived from these.
  const [actionType, setActionType] = useState("");
  const [intendedEffect, setIntendedEffect] = useState("");
  const [actionClass, setActionClass] = useState("");
  const [risk, setRisk] = useState("");
  const [reversibility, setReversibility] = useState("");
  const [sideEffect, setSideEffect] = useState("");
  // P2-09 evidence quality, likewise supplied rather than assumed.
  const [confidence, setConfidence] = useState("");
  const [missingDataState, setMissingDataState] = useState("");

  const stage = (key: ExecutionStageKey) => chain.stages.find((entry) => entry.key === key)!;

  async function run(key: ExecutionStageKey, operation: ExecutionOperation) {
    setPending(key);
    setError(null);
    try {
      await onRun(operation);
      // Only a server-accepted submission ends the attempt. A failure — including a
      // canonical idempotency conflict — keeps the token so the retry carries the same
      // identity instead of writing a second Observation.
      if (operation.kind === "observation") attempt.current.succeed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The operation could not be completed.");
    } finally {
      setPending(null);
    }
  }

  const actionStage = stage("material_action");
  const taskStage = stage("task");
  const executionStage = stage("execution");
  const outcomeStage = stage("outcome");
  const observationStage = stage("observation");
  const reviewStage = stage("review");

  const busy = pending !== null;
  const selectedEvidence = evidenceId || evidenceOptions[0]?.id || "";
  /** The chain's persisted correlation: P2-06 sets it on the Action and P2-08 copies it
   *  onto the Execution, so Outcome and Observation join the same chain rather than
   *  starting a disconnected one. */
  const chainCorrelationId = chain.action?.correlationId ?? "";
  const actionDraftComplete =
    actionType.trim().length > 0 &&
    intendedEffect.trim().length > 0 &&
    Boolean(actionClass && risk && reversibility && sideEffect);
  const confidenceValue = Number(confidence);
  const confidenceValid = confidence !== "" && Number.isFinite(confidenceValue) && confidenceValue >= 0 && confidenceValue <= 1;
  const observationComplete =
    observationSummary.trim().length > 0 && Boolean(selectedEvidence) && confidenceValid && Boolean(missingDataState);

  return (
    <section aria-labelledby={headingId} className="mt-5 border-t border-white/10 pt-4">
      <h3 id={headingId} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        After your decision
      </h3>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
        Recording a decision does not act. Each step below is a separate governed operation you choose to take.
      </p>

      {/* The P2-12 invariant, stated from persisted state rather than implied by layout. */}
      <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-zinc-300">
        {chain.boundary.statement}
      </p>

      <ol className="mt-3 space-y-3">
        <StageRow stage={actionStage}>
          {chain.action ? (
            <dl className="mt-2 grid gap-1 text-[11px] text-zinc-400">
              <div className="flex gap-2"><dt className="text-zinc-500">Action</dt><dd className="font-mono">{chain.action.actionId}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">Governance</dt><dd>{labelize(chain.action.governanceState)}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">Executable</dt><dd>{chain.action.canExecute ? "yes" : "no — authorization is not execution"}</dd></div>
            </dl>
          ) : actionStage.actionable ? (
            <div className="mt-2">
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Governance classifies this action from what you state below, so describe the action you
                actually intend — these values are not assumed for you.
              </p>
              <label htmlFor={`${actionFormId}-type`} className="mt-2 block text-[11px] font-medium text-zinc-400">
                What kind of action is this? (required)
              </label>
              <input
                id={`${actionFormId}-type`}
                value={actionType}
                onChange={(event) => setActionType(event.target.value)}
                placeholder="e.g. supplier contract amendment"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
              />
              <label htmlFor={`${actionFormId}-effect`} className="mt-2 block text-[11px] font-medium text-zinc-400">
                What would it change? (required)
              </label>
              <textarea
                id={`${actionFormId}-effect`}
                rows={2}
                value={intendedEffect}
                onChange={(event) => setIntendedEffect(event.target.value)}
                placeholder="The intended effect of acting"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
              />
              <Choice id={`${actionFormId}-class`} label="Action class (required)" value={actionClass} options={MATERIAL_ACTION_CLASSES} onChange={setActionClass} />
              <Choice id={`${actionFormId}-risk`} label="Risk (required)" value={risk} options={MATERIAL_ACTION_RISKS} onChange={setRisk} />
              <Choice id={`${actionFormId}-reversibility`} label="Reversibility (required)" value={reversibility} options={MATERIAL_ACTION_REVERSIBILITY} onChange={setReversibility} />
              <Choice id={`${actionFormId}-side-effect`} label="Side effect (required)" value={sideEffect} options={MATERIAL_ACTION_SIDE_EFFECTS} onChange={setSideEffect} />
              <button
                type="button"
                disabled={busy || !actionDraftComplete}
                onClick={() =>
                  void run("material_action", {
                    kind: "material_action",
                    decisionId: chain.decisionId,
                    draft: { actionType: actionType.trim(), intendedEffect: intendedEffect.trim(), actionClass, risk, reversibility, sideEffect },
                    justification: chain.rationale ?? "Recorded human decision.",
                  })
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "material_action" ? "Requesting governed action…" : "Request governed material action"}
              </button>
              {!actionDraftComplete && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Describe the action and classify it to continue. Governance depends on these answers.
                </p>
              )}
            </div>
          ) : null}
        </StageRow>

        <StageRow stage={taskStage}>
          {chain.task ? (
            <dl className="mt-2 grid gap-1 text-[11px] text-zinc-400">
              <div className="flex gap-2"><dt className="text-zinc-500">Task</dt><dd className="font-mono">{chain.task.taskId}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">Status</dt><dd>{labelize(chain.task.status)}</dd></div>
            </dl>
          ) : taskStage.actionable && chain.action ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("task", { kind: "task", actionId: chain.action!.actionId })}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending === "task" ? "Creating canonical task…" : "Create canonical internal task"}
            </button>
          ) : null}
        </StageRow>

        <StageRow stage={executionStage}>
          {chain.executions.length > 0 && (
            <dl className="mt-2 grid gap-1 text-[11px] text-zinc-400">
              <div className="flex gap-2"><dt className="text-zinc-500">Execution</dt><dd className="font-mono">{chain.latestExecution?.executionId}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">State</dt><dd>{labelize(chain.latestExecution?.status ?? null)}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">Attempts</dt><dd>{chain.latestExecution?.attemptCount ?? "—"}</dd></div>
            </dl>
          )}
          {executionStage.actionable && chain.task && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["queue", "start", "complete"] as const).map((command) => (
                <button
                  key={command}
                  type="button"
                  disabled={busy}
                  onClick={() => void run("execution", { kind: "execution", taskId: chain.task!.taskId, command })}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending === "execution" ? "Recording…" : `Record ${command}`}
                </button>
              ))}
            </div>
          )}
        </StageRow>

        <StageRow stage={outcomeStage}>
          {chain.outcome ? (
            <dl className="mt-2 grid gap-1 text-[11px] text-zinc-400">
              <div className="flex gap-2"><dt className="text-zinc-500">Outcome</dt><dd className="font-mono">{chain.outcome.outcomeId}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">Expected</dt><dd>{chain.outcome.expectedResult ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-zinc-500">State</dt><dd>{labelize(chain.outcome.state)}</dd></div>
            </dl>
          ) : outcomeStage.actionable && chain.task ? (
            <div className="mt-2">
              <label htmlFor={expectedId} className="text-[11px] font-medium text-zinc-400">
                What is this work expected to achieve? (required)
              </label>
              <textarea
                id={expectedId}
                rows={2}
                value={expectedResult}
                onChange={(event) => setExpectedResult(event.target.value)}
                placeholder="The outcome you expect, in business terms"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || expectedResult.trim().length === 0 || !chainCorrelationId}
                onClick={() =>
                  void run("outcome", {
                    kind: "outcome",
                    taskId: chain.task!.taskId,
                    expectedResult: expectedResult.trim(),
                    correlationId: chainCorrelationId,
                  })
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "outcome" ? "Defining expected outcome…" : "Define expected outcome"}
              </button>
              {expectedResult.trim().length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">Describe the expected outcome to continue.</p>
              )}
            </div>
          ) : null}
        </StageRow>

        <StageRow stage={observationStage}>
          {chain.observations.length > 0 && (
            <ul className="mt-2 space-y-2">
              {chain.observations.map((observation) => (
                <li key={observation.observationId} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[11px] text-zinc-400">
                  <p className="text-zinc-300">{labelize(observation.observationState)}</p>
                  <p className="mt-0.5">{observation.summary ?? "—"}</p>
                  <p className="mt-0.5">
                    Evidence: {observation.evidenceReferenceIds.length > 0 ? observation.evidenceReferenceIds.join(", ") : "none recorded"}
                    {observation.missingDataState ? ` · missing data: ${labelize(observation.missingDataState)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {observationStage.actionable && chain.outcome && (
            <div className="mt-2">
              <label htmlFor={stateId} className="text-[11px] font-medium text-zinc-400">What does the evidence say?</label>
              <select
                id={stateId}
                value={observationState}
                onChange={(event) => setObservationState(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 focus:border-sky-500/40 focus:outline-none"
              >
                {OBSERVATION_STATES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {OBSERVATION_STATES.find((option) => option.value === observationState)?.hint}
              </p>

              <label htmlFor={summaryId} className="mt-2 block text-[11px] font-medium text-zinc-400">
                What was observed? (required)
              </label>
              <textarea
                id={summaryId}
                rows={2}
                value={observationSummary}
                onChange={(event) => setObservationSummary(event.target.value)}
                placeholder="What the evidence actually shows"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
              />

              {evidenceOptions.length > 0 ? (
                <>
                  <label htmlFor={`${summaryId}-evidence`} className="mt-2 block text-[11px] font-medium text-zinc-400">
                    Supporting evidence (required)
                  </label>
                  <select
                    id={`${summaryId}-evidence`}
                    value={selectedEvidence}
                    onChange={(event) => setEvidenceId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 focus:border-sky-500/40 focus:outline-none"
                  >
                    {evidenceOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.title}</option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                  No live, provenance-bearing evidence is available for this project yet, so an
                  observation cannot be recorded. Demo or fixture evidence cannot promote an outcome.
                </p>
              )}

              {/* Epistemic state is stated by the observer, never assumed to be certain. */}
              <div className="mt-2">
                <label htmlFor={`${qualityId}-confidence`} className="text-[11px] font-medium text-zinc-400">
                  How confident is this observation? 0 to 1 (required)
                </label>
                <input
                  id={`${qualityId}-confidence`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value)}
                  placeholder="e.g. 0.6"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
                />
              </div>
              <Choice
                id={`${qualityId}-missing`}
                label="Was any needed data missing? (required)"
                value={missingDataState}
                options={MISSING_DATA_STATES}
                onChange={setMissingDataState}
                hint={MISSING_DATA_HELP[missingDataState]}
              />

              <button
                type="button"
                disabled={busy || !observationComplete || !chainCorrelationId}
                onClick={() =>
                  void run("observation", {
                    kind: "observation",
                    outcomeId: chain.outcome!.outcomeId,
                    observationState,
                    summary: observationSummary.trim(),
                    evidenceReferenceIds: [selectedEvidence],
                    quality: { confidenceScore: confidenceValue, missingDataState },
                    correlationId: chainCorrelationId,
                    // Reused across retries of this submission; a fresh token is minted
                    // once the previous submission has been accepted.
                    attemptNonce: attempt.current.begin(),
                  })
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "observation" ? "Recording observation…" : "Record evidence-backed observation"}
              </button>
              {!observationComplete && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  An observation needs a summary, supporting evidence, a confidence value and a missing-data state.
                </p>
              )}
            </div>
          )}
        </StageRow>

        <StageRow stage={reviewStage}>
          {chain.lineage && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-medium text-zinc-400">
                Complete lineage ({chain.lineage.steps.length} steps · {labelize(chain.lineage.lineageStatus)})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {chain.lineage.steps.map((step, index) => (
                  <li key={`${step.kind}-${step.id ?? index}`} className="text-[11px] leading-relaxed text-zinc-400">
                    <span className="text-zinc-300">{labelize(step.kind)}</span>
                    {" · "}
                    {step.id ? <span className="font-mono">{step.id}</span> : <span>{step.gapReason ?? "not present"}</span>}
                  </li>
                ))}
              </ul>
              {chain.lineage.gaps.length > 0 && (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                  Gaps: {chain.lineage.gaps.join("; ")}
                </p>
              )}
              {chain.lineage.disputes.length > 0 && (
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  Disputes: {chain.lineage.disputes.join("; ")}
                </p>
              )}
              {chain.lineage.hasCorrelationOnly && (
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  Some links are correlation only, so this chain does not establish causation.
                </p>
              )}
            </details>
          )}
        </StageRow>
      </ol>

      <p role="status" aria-live="polite" className="sr-only">
        {pending ? `Recording ${pending.replaceAll("_", " ")}.` : ""}
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
