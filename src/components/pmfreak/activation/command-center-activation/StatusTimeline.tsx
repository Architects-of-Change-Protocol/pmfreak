import type { ActivationStatus } from "./types";

const STEPS: { status: ActivationStatus; label: string }[] = [
  { status: "activation_started", label: "Started" },
  { status: "request_sent", label: "Creating" },
  { status: "created", label: "Created" },
  { status: "initializing", label: "Initializing" },
  { status: "ready", label: "Ready" },
];

const ORDER: ActivationStatus[] = STEPS.map((s) => s.status);

/** Compact top-of-overlay indicator: which real step of the activation is currently active. */
export function StatusTimeline({ status }: { status: ActivationStatus }) {
  const currentIndex = ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-1.5" role="status" aria-label={`Activation status: ${status}`}>
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={step.status} className="flex flex-1 items-center gap-1.5">
            <div className="flex-1">
              <div className="h-px overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDone || isActive
                      ? "bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-400"
                      : "bg-transparent"
                  }`}
                  style={{ width: isDone ? "100%" : isActive ? "60%" : "0%" }}
                />
              </div>
              <p
                className={`mt-1.5 text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                  isActive ? "text-cyan-700" : isDone ? "text-slate-400" : "text-slate-300"
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
