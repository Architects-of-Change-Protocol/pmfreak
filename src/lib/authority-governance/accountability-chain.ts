import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAuthority } from "./authority-registry";
import { getActiveDelegation, getDelegationChain } from "./delegation-engine";
import type {
  AuthorityResult,
  AccountabilityChain,
  AccountabilityChainNode,
  BuildAccountabilityChainInput,
  AuthorityType,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): AuthorityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<AuthorityResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): AuthorityResult<T> {
  return { ok: false, error, failureClass };
}

// ─── buildAccountabilityChain ────────────────────────────────────────────────
//
// Reconstructs the full authority chain for a decision:
//   Decision → approved by Actor → Authority → Delegated by → valid dates

export async function buildAccountabilityChain(
  input: BuildAccountabilityChainInput,
): Promise<AuthorityResult<AccountabilityChain>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  // Fetch the constitutional decision (or operational decision) for title/timestamps
  const { data: decision } = await supabase
    .from("constitutional_decisions")
    .select("id,title,approved_by,approved_at")
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle<{
      id: string;
      title: string;
      approved_by: string | null;
      approved_at: string | null;
    }>();

  const decisionTitle = decision?.title ?? "Unknown Decision";
  const approvedBy = decision?.approved_by ?? input.actorId;
  const approvedAt = decision?.approved_at ?? null;

  const chain: AccountabilityChainNode[] = [];
  const builtAt = new Date().toISOString();

  // Step 1: Check direct authority registration
  const directAuth = await getActiveAuthority({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    authorityType: input.claimedAuthority,
    projectId: input.projectId,
    atTime: approvedAt ?? undefined,
  });

  if (directAuth.ok && directAuth.data) {
    chain.push({
      actorId: input.actorId,
      authorityType: input.claimedAuthority,
      basis: "direct_registration",
      validFrom: directAuth.data.valid_from,
      validUntil: directAuth.data.valid_until,
      delegationId: null,
      delegatedBy: null,
      delegatedByAuthority: null,
      depth: 1,
    });
  } else {
    // Step 2: Check if authority was obtained via delegation
    const delegation = await getActiveDelegation({
      workspaceId: input.workspaceId,
      delegateId: input.actorId,
      delegateAuthority: input.claimedAuthority,
      projectId: input.projectId,
      atTime: approvedAt ?? undefined,
    });

    if (delegation.ok && delegation.data) {
      // Walk the delegation chain to its root
      const chainResult = await getDelegationChain({
        workspaceId: input.workspaceId,
        delegationId: delegation.data.id,
      });

      if (chainResult.ok) {
        for (const link of chainResult.data) {
          chain.push({
            actorId: link.delegate_id,
            authorityType: link.delegate_authority as AuthorityType,
            basis: "delegation",
            validFrom: link.valid_from,
            validUntil: link.valid_until,
            delegationId: link.id,
            delegatedBy: link.delegator_id,
            delegatedByAuthority: link.delegator_authority as AuthorityType,
            depth: link.delegation_depth,
          });
        }
      }
    }
  }

  const rootAuthority = chain.length > 0 ? chain[0].authorityType : null;

  const result: AccountabilityChain = {
    decisionId: input.decisionId,
    decisionTitle,
    approvedBy,
    approvedAt,
    approverAuthority: input.claimedAuthority,
    chain,
    rootAuthority,
    builtAt,
  };

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "ACCOUNTABILITY_CHAIN_BUILT",
    eventCategory: "governance",
    source: "system",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitutional_decisions",
    rawReferenceId: input.decisionId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      decisionId: input.decisionId,
      actorId: input.actorId,
      claimedAuthority: input.claimedAuthority,
      chainLength: chain.length,
      rootAuthority,
    },
  });

  return { ok: true, data: result };
}

// ─── getDecisionAccountability ───────────────────────────────────────────────
// Convenience: retrieve pre-built accountability info for a decision

export async function getDecisionAccountability(input: {
  workspaceId: string;
  decisionId: string;
}): Promise<AuthorityResult<{
  decision: { id: string; title: string; approved_by: string | null; approved_at: string | null; decision_authority: string };
  approverAuthorities: { actorId: string; authorityType: string; status: string }[];
}>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: decision, error } = await supabase
    .from("constitutional_decisions")
    .select("id,title,approved_by,approved_at,decision_authority")
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle<{
      id: string;
      title: string;
      approved_by: string | null;
      approved_at: string | null;
      decision_authority: string;
    }>();

  if (error || !decision) return failed("Decision not found.", "not_found");

  const approverAuthorities: { actorId: string; authorityType: string; status: string }[] = [];

  if (decision.approved_by) {
    const { data: auths } = await supabase
      .from("authority_registrations")
      .select("actor_id,authority_type,status")
      .eq("workspace_id", input.workspaceId)
      .eq("actor_id", decision.approved_by)
      .returns<Array<{ actor_id: string; authority_type: string; status: string }>>();

    for (const a of auths ?? []) {
      approverAuthorities.push({
        actorId: a.actor_id,
        authorityType: a.authority_type,
        status: a.status,
      });
    }
  }

  return { ok: true, data: { decision, approverAuthorities } };
}
