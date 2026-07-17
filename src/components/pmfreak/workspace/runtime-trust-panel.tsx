import type { ValidationConfidence, ValidationFeedback, ValidationTrace } from "@/lib/workspace/runtime-validation";
import { VALIDATION_CONFIDENCE_LABELS } from "@/lib/workspace/validation-trace-builder";

const CONFIDENCE_STYLES: Record<ValidationConfidence, string> = {
  low: "text-zinc-500",
  building: "text-amber-300/80",
  credible: "text-cyan-300/80",
  high: "text-emerald-300/80",
};

const SOURCE_LABELS: Record<string, string> = {
  conversation: "Conversation",
  memory: "Memory",
  awakening: "Awakening",
  imprint: "Imprint",
  delivery: "Delivery",
  stakeholders: "Stakeholders",
  risk: "Risk",
  navigation: "Navigation",
};

type Props = {
  traces: ValidationTrace[];
  currentConfidence: ValidationConfidence;
  onFeedback: (traceId: string, feedback: ValidationFeedback) => void;
};

export function RuntimeTrustPanel({ traces, currentConfidence, onFeedback }: Props) {
  const latest = traces[traces.length - 1] ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
      <p className="mb-2.5 text-[9px] uppercase tracking-[0.28em] text-zinc-400">Runtime Trust</p>

      {/* Confidence */}
      <div className="mb-3">
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Confidence</p>
        <p className={`font-medium ${CONFIDENCE_STYLES[currentConfidence]}`}>
          {VALIDATION_CONFIDENCE_LABELS[currentConfidence]}
        </p>
      </div>

      {latest ? (
        <>
          {/* Active Signal Sources */}
          {latest.activeSources.length > 0 ? (
            <div className="mb-3">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Active Sources</p>
              <div className="flex flex-wrap gap-1">
                {latest.activeSources.map((src) => (
                  <span
                    key={src}
                    className="rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-2 py-0.5 text-[10px] text-violet-300/70"
                  >
                    {SOURCE_LABELS[src] ?? src}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Operational Lineage */}
          {latest.reasoningPath.length > 0 ? (
            <details className="mb-3">
              <summary className="cursor-pointer text-[10px] text-zinc-500 uppercase tracking-widest select-none">
                Operational Lineage
              </summary>
              <ol className="mt-1.5 space-y-0.5 text-slate-500">
                {latest.reasoningPath.map((step, i) => (
                  <li key={step} className="flex items-start gap-1">
                    {i > 0 ? <span className="text-zinc-300">→</span> : null}
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          {/* Trust Notes */}
          {latest.continuitySignals.length > 0 ? (
            <details className="mb-3">
              <summary className="cursor-pointer text-[10px] text-zinc-500 uppercase tracking-widest select-none">
                Trust Notes
              </summary>
              <ul className="mt-1.5 space-y-0.5 text-slate-500">
                {latest.continuitySignals.map((note) => (
                  <li key={note} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 text-violet-500/50">·</span>
                    {note}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {/* Feedback */}
          {latest.feedbackState ? (
            <p className="text-[10px] text-zinc-400">
              Feedback recorded:{" "}
              <span className={latest.feedbackState === "aligned" ? "text-emerald-400/60" : "text-amber-400/60"}>
                {latest.feedbackState === "aligned" ? "Runtime aligned" : "Needs recalibration"}
              </span>
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onFeedback(latest.traceId, "aligned")}
                className="flex-1 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] py-1 text-[10px] text-emerald-300/60 transition hover:border-emerald-400/35 hover:text-emerald-300/80"
              >
                Runtime aligned
              </button>
              <button
                type="button"
                onClick={() => onFeedback(latest.traceId, "needs-recalibration")}
                className="flex-1 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] py-1 text-[10px] text-amber-300/60 transition hover:border-amber-400/35 hover:text-amber-300/80"
              >
                Needs recalibration
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-zinc-300">Awaiting first operational signal</p>
      )}
    </div>
  );
}
