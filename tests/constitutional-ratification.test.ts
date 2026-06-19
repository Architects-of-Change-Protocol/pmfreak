/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// ─── In-memory store ─────────────────────────────────────────────────────────
//
// All service logic is reimplemented here without database access. This mirrors
// the pattern used in personal-pm-memory.test.ts: validate logic, state
// machines, hashing, and legitimacy computation in pure memory.

function uuid() {
  return "00000000-0000-4000-8000-000000000000".replace(/[0]/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

// ─── Hash engine (mirrors src/lib/constitutional-ratification/hash-engine.ts) ─

function fnv1a32(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function generateSignatureHash(input) {
  const canonical = [
    input.entityType ?? "",
    input.entityId,
    String(input.entityVersion),
    input.authorityType ?? "",
    input.authorityId,
    input.timestamp,
  ].join("|");
  const a = fnv1a32(canonical);
  const b = fnv1a32(`${a}:${canonical}`);
  const c = fnv1a32(`${b}:${canonical}`);
  const d = fnv1a32(`${c}:${canonical}`);
  return `sha-sig-${a}${b}${c}${d}`;
}

// ─── In-memory ratification store ────────────────────────────────────────────

function createRatificationStore() {
  const signatures = new Map(); // id -> signature
  const policies = new Map();   // `${workspaceId}:${entityType}` -> policy

  function validUuid(v) {
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function validation(error) {
    return { ok: false, error, failureClass: "validation_failed" };
  }
  function failed(error, failureClass = "persistence_failed") {
    return { ok: false, error, failureClass };
  }

  return {
    // ── requestSignature ───────────────────────────────────────────────────
    requestSignature(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
      if (!validUuid(input.authorityId)) return validation("authorityId must be a UUID.");
      if (!validUuid(input.requestedBy)) return validation("requestedBy must be a UUID.");
      if (!["constitution", "amendment", "decision"].includes(input.entityType)) {
        return validation("entityType must be constitution, amendment, or decision.");
      }
      if ((input.entityVersion ?? 0) < 1) return validation("entityVersion must be >= 1.");

      // Rule 2: no duplicate
      for (const sig of signatures.values()) {
        if (
          sig.workspace_id === input.workspaceId &&
          sig.entity_type === input.entityType &&
          sig.entity_id === input.entityId &&
          sig.authority_id === input.authorityId
        ) {
          return failed(
            `A signature record already exists for this authority on this entity (status: ${sig.status}).`,
            "governance_violation",
          );
        }
      }

      const id = uuid();
      const now = new Date().toISOString();
      const sig = {
        id,
        workspace_id: input.workspaceId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        entity_version: input.entityVersion,
        authority_type: input.authorityType,
        authority_id: input.authorityId,
        status: "pending",
        signature_hash: null,
        comments: input.comments ?? null,
        requested_at: now,
        signed_at: null,
        rejected_at: null,
        expired_at: null,
        withdrawn_at: null,
        created_by: input.requestedBy,
        created_at: now,
        updated_at: now,
      };
      signatures.set(id, sig);
      return { ok: true, data: sig };
    },

    // ── signEntity ─────────────────────────────────────────────────────────
    signEntity(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");
      if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

      const sig = signatures.get(input.signatureId);
      if (!sig || sig.workspace_id !== input.workspaceId) {
        return failed("Signature not found.", "not_found");
      }
      if (sig.status !== "pending") {
        return failed(`Signature in status '${sig.status}' cannot be signed.`, "governance_violation");
      }

      const now = new Date().toISOString();
      const hash = generateSignatureHash({
        entityType: sig.entity_type,
        entityId: sig.entity_id,
        entityVersion: sig.entity_version,
        authorityType: sig.authority_type,
        authorityId: sig.authority_id,
        timestamp: now,
      });

      Object.assign(sig, { status: "signed", signature_hash: hash, signed_at: now, updated_at: now });
      return { ok: true, data: { ...sig } };
    },

    // ── rejectSignature ────────────────────────────────────────────────────
    rejectSignature(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");

      const sig = signatures.get(input.signatureId);
      if (!sig || sig.workspace_id !== input.workspaceId) {
        return failed("Signature not found.", "not_found");
      }
      if (sig.status !== "pending") {
        return failed(`Signature in status '${sig.status}' cannot be rejected.`, "governance_violation");
      }

      const now = new Date().toISOString();
      Object.assign(sig, { status: "rejected", rejected_at: now, updated_at: now,
        comments: input.comments ?? sig.comments });
      return { ok: true, data: { ...sig } };
    },

    // ── withdrawSignature ──────────────────────────────────────────────────
    withdrawSignature(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");

      const sig = signatures.get(input.signatureId);
      if (!sig || sig.workspace_id !== input.workspaceId) {
        return failed("Signature not found.", "not_found");
      }
      if (!["pending", "signed"].includes(sig.status)) {
        return failed(`Signature in status '${sig.status}' cannot be withdrawn.`, "governance_violation");
      }

      const now = new Date().toISOString();
      Object.assign(sig, { status: "withdrawn", withdrawn_at: now, updated_at: now,
        comments: input.comments ?? sig.comments });
      return { ok: true, data: { ...sig } };
    },

    // ── expireSignature ────────────────────────────────────────────────────
    expireSignature(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");

      const sig = signatures.get(input.signatureId);
      if (!sig || sig.workspace_id !== input.workspaceId) {
        return failed("Signature not found.", "not_found");
      }
      if (sig.status !== "pending") {
        return failed(`Only pending signatures can be expired; current: '${sig.status}'.`, "governance_violation");
      }

      const now = new Date().toISOString();
      Object.assign(sig, { status: "expired", expired_at: now, updated_at: now });
      return { ok: true, data: { ...sig } };
    },

    // ── getSignatureStatus ─────────────────────────────────────────────────
    getSignatureStatus(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");

      const result = [...signatures.values()].filter(
        (s) =>
          s.workspace_id === input.workspaceId &&
          s.entity_type === input.entityType &&
          s.entity_id === input.entityId,
      );
      return { ok: true, data: result };
    },

    // ── upsertPolicy ───────────────────────────────────────────────────────
    upsertPolicy(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if ((input.minimumSignatures ?? 0) < 1) return validation("minimumSignatures must be >= 1.");

      const key = `${input.workspaceId}:${input.entityType}`;
      const policy = {
        id: uuid(),
        workspace_id: input.workspaceId,
        entity_type: input.entityType,
        minimum_signatures: input.minimumSignatures,
        required_authorities: input.requiredAuthorities ?? [],
        allow_unanimous_override: input.allowUnanimousOverride ?? false,
        created_at: new Date().toISOString(),
      };
      policies.set(key, policy);
      return { ok: true, data: policy };
    },

    // ── validateRatification ───────────────────────────────────────────────
    validateRatification(input) {
      if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
      if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");

      const sigs = [...signatures.values()].filter(
        (s) =>
          s.workspace_id === input.workspaceId &&
          s.entity_type === input.entityType &&
          s.entity_id === input.entityId,
      );

      const signedSigs = sigs.filter((s) => s.status === "signed");
      const signedCount = signedSigs.length;

      const key = `${input.workspaceId}:${input.entityType}`;
      const policy = policies.get(key) ?? null;
      const minimumRequired = policy?.minimum_signatures ?? 1;
      const requiredAuthorities = policy?.required_authorities ?? [];

      const signedAuthorityTypes = new Set(signedSigs.map((s) => s.authority_type));
      const missingAuthorities = requiredAuthorities.filter((a) => !signedAuthorityTypes.has(a));
      const requiredAuthoritiesMet = missingAuthorities.length === 0;

      const unanimousOverride =
        (policy?.allow_unanimous_override ?? false) &&
        sigs.length > 0 &&
        sigs.every((s) => s.status === "signed");

      const meetsMinimum = unanimousOverride || signedCount >= minimumRequired;
      const valid = meetsMinimum && requiredAuthoritiesMet;

      return {
        ok: true,
        data: {
          valid,
          reason: valid
            ? "Ratification requirements are met."
            : !meetsMinimum
              ? `Insufficient signatures: ${signedCount} of ${minimumRequired} required.`
              : `Missing required authorities: ${missingAuthorities.join(", ")}.`,
          signedCount,
          minimumRequired,
          requiredAuthoritiesMet,
          missingAuthorities,
        },
      };
    },

    // ── calculateLegitimacyStatus ──────────────────────────────────────────
    calculateLegitimacyStatus(input) {
      const sigs = [...signatures.values()].filter(
        (s) =>
          s.workspace_id === input.workspaceId &&
          s.entity_type === input.entityType &&
          s.entity_id === input.entityId,
      );

      if (sigs.length === 0) {
        return {
          ok: true,
          data: {
            entityType: input.entityType,
            entityId: input.entityId,
            status: "unratified",
            signedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            minimumRequired: 1,
            requiredAuthoritiesMet: false,
            missingAuthorities: [],
            signatures: [],
            assessedAt: new Date().toISOString(),
          },
        };
      }

      const key = `${input.workspaceId}:${input.entityType}`;
      const policy = policies.get(key) ?? null;
      const minimumRequired = policy?.minimum_signatures ?? 1;
      const requiredAuthorities = policy?.required_authorities ?? [];

      const signedSigs = sigs.filter((s) => s.status === "signed");
      const rejectedSigs = sigs.filter((s) => s.status === "rejected");
      const pendingSigs = sigs.filter((s) => s.status === "pending");
      const expiredSigs = sigs.filter((s) => s.status === "expired");

      const signedCount = signedSigs.length;
      const signedAuthorityTypes = new Set(signedSigs.map((s) => s.authority_type));
      const missingAuthorities = requiredAuthorities.filter((a) => !signedAuthorityTypes.has(a));
      const requiredAuthoritiesMet = missingAuthorities.length === 0;

      const unanimousOverride =
        (policy?.allow_unanimous_override ?? false) &&
        sigs.length > 0 &&
        sigs.every((s) => s.status === "signed");

      const meetsMinimum = unanimousOverride || signedCount >= minimumRequired;

      let status;
      if (expiredSigs.length === sigs.length) {
        status = "expired";
      } else if (rejectedSigs.length > 0 && signedCount === 0 && pendingSigs.length === 0) {
        status = "rejected";
      } else if (meetsMinimum && requiredAuthoritiesMet) {
        status = "ratified";
      } else if (signedCount > 0 && signedCount < minimumRequired) {
        status = "partially_ratified";
      } else if (signedCount === 0) {
        status = "unratified";
      } else {
        status = "partially_ratified";
      }

      return {
        ok: true,
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          status,
          signedCount,
          rejectedCount: rejectedSigs.length,
          pendingCount: pendingSigs.length,
          minimumRequired,
          requiredAuthoritiesMet,
          missingAuthorities,
          signatures: sigs,
          assessedAt: new Date().toISOString(),
        },
      };
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Signature Lifecycle", () => {
  test("Pending → Signed", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();
    const rId = uuid();

    const req = store.requestSignature({
      workspaceId: wId,
      entityType: "constitution",
      entityId: eId,
      entityVersion: 1,
      authorityType: "sponsor",
      authorityId: aId,
      requestedBy: rId,
    });
    assert.ok(req.ok);
    assert.equal(req.data.status, "pending");

    const signed = store.signEntity({
      workspaceId: wId,
      signatureId: req.data.id,
      actorId: aId,
    });
    assert.ok(signed.ok);
    assert.equal(signed.data.status, "signed");
    assert.ok(signed.data.signature_hash, "signature_hash must be set");
    assert.ok(signed.data.signed_at, "signed_at must be set");
  });

  test("Pending → Rejected", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId,
      entityType: "amendment",
      entityId: eId,
      entityVersion: 2,
      authorityType: "client",
      authorityId: aId,
      requestedBy: uuid(),
    });
    assert.ok(req.ok);

    const rejected = store.rejectSignature({
      workspaceId: wId,
      signatureId: req.data.id,
      actorId: aId,
      comments: "Not acceptable.",
    });
    assert.ok(rejected.ok);
    assert.equal(rejected.data.status, "rejected");
    assert.ok(rejected.data.rejected_at);

    // Rule 3: rejected is terminal — cannot be signed
    const trySign = store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });
    assert.ok(!trySign.ok);
    assert.equal(trySign.failureClass, "governance_violation");
  });

  test("Pending → Expired", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId,
      entityType: "decision",
      entityId: eId,
      entityVersion: 1,
      authorityType: "governance_board",
      authorityId: aId,
      requestedBy: uuid(),
    });
    assert.ok(req.ok);

    const expired = store.expireSignature({ workspaceId: wId, signatureId: req.data.id, actorId: uuid() });
    assert.ok(expired.ok);
    assert.equal(expired.data.status, "expired");
    assert.ok(expired.data.expired_at);
  });

  test("Pending → Withdrawn", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId,
      entityType: "constitution",
      entityId: eId,
      entityVersion: 1,
      authorityType: "project_manager",
      authorityId: aId,
      requestedBy: uuid(),
    });
    assert.ok(req.ok);

    const withdrawn = store.withdrawSignature({ workspaceId: wId, signatureId: req.data.id, actorId: aId });
    assert.ok(withdrawn.ok);
    assert.equal(withdrawn.data.status, "withdrawn");
    assert.ok(withdrawn.data.withdrawn_at);
  });

  test("Signed → Withdrawn (rule 4: does not count)", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId,
      entityType: "amendment",
      entityId: eId,
      entityVersion: 1,
      authorityType: "sponsor",
      authorityId: aId,
      requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const withdrawn = store.withdrawSignature({ workspaceId: wId, signatureId: req.data.id, actorId: aId });
    assert.ok(withdrawn.ok);
    assert.equal(withdrawn.data.status, "withdrawn");

    // Withdrawn does not count for ratification
    const validation = store.validateRatification({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(validation.ok);
    assert.equal(validation.data.valid, false);
    assert.equal(validation.data.signedCount, 0);
  });
});

