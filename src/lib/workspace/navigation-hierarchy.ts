export type NavigationTier = "primary" | "lens" | "utility" | "advanced";

export type NavigationNode = {
  label: string;
  href: string;
  tier: NavigationTier;
  visibleByDefault: boolean;
  requiresCapability?: string;
};

export const NAVIGATION_HIERARCHY: NavigationNode[] = [
  { label: "Workspace", href: "/workspace", tier: "primary", visibleByDefault: true },
  { label: "Create PMO", href: "/create-pmo", tier: "primary", visibleByDefault: true },
  { label: "Create Project", href: "/projects/new", tier: "primary", visibleByDefault: true },

  { label: "Summary", href: "/dashboard", tier: "lens", visibleByDefault: true },
  { label: "Execution", href: "/command-center", tier: "lens", visibleByDefault: true },
  { label: "Executive", href: "/executive", tier: "lens", visibleByDefault: true },
  { label: "Portfolio", href: "/portfolio", tier: "lens", visibleByDefault: true },

  { label: "Projects", href: "/projects", tier: "utility", visibleByDefault: true },
  { label: "Programs", href: "/programs", tier: "utility", visibleByDefault: true },
  { label: "Upload", href: "/upload", tier: "utility", visibleByDefault: true },
  { label: "Settings", href: "/team", tier: "utility", visibleByDefault: true },

  { label: "Operational Memory", href: "/operational-memory", tier: "advanced", visibleByDefault: false, requiresCapability: "memory" },
  { label: "Stakeholders", href: "/stakeholder-intel", tier: "advanced", visibleByDefault: false, requiresCapability: "stakeholders" },
  { label: "Change Detection", href: "/change-detection", tier: "advanced", visibleByDefault: false, requiresCapability: "risks" },
  { label: "Meetings", href: "/meetings", tier: "advanced", visibleByDefault: false, requiresCapability: "coordination" },
  { label: "Follow-up", href: "/follow-up-dashboard", tier: "advanced", visibleByDefault: false, requiresCapability: "delivery" },
  { label: "Governance", href: "/governance", tier: "advanced", visibleByDefault: false, requiresCapability: "governance" },
  { label: "Policies", href: "/policies", tier: "advanced", visibleByDefault: false, requiresCapability: "governance" },
  { label: "Trust Agents", href: "/trust/agents", tier: "advanced", visibleByDefault: false, requiresCapability: "interventions" },
  { label: "Audit", href: "/audit", tier: "advanced", visibleByDefault: false, requiresCapability: "governance" },
  { label: "Capabilities", href: "/capabilities", tier: "advanced", visibleByDefault: false, requiresCapability: "interventions" },
  { label: "Intelligence", href: "/intelligence", tier: "advanced", visibleByDefault: false, requiresCapability: "executive" },
  { label: "Trials", href: "/trials", tier: "advanced", visibleByDefault: false, requiresCapability: "interventions" },
];

export const getNavigationByTier = (tier: NavigationTier) => NAVIGATION_HIERARCHY.filter((node) => node.tier === tier);
