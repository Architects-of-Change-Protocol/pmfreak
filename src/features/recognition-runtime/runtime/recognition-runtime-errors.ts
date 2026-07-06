// AOC Recognition Runtime — programmer-error exceptions.
//
// These are thrown only for invalid *usage* of the runtime (duplicate ids,
// unknown references passed to a mutation, malformed setup). They are never
// thrown by RecognitionVerifier.verify() for business-rule failures — those
// are expressed as a RecognitionDecision outcome instead, so verification is
// total and deterministic.

export class RecognitionRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DuplicateTrustDomainError extends RecognitionRuntimeError {
  constructor(trustDomainId: string) {
    super(`Trust domain already exists: ${trustDomainId}`);
  }
}

export class UnknownTrustDomainError extends RecognitionRuntimeError {
  constructor(trustDomainId: string) {
    super(`Unknown trust domain: ${trustDomainId}`);
  }
}

export class DuplicateActorError extends RecognitionRuntimeError {
  constructor(actorId: string) {
    super(`Actor already registered: ${actorId}`);
  }
}

export class UnknownActorError extends RecognitionRuntimeError {
  constructor(actorId: string) {
    super(`Unknown actor: ${actorId}`);
  }
}

export class UnknownPassportError extends RecognitionRuntimeError {
  constructor(passportId: string) {
    super(`Unknown passport: ${passportId}`);
  }
}

export class UnknownCapabilityTokenError extends RecognitionRuntimeError {
  constructor(capabilityTokenId: string) {
    super(`Unknown capability token: ${capabilityTokenId}`);
  }
}

export class UnknownApprovalRequirementRuleError extends RecognitionRuntimeError {
  constructor(ruleId: string) {
    super(`Unknown recognition requirement rule: ${ruleId}`);
  }
}