describe("Rule 2: No duplicate authority on same entity", () => {
  test("Second request for same authority is rejected", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();
    const rId = uuid();
    const input = {
      workspaceId: wId, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: rId,
    };
    const first = store.requestSignature(input);
    assert.ok(first.ok);
    const second = store.requestSignature(input);
    assert.ok(!second.ok);
    assert.equal(second.failureClass, "governance_violation");
  });
});

describe("Ratification Validation", () => {
  test("Meets policy (default: 1 signature)", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "amendment", entityId: eId,
      entityVersion: 1, authorityType: "project_manager", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const v = store.validateRatification({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, true);
    assert.equal(v.data.signedCount, 1);
  });

  test("Does not meet policy (minimum 2 required)", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    store.upsertPolicy({ workspaceId: wId, entityType: "constitution", minimumSignatures: 2, requiredAuthorities: [] });

    const req = store.requestSignature({
      workspaceId: wId, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const v = store.validateRatification({ workspaceId: wId, entityType: "constitution", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, false);
    assert.equal(v.data.signedCount, 1);
    assert.equal(v.data.minimumRequired, 2);
  });

  test("Missing required authority blocks ratification", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    store.upsertPolicy({
      workspaceId: wId,
      entityType: "decision",
      minimumSignatures: 1,
      requiredAuthorities: ["governance_board"],
    });

    const req = store.requestSignature({
      workspaceId: wId, entityType: "decision", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const v = store.validateRatification({ workspaceId: wId, entityType: "decision", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, false);
    assert.ok(v.data.missingAuthorities.includes("governance_board"));
  });

  test("Unanimous override satisfies policy", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    store.upsertPolicy({
      workspaceId: wId,
      entityType: "amendment",
      minimumSignatures: 3,
      requiredAuthorities: [],
      allowUnanimousOverride: true,
    });

    const req = store.requestSignature({
      workspaceId: wId, entityType: "amendment", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    // Only 1 signature but unanimous override = everyone signed
    const v = store.validateRatification({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, true);
  });
});

describe("Legitimacy Engine — All States", () => {
  test("unratified — no signatures", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "constitution", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "unratified");
    assert.equal(l.data.signedCount, 0);
  });

  test("partially_ratified — some signed but below minimum", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    store.upsertPolicy({ workspaceId: wId, entityType: "amendment", minimumSignatures: 3, requiredAuthorities: [] });

    const req = store.requestSignature({
      workspaceId: wId, entityType: "amendment", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "partially_ratified");
  });

  test("ratified — meets minimum and required authorities", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "decision", entityId: eId,
      entityVersion: 1, authorityType: "project_manager", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "decision", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "ratified");
  });

  test("rejected — all signatures rejected", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "client", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.rejectSignature({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "constitution", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "rejected");
  });

  test("expired — all signatures expired", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "amendment", entityId: eId,
      entityVersion: 1, authorityType: "steering_committee", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.expireSignature({ workspaceId: wId, signatureId: req.data.id, actorId: uuid() });

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "expired");
  });
});

