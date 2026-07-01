type StepConfig = {
  id: number;
  label: string;
  sublabel: string;
};

const STEPS: StepConfig[] = [
  { id: 1, label: "Workspace", sublabel: "Environment" },
  { id: 2, label: "Initiative", sublabel: "Context" },
  { id: 3, label: "Governance", sublabel: "Trust layer" },
  { id: 4, label: "Intelligence", sublabel: "Signal readiness" },
  { id: 5, label: "Review", sublabel: "Final validation" },
];

export function ActivationProgress({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative h-0.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-5 gap-1">
        {STEPS.map((s) => {
          const isActive = s.id === currentStep;
          const isDone = s.id < currentStep;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStepClick(s.id)}
              className={`rounded-xl border px-2 py-2.5 text-left transition-all duration-300 ${
                isActive
                  ? "border-sky-300 bg-sky-50"
                  : isDone
                    ? "border-slate-200 bg-slate-50 opacity-70 hover:opacity-90"
                    : "border-slate-200 bg-slate-50/60 opacity-50"
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  isActive ? "text-sky-600" : isDone ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {isDone ? "✓" : `0${s.id}`}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                {s.label}
              </p>
              <p className={`text-[10px] ${isActive ? "text-slate-500" : "text-slate-400"}`}>{s.sublabel}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
