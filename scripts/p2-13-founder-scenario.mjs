#!/usr/bin/env node
/**
 * P2-13 — Founder Invite seed and isolated environment harness.
 *
 *   node scripts/p2-13-founder-scenario.mjs preflight
 *   node scripts/p2-13-founder-scenario.mjs seed
 *   node scripts/p2-13-founder-scenario.mjs verify
 *   node scripts/p2-13-founder-scenario.mjs reset
 *   node scripts/p2-13-founder-scenario.mjs reseed
 *
 * Reads configuration from the process environment only (same convention as
 * `scripts/check-operational-flow-db.mjs`); it never reads a dotenv file and
 * never writes one.
 *
 * ── What this harness does and does not do ────────────────────────────────
 *
 * Service role is used ONLY to provision fixture prerequisites that have no
 * authenticated path: auth users, workspaces, projects, memberships and the
 * Founder Invite access records. It is never used as user authorization.
 *
 * The canonical spine is seeded through the real, verified contracts, as the
 * real authenticated fixture actors:
 *
 *   capture_operational_input     -> Source -> Raw Input -> Normalized Event
 *   derive_operational_evidence   -> Evidence (from the Normalized Event only)
 *   materialize_operational_chain -> Signal -> Risk/Issue -> Governance -> Recommendation
 *
 * Evidence is never inserted directly, no digest is ever fabricated, and no
 * downstream canonical state (Decision, Material Action, Task, Execution,
 * Outcome, Observation) is created — those are the transitions P2-14's
 * browser story must itself perform.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import {
  CANONICAL_SPINE_OWNERSHIP,
  EXPECTED_CHAIN_COUNTS,
  FIXTURE_EVIDENCE_STATE,
  FIXTURE_EXPIRY_OWNER,
  FIXTURE_LABEL,
  P2_13_SCENARIO_ID,
  P2_13_SCENARIO_KEY,
  P2_13_TENANTS,
  SCENARIO_ACTOR_EMAILS,
  SCENARIO_PROJECT_IDS,
  SCENARIO_WORKSPACE_IDS,
  buildP2_14HandoffManifest,
} from "./p2-13/founder-scenario-manifest.mjs";
import {
  GUARD_MODES,
  LOCAL_ISOLATED,
  assertIsolatedTarget,
  classifyP2_13Target,
} from "./p2-13/isolation-guard.mjs";
import {
  RESIDUE_TABLES,
  buildResetSql,
  parseResetCounts,
  resolveSqlRunner,
} from "./p2-13/fixture-cleanup.mjs";
import {
  RUN_STATUS,
  createSecretRedactor,
  createStageTracker,
  emitReport,
  safeFailureReason,
} from "./p2-13/observability.mjs";

const COMMANDS = ["preflight", "seed", "verify", "reset", "reseed"];
const command = (process.argv[2] ?? "").trim();

const SEED_STAGES = [
  "isolation_guard",
  "fixture_identity",
  "tenant_containers",
  "tenant_membership",
  "founder_invite_access",
  "actor_authentication",
  "canonical_intake",
  "canonical_evidence",
  "canonical_finding_and_recommendation",
  "scenario_verification",
];

const env = process.env;
const redact = createSecretRedactor([
  env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY,
  env.OPERATIONAL_FLOW_TEST_ANON_KEY,
  env.SUPABASE_SERVICE_ROLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  env.OPERATIONAL_FLOW_TEST_DATABASE_URL,
  env.P2_13_FIXTURE_ACTOR_PASSWORD,
]);

function fail(message, extra = {}) {
  emitReport({ ok: false, command, scenarioId: P2_13_SCENARIO_ID, error: message, ...extra }, redact);
  process.exit(1);
}

if (!COMMANDS.includes(command)) {
  emitReport(
    {
      ok: false,
      error: `Unknown command. Usage: node scripts/p2-13-founder-scenario.mjs <${COMMANDS.join("|")}>`,
    },
    redact,
  );
  process.exit(2);
}

const guardMode =
  command === "reset" || command === "reseed"
    ? GUARD_MODES.DESTRUCTIVE
    : command === "verify" || command === "preflight"
      ? GUARD_MODES.READ
      : GUARD_MODES.SEED;

const verdict = classifyP2_13Target(env, { mode: guardMode });
if (!verdict.ok) {
  emitReport(
    {
      ok: false,
      command,
      scenarioId: P2_13_SCENARIO_ID,
      status: RUN_STATUS.REFUSED,
      databaseTargetClassification: verdict.classification,
      refusals: verdict.refusals,
      signals: verdict.signals.filter((entry) => !entry.ok),
      message: "P2-13 refused to run: the target could not be proven local and isolated.",
    },
    redact,
  );
  // Exit 2 mirrors the repository convention for "infrastructure/opt-in absent".
  process.exit(2);
}

const supabaseUrl = env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const actorPassword = env.P2_13_FIXTURE_ACTOR_PASSWORD;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const anonClient = () => createClient(supabaseUrl, anonKey, clientOptions);

/** Any Supabase error is reduced to a stable, non-leaking reason. */
function unwrap(result, operation) {
  if (result.error) {
    const error = new Error(`${operation}:${safeFailureReason(result.error, redact)}`);
    error.operation = operation;
    throw error;
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────
// Fixture prerequisites (service role — never user authorization)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Look up a fixture identity by its deterministic email, using the admin API.
 *
 * Identity resolution must not depend on the fixture password: a rotated
 * `P2_13_FIXTURE_ACTOR_PASSWORD` would otherwise make an existing scenario
 * both unseedable and unresettable, and would leave orphan fixture accounts
 * behind that reset believed it had removed.
 *
 * Only the deterministic scenario emails are ever matched, so this can never
 * reach an account the scenario does not own.
 */
async function findFixtureUserByEmail(email) {
  const owned = new Set(SCENARIO_ACTOR_EMAILS.map((entry) => entry.toLowerCase()));
  if (!owned.has(email.toLowerCase())) throw new Error(`p2_13_unowned_actor_email`);

  // GoTrue paginates; walk until the page is short rather than assuming the
  // fixture accounts land on page one of a shared local stack.
  for (let page = 1; page <= 50; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`fixture_actor_lookup:${safeFailureReason(listed.error, redact)}`);
    const users = listed.data?.users ?? [];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < 200) return null;
  }
  return null;
}

