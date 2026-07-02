export type PMModule = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  status: "Live" | "New";
  group: "Core" | "Intelligence" | "Execution" | "System";
  memoryRole: string;
};

export const PM_MODULES: PMModule[] = [
  {
    href: "/dashboard",
    label: "Home",
    shortLabel: "Home",
    description:
      "What needs attention now, what changed, and the next best move.",
    status: "Live",
    group: "Core",
    memoryRole: "Cross-workspace operational state",
  },
  {
    href: "/copilot",
    label: "Copilot",
    shortLabel: "Copilot",
    description:
      "Ask, decide, and unblock quickly with context-aware PM guidance.",
    status: "Live",
    group: "Core",
    memoryRole: "Conversational continuity and context recall",
  },
  {
    href: "/operational-memory",
    label: "Memory",
    shortLabel: "Memory",
    description:
      "Shared project memory with timelines, decisions, and context recall.",
    status: "Live",
    group: "Core",
    memoryRole: "System of record for operational intelligence",
  },
  {
    href: "/input-hub",
    label: "Input Hub",
    shortLabel: "Input",
    description:
      "Capture delivery, stakeholder, and risk updates in one place.",
    status: "Live",
    group: "Core",
    memoryRole: "Primary intake into operational memory",
  },
  {
    href: "/executive",
    label: "Executive View",
    shortLabel: "Executive",
    description: "Executive snapshot of momentum, risk, and confidence.",
    status: "Live",
    group: "Intelligence",
    memoryRole: "Decision-layer synthesis from memory and alerts",
  },
  {
    href: "/stakeholder-intel",
    label: "Stakeholders",
    shortLabel: "Stakeholders",
    description:
      "Relationship risk, influence dynamics, and stakeholder temperature trends.",
    status: "Live",
    group: "Intelligence",
    memoryRole: "Human-system signals attached to memory timeline",
  },
  {
    href: "/change-detection",
    label: "Change Detection",
    shortLabel: "Changes",
    description:
      "Detect movement, deterioration, and pattern shifts across operational streams.",
    status: "Live",
    group: "Intelligence",
    memoryRole: "Temporal intelligence over memory deltas",
  },
  {
    href: "/command-center",
    label: "Project Brief",
    shortLabel: "Brief",
    description:
      "Coordinate interventions and escalation response for high-severity conditions.",
    status: "Live",
    group: "Execution",
    memoryRole: "Intervention control informed by memory and synthesis",
  },
  {
    href: "/follow-up-dashboard",
    label: "Follow-ups",
    shortLabel: "Follow-up",
    description:
      "Track actions, owners, and operational closure quality over time.",
    status: "Live",
    group: "Execution",
    memoryRole: "Execution evidence written back into memory",
  },
  {
    href: "/projects",
    label: "Projects",
    shortLabel: "Projects",
    description:
      "Program and project operational contexts linked to shared organizational memory.",
    status: "Live",
    group: "Execution",
    memoryRole: "Scoped delivery contexts linked to global memory",
  },
  {
    href: "/early-access",
    label: "Early Access",
    shortLabel: "Early Access",
    description:
      "Invite distribution, trial state, and activation visibility for controlled rollout.",
    status: "New",
    group: "System",
    memoryRole:
      "Founder-led adoption telemetry and workspace activation status",
  },
  {
    href: "/team",
    label: "Team & Access",
    shortLabel: "Settings",
    description:
      "People, roles, and approvals to keep execution safe and fast.",
    status: "Live",
    group: "System",
    memoryRole: "Governed usage of organizational memory",
  },
];

export const MODULE_GROUP_LABELS: Record<PMModule["group"], string> = {
  Core: "Core",
  Intelligence: "Intelligence",
  Execution: "Execution",
  System: "Access",
};

export const OPERATIONAL_FLOW = [
  "Input Hub",
  "Memory",
  "Executive View",
  "Change Detection",
  "Project Brief",
  "Follow-ups",
] as const;
