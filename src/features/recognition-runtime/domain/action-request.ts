// AOC Recognition Runtime — ActionRequest domain model
//
// An ActionRequest is what gets verified. It answers: "actor X wants to
// perform action Y against resourceScope Z, using this passport/token,
// with this evidence." RecognitionVerifier turns it into a
// RecognitionDecision.

import type { ApprovalEvidenceArtifact } from "./recognition-policy";

export type ActionRequest = {
  id: string;

  trustDomainId: string;

  actorId: string;
  principalActorId?: string;

  action: string;
  resourceScope: string;
  resourceId?: string;

  passportId?: string;
  capabilityTokenId?: string;

  evidence?: ApprovalEvidenceArtifact[];

  requestedAt: string;

  metadata?: Record<string, unknown>;
};
