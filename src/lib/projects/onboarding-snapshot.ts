// Narrows the persisted `projects.onboarding_payload` jsonb (shaped like
// ProjectOnboardingPayload) into the smaller ProjectOnboardingSnapshot the
// Project Brain's deterministic derivation actually reads. Kept in the
// projects domain, not in src/lib/project-brain, so that module has no
// dependency on the projects domain's types.
import type { ProjectOnboardingPayload } from "./project-onboarding-types";
import type { ProjectOnboardingSnapshot } from "@/lib/project-brain/derive-initial-response";

export function toProjectBrainOnboardingSnapshot(payload: unknown): ProjectOnboardingSnapshot | null {
  const p = payload as Partial<ProjectOnboardingPayload> | null | undefined;
  if (!p?.identity || !p.deliveryContext || !p.discovery) return null;

  return {
    identity: {
      technicalLead: p.identity.technicalLead ?? "",
      targetDeliveryDate: p.identity.targetDeliveryDate ?? "",
      pmAssigned: p.identity.pmAssigned ?? "",
    },
    deliveryContext: {
      problemStatement: p.deliveryContext.problemStatement ?? "",
      mainDeliverable: p.deliveryContext.mainDeliverable ?? "",
      externalDependencies: p.deliveryContext.externalDependencies ?? "",
      contractualMilestones: p.deliveryContext.contractualMilestones ?? "",
    },
    discovery: {
      unknowns: p.discovery.unknowns ?? "",
      requirementsDefined: p.discovery.requirementsDefined ?? null,
      pendingClientDependencies: p.discovery.pendingClientDependencies ?? "",
      pendingAccesses: p.discovery.pendingAccesses ?? "",
      vendorDependencies: p.discovery.vendorDependencies ?? "",
      financialBlockers: p.discovery.financialBlockers ?? "",
    },
  };
}
