import type { ProgramType } from "@/lib/db/database-contract";

const TYPE_LABELS: Record<ProgramType, string> = {
  SOFTWARE_DEVELOPMENT:   "Software Dev",
  INFRASTRUCTURE_PROJECT: "Infrastructure",
  CUSTOMER_ONBOARDING:    "Customer Onboarding",
  AOC_PROTOCOL_ADOPTION:  "AOC Protocol",
  ORGANIZATIONAL_CHANGE:  "Org Change",
  STRATEGIC_INITIATIVE:   "Strategic Initiative",
  INTERNAL_PROGRAM:       "Internal",
  CUSTOM:                 "Custom",
};

export function ProgramTypeBadge({ type }: { type: ProgramType }) {
  return (
    <span className="inline-flex items-center rounded-full border border-indigo-300/30 bg-indigo-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}
