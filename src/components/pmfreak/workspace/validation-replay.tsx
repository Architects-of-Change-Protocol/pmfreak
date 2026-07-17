import type { ValidationTrace } from "@/lib/workspace/runtime-validation";
import { VALIDATION_CONFIDENCE_LABELS } from "@/lib/workspace/validation-trace-builder";

const SOURCE_ABBREV: Record<string, string> = {
  conversation: "Conv",
  memory: "Mem",
  awakening: "Awake",
  imprint: "Imprint",
  delivery: "Delivery",
  stakeholders: "Stakeholders",
  risk: "Risk",
  navigation: "Nav",
};

type Props = {
  traces: ValidationTrace[];
};

export function ValidationReplay({ traces }: Props) {
  const recent = [...traces].reverse().slice(0, 8);

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
      <summary className="cursor-pointer select-none text-[9px] uppercase tracking-[0.28em] text-zinc-400">
        Validation Replay
      </summary>
      {recent.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-300">No traces recorded yet</p>
      ) : (
        <div className="mt-3 space-y-3">
          {recent.map((trace, idx) => (
            <div
              key={trace.traceId}
              className="rounded-xl border border-slate-200 bg-[#FCFBF9]/30 p-2.5 space-y-1.5"
            >
              <p className="text-[9px] uppercase tracking-widest text-zinc-400">
                Trace #{traces.length - idx}
              </p>

              {trace.triggerSummary ? (
                <div>
                  <span className="text-zinc-400">Input: </span>
                  <span className="text-slate-500">{trace.triggerSummary.slice(0, 72)}</span>
                </div>
              ) : null}

              {trace.activeSources.length > 0 ? (
                <div>
                  <span className="text-zinc-400">Runtime: </span>
                  <span className="text-slate-500">
                    {trace.activeSources.map((s) => SOURCE_ABBREV[s] ?? s).join(" + ")}
                  </span>
                </div>
              ) : null}

              <div>
                <span className="text-zinc-400">Confidence: </span>
                <span className="text-violet-300/70">{VALIDATION_CONFIDENCE_LABELS[trace.confidence]}</span>
              </div>

              {trace.outputBias ? (
                <div>
                  <span className="text-zinc-400">Output bias: </span>
                  <span className="text-slate-500">{trace.outputBias}</span>
                </div>
              ) : null}

              {trace.feedbackState ? (
                <div>
                  <span className="text-zinc-400">Feedback: </span>
                  <span className={trace.feedbackState === "aligned" ? "text-emerald-400/60" : "text-amber-400/60"}>
                    {trace.feedbackState === "aligned" ? "Runtime aligned" : "Needs recalibration"}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
