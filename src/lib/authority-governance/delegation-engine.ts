import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAuthority } from "./authority-registry";
import type {
  AuthorityResult,
  AuthorityDelegationRecord,
  CreateDelegationInput,
  RevokeDelegationInput,
  AuthorityType,
} from "./types";

const COLUMNS =
  "id,workspace_id,delegator_id,delegator_authority,delegate_id,delegate_authority,project_id,valid_from,valid_until,status,revoked_at,revoked_by,revocation_reason,delegation_depth,parent_delegation_id,created_by,created_at,updated_at";

const MAX_DELEGATION_DEPTH = 3;

// Canonical authority hierarchy depth (higher = more authority)
const AUTHORITY_RANK: Record<AuthorityType, number> = {
  governance_board: 10,
  steering_committee: 9,
  sponsor: 8,
  client: 7,
  project_manager: 6,
  product_owner: 5,
  architect: 4,
  technical_lead: 3,
  external_approver: 2,
};

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): AuthorityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<AuthorityResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): AuthorityResult<T> {
  return { ok: false, error, failureClass };
}

// ─── createDelegation ────────────────────────────────────────────────────────

export async function createDelegation(
  input: CreateDelegationInput,
): Promise<AuthorityResult<AuthorityDelegationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.delegatorId)) return validation("delegatorId must be a UUID.");
  if (!validUuid(input.delegateId)) return validation("delegateId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");

  // Rule: cannot delegate to yourself
  if (input.delegatorId === input.delegateId) {
    return validation("Cannot delegate authority to yourself.");
  }

  // Rule: cannot broaden authority — delegate authority must be <= delegator authority
  const delegatorRank = AUTHORITY_RANK[input.delegatorAuthority] ?? 0;
  const delegateRank = AUTHORITY_RANK[input.delegateAuthority] ?? 0;
  if (delegateRank > delegatorRank) {
    return { ok: false, error: "Delegate authority cannot exceed delegator authority.", failureClass: "governance_violation" };
  }

  // Rule: delegator must hold the authority (direct registration OR active delegation)
  const directAuth = await getActiveAuthority({
    workspaceId: input.workspaceId,
    actorId: input.delegatorId,
    authorityType: input.delegatorAuthority,
    projectId: input.projectId,
  });
  if (!directAuth.ok) return directAuth;

  if (!directAuth.data) {
    // Check if authority is held via an existing delegation
    const delegatedAuth = await getActiveDelegation({
      workspaceId: input.workspaceId,
      delegateId: input.delegatorId,
      delegateAuthority: input.delegatorAuthority,
      projectId: input.projectId,
    });
    if (!delegatedAuth.ok) return delegatedAuth;
    if (!delegatedAuth.data) {
      return { ok: false, error: "Delegator does not hold the claimed authority.", failureClass: "governance_violation" };
    }
  }

  // Compute delegation depth from parent, validating parent integrity
  let depth = 1;
  if (input.parentDelegationId) {
    if (!validUuid(input.parentDelegationId)) return validation("parentDelegationId must be a UUID.");

    const supabase = await createSupabaseServerClient();
    const { data: parent } = await supabase
      .from("authority_delegations")
      .select(COLUMNS)
      .eq("id", input.parentDelegationId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle<AuthorityDelegationRecord>();

    if (!parent) return failed("Parent delegation not found.", "not_found");
    // Parent must be active and unexpired
    if (parent.status !== "active") {
      return { ok: false, error: "Parent delegation is not active.", failureClass: "governance_violation" };
    }
    const now = new Date().toISOString();
    if (parent.valid_until && parent.valid_until < now) {
      return { ok: false, error: "Parent delegation has expired.", failureClass: "governance_violation" };
    }
    // Parent's delegate must be the current delegator
    if (parent.delegate_id !== input.delegatorId || parent.delegate_authority !== input.delegatorAuthority) {
      return { ok: false, error: "Parent delegation delegate does not match delegator.", failureClass: "governance_violation" };
    }
    // Scope must match
    if (parent.project_id !== (input.projectId ?? null)) {
      return { ok: false, error: "Parent delegation project scope does not match.", failureClass: "governance_violation" };
    }

    depth = parent.delegation_depth + 1;
  }

  if (depth > MAX_DELEGATION_DEPTH) {
    return { ok: false, error: `Delegation depth ${depth} exceeds maximum of ${MAX_DELEGATION_DEPTH}.`, failureClass: "governance_violation" };
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("authority_delegations")
    .insert({
      workspace_id: input.workspaceId,
      delegator_id: input.delegatorId,
      delegator_authority: input.delegatorAuthority,
      delegate_id: input.delegateId,
      delegate_authority: input.delegateAuthority,
      project_id: input.projectId ?? null,
      valid_from: input.validFrom ?? now,
      valid_until: input.validUntil ?? null,
      status: "active",
      delegation_depth: depth,
      parent_delegation_id: input.parentDelegationId ?? null,
      created_by: input.createdBy,
    })
    .select(COLUMNS)
    .single<AuthorityDelegationRecord>();

  if (error || !data) return failed("Unable to create delegation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    actorType: "user",
    eventType: "AUTHORITY_DELEGATED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_delegations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      delegationId: data.id,
      delegatorId: input.delegatorId,
      delegatorAuthority: input.delegatorAuthority,
      delegateId: input.delegateId,
      delegateAuthority: input.delegateAuthority,
      depth,
    },
  });

  return { ok: true, data };
}