describe("Hash Generation", () => {
  test("Consistent — same inputs produce same hash", () => {
    const input = {
      entityType: "constitution",
      entityId: uuid(),
      entityVersion: 1,
      authorityType: "sponsor",
      authorityId: uuid(),
      timestamp: "2026-06-26T00:00:00.000Z",
    };
    const h1 = generateSignatureHash(input);
    const h2 = generateSignatureHash(input);
    assert.equal(h1, h2);
    assert.ok(h1.startsWith("sha-sig-"));
  });

  test("No duplication — different authority_id produces different hash", () => {
    const base = {
      entityType: "amendment",
      entityId: uuid(),
      entityVersion: 1,
      authorityType: "client",
      timestamp: "2026-06-26T00:00:00.000Z",
    };
    const h1 = generateSignatureHash({ ...base, authorityId: uuid() });
    const h2 = generateSignatureHash({ ...base, authorityId: uuid() });
    assert.notEqual(h1, h2);
  });

  test("No duplication — different timestamp produces different hash", () => {
    const base = {
      entityType: "decision",
      entityId: uuid(),
      entityVersion: 1,
      authorityType: "sponsor",
      authorityId: uuid(),
    };
    const h1 = generateSignatureHash({ ...base, timestamp: "2026-06-26T00:00:00.000Z" });
    const h2 = generateSignatureHash({ ...base, timestamp: "2026-06-26T00:00:01.000Z" });
    assert.notEqual(h1, h2);
  });

  test("No duplication — different entity_version produces different hash", () => {
    const base = {
      entityType: "constitution",
      entityId: uuid(),
      authorityType: "sponsor",
      authorityId: uuid(),
      timestamp: "2026-06-26T00:00:00.000Z",
    };
    const h1 = generateSignatureHash({ ...base, entityVersion: 1 });
    const h2 = generateSignatureHash({ ...base, entityVersion: 2 });
    assert.notEqual(h1, h2);
  });
});

