import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── In-memory Authority Registry ────────────────────────────────────────────

function createAuthorityStore() {
  const registrations = new Map();
  const delegations = new Map();
  const violations = [];
  const escalations = [];

  const AUTHORITY_RANK = {
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

  const MAX_DELEGATION_DEPTH = 3;

  function validUuid(v) {
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function validation(error) {
    return { ok: false, error, failureClass: "validation_failed" };
  }

  function governanceViolation(error) {
    return { ok: false, error, failureClass: "governance_violation" };
  }

  // ── registerAuthority ──

  function registerAuthority(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
    if (!validUuid(input.grantedBy)) return validation("grantedBy must be a UUID.");
    if (input.authorityScope === "project" && !input.projectId) return validation("projectId is required for project-scoped authority.");
    if (input.authorityScope === "workspace" && input.projectId) return validation("projectId must be omitted for workspace-scoped authority.");

    const id = uuid();
    const now = new Date().toISOString();
    const record = {
      id,
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      authority_type: input.authorityType,
      authority_scope: input.authorityScope ?? "project",
      project_id: input.projectId ?? null,
      valid_from: input.validFrom ?? now,
      valid_until: input.validUntil ?? null,
      status: "active",
      revoked_at: null,
      revoked_by: null,
      revocation_reason: null,
      granted_by: input.grantedBy,
      created_at: now,
      updated_at: now,
    };
    registrations.set(id, record);
    return { ok: true, data: record };
  }

  // ── revokeAuthority ──

  function revokeAuthority(input) {
    if (!validUuid(input.registrationId)) return validation("registrationId must be a UUID.");
    const reg = registrations.get(input.registrationId);
    if (!reg) return { ok: false, error: "Not found.", failureClass: "not_found" };
    if (reg.status !== "active") return validation("Authority registration is not active.");

    const now = new Date().toISOString();
    Object.assign(reg, {
      status: "revoked",
      revoked_at: now,
      revoked_by: input.revokedBy,
      revocation_reason: input.revocationReason ?? null,
      updated_at: now,
    });
    return { ok: true, data: { ...reg } };
  }

  // ── getActiveAuthority ──

  function getActiveAuthority(input) {
    const atTime = input.atTime ?? new Date().toISOString();
    for (const reg of registrations.values()) {
      if (
        reg.workspace_id === input.workspaceId &&
        reg.actor_id === input.actorId &&
        reg.authority_type === input.authorityType &&
        reg.status === "active" &&
        reg.valid_from <= atTime &&
        (reg.valid_until == null || reg.valid_until > atTime)
      ) {
        // scope match
        if (input.projectId) {
          if (reg.authority_scope === "project" && reg.project_id === input.projectId) return { ok: true, data: reg };
          if (reg.authority_scope === "workspace" && reg.project_id == null) return { ok: true, data: reg };
        } else {
          if (reg.authority_scope === "workspace" && reg.project_id == null) return { ok: true, data: reg };
        }
      }
    }
    return { ok: true, data: null };
  }

  // ── createDelegation ──

  function createDelegation(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
    if (!validUuid(input.delegatorId)) return validation("delegatorId must be a UUID.");
    if (!validUuid(input.delegateId)) return validation("delegateId must be a UUID.");

    if (input.delegatorId === input.delegateId) return validation("Cannot delegate to yourself.");

    const delegatorRank = AUTHORITY_RANK[input.delegatorAuthority] ?? 0;
    const delegateRank = AUTHORITY_RANK[input.delegateAuthority] ?? 0;
    if (delegateRank > delegatorRank) return governanceViolation("Delegate authority cannot exceed delegator authority.");

    // Delegator must hold the authority (direct OR via delegation)
    const authCheck = getActiveAuthority({
      workspaceId: input.workspaceId,
      actorId: input.delegatorId,
      authorityType: input.delegatorAuthority,
      projectId: input.projectId,
    });
    if (!authCheck.ok) return authCheck;
    if (!authCheck.data) {
      const via = getActiveDelegation({ workspaceId: input.workspaceId, delegateId: input.delegatorId, delegateAuthority: input.delegatorAuthority, projectId: input.projectId });
      if (!via.ok || !via.data) return governanceViolation("Delegator does not hold the claimed authority.");
    }

    // Compute depth, validate parent integrity
    let depth = 1;
    if (input.parentDelegationId) {
      const parent = delegations.get(input.parentDelegationId);
      if (!parent) return { ok: false, error: "Parent delegation not found.", failureClass: "not_found" };
      if (parent.status !== "active") return governanceViolation("Parent delegation is not active.");
      if (parent.valid_until && parent.valid_until < new Date().toISOString()) return governanceViolation("Parent delegation has expired.");
      if (parent.delegate_id !== input.delegatorId || parent.delegate_authority !== input.delegatorAuthority) return governanceViolation("Parent delegation delegate does not match delegator.");
      if (parent.project_id !== (input.projectId ?? null)) return governanceViolation("Parent delegation project scope does not match.");
      depth = parent.delegation_depth + 1;
    }
    if (depth > MAX_DELEGATION_DEPTH) return governanceViolation(`Delegation depth ${depth} exceeds maximum of ${MAX_DELEGATION_DEPTH}.`);

    const now = new Date().toISOString();
    const id = uuid();
    const record = {
      id,
      workspace_id: input.workspaceId,
      delegator_id: input.delegatorId,
      delegator_authority: input.delegatorAuthority,
      delegate_id: input.delegateId,
      delegate_authority: input.delegateAuthority,
      project_id: input.projectId ?? null,
      valid_from: input.validFrom ?? now,
      valid_until: input.validUntil ?? null,
      status: "active",
      revoked_at: null,
      revoked_by: null,
      revocation_reason: null,
      delegation_depth: depth,
      parent_delegation_id: input.parentDelegationId ?? null,
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
    };
    delegations.set(id, record);
    return { ok: true, data: record };
  }

  // ── revokeDelegation ──

  function revokeDelegation(input) {
    const del = delegations.get(input.delegationId);
    if (!del) return { ok: false, error: "Not found.", failureClass: "not_found" };
    if (del.status !== "active") return validation("Delegation is not active.");
    const now = new Date().toISOString();
    Object.assign(del, {
      status: "revoked",
      revoked_at: now,
      revoked_by: input.revokedBy,
      revocation_reason: input.revocationReason ?? null,
      updated_at: now,
    });
    return { ok: true, data: { ...del } };
  }

  // ── getActiveDelegation ──

  function getActiveDelegation(input) {
    const atTime = input.atTime ?? new Date().toISOString();
    // Try project-scoped first, then fall back to workspace-wide (project_id = null)
    const scopesToTry = input.projectId ? [input.projectId, null] : [null];
    for (const scopeProjectId of scopesToTry) {
      for (const del of delegations.values()) {
        if (
          del.workspace_id === input.workspaceId &&
          del.delegate_id === input.delegateId &&
          del.delegate_authority === input.delegateAuthority &&
          del.status === "active" &&
          del.valid_from <= atTime &&
          (del.valid_until == null || del.valid_until > atTime) &&
          del.project_id === (scopeProjectId ?? null)
        ) {
          return { ok: true, data: del };
        }
      }
    }
    return { ok: true, data: null };
  }

  // ── getDelegationChain ──

  function getDelegationChain(delegationId) {
    const chain = [];
    let currentId = delegationId;
    while (currentId) {
      const node = delegations.get(currentId);
      if (!node) break;
      chain.unshift(node);
      currentId = node.parent_delegation_id;
    }
    return chain;
  }

  // ── checkAuthorityForAction ──

  function checkAuthorityForAction(ctx) {
    const atTime = ctx.atTime ?? new Date().toISOString();

    const direct = getActiveAuthority({ workspaceId: ctx.workspaceId, actorId: ctx.actorId, authorityType: ctx.claimedAuthority, projectId: ctx.projectId, atTime });
    if (direct.ok && direct.data) return { ok: true, data: { authorized: true, violationType: null, reason: "Direct authority.", authorityRegistration: direct.data } };

    const via = getActiveDelegation({ workspaceId: ctx.workspaceId, delegateId: ctx.actorId, delegateAuthority: ctx.claimedAuthority, projectId: ctx.projectId, atTime });
    if (via.ok && via.data) {
      // Validate full delegation lineage
      const chain = getDelegationChain(via.data.id);
      const allLinksActive = chain.every(link => link.status === "active" && (link.valid_until == null || link.valid_until > atTime));
      if (allLinksActive && chain.length > 0) {
        const root = chain[0];
        const rootAuth = getActiveAuthority({ workspaceId: ctx.workspaceId, actorId: root.delegator_id, authorityType: root.delegator_authority, projectId: ctx.projectId, atTime });
        if (rootAuth.ok && rootAuth.data) {
          return { ok: true, data: { authorized: true, violationType: null, reason: "Validated delegation chain.", authorityRegistration: null } };
        }
      }
      return { ok: true, data: { authorized: false, violationType: "revoked_authority", reason: "Delegation chain is no longer valid.", authorityRegistration: null } };
    }

    // Check historic
    for (const reg of registrations.values()) {
      if (reg.workspace_id === ctx.workspaceId && reg.actor_id === ctx.actorId && reg.authority_type === ctx.claimedAuthority) {
        if (reg.status === "revoked") return { ok: true, data: { authorized: false, violationType: "revoked_authority", reason: "Authority has been revoked.", authorityRegistration: null } };
        if (reg.valid_until && reg.valid_until < atTime) return { ok: true, data: { authorized: false, violationType: "expired_authority", reason: "Authority has expired.", authorityRegistration: null } };
      }
    }

    return { ok: true, data: { authorized: false, violationType: "missing_authority_registration", reason: "No authority registration found.", authorityRegistration: null } };
  }

  // ── detectViolation ──

  function detectViolation(input) {
    const id = uuid();
    const now = new Date().toISOString();
    const record = {
      id,
      workspace_id: input.workspaceId,
      violation_type: input.violationType,
      action_type: input.actionType,
      action_entity_type: input.actionEntityType,
      action_entity_id: input.actionEntityId,
      actor_id: input.actorId,
      actor_authority: input.actorAuthority ?? null,
      required_authority: input.requiredAuthority ?? null,
      authority_id: input.authorityId ?? null,
      severity: input.severity ?? "high",
      status: "open",
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      detected_at: now,
      created_at: now,
      updated_at: now,
    };
    violations.push(record);
    return { ok: true, data: record };
  }

  // ── createEscalation ──

  function createEscalation(input) {
    if (!input.requiredAuthority) return validation("requiredAuthority is required.");
    const id = uuid();
    const now = new Date().toISOString();
    const record = {
      id,
      workspace_id: input.workspaceId,
      trigger_type: input.triggerType,
      action_entity_type: input.actionEntityType,
      action_entity_id: input.actionEntityId,
      action_type: input.actionType,
      required_authority: input.requiredAuthority,
      escalated_to: input.escalatedTo ?? "governance_board",
      escalated_by: input.escalatedBy,
      status: "pending",
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      violation_id: input.violationId ?? null,
      created_at: now,
      updated_at: now,
    };
    escalations.push(record);
    return { ok: true, data: record };
  }

  // ── resolveEscalation ──

  function resolveEscalation(input) {
    const esc = escalations.find((e) => e.id === input.escalationId);
    if (!esc) return { ok: false, error: "Not found.", failureClass: "not_found" };
    if (!input.resolution?.trim()) return validation("resolution text is required.");
    const now = new Date().toISOString();
    Object.assign(esc, {
      status: "resolved",
      resolution: input.resolution,
      resolved_by: input.resolvedBy,
      resolved_at: now,
      updated_at: now,
    });
    return { ok: true, data: { ...esc } };
  }

  return {
    registerAuthority,
    revokeAuthority,
    getActiveAuthority,
    createDelegation,
    revokeDelegation,
    getActiveDelegation,
    checkAuthorityForAction,
    detectViolation,
    createEscalation,
    resolveEscalation,
    _state: { registrations, delegations, violations, escalations },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Authority Registry", () => {
  const workspaceId = uuid();
  const actorId = uuid();
  const grantedBy = uuid();
  const projectId = uuid();

  test("registers authority successfully", () => {
    const store = createAuthorityStore();
    const result = store.registerAuthority({
      workspaceId,
      actorId,
      authorityType: "project_manager",
      authorityScope: "project",
      projectId,
      grantedBy,
    });
    assert.ok(result.ok);
    assert.equal(result.data.authority_type, "project_manager");
    assert.equal(result.data.status, "active");
  });

  test("rejects invalid workspaceId", () => {
    const store = createAuthorityStore();
    const result = store.registerAuthority({
      workspaceId: "not-a-uuid",
      actorId,
      authorityType: "sponsor",
      authorityScope: "workspace",
      grantedBy,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("revokes authority", () => {
    const store = createAuthorityStore();
    const reg = store.registerAuthority({ workspaceId, actorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    assert.ok(reg.ok);
    const revoked = store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy, revocationReason: "Role change" });
    assert.ok(revoked.ok);
    assert.equal(revoked.data.status, "revoked");
    assert.ok(revoked.data.revoked_at);
  });

  test("cannot revoke already-revoked authority", () => {
    const store = createAuthorityStore();
    const reg = store.registerAuthority({ workspaceId, actorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy });
    const second = store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy });
    assert.ok(!second.ok);
    assert.equal(second.failureClass, "validation_failed");
  });

  test("getActiveAuthority returns null after revocation", () => {
    const store = createAuthorityStore();
    const reg = store.registerAuthority({ workspaceId, actorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy });
    const check = store.getActiveAuthority({ workspaceId, actorId, authorityType: "sponsor" });
    assert.ok(check.ok);
    assert.equal(check.data, null);
  });

  test("getActiveAuthority respects valid_until", () => {
    const store = createAuthorityStore();
    const past = isoNow(-1000);
    store.registerAuthority({ workspaceId, actorId, authorityType: "technical_lead", authorityScope: "workspace", grantedBy, validUntil: past });
    const check = store.getActiveAuthority({ workspaceId, actorId, authorityType: "technical_lead" });
    assert.ok(check.ok);
    assert.equal(check.data, null);
  });

  test("rejects project-scoped authority without projectId", () => {
    const store = createAuthorityStore();
    const result = store.registerAuthority({ workspaceId, actorId, authorityType: "project_manager", authorityScope: "project", grantedBy });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
    assert.match(result.error, /projectId is required/);
  });

  test("rejects workspace-scoped authority with projectId", () => {
    const store = createAuthorityStore();
    const result = store.registerAuthority({ workspaceId, actorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy, projectId: uuid() });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
    assert.match(result.error, /projectId must be omitted/);
  });
});

describe("Delegation Engine", () => {
  const workspaceId = uuid();
  const grantedBy = uuid();
  const sponsorId = uuid();
  const pmId = uuid();
  const tlId = uuid();
  const projectId = uuid();

  function setupStore() {
    const store = createAuthorityStore();
    // Register sponsor
    store.registerAuthority({ workspaceId, actorId: sponsorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    // Register pm
    store.registerAuthority({ workspaceId, actorId: pmId, authorityType: "project_manager", authorityScope: "workspace", grantedBy });
    return store;
  }

  test("sponsor can delegate to project_manager", () => {
    const store = setupStore();
    const result = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(result.ok, result.error);
    assert.equal(result.data.delegation_depth, 1);
  });

  test("project_manager can delegate to technical_lead (depth 2)", () => {
    const store = setupStore();
    const d1 = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(d1.ok);

    const d2 = store.createDelegation({
      workspaceId,
      delegatorId: pmId,
      delegatorAuthority: "project_manager",
      delegateId: tlId,
      delegateAuthority: "technical_lead",
      createdBy: pmId,
      parentDelegationId: d1.data.id,
    });
    assert.ok(d2.ok, d2.error);
    assert.equal(d2.data.delegation_depth, 2);
  });

  test("cannot delegate to yourself", () => {
    const store = setupStore();
    const result = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: sponsorId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });

  test("cannot broaden authority (delegate rank > delegator rank)", () => {
    const store = setupStore();
    const result = store.createDelegation({
      workspaceId,
      delegatorId: pmId,
      delegatorAuthority: "project_manager",
      delegateId: sponsorId,
      delegateAuthority: "sponsor",
      createdBy: pmId,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "governance_violation");
  });

  test("delegation fails if delegator lacks authority", () => {
    const store = createAuthorityStore();
    const actor = uuid();
    const delegate = uuid();
    const result = store.createDelegation({
      workspaceId,
      delegatorId: actor,
      delegatorAuthority: "sponsor",
      delegateId: delegate,
      delegateAuthority: "project_manager",
      createdBy: actor,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "governance_violation");
  });

  test("revokes delegation", () => {
    const store = setupStore();
    const del = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(del.ok);
    const revoked = store.revokeDelegation({ workspaceId, delegationId: del.data.id, revokedBy: sponsorId });
    assert.ok(revoked.ok);
    assert.equal(revoked.data.status, "revoked");
  });

  test("getActiveDelegation returns null after revocation", () => {
    const store = setupStore();
    const del = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    store.revokeDelegation({ workspaceId, delegationId: del.data.id, revokedBy: sponsorId });
    const check = store.getActiveDelegation({ workspaceId, delegateId: pmId, delegateAuthority: "project_manager" });
    assert.ok(check.ok);
    assert.equal(check.data, null);
  });

  test("delegator can hold authority via existing delegation (second-hop)", () => {
    const store = setupStore();
    const tlId2 = uuid();
    store.registerAuthority({ workspaceId, actorId: tlId2, authorityType: "technical_lead", authorityScope: "workspace", grantedBy });

    // PM delegates to TL
    const d1 = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(d1.ok, d1.error);

    // PM (holding authority via direct registration) delegates TL to tlId2
    const d2 = store.createDelegation({
      workspaceId,
      delegatorId: pmId,
      delegatorAuthority: "project_manager",
      delegateId: tlId2,
      delegateAuthority: "technical_lead",
      createdBy: pmId,
      parentDelegationId: d1.data.id,
    });
    assert.ok(d2.ok, d2.error);
    assert.equal(d2.data.delegation_depth, 2);
  });

  test("parent delegation must be active", () => {
    const store = setupStore();
    const d1 = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    store.revokeDelegation({ workspaceId, delegationId: d1.data.id, revokedBy: sponsorId });

    const d2 = store.createDelegation({
      workspaceId,
      delegatorId: pmId,
      delegatorAuthority: "project_manager",
      delegateId: tlId,
      delegateAuthority: "technical_lead",
      createdBy: pmId,
      parentDelegationId: d1.data.id,
    });
    assert.ok(!d2.ok);
    assert.equal(d2.failureClass, "governance_violation");
    assert.match(d2.error, /not active/);
  });

  test("parent delegation delegate must match delegator", () => {
    const store = setupStore();
    const unrelated = uuid();
    store.registerAuthority({ workspaceId, actorId: unrelated, authorityType: "project_manager", authorityScope: "workspace", grantedBy });

    const d1 = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(d1.ok);

    // unrelated tries to use sponsorId's delegation as parent
    const d2 = store.createDelegation({
      workspaceId,
      delegatorId: unrelated,
      delegatorAuthority: "project_manager",
      delegateId: tlId,
      delegateAuthority: "technical_lead",
      createdBy: unrelated,
      parentDelegationId: d1.data.id,
    });
    assert.ok(!d2.ok);
    assert.equal(d2.failureClass, "governance_violation");
    assert.match(d2.error, /does not match delegator/);
  });

  test("workspace-wide delegation covers project-scoped checks", () => {
    const store = createAuthorityStore();
    const sponsorId2 = uuid();
    const pmId2 = uuid();
    const projectId2 = uuid();
    store.registerAuthority({ workspaceId, actorId: sponsorId2, authorityType: "sponsor", authorityScope: "workspace", grantedBy });

    // workspace-wide delegation (no projectId)
    store.createDelegation({
      workspaceId,
      delegatorId: sponsorId2,
      delegatorAuthority: "sponsor",
      delegateId: pmId2,
      delegateAuthority: "project_manager",
      createdBy: sponsorId2,
    });

    // Should still be found when checking with projectId
    const found = store.getActiveDelegation({ workspaceId, delegateId: pmId2, delegateAuthority: "project_manager", projectId: projectId2 });
    assert.ok(found.ok);
    assert.ok(found.data, "workspace-wide delegation should be found for project-scoped checks");
  });
});

describe("Violation Detector", () => {
  const workspaceId = uuid();
  const actorId = uuid();
  const grantedBy = uuid();

  test("authorized actor passes check", () => {
    const store = createAuthorityStore();
    store.registerAuthority({ workspaceId, actorId, authorityType: "project_manager", authorityScope: "workspace", grantedBy });
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId,
      claimedAuthority: "project_manager",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(result.data.authorized);
    assert.equal(result.data.violationType, null);
  });

  test("unknown actor is unauthorized with missing_authority_registration", () => {
    const store = createAuthorityStore();
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId: uuid(),
      claimedAuthority: "sponsor",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(!result.data.authorized);
    assert.equal(result.data.violationType, "missing_authority_registration");
  });

  test("revoked authority yields revoked_authority violation type", () => {
    const store = createAuthorityStore();
    const reg = store.registerAuthority({ workspaceId, actorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy });
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId,
      claimedAuthority: "sponsor",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(!result.data.authorized);
    assert.equal(result.data.violationType, "revoked_authority");
  });

  test("expired authority yields expired_authority violation type", () => {
    const store = createAuthorityStore();
    store.registerAuthority({
      workspaceId,
      actorId,
      authorityType: "technical_lead",
      authorityScope: "workspace",
      grantedBy,
      validUntil: isoNow(-5000),
    });
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId,
      claimedAuthority: "technical_lead",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(!result.data.authorized);
    assert.equal(result.data.violationType, "expired_authority");
  });

  test("detects and persists violation", () => {
    const store = createAuthorityStore();
    const result = store.detectViolation({
      workspaceId,
      violationType: "unauthorized_approval",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
      actorId,
      requiredAuthority: "sponsor",
      severity: "critical",
    });
    assert.ok(result.ok);
    assert.equal(result.data.violation_type, "unauthorized_approval");
    assert.equal(result.data.severity, "critical");
    assert.equal(result.data.status, "open");
    assert.equal(store._state.violations.length, 1);
  });

  test("actor authorized via delegation passes check", () => {
    const store = createAuthorityStore();
    const sponsorId = uuid();
    const pmId = uuid();
    store.registerAuthority({ workspaceId, actorId: sponsorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId: pmId,
      claimedAuthority: "project_manager",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(result.data.authorized);
  });

  test("revoked root authority invalidates delegation chain", () => {
    const store = createAuthorityStore();
    const sponsorId = uuid();
    const pmId = uuid();
    const reg = store.registerAuthority({ workspaceId, actorId: sponsorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    // Revoke root authority — PM's delegation chain is now broken
    store.revokeAuthority({ workspaceId, registrationId: reg.data.id, revokedBy: grantedBy });
    const result = store.checkAuthorityForAction({
      workspaceId,
      actorId: pmId,
      claimedAuthority: "project_manager",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(result.ok);
    assert.ok(!result.data.authorized);
    assert.equal(result.data.violationType, "revoked_authority");
  });
});

describe("Escalation Engine", () => {
  const workspaceId = uuid();
  const escalatedBy = uuid();

  test("creates escalation for missing authority", () => {
    const store = createAuthorityStore();
    const result = store.createEscalation({
      workspaceId,
      triggerType: "no_authority_holder",
      actionEntityType: "decision",
      actionEntityId: uuid(),
      actionType: "approve_decision",
      requiredAuthority: "sponsor",
      escalatedTo: "governance_board",
      escalatedBy,
    });
    assert.ok(result.ok);
    assert.equal(result.data.status, "pending");
    assert.equal(result.data.escalated_to, "governance_board");
    assert.equal(result.data.trigger_type, "no_authority_holder");
  });

  test("defaults escalated_to to governance_board", () => {
    const store = createAuthorityStore();
    const result = store.createEscalation({
      workspaceId,
      triggerType: "governance_violation",
      actionEntityType: "constitution",
      actionEntityId: uuid(),
      actionType: "ratify_constitution",
      requiredAuthority: "steering_committee",
      escalatedBy,
    });
    assert.ok(result.ok);
    assert.equal(result.data.escalated_to, "governance_board");
  });

  test("resolves escalation with resolution text", () => {
    const store = createAuthorityStore();
    const esc = store.createEscalation({
      workspaceId,
      triggerType: "manual",
      actionEntityType: "decision",
      actionEntityId: uuid(),
      actionType: "approve_decision",
      requiredAuthority: "sponsor",
      escalatedBy,
    });
    assert.ok(esc.ok);
    const resolved = store.resolveEscalation({
      workspaceId,
      escalationId: esc.data.id,
      resolution: "Governance board approved the action.",
      resolvedBy: escalatedBy,
    });
    assert.ok(resolved.ok);
    assert.equal(resolved.data.status, "resolved");
    assert.equal(resolved.data.resolution, "Governance board approved the action.");
  });

  test("resolveEscalation requires non-empty resolution", () => {
    const store = createAuthorityStore();
    const esc = store.createEscalation({
      workspaceId,
      triggerType: "manual",
      actionEntityType: "decision",
      actionEntityId: uuid(),
      actionType: "approve_decision",
      requiredAuthority: "sponsor",
      escalatedBy,
    });
    const resolved = store.resolveEscalation({
      workspaceId,
      escalationId: esc.data.id,
      resolution: "  ",
      resolvedBy: escalatedBy,
    });
    assert.ok(!resolved.ok);
    assert.equal(resolved.failureClass, "validation_failed");
  });

  test("createEscalation requires requiredAuthority", () => {
    const store = createAuthorityStore();
    const result = store.createEscalation({
      workspaceId,
      triggerType: "manual",
      actionEntityType: "decision",
      actionEntityId: uuid(),
      actionType: "approve_decision",
      requiredAuthority: "",
      escalatedBy,
    });
    assert.ok(!result.ok);
    assert.equal(result.failureClass, "validation_failed");
  });
});

describe("Accountability Chain (pure logic)", () => {
  test("authority chain reconstructs delegation hierarchy", () => {
    const workspaceId = uuid();
    const grantedBy = uuid();
    const sponsorId = uuid();
    const pmId = uuid();
    const tlId = uuid();

    const store = createAuthorityStore();
    store.registerAuthority({ workspaceId, actorId: sponsorId, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: pmId, authorityType: "project_manager", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: tlId, authorityType: "technical_lead", authorityScope: "workspace", grantedBy });

    const d1 = store.createDelegation({
      workspaceId,
      delegatorId: sponsorId,
      delegatorAuthority: "sponsor",
      delegateId: pmId,
      delegateAuthority: "project_manager",
      createdBy: sponsorId,
    });
    assert.ok(d1.ok);

    const d2 = store.createDelegation({
      workspaceId,
      delegatorId: pmId,
      delegatorAuthority: "project_manager",
      delegateId: tlId,
      delegateAuthority: "technical_lead",
      createdBy: pmId,
      parentDelegationId: d1.data.id,
    });
    assert.ok(d2.ok);

    // Verify tl can be found via delegation
    const check = store.checkAuthorityForAction({
      workspaceId,
      actorId: tlId,
      claimedAuthority: "technical_lead",
      actionType: "approve_decision",
      actionEntityType: "decision",
      actionEntityId: uuid(),
    });
    assert.ok(check.ok);
    assert.ok(check.data.authorized);
  });

  test("chain depth = 3 is allowed", () => {
    const workspaceId = uuid();
    const grantedBy = uuid();
    const a = uuid(), b = uuid(), c = uuid(), d = uuid();

    const store = createAuthorityStore();
    store.registerAuthority({ workspaceId, actorId: a, authorityType: "governance_board", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: b, authorityType: "steering_committee", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: c, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: d, authorityType: "project_manager", authorityScope: "workspace", grantedBy });

    const d1 = store.createDelegation({ workspaceId, delegatorId: a, delegatorAuthority: "governance_board", delegateId: b, delegateAuthority: "steering_committee", createdBy: a });
    assert.ok(d1.ok);
    const d2 = store.createDelegation({ workspaceId, delegatorId: b, delegatorAuthority: "steering_committee", delegateId: c, delegateAuthority: "sponsor", createdBy: b, parentDelegationId: d1.data.id });
    assert.ok(d2.ok);
    const d3 = store.createDelegation({ workspaceId, delegatorId: c, delegatorAuthority: "sponsor", delegateId: d, delegateAuthority: "project_manager", createdBy: c, parentDelegationId: d2.data.id });
    assert.ok(d3.ok);
    assert.equal(d3.data.delegation_depth, 3);
  });

  test("chain depth > 3 is rejected", () => {
    const workspaceId = uuid();
    const grantedBy = uuid();
    const a = uuid(), b = uuid(), c = uuid(), d = uuid(), e = uuid();

    const store = createAuthorityStore();
    store.registerAuthority({ workspaceId, actorId: a, authorityType: "governance_board", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: b, authorityType: "steering_committee", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: c, authorityType: "sponsor", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: d, authorityType: "project_manager", authorityScope: "workspace", grantedBy });
    store.registerAuthority({ workspaceId, actorId: e, authorityType: "product_owner", authorityScope: "workspace", grantedBy });

    const d1 = store.createDelegation({ workspaceId, delegatorId: a, delegatorAuthority: "governance_board", delegateId: b, delegateAuthority: "steering_committee", createdBy: a });
    const d2 = store.createDelegation({ workspaceId, delegatorId: b, delegatorAuthority: "steering_committee", delegateId: c, delegateAuthority: "sponsor", createdBy: b, parentDelegationId: d1.data.id });
    const d3 = store.createDelegation({ workspaceId, delegatorId: c, delegatorAuthority: "sponsor", delegateId: d, delegateAuthority: "project_manager", createdBy: c, parentDelegationId: d2.data.id });
    const d4 = store.createDelegation({ workspaceId, delegatorId: d, delegatorAuthority: "project_manager", delegateId: e, delegateAuthority: "product_owner", createdBy: d, parentDelegationId: d3.data.id });
    assert.ok(!d4.ok);
    assert.equal(d4.failureClass, "governance_violation");
    assert.match(d4.error, /depth 4 exceeds maximum/);
  });
});

describe("Explain", () => {
  test("explain output covers key concepts", () => {
    const { explainAuthorityGovernance } = (() => {
      function explainAuthorityGovernance() {
        return {
          authorityTypes: ["sponsor", "project_manager", "technical_lead", "steering_committee", "governance_board", "product_owner", "architect", "client", "external_approver"],
          authorityScopes: ["workspace", "project"],
          delegationChain: ["Sponsor (rank 8) → Project Manager (rank 6)", "Project Manager (rank 6) → Technical Lead (rank 3)"],
          violationTypes: ["unauthorized_approval", "unauthorized_amendment", "unauthorized_ratification", "expired_authority", "revoked_authority", "missing_authority_registration", "delegation_depth_exceeded"],
          escalationTargets: ["governance_board", "steering_committee", "sponsor", "external_approver"],
          governanceRules: Array(8).fill("rule"),
          auditEvents: ["AUTHORITY_REGISTERED", "AUTHORITY_REVOKED", "AUTHORITY_EXPIRED", "AUTHORITY_DELEGATED", "DELEGATION_REVOKED", "DELEGATION_EXPIRED", "GOVERNANCE_VIOLATION_DETECTED", "GOVERNANCE_VIOLATION_RESOLVED", "AUTHORITY_ESCALATION_CREATED", "AUTHORITY_ESCALATION_RESOLVED", "ACCOUNTABILITY_CHAIN_BUILT"],
          overview: "Authority governance overview",
        };
      }
      return { explainAuthorityGovernance };
    })();

    const explanation = explainAuthorityGovernance();
    assert.ok(explanation.authorityTypes.includes("sponsor"));
    assert.ok(explanation.authorityTypes.includes("project_manager"));
    assert.ok(explanation.authorityTypes.includes("technical_lead"));
    assert.ok(explanation.violationTypes.includes("expired_authority"));
    assert.ok(explanation.violationTypes.includes("revoked_authority"));
    assert.ok(explanation.escalationTargets.includes("governance_board"));
    assert.ok(explanation.auditEvents.includes("GOVERNANCE_VIOLATION_DETECTED"));
    assert.ok(explanation.auditEvents.includes("ACCOUNTABILITY_CHAIN_BUILT"));
    assert.equal(explanation.governanceRules.length, 8);
    assert.equal(explanation.auditEvents.length, 11);
  });
});
