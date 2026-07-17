import type { ReactNode } from "react";

type Metric = { label: string; value: string; delta?: string };

export function ModuleShell({
  title,
  subtitle,
  metrics,
  children,
}: {
  title: string;
  subtitle: string;
  metrics: Metric[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">{subtitle}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-200">
              <p className="text-xs uppercase tracking-wider text-cyan-800">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold">{metric.value}</p>
              {metric.delta ? <p className="mt-1 text-xs text-slate-600">{metric.delta}</p> : null}
            </article>
          ))}
        </div>
      </header>
      {children}
    </div>
  );
}