/**
 * Resolve a deterministic fixture actor.
 *
 * Sign-in comes first so an existing fixture user is reused rather than
 * duplicated, and so the returned id always belongs to an account whose
 * credentials actually work — a created-but-unusable user would otherwise be
 * reported as a successful stage.
 *
 * `create` is false for `verify`, which must be strictly read-only: a verify
 * that provisioned a missing actor would repair the very state it is meant
 * to report on, and would resurrect fixture identities after a reset.
 */
async function ensureFixtureActor(actor, { create = true } = {}) {
  const client = anonClient();
  let signIn = await client.auth.signInWithPassword({ email: actor.email, password: actorPassword });

  if (signIn.error && !create) return null;

  if (signIn.error) {
    // The account may already exist from an earlier run whose fixture password
    // differed, which would otherwise strand the scenario: it could be neither
    // seeded nor verified.
    //
    // Realigning it is deliberately NOT automatic. If any password that passed
    // the length check silently became the fixture password, a typo would
    // rewrite working credentials, and — worse — a seed that genuinely cannot
    // authenticate would repair itself into looking successful, destroying the
    // PARTIAL_SEED evidence this harness has to produce. So the recovery is a
    // separate, explicit operator decision.
    const existing = (await findFixtureUserByEmail(actor.email)) ?? null;

    if (existing && env.P2_13_REALIGN_FIXTURE_ACTORS !== "true") {
      throw new Error(
        `fixture_actor_signin:the deterministic fixture identity exists but its password does not match P2_13_FIXTURE_ACTOR_PASSWORD. Re-run with P2_13_REALIGN_FIXTURE_ACTORS=true to realign it, or reset the scenario.`,
      );
    }

    if (existing) {
      const realigned = await admin.auth.admin.updateUserById(existing.id, {
        password: actorPassword,
        email_confirm: true,
        user_metadata: { fixture: true, fixtureLabel: FIXTURE_LABEL, scenarioKey: P2_13_SCENARIO_KEY },
      });
      if (realigned.error) {
        throw new Error(`fixture_actor_realign:${safeFailureReason(realigned.error, redact)}`);
      }
    } else {
      const created = await admin.auth.admin.createUser({
        email: actor.email,
        password: actorPassword,
        email_confirm: true,
        user_metadata: { fixture: true, fixtureLabel: FIXTURE_LABEL, scenarioKey: P2_13_SCENARIO_KEY },
      });
      if (created.error && !/already|registered|exists/i.test(created.error.message ?? "")) {
        throw new Error(`fixture_actor_create:${safeFailureReason(created.error, redact)}`);
      }
    }

    signIn = await client.auth.signInWithPassword({ email: actor.email, password: actorPassword });
    if (signIn.error) {
      throw new Error(`fixture_actor_signin:${safeFailureReason(signIn.error, redact)}`);
    }
  }

  return { id: signIn.data.user.id, email: actor.email, role: actor.role, client, reference: actor.reference };
}

async function ensureTenantContainers(tenant, ownerId) {
  unwrap(
    await admin.from("workspaces").upsert(
      { id: tenant.workspaceId, name: tenant.workspaceName, created_by_user_id: ownerId },
      { onConflict: "id" },
    ),
    "ensure_workspace",
  );

  unwrap(
    await admin.from("projects").upsert(
      {
        id: tenant.projectId,
        workspace_id: tenant.workspaceId,
        user_id: ownerId,
        name: tenant.projectName,
        description: `${FIXTURE_LABEL} P2-13 Founder Invite scenario (${tenant.semanticRole}).`,
        onboarding_payload: {
          demo: true,
          fixtureLabel: FIXTURE_LABEL,
          demoScenarioKey: P2_13_SCENARIO_KEY,
          p2_13ScenarioId: P2_13_SCENARIO_ID,
          fixtureExpiresWhen: [FIXTURE_EXPIRY_OWNER],
        },
      },
      { onConflict: "id" },
    ),
    "ensure_project",
  );
}

async function ensureMemberships(tenant, actors) {
  unwrap(
    await admin.from("workspace_memberships").upsert(
      actors.map((actor) => ({
        workspace_id: tenant.workspaceId,
        user_id: actor.id,
        role: actor.role,
      })),
      { onConflict: "workspace_id,user_id" },
    ),
    "ensure_membership",
  );
}

/**
 * Founder Invite access preconditions.
 *
 * The invite is written already-accepted and its token hash is derived from
 * the public deterministic invite id — no invite token is ever minted, so
 * there is nothing to leak and no acceptance path to replay. The trial
 * license is what the protected layout actually gates on.
 */
