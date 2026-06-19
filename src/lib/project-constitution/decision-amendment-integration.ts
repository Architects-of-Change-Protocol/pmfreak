import { createPlatformEvent } from "@/lib/platform-events";
import type { DecisionRecord, DecisionResult } from "./decision-types";
import type { AmendmentRecord } from "./amendment-types";
import { createAmendment } from "./amendment-service";
import { linkDecisionEntity } from "./decision-service";

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

export type GenerateAmendmentFromDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
  amendmentTitle: string;
  amendmentDescription?: string | null;
  amendmentJustification?: string | null;
};

export type AmendmentFromDecisionResult = {
  amendment: AmendmentRecord;
  decision: DecisionRecord;
};

export async function generateAmendmentFromDecision(
  input: GenerateAmendmentFromDecisionInput,
  decision: DecisionRecord,
): Promise<DecisionResult<AmendmentFromDecisionResult>> {
  if (!validUuid(input.decisionId))
    return { ok: false, error: "decisionId must be a UUID.", failureClass: "validation_failed" };
  if (!validUuid(input.workspaceId))
    return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
  if (!validUuid(input.actorId))
    return { ok: false, error: "actorId must be a UUID.", failureClass: "validation_failed" };
  if (!input.amendmentTitle || !input.amendmentTitle.trim())
    return { ok: false, error: "amendmentTitle is required.", failureClass: "validation_failed" };

  // Rule 13: Only approved decisions can generate amendments
  if (decision.status !== "approved" && decision.status !== "executed") {
    return {
      ok: false,
      error: `Cannot generate an amendment from a decision in status '${decision.status}'. Decision must be approved.`,
      failureClass: "governance_violation",
    };
  }

  // Create amendment draft linked to this decision
  const amendmentResult = await createAmendment({
    workspaceId: input.workspaceId,
    constitutionId: decision.constitution_id,
    title: input.amendmentTitle.trim(),
    description: input.amendmentDescription ?? null,
    justification:
      input.amendmentJustification ??
      `Generated from constitutional decision: ${decision.title}`,
    createdBy: input.actorId,
  });

  if (!amendmentResult.ok) return amendmentResult;

  const amendment = amendmentResult.data;

  // Rule 14: Link the amendment back to the origin decision
  const linkResult = await linkDecisionEntity({
    decisionId: input.decisionId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    linkType: "amendment",
    linkedEntityId: amendment.id,
  });

  if (!linkResult.ok) return linkResult;

  // Emit traceability event
  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitution_amendments",
    rawReferenceId: amendment.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      decisionId: input.decisionId,
      amendmentId: amendment.id,
      constitutionId: decision.constitution_id,
      decisionTitle: decision.title,
      amendmentTitle: amendment.title,
    },
  });

  if (!event.ok)
    return { ok: false, error: event.error, failureClass: "event_emission_failed" };

  return { ok: true, data: { amendment, decision } };
}