// ─── revokeDelegation ────────────────────────────────────────────────────────

export async function revokeDelegation(
  input: RevokeDelegationInput,
): Promise<AuthorityResult<AuthorityDelegationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.delegationId)) return validation("delegationId must be a UUID.");
  if (!validUuid(input.revokedBy)) return validation("revokedBy must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("authority_delegations")
    .select(COLUMNS)
    .eq("id", input.delegationId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle<AuthorityDelegationRecord>();

  if (!existing) return failed("Delegation not found.", "not_found");
  if (existing.status !== "active") return validation("Delegation is not active.");

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("authority_delegations")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: input.revokedBy,
      revocation_reason: input.revocationReason ?? null,
      updated_at: now,
    })
    .eq("id", input.delegationId)
    .eq("workspace_id", input.workspaceId)
    .select(COLUMNS)
    .single<AuthorityDelegationRecord>();

  if (error || !data) return failed("Unable to revoke delegation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.revokedBy,
    actorType: "user",
    eventType: "DELEGATION_REVOKED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_delegations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      delegationId: data.id,
      delegatorId: existing.delegator_id,
      delegateId: existing.delegate_id,
      revocationReason: input.revocationReason ?? null,
    },
  });

  return { ok: true, data };
}

// ─── getActiveDelegation ─────────────────────────────────────────────────────

export async function getActiveDelegation(input: {
  workspaceId: string;
  delegateId: string;
  delegateAuthority: AuthorityType;
  projectId?: string | null;
  atTime?: string;
}): Promise<AuthorityResult<AuthorityDelegationRecord | null>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.delegateId)) return validation("delegateId must be a UUID.");

  const atTime = input.atTime ?? new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  // When projectId is given: try project-specific first, then fall back to workspace-wide
  const scopesToTry: Array<string | null> = input.projectId
    ? [input.projectId, null]
    : [null];

  for (const scopeProjectId of scopesToTry) {
    let query = supabase
      .from("authority_delegations")
      .select(COLUMNS)
      .eq("workspace_id", input.workspaceId)
      .eq("delegate_id", input.delegateId)
      .eq("delegate_authority", input.delegateAuthority)
      .eq("status", "active")
      .lte("valid_from", atTime);

    if (scopeProjectId) {
      query = query.eq("project_id", scopeProjectId);
    } else {
      query = query.is("project_id", null);
    }

    const { data, error } = await query.maybeSingle<AuthorityDelegationRecord>();
    if (error) return failed("Unable to retrieve delegation.");
    if (data) {
      if (data.valid_until && data.valid_until < atTime) continue;
      return { ok: true, data };
    }
  }

  return { ok: true, data: null };
}

// ─── getDelegationChain ──────────────────────────────────────────────────────

export async function getDelegationChain(input: {
  workspaceId: string;
  delegationId: string;
}): Promise<AuthorityResult<AuthorityDelegationRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.delegationId)) return validation("delegationId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const chain: AuthorityDelegationRecord[] = [];

  // Helper with explicit return type breaks the circular inference that confuses tsc
  const fetchNode = async (id: string): Promise<AuthorityDelegationRecord | null> => {
    const { data } = await supabase
      .from("authority_delegations")
      .select(COLUMNS)
      .eq("id", id)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle<AuthorityDelegationRecord>();
    return data;
  };

  let currentId: string | null = input.delegationId;
  while (currentId) {
    const node = await fetchNode(currentId);
    if (!node) break;
    chain.unshift(node); // prepend so root is first
    currentId = node.parent_delegation_id;
  }

  return { ok: true, data: chain };
}
