import type { RecognitionPolicy } from "./policy-context";
import { trustDomainValidityPolicy } from "./trust-domain-validity-policy";
import { actorRecognitionPolicy } from "./actor-recognition-policy";
import { rogueActorPolicy } from "./rogue-actor-policy";
import { passportValidityPolicy } from "./passport-validity-policy";
import { capabilityValidityPolicy } from "./capability-validity-policy";
import { capabilityScopePolicy } from "./capability-scope-policy";
import { evidenceRequirementPolicy } from "./evidence-requirement-policy";
import { approvalRequirementPolicy } from "./approval-requirement-policy";

export * from "./policy-context";
export * from "./trust-domain-validity-policy";
export * from "./actor-recognition-policy";
export * from "./rogue-actor-policy";
export * from "./passport-validity-policy";
export * from "./capability-validity-policy";
export * from "./capability-scope-policy";
export * from "./evidence-requirement-policy";
export * from "./approval-requirement-policy";

// Fixed, deterministic evaluation order. RecognitionVerifier stops at the
// first failing policy, so order determines which reason a caller sees when
// more than one thing is wrong with a request.
export const RECOGNITION_POLICY_ORDER: readonly RecognitionPolicy[] = [
  trustDomainValidityPolicy,
  actorRecognitionPolicy,
  rogueActorPolicy,
  passportValidityPolicy,
  capabilityValidityPolicy,
  capabilityScopePolicy,
  evidenceRequirementPolicy,
  approvalRequirementPolicy,
];
