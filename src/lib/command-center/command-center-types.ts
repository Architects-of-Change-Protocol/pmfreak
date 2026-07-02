import type {
  CommandCenterType,
  OwnerType,
  VisibilityScope,
  ConfidentialityLevel,
} from "@/lib/db/database-contract";

export type { CommandCenterType, OwnerType, VisibilityScope, ConfidentialityLevel };

export type CommandCenterTypeMeta = {
  type: CommandCenterType;
  label: string;
  description: string;
  ownerType: OwnerType;
};

/**
 * The five Command Center types supported at first launch. Every type maps to
 * a default owner_type used for governance metadata. Order matches the
 * first-launch creation flow.
 */
export const COMMAND_CENTER_TYPES: CommandCenterTypeMeta[] = [
  {
    type: "company_pmo",
    label: "Company PMO",
    description:
      "For formal organizational PMO governance. Used to manage portfolios, programs, teams, and company-owned projects.",
    ownerType: "company",
  },
  {
    type: "team_portfolio",
    label: "Team Portfolio",
    description:
      "For teams managing multiple related projects or initiatives. Useful when the structure is not a formal PMO but still needs governance.",
    ownerType: "team",
  },
  {
    type: "independent",
    label: "Independent Command Center",
    description:
      "For independent PMs, consultants, freelancers, or solo operators. Gives projects strategic direction, objectives, context, and governance rules.",
    ownerType: "personal",
  },
  {
    type: "client_portfolio",
    label: "Client Portfolio",
    description:
      "For managing projects related to a specific client. Useful for consultants, vendors, agencies, integrators, or professional services providers.",
    ownerType: "client",
  },
  {
    type: "improvement_program",
    label: "Improvement Program",
    description:
      "For internal improvement initiatives, transformation work, process improvement, operational excellence, or strategic initiatives.",
    ownerType: "program",
  },
];

export const COMMAND_CENTER_TYPE_META: Record<CommandCenterType, CommandCenterTypeMeta> =
  Object.fromEntries(COMMAND_CENTER_TYPES.map((meta) => [meta.type, meta])) as Record<
    CommandCenterType,
    CommandCenterTypeMeta
  >;

export function defaultOwnerTypeFor(type: CommandCenterType): OwnerType {
  return COMMAND_CENTER_TYPE_META[type].ownerType;
}

export function commandCenterTypeLabel(type: CommandCenterType | null | undefined): string {
  if (!type) return "Unconfigured";
  return COMMAND_CENTER_TYPE_META[type]?.label ?? "Command Center";
}

/**
 * Company-owned contexts (company PMO or team portfolio operating on behalf
 * of a company) get the "projects should be work-related" notice.
 * Independent, client, and program contexts allow broader project types.
 */
export function isCompanyOwnedContext(ownerType: OwnerType | null | undefined): boolean {
  return ownerType === "company" || ownerType === "team";
}

export const DEFAULT_VISIBILITY_SCOPE: VisibilityScope = "command_center";
export const DEFAULT_CONFIDENTIALITY_LEVEL: ConfidentialityLevel = "internal";
