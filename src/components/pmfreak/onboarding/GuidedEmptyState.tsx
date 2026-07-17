export function GuidedEmptyState({
  signal,
  title,
  description,
  why,
  actions,
}: {
  signal?: string;
  title: string;
  description: string;
  why?: string;
  actions?: Array<{ label: string; sublabel?: string }>;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-b from-indigo-400/[0.06] to-transparent p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_60%)]" />
      <div className="relative space-y-4">
        {signal && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-600">{signal}</p>
        )}
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
        {why && (
          <div className="flex items-start gap-2 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-3 py-2.5">
            <span className="mt-px shrink-0 text-[9px] font-bold uppercase tracking-widest text-indigo-600">AI</span>
            <p className="text-[11px] leading-relaxed text-indigo-200/80">{why}</p>
          </div>
        )}
        {actions && actions.length > 0 && (
          <ul className="space-y-2">
            {actions.map((action) => (
              <li key={action.label} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/60" />
                <span>
                  {action.label}
                  {action.sublabel && <span className="ml-1 text-slate-400">— {action.sublabel}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
