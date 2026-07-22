import type { ActivationStatus } from "./types";

// Two steps, because there are two real ones. The former five-step timeline
// (Started / Creating / Created / Initializing / Ready) advertised backend
// phases that did not exist.
const STEPS: { status: ActivationStatus; label: string }[] = [
  { status: "submitting", label: "Creating" },
  { status: "success", label: "Created" },
];

const ORDER: ActivationStatus[] = STEPS.map((s) => s.status);

export function StatusTimeline({ status }: { status: ActivationStatus }) {
  const currentIndex = ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-1.5" role="status" aria-label={`Activation status: ${status}`}>
      {STEPS.map((step, index) => {
        const reached = currentIndex >= index && currentIndex !== -1;
        return (
          <div key={step.status} className="flex flex-1 items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                reached ? "bg-cyan-500" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-[10px] uppercase tracking-[0.14em] transition-colors ${
                reached ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