describe("Amendment Integration — Ratification Gate", () => {
  test("validateRatification returns false when no signatures exist", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const aId = uuid();

    // No signatures for this amendment
    const v = store.validateRatification({ workspaceId: wId, entityType: "amendment", entityId: aId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, false);
    assert.equal(v.data.signedCount, 0);
  });

  test("validateRatification returns true when amendment has sufficient signatures", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const authorId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "amendment", entityId: eId,
      entityVersion: 1, authorityType: "project_manager", authorityId: authorId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: authorId });

    const v = store.validateRatification({ workspaceId: wId, entityType: "amendment", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, true);
  });
});

describe("Constitution Integration", () => {
  test("Constitution without signatures is unratified", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "constitution", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "unratified");
  });

  test("Constitution with sufficient signatures is ratified", () => {
    const store = createRatificationStore();
    const wId = uuid();
    const eId = uuid();
    const aId = uuid();

    const req = store.requestSignature({
      workspaceId: wId, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wId, signatureId: req.data.id, actorId: aId });

    const l = store.calculateLegitimacyStatus({ workspaceId: wId, entityType: "constitution", entityId: eId });
    assert.ok(l.ok);
    assert.equal(l.data.status, "ratified");
  });
});

describe("Workspace Isolation", () => {
  test("Signature from workspace A is not visible in workspace B", () => {
    const store = createRatificationStore();
    const wA = uuid();
    const wB = uuid();
    const eId = uuid();
    const aId = uuid();

    store.requestSignature({
      workspaceId: wA, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });

    const statusB = store.getSignatureStatus({ workspaceId: wB, entityType: "constitution", entityId: eId });
    assert.ok(statusB.ok);
    assert.equal(statusB.data.length, 0);
  });

  test("Policy from workspace A is not applied in workspace B", () => {
    const store = createRatificationStore();
    const wA = uuid();
    const wB = uuid();
    const eId = uuid();
    const aId = uuid();

    store.upsertPolicy({ workspaceId: wA, entityType: "constitution", minimumSignatures: 10, requiredAuthorities: [] });

    // Workspace B has a signed signature — default policy (min 1) should apply
    const req = store.requestSignature({
      workspaceId: wB, entityType: "constitution", entityId: eId,
      entityVersion: 1, authorityType: "sponsor", authorityId: aId, requestedBy: uuid(),
    });
    assert.ok(req.ok);
    store.signEntity({ workspaceId: wB, signatureId: req.data.id, actorId: aId });

    const v = store.validateRatification({ workspaceId: wB, entityType: "constitution", entityId: eId });
    assert.ok(v.ok);
    assert.equal(v.data.valid, true); // workspace B uses default policy, not wA's policy of 10
  });
});

