import { ConfidenceScore } from "./ConfidenceScore";

export type EvidenceSourceDocument = { id: string; name: string; href: string };
export type EvidenceMetric = { label: string; value: string };

/**
 * Evidence Panel — 08-ai-interaction-patterns.md §5. Never inlines a full
 * source document; always links into the canonical Document/Evidence
 * screen. The Agent Reasoning section is omitted (not rendered empty) when
 * no Agent Run backs the claim, per the Empty-state rule in
 * 08-command-center-experience.md §5.
 */
export function EvidenceViewer({
  sourceDocuments,
  historicalData,
  metrics,
  agentReasoning,
  confidence,
}: {
  sourceDocuments: EvidenceSourceDocument[];
  historicalData?: string | null;
  metrics?: EvidenceMetric[];
  agentReasoning?: { summary: string; runHref: string } | null;
  confidence: { value: number; basis: string };
}) {
  return (
    <section aria-label="Evidence" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Source Documents</h3>
        {sourceDocuments.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {sourceDocuments.map((doc) => (
              <li key={doc.id}>
                <a href={doc.href} className="text-sm text-cyan-300 underline-offset-2 hover:underline focus-visible:underline">
                  {doc.name}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-400">No source documents linked yet.</p>
        )}
      </div>

      {historicalData ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Historical Data</h3>
          <p className="mt-1 text-sm text-slate-300">{historicalData}</p>
        </div>
      ) : null}

      {metrics && metrics.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Metrics</h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
            {metrics.map((metric) => (
              <div key={metric.label} className="contents">
                <dt className="text-sm text-slate-400">{metric.label}</dt>
                <dd className="text-sm text-slate-200">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {agentReasoning ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Agent Reasoning</h3>
          <p className="mt-1 text-sm text-slate-300">{agentReasoning.summary}</p>
          <a href={agentReasoning.runHref} className="text-xs text-cyan-300 underline-offset-2 hover:underline focus-visible:underline">
            View Agent Run
          </a>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-slate-200">Confidence</h3>
        <div className="mt-1">
          <ConfidenceScore confidence={confidence.value} basis={confidence.basis} />
        </div>
      </div>
    </section>
  );
}
