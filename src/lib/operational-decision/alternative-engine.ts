import type { DecisionAlternative } from "./types";

// ─── generateDecisionAlternatives ────────────────────────────────────────────
// Generates decision alternatives based on focus type from the source consequence.
// Every focus type produces at least 3 distinct options.

export function generateDecisionAlternatives(input: {
  focusType: string;
  severity: string;
}): DecisionAlternative[] {
  const alts = ALTERNATIVES_BY_FOCUS_TYPE[input.focusType];
  return alts ?? DEFAULT_ALTERNATIVES;
}

// ─── Alternative Definitions ──────────────────────────────────────────────────

const ALTERNATIVES_BY_FOCUS_TYPE: Record<string, DecisionAlternative[]> = {
  authority: [
    {
      optionName:         "create_delegation",
      optionDescription:  "Create a formal delegation to assign decision-making authority to a qualified party.",
      optionType:         "authority",
      pros:               ["Resolves authority gap immediately", "Preserves governance chain", "Lowest execution impact"],
      cons:               ["Requires qualified delegate", "May need ratification"],
      estimatedEffort:    "medium",
      estimatedRisk:      "low",
    },
    {
      optionName:         "sponsor_intervention",
      optionDescription:  "Escalate to project sponsor to exercise override authority and unblock decision-making.",
      optionType:         "escalation",
      pros:               ["Fast resolution", "Uses existing sponsor authority"],
      cons:               ["Consumes sponsor bandwidth", "May set precedent for bypassing governance"],
      estimatedEffort:    "low",
      estimatedRisk:      "medium",
    },
    {
      optionName:         "governance_board_review",
      optionDescription:  "Initiate a governance board review to formally resolve the authority ambiguity.",
      optionType:         "governance",
      pros:               ["Highest institutional legitimacy", "Creates permanent governance clarity"],
      cons:               ["Slowest path", "High process overhead"],
      estimatedEffort:    "high",
      estimatedRisk:      "low",
    },
  ],

  commitment: [
    {
      optionName:         "reassign_owner",
      optionDescription:  "Reassign the commitment to a different owner with capacity and authority to deliver.",
      optionType:         "commitment",
      pros:               ["Minimises execution impact", "Preserves commitment", "Fastest recovery"],
      cons:               ["Requires available assignee", "Context transfer cost"],
      estimatedEffort:    "medium",
      estimatedRisk:      "low",
    },
    {
      optionName:         "extend_deadline",
      optionDescription:  "Formally extend the commitment deadline after impact assessment and stakeholder alignment.",
      optionType:         "commitment",
      pros:               ["Low change risk", "Maintains original owner accountability"],
      cons:               ["Delays downstream dependencies", "May damage stakeholder trust"],
      estimatedEffort:    "low",
      estimatedRisk:      "medium",
    },
    {
      optionName:         "breach_commitment",
      optionDescription:  "Accept formal breach of commitment and trigger the agreed consequence protocol.",
      optionType:         "risk",
      pros:               ["Forces clarity on impact", "May trigger higher-priority resolution"],
      cons:               ["Highest governance cost", "Damages trust and health metrics"],
      estimatedEffort:    "low",
      estimatedRisk:      "critical",
    },
  ],

  execution: [
    {
      optionName:         "revise_projection",
      optionDescription:  "Update execution projections to reflect current reality and recalibrate delivery expectations.",
      optionType:         "execution",
      pros:               ["Restores projection accuracy", "Enables better decision-making"],
      cons:               ["May expose missed commitments", "Requires stakeholder communication"],
      estimatedEffort:    "medium",
      estimatedRisk:      "low",
    },
    {
      optionName:         "increase_resources",
      optionDescription:  "Allocate additional resources (people, budget, tooling) to close the execution gap.",
      optionType:         "resource",
      pros:               ["Fastest delivery acceleration", "Preserves original scope"],
      cons:               ["Higher cost", "Resource availability constraints"],
      estimatedEffort:    "high",
      estimatedRisk:      "medium",
    },
    {
      optionName:         "reduce_scope",
      optionDescription:  "Reduce delivery scope to match available capacity and protect execution health.",
      optionType:         "structural",
      pros:               ["Preserves delivery health", "Reduces risk immediately"],
      cons:               ["Stakeholder expectation impact", "May require governance approval"],
      estimatedEffort:    "medium",
      estimatedRisk:      "medium",
    },
  ],

  governance: [
    {
      optionName:         "governance_review",
      optionDescription:  "Initiate a formal governance review to assess and remediate the violation.",
      optionType:         "governance",
      pros:               ["Restores governance integrity", "Creates audit trail"],
      cons:               ["Time-intensive", "May surface additional violations"],
      estimatedEffort:    "high",
      estimatedRisk:      "low",
    },
    {
      optionName:         "corrective_action",
      optionDescription:  "Issue a targeted corrective action to address the governance violation directly.",
      optionType:         "governance",
      pros:               ["Fast and targeted", "Maintains proportionality"],
      cons:               ["May not address root cause", "Requires clear accountability"],
      estimatedEffort:    "medium",
      estimatedRisk:      "medium",
    },
    {
      optionName:         "escalation",
      optionDescription:  "Escalate the governance violation to senior authority for resolution.",
      optionType:         "escalation",
      pros:               ["High visibility drives fast resolution", "Creates institutional record"],
      cons:               ["Consumes senior bandwidth", "May damage team relationships"],
      estimatedEffort:    "low",
      estimatedRisk:      "medium",
    },
  ],

  risk: [
    {
      optionName:         "risk_mitigation",
      optionDescription:  "Implement targeted mitigations to reduce probability and impact of the identified risk.",
      optionType:         "risk",
      pros:               ["Proactive risk reduction", "Preserves delivery"],
      cons:               ["Requires mitigation planning", "May consume capacity"],
      estimatedEffort:    "medium",
      estimatedRisk:      "low",
    },
    {
      optionName:         "risk_transfer",
      optionDescription:  "Transfer the risk to a party better equipped to absorb or manage it.",
      optionType:         "risk",
      pros:               ["Reduces team exposure", "May be low-cost if transfer is contractual"],
      cons:               ["Dependency on transfer party", "May require negotiation"],
      estimatedEffort:    "medium",
      estimatedRisk:      "medium",
    },
    {
      optionName:         "risk_acceptance",
      optionDescription:  "Formally accept the risk with documented rationale and monitoring plan.",
      optionType:         "governance",
      pros:               ["Low overhead", "Enables delivery continuity"],
      cons:               ["Exposes project to materialisation", "Requires formal documentation"],
      estimatedEffort:    "low",
      estimatedRisk:      "high",
    },
  ],
};

const DEFAULT_ALTERNATIVES: DecisionAlternative[] = [
  {
    optionName:         "immediate_resolution",
    optionDescription:  "Address the focus item directly with the most expedient available action.",
    optionType:         "execution",
    pros:               ["Fast", "Simple"],
    cons:               ["May miss systemic root cause"],
    estimatedEffort:    "medium",
    estimatedRisk:      "medium",
  },
  {
    optionName:         "structured_review",
    optionDescription:  "Conduct a structured review of the focus item and define a formal resolution path.",
    optionType:         "governance",
    pros:               ["Thorough", "Creates audit trail"],
    cons:               ["Slower", "Higher process overhead"],
    estimatedEffort:    "high",
    estimatedRisk:      "low",
  },
  {
    optionName:         "escalation_to_authority",
    optionDescription:  "Escalate the focus item to appropriate authority for resolution.",
    optionType:         "escalation",
    pros:               ["Leverages existing authority", "Drives accountability"],
    cons:               ["Consumes authority bandwidth"],
    estimatedEffort:    "low",
    estimatedRisk:      "medium",
  },
];
