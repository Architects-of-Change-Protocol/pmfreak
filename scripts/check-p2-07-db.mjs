import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = process.env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.OPERATIONAL_FLOW_TEST_BASE_URL?.replace(/\/$/, "");
const databaseUrl = process.env.OPERATIONAL_FLOW_TEST_DATABASE_URL;

if (
  !supabaseUrl ||
  !anonKey ||
  !serviceRoleKey ||
  !appBaseUrl ||
  !databaseUrl ||
  process.env.OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE !== "true"
) {
  console.error([
    "P2-07 live verification requires the disposable local PMFreak stack.",
    "Set OPERATIONAL_FLOW_TEST_SUPABASE_URL, OPERATIONAL_FLOW_TEST_ANON_KEY,",
    "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY, OPERATIONAL_FLOW_TEST_BASE_URL,",
    "OPERATIONAL_FLOW_TEST_DATABASE_URL and OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true.",
  ].join("\n"));
  process.exit(2);
}

for (const [name, target] of [
  ["Supabase API", supabaseUrl],
  ["PMFreak", appBaseUrl],
  ["PostgreSQL", databaseUrl],
]) {
  let host;
  try {
    host = new URL(target).hostname;
  } catch {
    console.error(`SAFETY ABORT: invalid ${name} URL.`);
    process.exit(2);
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    console.error(`SAFETY ABORT: ${name} must use a literal loopback host.`);
    process.exit(2);
  }
}

