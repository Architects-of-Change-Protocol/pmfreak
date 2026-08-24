import type { GovernanceDecisionState } from "@/lib/governance/authority/runtime";
import type { RuntimeLineage } from "@/lib/aoc/contracts/lineage";
import type { RuntimeAuthoritySource, RuntimeMetadata, RuntimeScope } from "@/lib/aoc/contracts/metadata";

export type CanonicalRuntimeDecision = {
  allowed: boolean;
  decisionId: string;
  authoritative: boolean;
  authoritySource: RuntimeAuthoritySource;
  governanceAction: string;
  decisionState: GovernanceDecisionState;
  denialReason?: string;
  reason: string;
  evaluatedAt: string;
  scope: RuntimeScope;
  actor: { actorType: string; actorUserId: string | null; actorAgentId: string | null };
  lineage: RuntimeLineage;
  policy: { matchedPolicies: string[]; requiredPermission: string; enforcementLevel: "hard" | "soft" };
  runtimeMetadata: RuntimeMetadata;
};