describe("Validation — UUID guards", () => {
  test("Invalid workspaceId fails validation", () => {
    const store = createRatificationStore();
    const r = store.requestSignature({
      workspaceId: "not-a-uuid", entityType: "constitution", entityId: uuid(),
      entityVersion: 1, authorityType: "sponsor", authorityId: uuid(), requestedBy: uuid(),
    });
    assert.ok(!r.ok);
    assert.equal(r.failureClass, "validation_failed");
  });

  test("Invalid entityId fails validation", () => {
    const store = createRatificationStore();
    const r = store.requestSignature({
      workspaceId: uuid(), entityType: "amendment", entityId: "bad",
      entityVersion: 1, authorityType: "client", authorityId: uuid(), requestedBy: uuid(),
    });
    assert.ok(!r.ok);
    assert.equal(r.failureClass, "validation_failed");
  });

  test("Invalid entityType fails validation", () => {
    const store = createRatificationStore();
    const r = store.requestSignature({
      workspaceId: uuid(), entityType: "unknown_type", entityId: uuid(),
      entityVersion: 1, authorityType: "sponsor", authorityId: uuid(), requestedBy: uuid(),
    });
    assert.ok(!r.ok);
    assert.equal(r.failureClass, "validation_failed");
  });

  test("minimumSignatures < 1 fails policy upsert", () => {
    const store = createRatificationStore();
    const r = store.upsertPolicy({
      workspaceId: uuid(), entityType: "constitution", minimumSignatures: 0, requiredAuthorities: [],
    });
    assert.ok(!r.ok);
    assert.equal(r.failureClass, "validation_failed");
  });
});
