import type { Plan } from "@/lib/feature-gates";
import { NAVIGATION_HIERARCHY } from "@/lib/workspace/navigation-hierarchy";
import type {
  CapabilityDomain,
  CapabilityRevealInput,
  CapabilityRevealState,
  CapabilityRevealStage,
  ContinuityMaturity,
  EvidenceDensity,
  NavigationRailItem,
  RoleProfile,
} from "./capability-reveal-types";
import { REVEAL_DOMAIN_ORDER, ROLE_DOMAIN_PRIORITIES } from "./capability-reveal-contract";

export const LENS_LABELS = {
  execution: "Execution Lens",
  executive: "Executive Lens",
} as const;

const NAV_STYLE = {
  primary: { accent: "from-indigo-300/25 to-cyan-300/15", active: "border-indigo-100/70 bg-indigo-300/[0.16] text-white shadow-[0_0_24px_rgba(129,140,248,0.28)]", idle: "text-indigo-100/90" },
  lens: { accent: "from-cyan-300/20 to-fuchsia-300/10", active: "border-cyan-200/30 bg-cyan-300/[0.07] text-cyan-100", idle: "text-slate-300" },
  utility: { accent: "from-emerald-300/20 to-teal-300/10", active: "border-emerald-200/30 bg-emerald-300/[0.07] text-emerald-100", idle: "text-slate-300" },
  advanced: { accent: "from-slate-300/15 to-zinc-300/10", active: "border-slate-200/30 bg-slate-200/[0.07] text-slate-100", idle: "text-slate-300" },
} as const;

export const computeRoleProfile = (role: string): RoleProfile => {
  const normalized = role.toLowerCase();
  if (normalized.includes("owner") || normalized.includes("admin") || normalized.includes("pmo")) return "pmo";
  if (normalized.includes("exec") || normalized.includes("viewer")) return "executive";
  if (normalized.includes("ops") || normalized.includes("operation")) return "ops";
  return "pm";
};
// ... unchanged functions
export const computeEvidenceDensity = (input: Pick<CapabilityRevealInput, "evidenceSignals" | "hasProject">): EvidenceDensity => {
  if (!input.hasProject) return "none";
  if (input.evidenceSignals <= 0) return "low";
  if (input.evidenceSignals < 5) return "moderate";
  return "high";
};
export const computeContinuityMaturity = (input: Pick<CapabilityRevealInput, "operationalMemorySignals" | "continuitySignals">): ContinuityMaturity => {
  const score = input.operationalMemorySignals + input.continuitySignals;
  if (score >= 8) return "stable";
  if (score >= 3) return "developing";
  return "emerging";
};
const computeStage = (input: CapabilityRevealInput, evidence: EvidenceDensity, continuity: ContinuityMaturity): CapabilityRevealStage => {
  if (!input.onboardingCompleted || !input.hasProject) return "activation";
  if (input.firstRun || evidence === "low") return "awareness";
  if (evidence === "moderate" && continuity !== "stable") return "guidance";
  if (input.canUseGovernanceDirectives || input.planTier === "pmo") return continuity === "stable" ? "constraint" : "governance";
  if (evidence === "high" && continuity === "stable" && input.canUseAdvancedAi && input.canUsePortfolioMemory) return "organizational";
  return "guidance";
};
export const computeUnlockedDomains = (stage: CapabilityRevealStage, role: RoleProfile, planTier: Plan): CapabilityDomain[] => {
  const baseByStage: Record<CapabilityRevealStage, CapabilityDomain[]> = {
    activation: ["core", "projects", "vault"], awareness: ["core", "projects", "vault", "memory"], guidance: ["core", "projects", "vault", "memory", "risks", "stakeholders", "delivery", "coordination"], governance: ["core", "projects", "vault", "memory", "risks", "stakeholders", "delivery", "coordination", "interventions", "executive"], constraint: REVEAL_DOMAIN_ORDER.filter((d) => d !== "lessons"), organizational: REVEAL_DOMAIN_ORDER,
  };
  const base = new Set(baseByStage[stage]);
  for (const d of ROLE_DOMAIN_PRIORITIES[role] ?? []) base.add(d);
  if (planTier === "pmo") { base.add("governance"); base.add("executive"); }
  return REVEAL_DOMAIN_ORDER.filter((d) => base.has(d));
};
export const computeRevealHints = (input: { stage: CapabilityRevealStage; evidenceDensity: EvidenceDensity; continuityMaturity: ContinuityMaturity; blockedDomains: CapabilityDomain[]; }): string[] => {
  const hints: string[] = [];
  if (input.evidenceDensity === "none" || input.evidenceDensity === "low") hints.push("Upload project evidence to activate governance continuity reasoning.");
  if (input.continuityMaturity === "emerging") hints.push("Operational memory depth is still emerging; continue adding blockers, decisions, and stakeholder updates.");
  if (input.stage === "guidance") hints.push("Operational memory depth has unlocked adaptive planning guidance.");
  if (input.blockedDomains.includes("scope")) hints.push("Scope Intelligence unlocks after consistent continuity and evidence density.");
  if (input.blockedDomains.includes("lessons")) hints.push("Lessons Learned activates when recurrent execution patterns stabilize.");
  return hints;
};
export const computeCapabilityRevealState = (input: CapabilityRevealInput): CapabilityRevealState => {
  const roleProfile = computeRoleProfile(input.role);
  const evidenceDensity = computeEvidenceDensity(input);
  const continuityMaturity = computeContinuityMaturity(input);
  const stage = computeStage(input, evidenceDensity, continuityMaturity);
  const unlockedDomains = computeUnlockedDomains(stage, roleProfile, input.planTier);
  const blockedDomains = REVEAL_DOMAIN_ORDER.filter((d) => !unlockedDomains.includes(d));
  return { stage, planTier: input.planTier, roleProfile, hasProject: input.hasProject, evidenceDensity, continuityMaturity, unlockedDomains, blockedDomains, revealReasons: [`plan:${input.planTier}`, `role:${roleProfile}`, `stage:${stage}`, `evidence:${evidenceDensity}`, `continuity:${continuityMaturity}`], educationalHints: computeRevealHints({ stage, evidenceDensity, continuityMaturity, blockedDomains }) };
};

export const computeNavigationRail = (state: CapabilityRevealState): NavigationRailItem[] => {
  return NAVIGATION_HIERARCHY.filter((node) => {
    if (node.tier !== "advanced") return node.visibleByDefault;
    if (!node.requiresCapability) return true;
    return state.unlockedDomains.includes(node.requiresCapability as CapabilityDomain);
  }).map((node) => ({
    label: node.label,
    href: node.href,
    ...(node.tier === "primary" ? NAV_STYLE.primary : node.tier === "lens" ? NAV_STYLE.lens : node.tier === "utility" ? NAV_STYLE.utility : NAV_STYLE.advanced),
  }));
};