async function ensureFounderAccess(tenant, ownerId) {
  const { inviteId, trialLicenseId, workspaceActivationId, inviteEmail, inviteNote } = tenant.founderInvite;
  const now = Date.now();
  const acceptedAt = new Date(now).toISOString();
  const trialEndAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();

  unwrap(
    await admin.from("early_access_invites").upsert(
      {
        id: inviteId,
        invite_email: inviteEmail,
        // A hash of a public, deterministic value: no usable token exists.
        invite_token_hash: createHash("sha256").update(`p2-13-fixture-consumed-invite:${inviteId}`).digest("hex"),
        invite_note: inviteNote,
        inviter_user_id: ownerId,
        expires_at: trialEndAt,
        accepted_at: acceptedAt,
        requires_approval: false,
        workspace_id: tenant.workspaceId,
      },
      { onConflict: "id" },
    ),
    "ensure_early_access_invite",
  );

  unwrap(
    await admin.from("trial_licenses").upsert(
      {
        id: trialLicenseId,
        invite_id: inviteId,
        workspace_id: tenant.workspaceId,
        trial_start_at: acceptedAt,
        trial_end_at: trialEndAt,
        trial_status: "active",
      },
      { onConflict: "id" },
    ),
    "ensure_trial_license",
  );

  unwrap(
    await admin.from("workspace_activations").upsert(
      {
        id: workspaceActivationId,
        invite_id: inviteId,
        trial_license_id: trialLicenseId,
        workspace_id: tenant.workspaceId,
        activated_by_user_id: ownerId,
        operational_memory_namespace: `workspace:${tenant.workspaceId}`,
        runtime_authority_linkage: { authority: "workspace_owner", fixtureLabel: FIXTURE_LABEL },
        governance_profile: { level: "early_access", profile: "p2-13-fixture" },
        explainability_defaults: { style: "high_trust", visibleRationales: true },
        machine_governance_defaults: { escalationMode: "balanced" },
        starter_cognition_state: { fixtureLabel: FIXTURE_LABEL, scenarioKey: P2_13_SCENARIO_KEY },
      },
      { onConflict: "id" },
    ),
    "ensure_workspace_activation",
  );

  return { inviteId, trialLicenseId, workspaceActivationId };
}

// ─────────────────────────────────────────────────────────────────────────
// Canonical spine (authenticated fixture actor — real verified contracts)
// ─────────────────────────────────────────────────────────────────────────

async function seedCanonicalIntake(tenant, ownerActor) {
  const { intake } = tenant;
  const result = unwrap(
    await ownerActor.client.rpc("capture_operational_input", {
      p_workspace_id: tenant.workspaceId,
      p_project_id: tenant.projectId,
      p_source_key: intake.sourceKey,
      p_idempotency_key: intake.rawIdempotencyKey,
      p_title: intake.title,
      p_content: intake.content,
      p_occurred_at: intake.occurredAt,
      p_correlation_id: intake.correlationId,
      p_causation_id: null,
      p_external_id: intake.externalId,
    }),
    "capture_operational_input",
  );
  return result;
}

async function seedCanonicalEvidence(tenant, ownerActor, normalizedEventId) {
  const { intake } = tenant;
  return unwrap(
    await ownerActor.client.rpc("derive_operational_evidence", {
      p_workspace_id: tenant.workspaceId,
      p_project_id: tenant.projectId,
      p_normalized_event_id: normalizedEventId,
      p_idempotency_key: intake.evidenceIdempotencyKey,
      p_assertion_type: intake.assertionType,
      p_classification: intake.classification,
      p_confidence_score: intake.confidenceScore,
      p_missing_data_state: intake.missingDataState,
      p_evaluated_at: intake.evaluatedAt,
      p_stale_at: intake.staleAt,
    }),
    "derive_operational_evidence",
  );
}

/**
 * Read the current Finding/Recommendation fan-out for one Evidence item.
 *
 * Used to decide whether the chain still needs materializing, and reported by
 * verify, so a replay that quietly appended a second detector run is visible
 * rather than invisible.
 */
async function readChainState(reader, evidenceItemId) {
  const signals = unwrap(
    await reader.from("operational_signals").select("id").eq("evidence_item_id", evidenceItemId),
    "chain_state_signals",
  ).map((row) => row.id);

  const risks = signals.length
    ? unwrap(
        await reader.from("risk_issue_records").select("id").in("signal_id", signals),
        "chain_state_risks",
      ).map((row) => row.id)
    : [];

  const governanceEvents = risks.length
    ? await exactCount(reader, "governance_events", (q) =>
        q.eq("related_entity_type", "risk_issue_record").in("related_entity_id", risks),
      )
    : 0;

  const recommendations = signals.length
    ? await exactCount(reader, "recommended_actions", (q) =>
        q.in("source_signal_id", signals).not("governance_event_id", "is", null),
      )
    : 0;

  return {
    signalIds: signals,
    signals: signals.length,
    riskIssueRecords: risks.length,
    governanceEvents,
    recommendations,
  };
}

/** Every branch of the fan-out present at exactly the contract-derived count. */
function chainIsComplete(state) {
  return (
    state.signals === EXPECTED_CHAIN_COUNTS.signals &&
    state.riskIssueRecords === EXPECTED_CHAIN_COUNTS.riskIssueRecords &&
    state.governanceEvents === EXPECTED_CHAIN_COUNTS.governanceEvents &&
    state.recommendations === EXPECTED_CHAIN_COUNTS.recommendations
  );
}

