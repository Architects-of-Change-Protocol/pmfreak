"use client";

import { useEffect, useState } from "react";

const SEQUENCE = [
  { label: "Mapping operational context", detail: "Calibrating project intelligence baseline" },
  { label: "Analyzing stakeholder structure", detail: "Identifying influence patterns and pressure vectors" },
  { label: "Establishing execution baseline", detail: "Anchoring delivery confidence and risk telemetry" },
  { label: "Preparing risk telemetry", detail: "Initializing signal monitoring across delivery domains" },
  { label: "Activating PMFreak agents", detail: "Operational intelligence layer is coming online" },
];

const STEP_DURATION = 900;

export function AIActivationTransition({ onComplete }: { onComplete: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SEQUENCE.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => {
            setActiveIndex(i);
            if (i === SEQUENCE.length - 1) {
              timers.push(
                setTimeout(() => {
                  setDone(true);
                  setTimeout(onComplete, 600);
                }, STEP_DURATION),
              );
            }
          },
          i * STEP_DURATION,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const progress = done ? 100 : Math.round(((activeIndex + 1) / SEQUENCE.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FCFBF9]/95 backdrop-blur-sm">
      <div className="relative w-full max-w-lg px-6">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -inset-32 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.10),transparent_65%)]" />

        <div className="relative space-y-8">
          {/* Header */}
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-600">
              PMFreak Activation
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {done ? "Operational intelligence active" : "Bringing systems online"}
            </h2>
          </div>

          {/* Progress bar */}
          <div className="h-px overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Sequence items */}
          <div className="space-y-2">
            {SEQUENCE.map((item, i) => {
              const isActive = i === activeIndex && !done;
              const isComplete = i < activeIndex || done;
              return (
                <div
                  key={item.label}
                  className={`flex items-start gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                    isActive
                      ? "border border-sky-200 bg-sky-50"
                      : isComplete
                        ? "opacity-60"
                        : "opacity-30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors duration-500 ${
                      isComplete || done
                        ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                        : isActive
                          ? "border-sky-300 bg-sky-100 text-sky-600"
                          : "border-slate-300 text-slate-400"
                    }`}
                  >
                    {isComplete || done ? "✓" : isActive ? "●" : "○"}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-medium transition-colors duration-300 ${
                        isActive ? "text-slate-900" : isComplete ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {item.label}
                      {isActive && <span className="ml-1 animate-pulse">...</span>}
                    </p>
                    {isActive && (
                      <p className="mt-0.5 text-xs text-sky-600/80">{item.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="text-center text-[11px] text-slate-400">
            {done ? "Redirecting to Command Center" : "Establishing operational context"}
          </p>
        </div>
      </div>
    </div>
  );
}
