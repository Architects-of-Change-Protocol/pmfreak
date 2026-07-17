import {
  PILOT_AGREEMENT_IS_PLACEHOLDER,
  PILOT_AGREEMENT_SECTIONS,
  PILOT_AGREEMENT_VERSION,
} from "@/lib/pilot/pilot-agreement";

/**
 * Pilot Gate Sprint 01 — Task 9: pilot agreement page (technical shell).
 * Renders the versioned section structure. While
 * PILOT_AGREEMENT_IS_PLACEHOLDER is true this page must display draft
 * placeholders only and never present itself as binding legal terms.
 */
export default function PilotAgreementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Closed Pilot</p>
        <h1 className="text-2xl font-semibold">Pilot Agreement</h1>
        <p className="text-sm text-slate-600">Version {PILOT_AGREEMENT_VERSION}</p>
      </header>

      {PILOT_AGREEMENT_IS_PLACEHOLDER && (
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm text-yellow-800" data-testid="pilot-agreement-placeholder-banner">
          <p className="font-semibold">Draft structure — not a legal document.</p>
          <p className="mt-1">
            This page is the technical shell for the pilot agreement. The content below is placeholder
            guidance pending legal review. Design partners sign a reviewed agreement directly with the
            PMFreak team before any real data enters the pilot.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {PILOT_AGREEMENT_SECTIONS.map((section) => (
          <section key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
            <p className="mt-2 text-sm italic text-slate-600">{section.placeholder}</p>
          </section>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Questions about pilot terms or data handling: contact the PMFreak team directly.
      </p>
    </div>
  );
}