/**
 * Materialize the Finding/Recommendation fan-out — but only when it is not
 * already intact.
 *
 * `materialize_operational_chain` is idempotent for every canonical node it
 * creates (`on conflict do nothing` on signal, risk/issue, governance event
 * and recommendation), but it mints a fresh `agent_runs` + `agent_outputs`
 * detector-run record on every invocation. Invoking it again for an unchanged
 * Evidence item would therefore append a duplicate detector run and break the
 * "a second seed creates nothing new" property this harness must prove.
 *
 * The verified P2-06 contract is not the place to fix that: appending a run
 * record per real detector execution is correct, and P2-13 must not weaken a
 * verified contract to make its own replay tidy. The decision belongs here,
 * in the harness: replay only when a branch is actually missing.
 *
 * Completeness is tested across the whole fan-out, not just signals, so a
 * partially damaged chain (a deleted Recommendation, say) still replays and is
 * repaired — the `on conflict do nothing` inserts leave surviving nodes and
 * their ids untouched.
 */
async function seedCanonicalFinding(ownerActor, evidenceItemId) {
  const before = await readChainState(ownerActor.client, evidenceItemId);
  if (chainIsComplete(before)) {
    return { disposition: "already_materialized", chainBranches: 0, state: before };
  }

  const result = unwrap(
    await ownerActor.client.rpc("materialize_operational_chain", { p_evidence_item_id: evidenceItemId }),
    "materialize_operational_chain",
  );

  return {
    disposition: before.signals === 0 ? "created" : "repaired",
    chainBranches: result.chain?.length ?? 0,
    state: await readChainState(ownerActor.client, evidenceItemId),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Verify (read-only, exact, never bounded)
// ─────────────────────────────────────────────────────────────────────────

const DIGEST = /^sha256:[a-f0-9]{64}$/;

async function exactCount(client, table, apply) {
  // `select("*")`, not `select("id")`: several scoped tables have a composite
  // primary key and no `id` column, and a bad column silently becomes an error
  // that a count check must not mistake for "zero rows".
  const query = apply(client.from(table).select("*", { count: "exact", head: true }));
  const result = await query;
  if (result.error) throw new Error(`count_${table}:${safeFailureReason(result.error, redact)}`);
  return result.count ?? 0;
}

/**
 * Verify one tenant.
 *
 * Every probe is an exact, fully-qualified lookup — never a bounded "newest N"
 * window, which cannot distinguish "absent" from "not in this page" (P2-12
 * review lesson A).
 *
 * Canonical rows are read as the authenticated tenant owner, so a passing
 * verify is simultaneously a same-tenant positive authorization proof. When
 * the fixture identity is absent (a reset scenario), it falls back to the
 * service-role reader so verify can still answer "absent" honestly — and
 * reports which reader it used rather than implying an authorization proof it
 * did not perform.
 */
async function verifyTenant(tenant, actorsById) {
  const owner = actorsById.get(`${tenant.key}:owner`) ?? null;
  const problems = [];
  const nodes = {};

  const reader = owner?.client ?? admin;
  const readAs = owner ? "authenticated_tenant_owner" : "service_role_fallback";
  if (!owner) problems.push("owner_actor:unauthenticated");

  const requireRow = (label, row, checks = []) => {
    if (!row) {
      problems.push(`${label}:absent`);
      return null;
    }
    for (const [name, ok] of checks) if (!ok) problems.push(`${label}:${name}`);
    return row;
  };

  const workspace = unwrap(
    await admin.from("workspaces").select("id,name").eq("id", tenant.workspaceId).maybeSingle(),
    "verify_workspace",
  );
  nodes.workspace = requireRow("workspace", workspace, [["name_mismatch", workspace?.name === tenant.workspaceName]])?.id ?? null;

  const project = unwrap(
    await admin
      .from("projects")
      .select("id,workspace_id,onboarding_payload")
      .eq("id", tenant.projectId)
      .maybeSingle(),
    "verify_project",
  );
  nodes.project =
    requireRow("project", project, [
      ["workspace_mismatch", project?.workspace_id === tenant.workspaceId],
      ["fixture_label_missing", project?.onboarding_payload?.fixtureLabel === FIXTURE_LABEL],
      ["scenario_key_missing", project?.onboarding_payload?.demoScenarioKey === P2_13_SCENARIO_KEY],
    ])?.id ?? null;

  const membershipCount = await exactCount(admin, "workspace_memberships", (q) =>
    q.eq("workspace_id", tenant.workspaceId),
  );
  if (membershipCount !== tenant.actors.length) {
    problems.push(`memberships:expected_${tenant.actors.length}_got_${membershipCount}`);
  }
  nodes.memberships = membershipCount;

  const invite = unwrap(
    await admin
      .from("early_access_invites")
      .select("id,accepted_at,revoked_at,workspace_id")
      .eq("id", tenant.founderInvite.inviteId)
      .maybeSingle(),
    "verify_invite",
  );
  nodes.founderInvite =
    requireRow("founder_invite", invite, [
      ["not_accepted", Boolean(invite?.accepted_at)],
      ["revoked", !invite?.revoked_at],
      ["workspace_mismatch", invite?.workspace_id === tenant.workspaceId],
    ])?.id ?? null;

  const trial = unwrap(
    await admin
      .from("trial_licenses")
      .select("id,trial_status,trial_end_at,workspace_id")
      .eq("id", tenant.founderInvite.trialLicenseId)
      .maybeSingle(),
    "verify_trial",
  );
  const trialRemainingDays = trial?.trial_end_at
    ? (new Date(trial.trial_end_at).getTime() - Date.now()) / 86_400_000
    : -1;
  nodes.trialLicense =
    requireRow("trial_license", trial, [
      ["not_active", trial?.trial_status === "active"],
      ["workspace_mismatch", trial?.workspace_id === tenant.workspaceId],
      // A wide margin, so ordinary clock skew can never decide this.
      ["window_too_short", trialRemainingDays > 30],
    ])?.id ?? null;

  const activation = unwrap(
    await admin
      .from("workspace_activations")
      .select("id,workspace_id")
      .eq("id", tenant.founderInvite.workspaceActivationId)
      .maybeSingle(),
    "verify_activation",
  );
  nodes.workspaceActivation =
    requireRow("workspace_activation", activation, [
      ["workspace_mismatch", activation?.workspace_id === tenant.workspaceId],
    ])?.id ?? null;

  // ── canonical spine, read as the authenticated owner ────────────────────
  const source = unwrap(
    await reader
      .from("operational_sources")
      .select("id,source_key,source_kind,status,is_fixture,fixture_label,fixture_expires_when")
      .eq("workspace_id", tenant.workspaceId)
      .eq("project_id", tenant.projectId)
      .eq("source_key", tenant.intake.sourceKey)
      .maybeSingle(),
    "verify_source",
  );
  nodes.source =
    requireRow("source", source, [
      ["not_fixture", source?.is_fixture === true],
      ["fixture_label_mismatch", source?.fixture_label === FIXTURE_LABEL],
      ["fixture_expiry_missing", (source?.fixture_expires_when ?? []).length > 0],
      ["status_not_active", source?.status === "active"],
    ])?.id ?? null;

  let rawInput = null;
  if (nodes.source) {
    rawInput = unwrap(
      await reader
        .from("operational_raw_inputs")
        .select("id,source_id,content_digest,status,correlation_id,occurred_at")
        .eq("source_id", nodes.source)
        .eq("idempotency_key", tenant.intake.rawIdempotencyKey)
        .maybeSingle(),
      "verify_raw_input",
    );
  }
  nodes.rawInput =
    requireRow("raw_input", rawInput, [
      ["digest_shape", DIGEST.test(String(rawInput?.content_digest))],
      ["placeholder_digest", !/^sha256:0+$/.test(String(rawInput?.content_digest))],
      ["status_not_received", rawInput?.status === "received"],
      ["correlation_mismatch", rawInput?.correlation_id === tenant.intake.correlationId],
    ])?.id ?? null;

  let normalizedEvent = null;
  if (nodes.rawInput) {
    normalizedEvent = unwrap(
      await reader
        .from("operational_normalized_events")
        .select("id,raw_input_id,source_id,event_type,schema_version,event_digest,status,provenance,correlation_id,causation_id")
        .eq("raw_input_id", nodes.rawInput)
        .eq("event_type", "manual_input.submitted")
        .eq("schema_version", 1)
        .maybeSingle(),
      "verify_normalized_event",
    );
  }
  nodes.normalizedEvent =
    requireRow("normalized_event", normalizedEvent, [
      ["raw_input_link", normalizedEvent?.raw_input_id === nodes.rawInput],
      ["source_link", normalizedEvent?.source_id === nodes.source],
      ["digest_shape", DIGEST.test(String(normalizedEvent?.event_digest))],
      ["raw_digest_provenance", normalizedEvent?.provenance?.rawDigest === rawInput?.content_digest],
      ["status_not_accepted", normalizedEvent?.status === "accepted"],
      // Correlation continuity: one correlation id must run unbroken from Raw
      // Input through Normalized Event to Evidence, so P2-14 can join the whole
      // lineage on it. Causation is separate and must be the real parent node,
      // never a value the harness invented.
      ["correlation_mismatch", normalizedEvent?.correlation_id === tenant.intake.correlationId],
      ["causation_is_raw_input", normalizedEvent?.causation_id === nodes.rawInput],
    ])?.id ?? null;

  const evidence = unwrap(
    await reader
      .from("evidence_items")
      .select("id,normalized_event_id,raw_input_id,source_id,derivation_digest,fixture_state,freshness_state,lifecycle,assertion_type,classification,correlation_id,rejection_reason,degraded_reason")
      .eq("workspace_id", tenant.workspaceId)
      .eq("project_id", tenant.projectId)
      .eq("derivation_idempotency_key", tenant.intake.evidenceIdempotencyKey)
      .maybeSingle(),
    "verify_evidence",
  );
  nodes.evidence =
    requireRow("evidence", evidence, [
      ["normalized_event_link", Boolean(evidence?.normalized_event_id) && evidence?.normalized_event_id === nodes.normalizedEvent],
      ["raw_input_link", evidence?.raw_input_id === nodes.rawInput],
      ["source_link", evidence?.source_id === nodes.source],
      ["digest_shape", DIGEST.test(String(evidence?.derivation_digest))],
      ["placeholder_digest", !/^sha256:0+$/.test(String(evidence?.derivation_digest))],
      ["fixture_state_not_demo", evidence?.fixture_state === FIXTURE_EVIDENCE_STATE],
      ["freshness_not_current", evidence?.freshness_state === "CURRENT"],
      ["lifecycle_not_recorded", evidence?.lifecycle === "RECORDED"],
      ["assertion_type_mismatch", evidence?.assertion_type === tenant.intake.assertionType],
      ["correlation_mismatch", evidence?.correlation_id === tenant.intake.correlationId],
    ])?.id ?? null;

  const signalRows = nodes.evidence
    ? unwrap(
        await reader
          .from("operational_signals")
          .select("id,signal_type")
          .eq("evidence_item_id", nodes.evidence)
          .order("signal_type", { ascending: true }),
        "verify_signals",
      )
    : [];
  if (signalRows.length !== EXPECTED_CHAIN_COUNTS.signals) {
    problems.push(`finding_signals:expected_${EXPECTED_CHAIN_COUNTS.signals}_got_${signalRows.length}`);
  }
  nodes.findingSignals = signalRows.map((row) => row.id);

  const signalIds = nodes.findingSignals;
  const riskCount = signalIds.length
    ? await exactCount(reader, "risk_issue_records", (q) => q.in("signal_id", signalIds))
    : 0;
  if (riskCount !== EXPECTED_CHAIN_COUNTS.riskIssueRecords) {
    problems.push(`finding_risk_issues:expected_${EXPECTED_CHAIN_COUNTS.riskIssueRecords}_got_${riskCount}`);
  }
  nodes.findingRiskIssues = riskCount;

  const riskIds = signalIds.length
    ? unwrap(
        await reader.from("risk_issue_records").select("id").in("signal_id", signalIds),
        "verify_risk_ids",
      ).map((row) => row.id)
    : [];
  const governanceCount = riskIds.length
    ? await exactCount(reader, "governance_events", (q) =>
        q.eq("related_entity_type", "risk_issue_record").in("related_entity_id", riskIds),
      )
    : 0;
  if (governanceCount !== EXPECTED_CHAIN_COUNTS.governanceEvents) {
    problems.push(`finding_governance:expected_${EXPECTED_CHAIN_COUNTS.governanceEvents}_got_${governanceCount}`);
  }
  nodes.findingGovernanceEvents = governanceCount;

  const recommendationRows = signalIds.length
    ? unwrap(
        await reader
          .from("recommended_actions")
          .select("id,status,governance_event_id,source_signal_id")
          .in("source_signal_id", signalIds)
          .not("governance_event_id", "is", null),
        "verify_recommendations",
      )
    : [];
  if (recommendationRows.length !== EXPECTED_CHAIN_COUNTS.recommendations) {
    problems.push(
      `recommendations:expected_${EXPECTED_CHAIN_COUNTS.recommendations}_got_${recommendationRows.length}`,
    );
  }
  const undecided = recommendationRows.filter((row) => row.status === "proposed").length;
  if (recommendationRows.length && undecided !== recommendationRows.length) {
    // P2-13 must hand P2-14 an undecided Recommendation: a Recommendation is
    // not a Decision, and pre-deciding it would delete the transition P2-14
    // exists to prove.
    problems.push(`recommendations:not_all_proposed_${undecided}_of_${recommendationRows.length}`);
  }
  nodes.recommendations = recommendationRows.map((row) => row.id).sort();

  // Detector-run accounting. `materialize_operational_chain` appends an
  // `agent_runs` record per invocation, so counting them is what makes a
  // duplicated replay observable at all.
  //
  // Reported, deliberately not asserted equal to 1: a genuine repair replay
  // (after a canonical node was lost) is a real second detector execution and
  // must not be reported as a damaged scenario. What the acceptance gate
  // asserts instead is that this count does not move between two seeds of an
  // unchanged scenario — that is the idempotency claim, and it is proven by
  // comparing this number across runs rather than by pinning it here.
  nodes.detectorRuns = await exactCount(admin, "agent_runs", (q) =>
    q
      .eq("workspace_id", tenant.workspaceId)
      .eq("agent_key", "system/deterministic:governance_signal_detector_v1"),
  );

  // ── downstream states P2-14 owns: counted, never created ────────────────
  const downstream = {
    decisions: await exactCount(admin, "operational_decision_records", (q) => q.eq("project_id", tenant.projectId)),
    materialActions: await exactCount(admin, "material_action_proposals", (q) => q.eq("project_id", tenant.projectId)),
    tasks: await exactCount(admin, "execution_tasks", (q) => q.eq("project_id", tenant.projectId)),
    internalExecutions: await exactCount(admin, "internal_task_executions", (q) => q.eq("project_id", tenant.projectId)),
    outcomes: await exactCount(admin, "canonical_task_outcomes", (q) => q.eq("project_id", tenant.projectId)),
    observations: await exactCount(admin, "canonical_outcome_observations", (q) => q.eq("project_id", tenant.projectId)),
  };

  const presentNodes = [
    nodes.workspace,
    nodes.project,
    nodes.founderInvite,
    nodes.source,
    nodes.rawInput,
    nodes.normalizedEvent,
    nodes.evidence,
  ].filter(Boolean).length;

  return {
    tenant: tenant.key,
    semanticRole: tenant.semanticRole,
    workspaceId: tenant.workspaceId,
    projectId: tenant.projectId,
    status: problems.length === 0 ? "COMPLETE" : presentNodes === 0 ? "ABSENT" : "INCOMPLETE",
    readAs,
    problems,
    nodes,
    provenance: {
      rawContentDigest: rawInput?.content_digest ?? null,
      normalizedEventDigest: normalizedEvent?.event_digest ?? null,
      evidenceDerivationDigest: evidence?.derivation_digest ?? null,
      correlationId: tenant.intake.correlationId,
    },
    downstreamOwnedByP2_14: downstream,
  };
}

async function authenticateAllActors({ create = true } = {}) {
  const actorsById = new Map();
  for (const tenant of P2_13_TENANTS) {
    for (const actor of tenant.actors) {
      const resolved = await ensureFixtureActor(actor, { create });
      if (resolved) actorsById.set(`${tenant.key}:${actor.key}`, resolved);
    }
  }
  return actorsById;
}

// ─────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────

async function runVerify() {
  // Read-only: never provision a missing actor.
  const actorsById = await authenticateAllActors({ create: false });
  const tenants = [];
  for (const tenant of P2_13_TENANTS) tenants.push(await verifyTenant(tenant, actorsById));

  const statuses = tenants.map((entry) => entry.status);
  const status = statuses.every((entry) => entry === "COMPLETE")
    ? "COMPLETE"
    : statuses.every((entry) => entry === "ABSENT")
      ? "ABSENT"
      : "INCOMPLETE";

  return { status, tenants };
}

async function runSeed() {
  const tracker = createStageTracker(SEED_STAGES);
  const seeded = [];

  try {
    tracker.begin("isolation_guard");
    assertIsolatedTarget(env, { mode: GUARD_MODES.SEED });
    tracker.complete("isolation_guard", { classification: LOCAL_ISOLATED });

    tracker.begin("fixture_identity");
    const actorsById = await authenticateAllActors();
    tracker.complete("fixture_identity", { actors: actorsById.size });

    tracker.begin("tenant_containers");
    for (const tenant of P2_13_TENANTS) {
      await ensureTenantContainers(tenant, actorsById.get(`${tenant.key}:owner`).id);
    }
    tracker.complete("tenant_containers", { tenants: P2_13_TENANTS.length });

    tracker.begin("tenant_membership");
    for (const tenant of P2_13_TENANTS) {
      await ensureMemberships(
        tenant,
        tenant.actors.map((actor) => actorsById.get(`${tenant.key}:${actor.key}`)),
      );
    }
    tracker.complete("tenant_membership");

    tracker.begin("founder_invite_access");
    for (const tenant of P2_13_TENANTS) {
      await ensureFounderAccess(tenant, actorsById.get(`${tenant.key}:owner`).id);
    }
    tracker.complete("founder_invite_access");

    tracker.begin("actor_authentication");
    // Already proven by ensureFixtureActor: every actor holds a working
    // authenticated session. Recorded as its own stage so a credential
    // failure is attributed here rather than to the canonical stages.
    tracker.complete("actor_authentication", {
      authenticated: [...actorsById.values()].map((actor) => actor.reference),
    });

    const intakeResults = new Map();
    tracker.begin("canonical_intake");
    for (const tenant of P2_13_TENANTS) {
      const result = await seedCanonicalIntake(tenant, actorsById.get(`${tenant.key}:owner`));
      intakeResults.set(tenant.key, result);
    }
    tracker.complete("canonical_intake", {
      dispositions: Object.fromEntries([...intakeResults].map(([key, value]) => [key, value.disposition])),
    });

    const evidenceResults = new Map();
    tracker.begin("canonical_evidence");
    for (const tenant of P2_13_TENANTS) {
      const result = await seedCanonicalEvidence(
        tenant,
        actorsById.get(`${tenant.key}:owner`),
        intakeResults.get(tenant.key).normalizedEvent.id,
      );
      evidenceResults.set(tenant.key, result);
    }
    tracker.complete("canonical_evidence", {
      dispositions: Object.fromEntries([...evidenceResults].map(([key, value]) => [key, value.disposition])),
    });

    tracker.begin("canonical_finding_and_recommendation");
    for (const tenant of P2_13_TENANTS) {
      const chain = await seedCanonicalFinding(
        actorsById.get(`${tenant.key}:owner`),
        evidenceResults.get(tenant.key).evidence.id,
      );
      seeded.push({
        tenant: tenant.key,
        disposition: chain.disposition,
        chainBranches: chain.chainBranches,
      });
    }
    tracker.complete("canonical_finding_and_recommendation", { chains: seeded });

    tracker.begin("scenario_verification");
    const verification = await runVerify();
    if (verification.status !== "COMPLETE") {
      tracker.fail("scenario_verification", { status: verification.status, tenants: verification.tenants });
      const snapshot = tracker.snapshot();
      return { ok: false, ...snapshot, verification };
    }
    tracker.complete("scenario_verification", { status: verification.status });

    const snapshot = tracker.snapshot();
    return { ok: snapshot.status === RUN_STATUS.COMPLETE, ...snapshot, verification };
  } catch (error) {
    const runningStage = tracker.snapshot().stages.find((entry) => entry.status === "running");
    if (runningStage) tracker.fail(runningStage.name, safeFailureReason(error, redact));
    const snapshot = tracker.snapshot();
    return { ok: false, ...snapshot, error: safeFailureReason(error, redact) };
  }
}

async function residueCounts() {
  const counts = {};
  for (const table of RESIDUE_TABLES) {
    let query;
    if (table === "workspaces") query = (q) => q.in("id", SCENARIO_WORKSPACE_IDS);
    else if (table === "projects") query = (q) => q.in("id", SCENARIO_PROJECT_IDS);
    else if (table === "early_access_invites") query = (q) => q.in("invite_email", SCENARIO_ACTOR_EMAILS);
    else if (table === "decision_evidence_links" || table === "agent_outputs" || table === "execution_task_events") {
      // These have no workspace column; their parents are counted instead and
      // a non-zero parent count already fails the residue assertion.
      continue;
    } else query = (q) => q.in("workspace_id", SCENARIO_WORKSPACE_IDS);

    const result = await query(admin.from(table).select("*", { count: "exact", head: true }));
    if (result.error) throw new Error(`residue_${table}:${safeFailureReason(result.error, redact)}`);
    counts[table] = result.count ?? 0;
  }
  return counts;
}

async function runReset() {
  assertIsolatedTarget(env, { mode: GUARD_MODES.DESTRUCTIVE });

  const runner = resolveSqlRunner(env);
  if (!runner.ok) return { ok: false, status: "REFUSED", reason: runner.reason };

  // Resolve fixture actor ids BEFORE the scenario disappears; GoTrue accounts
  // are deleted after the SQL transaction, once nothing references them.
  //
  // Resolved by admin lookup, not by signing in: a reset that could only find
  // the identities it still held the password for would silently leave orphan
  // fixture accounts behind and report success.
  const actorIds = [];
  for (const email of SCENARIO_ACTOR_EMAILS) {
    const existing = await findFixtureUserByEmail(email);
    if (existing) actorIds.push({ email, id: existing.id });
  }

  const before = await residueCounts();

  const sql = buildResetSql({
    workspaceIds: [...SCENARIO_WORKSPACE_IDS],
    projectIds: [...SCENARIO_PROJECT_IDS],
    inviteIds: P2_13_TENANTS.map((tenant) => tenant.founderInvite.inviteId),
    actorEmails: [...SCENARIO_ACTOR_EMAILS],
  });

  const executed = runner.execute(sql);
  if (executed.status !== 0) {
    return {
      ok: false,
      status: "FAILED",
      runner: runner.kind,
      reason: safeFailureReason(String(executed.stderr ?? executed.stdout ?? "reset failed"), redact),
    };
  }

  const deleted = parseResetCounts(executed.stdout) ?? [];

  const deletedActors = [];
  for (const actor of actorIds) {
    const removal = await admin.auth.admin.deleteUser(actor.id);
    if (removal.error) {
      return {
        ok: false,
        status: "FAILED",
        reason: `fixture_actor_delete:${safeFailureReason(removal.error, redact)}`,
        deleted,
      };
    }
    deletedActors.push(actor.email);
  }

  /**
   * Independent post-check through PostgREST rather than the SQL session that
   * did the deleting. If the SQL runner had been pointed at a different
   * database, these counts would still be non-zero — so a wrong target
   * surfaces as a visible residue failure instead of a false success.
   */
  const after = await residueCounts();
  const residual = Object.entries(after).filter(([, count]) => count > 0);

  return {
    ok: residual.length === 0,
    status: residual.length === 0 ? "COMPLETE" : "RESIDUE_REMAINS",
    runner: runner.kind,
    deletedByTable: deleted,
    deletedFixtureActors: deletedActors.length,
    residueBefore: before,
    residueAfter: after,
    residualTables: residual.map(([table, count]) => ({ table, count })),
  };
}

// ─────────────────────────────────────────────────────────────────────────

const started = { command, scenarioId: P2_13_SCENARIO_ID, scenarioKey: P2_13_SCENARIO_KEY };

try {
  if (command === "preflight") {
    emitReport(
      {
        ...started,
        ok: true,
        databaseTargetClassification: verdict.classification,
        target: verdict.target,
        signals: verdict.signals,
        fixtureLabel: FIXTURE_LABEL,
        fixtureExpiryOwner: FIXTURE_EXPIRY_OWNER,
        canonicalSpineOwnership: CANONICAL_SPINE_OWNERSHIP,
      },
      redact,
    );
    process.exit(0);
  }

  if (command === "verify") {
    const result = await runVerify();
    emitReport(
      { ...started, ok: result.status === "COMPLETE", databaseTargetClassification: verdict.classification, ...result },
      redact,
    );
    process.exit(result.status === "COMPLETE" ? 0 : 1);
  }

  if (command === "seed") {
    const result = await runSeed();
    emitReport(
      {
        ...started,
        databaseTargetClassification: verdict.classification,
        ...result,
        handoff: result.ok ? buildP2_14HandoffManifest() : undefined,
      },
      redact,
    );
    process.exit(result.ok ? 0 : 1);
  }

  if (command === "reset") {
    const result = await runReset();
    emitReport({ ...started, databaseTargetClassification: verdict.classification, ...result }, redact);
    process.exit(result.ok ? 0 : 1);
  }

  if (command === "reseed") {
    const reset = await runReset();
    if (!reset.ok) {
      emitReport({ ...started, ok: false, phase: "reset", databaseTargetClassification: verdict.classification, ...reset }, redact);
      process.exit(1);
    }
    const seed = await runSeed();
    emitReport(
      {
        ...started,
        databaseTargetClassification: verdict.classification,
        reset,
        seed,
        ok: seed.ok,
        handoff: seed.ok ? buildP2_14HandoffManifest() : undefined,
      },
      redact,
    );
    process.exit(seed.ok ? 0 : 1);
  }
} catch (error) {
  fail(safeFailureReason(error, redact), {
    databaseTargetClassification: verdict.classification,
    code: error?.code ?? null,
  });
}