if (appBaseUrl !== "http://localhost:3000") {
  console.error("SAFETY ABORT: browser/runtime origin must be http://localhost:3000.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const makeClient = () =>
  createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `P2-07-${randomUUID()}!`;
const users = {};
let assertions = 0;

const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions += 1;
};

async function createUser(label, workspaceId, role) {
  const email = `p2-07-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const client = makeClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  users[label] = { id: created.data.user.id, email, client, role, workspaceId };
}

async function loginCookie(email) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("next", "/projects");
  const response = await fetch(`${appBaseUrl}/api/login`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  check(values.length > 0, "authenticated login must return cookies");
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function api(cookie, body) {
  const response = await fetch(`${appBaseUrl}/api/operational-flow`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
}

async function taskList(cookie, projectId) {
  const response = await fetch(
    `${appBaseUrl}/api/execution-tasks?projectId=${encodeURIComponent(projectId)}`,
    { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(20_000) },
  );
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
}

async function makeDecision(cookie, workspaceId, projectId, keySuffix) {
  const now = new Date();
  const correlationId = randomUUID();

  const captured = await api(cookie, {
    operation: "capture_input",
    workspaceId,
    projectId,
    // No sourceKey: the P2-14 review repair pins the DEMO / FIXTURE identity server-side,
    // and a caller-chosen key is now refused rather than silently accepted.
    idempotencyKey: `capture-${keySuffix}`,
    title: "DEMO / FIXTURE P2-07 governed Action-to-Task",
    content:
      "A decision is needed before proceeding with this governed project change.",
    occurredAt: now.toISOString(),
    correlationId,
  });
  equal(captured.status, 201, "fixture input capture");

  const derived = await api(cookie, {
    operation: "derive_evidence",
    workspaceId,
    projectId,
    normalizedEventId: captured.body.normalizedEvent.id,
    idempotencyKey: `evidence-${keySuffix}`,
    assertionType: "FACT",
    classification: "DECISION_CONTEXT",
    confidenceScore: 0.95,
    missingDataState: "COMPLETE",
    evaluatedAt: now.toISOString(),
  });
  equal(derived.status, 201, "fixture evidence derivation");

  const chain = await api(cookie, {
    operation: "run_chain",
    workspaceId,
    projectId,
    evidenceItemId: derived.body.evidence.id,
  });
  equal(chain.status, 200, "fixture governance chain");

  const sourceSignalId = chain.body.chain?.[0]?.signal?.id;
  check(
    Boolean(sourceSignalId),
    "fixture governance chain must materialize a governed signal",
  );

  const recommendation = await admin
    .from("recommended_actions")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_signal_id", sourceSignalId)
    .not("governance_event_id", "is", null)
    .single();
  assert.ifError(recommendation.error);

  const decision = await api(cookie, {
    operation: "record_decision",
    workspaceId,
    projectId,
    recommendationId: recommendation.data.id,
    decisionStatus: "accepted",
    decision: "DEMO / FIXTURE accepted P2-07 decision",
    rationale: "Controlled local P2-07 verification.",
  });
  equal(decision.status, 201, "fixture decision record");

  return {
    decisionId: decision.body.decision.id,
    evidenceId: derived.body.evidence.id,
  };
}

async function proposeAction(
  cookie,
  workspaceId,
  projectId,
  decisionId,
  key,
  {
    actionClass = "external_write",
    risk = "high",
    createdAt = new Date(Date.now() - 30_000),
    evaluationTime = new Date(Date.now() - 20_000),
    expiresAt = new Date(Date.now() + 60 * 60_000),
  } = {},
) {
  const result = await api(cookie, {
    operation: "propose_material_action",
    workspaceId,
    projectId,
    decisionId,
    idempotencyKey: key,
    actionClass,
    actionType: "schedule_change_proposal",
    targetResourceType: "project_schedule",
    targetResourceId: projectId,
    intendedOperation: "create_internal_execution_task",
    intendedEffect: `P2-07 governed task ${key}`,
    risk,
    reversibility: "partially_reversible",
    sideEffect: "external",
    justification: "P2-07 disposable local verifier.",
    createdAt: createdAt.toISOString(),
    evaluationTime: evaluationTime.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  check([200, 201].includes(result.status), `action proposal ${key} created/replayed`);
  return result.body;
}

async function dispatch(cookie, workspaceId, projectId, actionId, expectedProposalDigest = null) {
  return api(cookie, {
    operation: "dispatch_material_action_to_task",
    workspaceId,
    projectId,
    actionId,
    ...(expectedProposalDigest ? { expectedProposalDigest } : {}),
  });
}

async function countTasksForAction(actionId) {
  const result = await admin
    .from("execution_tasks")
    .select("id", { count: "exact", head: true })
    .eq("source_payload->>source", "governed_action")
    .eq("source_payload->>sourceActionId", actionId);
  assert.ifError(result.error);
  return result.count ?? 0;
}

const workspaceA = randomUUID();
const workspaceB = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();

await createUser("owner", workspaceA, "owner");
await createUser("pm", workspaceA, "pm");
await createUser("viewer", workspaceA, "viewer");
await createUser("outsider", workspaceB, "owner");

assert.ifError(
  (
    await admin.from("workspaces").insert([
      {
        id: workspaceA,
        name: `P2-07 DEMO A ${suffix}`,
        created_by_user_id: users.owner.id,
      },
      {
        id: workspaceB,
        name: `P2-07 DEMO B ${suffix}`,
        created_by_user_id: users.outsider.id,
      },
    ])
  ).error,
);

assert.ifError(
  (
    await admin.from("workspace_memberships").insert([
      { workspace_id: workspaceA, user_id: users.owner.id, role: "owner" },
      { workspace_id: workspaceA, user_id: users.pm.id, role: "pm" },
      { workspace_id: workspaceA, user_id: users.viewer.id, role: "viewer" },
      { workspace_id: workspaceB, user_id: users.outsider.id, role: "owner" },
    ])
  ).error,
);

assert.ifError(
  (
    await admin.from("projects").insert([
      {
        id: projectA,
        workspace_id: workspaceA,
        user_id: users.owner.id,
        name: `P2-07 DEMO Project A ${suffix}`,
      },
      {
        id: projectB,
        workspace_id: workspaceB,
        user_id: users.outsider.id,
        name: `P2-07 DEMO Project B ${suffix}`,
      },
    ])
  ).error,
);

for (const label of ["owner", "pm", "viewer", "outsider"]) {
  const inviteId = randomUUID();
  assert.ifError(
    (
      await admin.from("early_access_invites").insert({
        id: inviteId,
        invite_email: users[label].email,
        invite_token_hash: randomUUID().replaceAll("-", ""),
        inviter_user_id: users[label].id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
        accepted_at: new Date().toISOString(),
        workspace_id: users[label].workspaceId,
      })
    ).error,
  );
  assert.ifError(
    (
      await admin.from("trial_licenses").insert({
        invite_id: inviteId,
        workspace_id: users[label].workspaceId,
        trial_start_at: new Date(Date.now() - 60_000).toISOString(),
        trial_end_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
        trial_status: "active",
      })
    ).error,
  );
}

const ownerCookie = await loginCookie(users.owner.email);
const pmCookie = await loginCookie(users.pm.email);
const viewerCookie = await loginCookie(users.viewer.email);
const outsiderCookie = await loginCookie(users.outsider.email);

const ownerDecision = await makeDecision(
  ownerCookie,
  workspaceA,
  projectA,
  `owner-${suffix}`,
);

const happyAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  ownerDecision.decisionId,
  `happy-${suffix}`,
);
const happyActionId = happyAction.proposal.id;
const happyDigest = happyAction.proposal.proposal_digest;

const beforeHappy = await countTasksForAction(happyActionId);
equal(beforeHappy, 0, "happy Action starts with zero Tasks");

const happy = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  happyActionId,
  happyDigest,
);
equal(happy.status, 201, "authorized Action creates Task");
equal(happy.body.disposition, "created", "happy disposition created");
check(Boolean(happy.body.task?.id), "happy Task has id");
equal(await countTasksForAction(happyActionId), 1, "happy Action has exactly one Task");
equal(
  happy.body.task.source_payload.sourceActionId,
  happyActionId,
  "Task retains source Action",
);
equal(
  happy.body.task.source_payload.sourceDecisionId,
  ownerDecision.decisionId,
  "Task retains source Decision",
);
check(
  Array.isArray(happy.body.task.source_payload.evidenceReferences),
  "Task retains evidence references",
);
equal(
  happy.body.nonExecution.executed,
  false,
  "Task creation is not execution",
);
equal(
  happy.body.nonExecution.outcomeCreated,
  false,
  "Task creation is not Outcome",
);

const replay = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  happyActionId,
  happyDigest,
);
equal(replay.status, 200, "idempotent replay returns success");
equal(replay.body.disposition, "existing", "replay disposition existing");
equal(replay.body.task.id, happy.body.task.id, "replay returns same Task id");
equal(await countTasksForAction(happyActionId), 1, "replay still one Task");

const conflict = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  happyActionId,
  "f".repeat(64),
);
equal(conflict.status, 409, "conflicting digest returns conflict");
equal(conflict.body.disposition, "conflict", "conflict disposition");
equal(await countTasksForAction(happyActionId), 1, "conflict creates no second Task");

for (const concurrency of [2, 5, 10]) {
  const decision = await makeDecision(
    ownerCookie,
    workspaceA,
    projectA,
    `concurrency-${concurrency}-${suffix}`,
  );
  const action = await proposeAction(
    ownerCookie,
    workspaceA,
    projectA,
    decision.decisionId,
    `concurrency-${concurrency}-${suffix}`,
  );
  const actionId = action.proposal.id;
  const responses = await Promise.all(
    Array.from({ length: concurrency }, () =>
      dispatch(ownerCookie, workspaceA, projectA, actionId),
    ),
  );
  check(
    responses.every((entry) => [200, 201].includes(entry.status)),
    `${concurrency} concurrent requests all converge safely`,
  );
  const taskIds = new Set(responses.map((entry) => entry.body.task?.id).filter(Boolean));
  equal(taskIds.size, 1, `${concurrency} concurrent requests return one Task id`);
  equal(
    await countTasksForAction(actionId),
    1,
    `${concurrency} concurrent requests persist one Task row`,
  );
  console.log(`CONCURRENCY ${concurrency}: one Task ${[...taskIds][0]}`);
}

const unavailableSourceLink = await admin
  .from("decision_evidence_links")
  .select(
    "evidence_item_id,evidence_hash_at_decision,evidence_version_at_decision,evidence_title_snapshot,link_reason",
  )
  .eq("decision_record_id", ownerDecision.decisionId)
  .limit(1)
  .single();
assert.ifError(unavailableSourceLink.error);

const unavailableDecisionId = randomUUID();
assert.ifError(
  (
    await admin.from("operational_decision_records").insert({
      id: unavailableDecisionId,
      workspace_id: workspaceA,
      project_id: projectA,
      recommendation_id: null,
      governance_event_id: null,
      decided_by: users.owner.id,
      decision: "DEMO / FIXTURE P2-07 unavailable-governance decision",
      decision_status: "accepted",
      rationale: "Controlled local fail-closed unavailable-governance proof.",
      authority_basis: "owner workspace authority (PMFreak role mapping v1)",
      authority_evaluation: {
        fixture: true,
        purpose: "P2-07 unavailable-governance proof",
      },
    })
  ).error,
);

assert.ifError(
  (
    await admin.from("decision_evidence_links").insert({
      decision_record_id: unavailableDecisionId,
      evidence_item_id: unavailableSourceLink.data.evidence_item_id,
      link_reason: "P2-07 real evidence lineage reused for unavailable-governance proof",
      evidence_hash_at_decision:
        unavailableSourceLink.data.evidence_hash_at_decision,
      evidence_version_at_decision:
        unavailableSourceLink.data.evidence_version_at_decision,
      evidence_title_snapshot:
        unavailableSourceLink.data.evidence_title_snapshot,
    })
  ).error,
);

const unavailableAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  unavailableDecisionId,
  `unavailable-${suffix}`,
);
const unavailableId = unavailableAction.proposal.id;
const unavailableDispatch = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  unavailableId,
);
equal(unavailableDispatch.status, 409, "unavailable Action rejected");
equal(
  unavailableDispatch.body.governanceState,
  "unavailable",
  "unavailable governance state preserved",
);
equal(
  await countTasksForAction(unavailableId),
  0,
  "unavailable creates zero Tasks",
);

const deniedDecision = await makeDecision(
  ownerCookie,
  workspaceA,
  projectA,
  `denied-${suffix}`,
);
const deniedAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  deniedDecision.decisionId,
  `denied-${suffix}`,
  { actionClass: "knowledge_elevation" },
);
const deniedId = deniedAction.proposal.id;
equal(await countTasksForAction(deniedId), 0, "denied starts with zero Tasks");
const denied = await dispatch(ownerCookie, workspaceA, projectA, deniedId);
equal(denied.status, 409, "denied Action rejected");
equal(denied.body.disposition, "denied", "denied disposition");
equal(denied.body.governanceState, "denied", "denied governance state preserved");
equal(await countTasksForAction(deniedId), 0, "denied creates zero Tasks");

const degradedDecision = await makeDecision(
  ownerCookie,
  workspaceA,
  projectA,
  `degraded-${suffix}`,
);
const degradedAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  degradedDecision.decisionId,
  `degraded-${suffix}`,
  { risk: "unknown" },
);
const degradedId = degradedAction.proposal.id;
const degraded = await dispatch(ownerCookie, workspaceA, projectA, degradedId);
equal(degraded.status, 409, "degraded Action rejected");
equal(degraded.body.governanceState, "degraded", "degraded state preserved");
equal(await countTasksForAction(degradedId), 0, "degraded creates zero Tasks");

const approvalDecision = await makeDecision(
  pmCookie,
  workspaceA,
  projectA,
  `approval-${suffix}`,
);
const approvalAction = await proposeAction(
  pmCookie,
  workspaceA,
  projectA,
  approvalDecision.decisionId,
  `approval-${suffix}`,
);
const approvalId = approvalAction.proposal.id;
const approval = await dispatch(pmCookie, workspaceA, projectA, approvalId);
equal(approval.status, 409, "requires-approval Action rejected");
equal(
  approval.body.governanceState,
  "requires_approval",
  "requires-approval state preserved",
);
equal(await countTasksForAction(approvalId), 0, "requires approval creates zero Tasks");

const revokedDecision = await makeDecision(
  ownerCookie,
  workspaceA,
  projectA,
  `revoked-${suffix}`,
);
const revokedAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  revokedDecision.decisionId,
  `revoked-${suffix}`,
);
const revokedId = revokedAction.proposal.id;
const revoked = await api(ownerCookie, {
  operation: "revoke_material_action",
  workspaceId: workspaceA,
  projectId: projectA,
  actionId: revokedId,
  evaluationTime: new Date().toISOString(),
  reasonCode: "p2_07_revocation_before_task",
});
check([200, 201].includes(revoked.status), "revocation recorded");
const revokedDispatch = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  revokedId,
);
equal(revokedDispatch.status, 409, "revoked Action rejected");
equal(revokedDispatch.body.governanceState, "revoked", "revoked state preserved");
equal(await countTasksForAction(revokedId), 0, "revoked before dispatch creates zero Tasks");

const expiredDecision = await makeDecision(
  ownerCookie,
  workspaceA,
  projectA,
  `expired-${suffix}`,
);
const expiredAction = await proposeAction(
  ownerCookie,
  workspaceA,
  projectA,
  expiredDecision.decisionId,
  `expired-${suffix}`,
  {
    createdAt: new Date(Date.now() - 3 * 60 * 60_000),
    evaluationTime: new Date(Date.now() - 2 * 60 * 60_000),
    expiresAt: new Date(Date.now() - 60 * 60_000),
  },
);
const expiredId = expiredAction.proposal.id;
const expiredDispatch = await dispatch(
  ownerCookie,
  workspaceA,
  projectA,
  expiredId,
);
equal(expiredDispatch.status, 409, "expired Action rejected");
equal(expiredDispatch.body.failureClass, "expired", "expired failure class");
equal(await countTasksForAction(expiredId), 0, "expired creates zero Tasks");

const anonymous = await dispatch(null, workspaceA, projectA, happyActionId);
equal(anonymous.status, 401, "unauthenticated dispatch rejected");

const viewer = await dispatch(
  viewerCookie,
  workspaceA,
  projectA,
  happyActionId,
);
equal(viewer.status, 403, "viewer dispatch rejected");

const crossTenant = await dispatch(
  outsiderCookie,
  workspaceB,
  projectB,
  happyActionId,
);
equal(crossTenant.status, 409, "cross-tenant Action dispatch rejected");
equal(crossTenant.body.failureClass, "not_found", "cross-tenant does not leak existence");

const crossTenantLookup = await taskList(outsiderCookie, projectA);
equal(crossTenantLookup.status, 403, "cross-tenant Task lookup rejected");

const forgedInsert = await users.owner.client.from("execution_tasks").insert({
  workspace_id: workspaceA,
  project_id: projectA,
  task_draft_id: null,
  recommended_action_id: null,
  raid_item_id: null,
  title: "FORGED governed provenance",
  description: "must be rejected by RLS",
  status: "not_started",
  priority: "medium",
  source_payload: {
    source: "governed_action",
    sourceActionId: randomUUID(),
  },
  created_by: users.owner.id,
});
check(Boolean(forgedInsert.error), "direct forged governed Task insert rejected");

const provenanceRewrite = await users.owner.client
  .from("execution_tasks")
  .update({ source_payload: { source: "manual", rewritten: true } })
  .eq("id", happy.body.task.id);
check(Boolean(provenanceRewrite.error), "governed Task provenance rewrite rejected");

const eventRows = await admin
  .from("execution_task_events")
  .select("event_type,event_payload")
  .eq("task_id", happy.body.task.id)
  .order("created_at", { ascending: true });
assert.ifError(eventRows.error);
check(
  eventRows.data.some((event) => event.event_type === "governed_action_task_created"),
  "creation audit event exists",
);
check(
  eventRows.data.some((event) => event.event_type === "governed_action_task_replayed"),
  "replay audit event exists",
);

console.log(`P2-07 DB verification PASS (${assertions} assertions).`);
console.log(`LINEAGE Task ${happy.body.task.id}`);
console.log(`  -> Action ${happyActionId}`);
console.log(`  -> Decision ${ownerDecision.decisionId}`);
console.log(
  `  -> Evidence ${happy.body.task.source_payload.evidenceReferences.join(", ")}`,
);
console.log("NO-OUTCOME: task creation reported executed=false, outcomeCreated=false.");