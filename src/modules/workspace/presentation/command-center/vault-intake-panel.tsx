"use client";

import { useId, useState } from "react";
import { captureAndDeriveDemoEvidence, captureAndDeriveLiveEvidence } from "./operational-data";
import { CloseIcon } from "./icons";

/**
 * Intake classification is an explicit user choice, never an inference.
 *
 * DEMO / FIXTURE is the default and keeps the pre-existing behaviour untouched. LIVE
 * routes to the verified `capture_live_operational_input` contract, which resolves a
 * NON-fixture Source — the only reason the derived Evidence becomes `fixture_state =
 * 'LIVE'` and may therefore support an Outcome Observation under P2-09.
 *
 * The two lineages never merge: fixture Evidence is not promoted, and the live contract
 * refuses to write against a fixture Source.
 */
type IntakeMode = "fixture" | "live";

const MODES: ReadonlyArray<{ value: IntakeMode; label: string; hint: string }> = [
  {
    value: "fixture",
    label: "DEMO / FIXTURE",
    hint: "Demonstration input. Derives DEMO / FIXTURE Evidence, which can never promote an Outcome.",
  },
  {
    value: "live",
    label: "LIVE operational record",
    hint: "A real operational record. Derives LIVE Evidence, which may be cited by an Outcome Observation.",
  },
];

const ASSERTION_TYPES = ["FACT", "INFERENCE", "ASSUMPTION"] as const;
const CLASSIFICATIONS = ["UNCLASSIFIED", "PROJECT_STATUS", "RISK", "ISSUE", "DECISION_CONTEXT", "DELIVERY"] as const;
const MISSING_DATA_STATES = ["COMPLETE", "PARTIAL", "UNKNOWN"] as const;

const labelize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export function VaultIntakePanel({ workspaceId, projectId, onClose, onIntakeComplete }: {
  workspaceId: string; projectId: string; onClose: () => void; onIntakeComplete: (summary: string) => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<IntakeMode>("fixture");
  // P2-09 evidence quality, supplied by the observer rather than assumed. Only the LIVE
  // path exposes these: fixture Evidence is never Observation-eligible, so asking for a
  // judgement it can never carry would be theatre.
  const [assertionType, setAssertionType] = useState<(typeof ASSERTION_TYPES)[number]>("INFERENCE");
  const [classification, setClassification] = useState<string>("PROJECT_STATUS");
  const [missingDataState, setMissingDataState] = useState<(typeof MISSING_DATA_STATES)[number]>("COMPLETE");
  const [confidenceScore, setConfidenceScore] = useState("0.90");

  // Scoped ids: the Command Center mounts responsive surfaces simultaneously, and a
  // hardcoded id would produce duplicate document ids and break label association.
  const uid = useId();
  const inputId = `${uid}-content`;
  const modeGroupId = `${uid}-mode`;

  const isLive = mode === "live";
  const confidence = Number(confidenceScore);
  const confidenceValid = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;

  const submit = async () => {
    if (!content.trim()) { setError("Paste some notes before capture."); return; }
    if (isLive && !confidenceValid) { setError("Confidence must be a number between 0 and 1."); return; }
    setBusy(true); setError("");
    try {
      if (isLive) {
        await captureAndDeriveLiveEvidence(workspaceId, projectId, {
          title: content.slice(0, 80), content,
          assertionType, classification, confidenceScore: confidence, missingDataState,
        });
        onIntakeComplete("LIVE Evidence derived with complete provenance. Intelligence has not run, and no Outcome was achieved.");
      } else {
        await captureAndDeriveDemoEvidence(workspaceId, projectId, { title: content.slice(0, 80), content });
        onIntakeComplete("DEMO / FIXTURE Evidence derived with complete provenance. Intelligence has not run.");
      }
      setContent(""); onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not capture those notes. Nothing was reported as successful.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_2px_20px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Add project notes</p>
          <p className="mt-0.5 text-xs text-zinc-500">Capture and Evidence derivation remain separate transitions; intelligence will not run.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-zinc-500 hover:bg-white/5"><CloseIcon className="h-4 w-4" /></button>
      </div>

      <fieldset className="mt-3" aria-describedby={`${modeGroupId}-hint`}>
        <legend className="text-[11px] font-medium text-zinc-400">How should this input be recorded?</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                mode === option.value ? "border-sky-500/40 bg-sky-500/10 text-sky-200" : "border-white/10 text-zinc-400 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name={modeGroupId}
                value={option.value}
                checked={mode === option.value}
                onChange={() => { setMode(option.value); setError(""); }}
                className="h-3 w-3 accent-sky-400"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p id={`${modeGroupId}-hint`} className="mt-1.5 text-[11px] text-zinc-500">
          {MODES.find((option) => option.value === mode)?.hint}
        </p>
      </fieldset>

      <label className="sr-only" htmlFor={inputId}>{isLive ? "Live operational record" : "Manual demo project notes"}</label>
      <textarea
        id={inputId}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="The supplier said delivery may slip to next Friday…"
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/10"
      />

      {isLive && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] text-zinc-400">
            Assertion type
            <select value={assertionType} onChange={(e) => setAssertionType(e.target.value as (typeof ASSERTION_TYPES)[number])} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-100">
              {ASSERTION_TYPES.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-zinc-400">
            Classification
            <select value={classification} onChange={(e) => setClassification(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-100">
              {CLASSIFICATIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-zinc-400">
            Missing data
            <select value={missingDataState} onChange={(e) => setMissingDataState(e.target.value as (typeof MISSING_DATA_STATES)[number])} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-100">
              {MISSING_DATA_STATES.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-zinc-400">
            Confidence (0–1)
            <input type="number" min="0" max="1" step="0.01" value={confidenceScore} onChange={(e) => setConfidenceScore(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-100" />
          </label>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-rose-400">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !content.trim()} className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Capturing and deriving…" : isLive ? "Capture LIVE record and derive Evidence" : "Capture and derive Evidence"}
        </button>
      </div>
    </div>
  );
}
