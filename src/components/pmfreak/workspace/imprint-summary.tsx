"use client";

import { computeImprintConfidence } from "@/lib/workspace/imprint-confidence";
import { resetImprintState } from "@/lib/workspace/operational-imprint-profile";
import type { PMOperationalImprint } from "@/lib/workspace/operational-imprint-profile";

const FOCUS_LABELS: Record<PMOperationalImprint["dominantFocus"], string> = {
  delivery: "Delivery-first",
  stakeholders: "Stakeholder-oriented",
  governance: "Governance-focused",
  risk: "Risk-aware",
};

const ESCALATION_LABELS: Record<PMOperationalImprint["escalationBias"], string> = {
  preventive: "Preventive escalation",
  reactive: "Reactive escalation",
  measured: "Measured escalation",
};

const STYLE_LABELS: Record<PMOperationalImprint["interventionStyle"], string> = {
  direct: "Direct intervention style",
  collaborative: "Collaborative intervention style",
  diplomatic: "Diplomatic intervention style",
  escalatory: "Escalatory intervention style",
};

type Props = {
  profile: PMOperationalImprint;
  companyId: string;
  workspaceId: string;
  userId: string;
  onReset: () => void;
};

export function ImprintSummary({ profile, companyId, workspaceId, userId, onReset }: Props) {
  const confidence = computeImprintConfidence(profile);
  // Only visible after sufficient maturity
  if (confidence === "forming" || confidence === "emerging") return null;

  const handleReset = () => {
    resetImprintState(companyId, workspaceId, userId);
    onReset();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
      <p className="mb-2 text-[9px] uppercase tracking-[0.28em] text-zinc-400">Observed tendencies</p>
      <ul className="space-y-1.5 text-slate-500">
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 shrink-0 rounded-full bg-indigo-400/40" />
          {FOCUS_LABELS[profile.dominantFocus]}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 shrink-0 rounded-full bg-indigo-400/40" />
          {ESCALATION_LABELS[profile.escalationBias]}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1 w-1 shrink-0 rounded-full bg-indigo-400/40" />
          {STYLE_LABELS[profile.interventionStyle]}
        </li>
      </ul>
      <button
        type="button"
        onClick={handleReset}
        className="mt-2.5 text-[9px] uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-500"
      >
        Reset Operational Imprint
      </button>
    </div>
  );
}
