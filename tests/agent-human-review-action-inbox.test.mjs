// ─── Agent Human Review & Action Inbox — Tests ─────────────────────────────────
// Sprint: Human Review & Action Inbox
// These tests run without Supabase / a live database.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Imports ──────────────────────────────────────────────────────────────────

const {
  validateAgentReviewQueueType,
  validateAgentReviewQueueStatus,
  validateAgentReviewItemSourceType,
  validateAgentReviewItemStatus,
  validateAgentReviewPriority,
  validateAgentReviewRiskLevel,
  validateAgentReviewAssignmentStatus,
  validateAgentReviewDecisionType,
  validateAgentReviewActionDraftType,
  validateAgentReviewActionDraftStatus,
  validateAgentReviewEventType,
  assertReviewPayloadSerializable,
  redactReviewPayload,
  normalizeCreateAgentReviewQueueInput,
  normalizeCreateAgentReviewItemInput,
  normalizeCreateAgentReviewDecisionInput,
  normalizeCreateAgentReviewActionDraftInput,
} = await import("../src/lib/agents/agent-review-inbox-validation.ts");

const {
  createAgentReviewQueue,
  getAgentReviewQueueById,
  getAgentReviewQueueByKey,
  listAgentReviewQueues,
  createAgentReviewItem,
  getAgentReviewItemById,
  listAgentReviewItems,
  updateAgentReviewItemStatus,
  createAgentReviewAssignment,
  listAgentReviewAssignments,
  createAgentReviewDecision,
  listAgentReviewDecisions,
  createAgentReviewActionDraft,
  getAgentReviewActionDraftById,
  listAgentReviewActionDrafts,
  updateAgentReviewActionDraftStatus,
  recordAgentReviewEvent,
  listAgentReviewEvents,
  _clearReviewStores,
} = await import("../src/lib/agents/agent-review-inbox-registry.ts");

const {
  createDefaultReviewQueues,
  assignReviewItem,
  openReviewItem,
  recordReviewDecision,
  convertReviewItemToActionDraft,
  markActionDraftReadyForApproval,
  cancelActionDraft,
  buildReviewInboxSummary,
} = await import("../src/lib/agents/agent-review-inbox-service.ts");

// ─── Type / Union Validators ──────────────────────────────────────────────────

describe("Type validators", () => {
  test("validateAgentReviewQueueType", () => {
    for (const v of ["personal", "team", "project", "pmo_governance", "risk", "compliance", "executive", "system"]) {
      assert.equal(validateAgentReviewQueueType(v), true);
    }
    assert.equal(validateAgentReviewQueueType("other"), false);
    assert.equal(validateAgentReviewQueueType(""), false);
  });

  test("validateAgentReviewQueueStatus", () => {
    for (const v of ["active", "paused", "archived"]) {
      assert.equal(validateAgentReviewQueueStatus(v), true);
    }
    assert.equal(validateAgentReviewQueueStatus("pending"), false);
  });

  test("validateAgentReviewItemSourceType", () => {
    for (const v of ["execution_result", "evidence_item", "execution_request", "adapter_execution", "manual"]) {
      assert.equal(validateAgentReviewItemSourceType(v), true);
    }
    assert.equal(validateAgentReviewItemSourceType("webhook"), false);
  });

  test("validateAgentReviewItemStatus", () => {
    for (const v of ["queued", "assigned", "in_review", "needs_more_evidence", "accepted", "rejected", "archived", "escalated", "deferred", "action_drafted", "completed"]) {
      assert.equal(validateAgentReviewItemStatus(v), true);
    }
    assert.equal(validateAgentReviewItemStatus("pending"), false);
  });

  test("validateAgentReviewPriority", () => {
    for (const v of ["low", "normal", "high", "urgent"]) {
      assert.equal(validateAgentReviewPriority(v), true);
    }
    assert.equal(validateAgentReviewPriority("critical"), false);
  });

  test("validateAgentReviewRiskLevel", () => {
    for (const v of ["low", "medium", "high", "critical"]) {
      assert.equal(validateAgentReviewRiskLevel(v), true);
    }
    assert.equal(validateAgentReviewRiskLevel("severe"), false);
  });

  test("validateAgentReviewAssignmentStatus", () => {
    for (const v of ["assigned", "accepted", "declined", "completed", "reassigned", "cancelled"]) {
      assert.equal(validateAgentReviewAssignmentStatus(v), true);
    }
    assert.equal(validateAgentReviewAssignmentStatus("pending"), false);
  });

  test("validateAgentReviewDecisionType", () => {
    for (const v of ["accept", "reject", "request_more_evidence", "archive", "escalate", "mark_duplicate", "defer", "convert_to_action_draft"]) {
      assert.equal(validateAgentReviewDecisionType(v), true);
    }
    assert.equal(validateAgentReviewDecisionType("approve"), false);
  });

  test("validateAgentReviewActionDraftType", () => {
    for (const v of ["draft_email", "draft_task", "draft_project_update", "draft_risk_escalation", "draft_status_report", "draft_governance_note", "draft_follow_up", "manual_action"]) {
      assert.equal(validateAgentReviewActionDraftType(v), true);
    }
    assert.equal(validateAgentReviewActionDraftType("live_email"), false);
  });

  test("validateAgentReviewActionDraftStatus", () => {
    for (const v of ["draft", "ready_for_approval", "approval_requested", "approved", "rejected", "cancelled", "converted"]) {
      assert.equal(validateAgentReviewActionDraftStatus(v), true);
    }
    assert.equal(validateAgentReviewActionDraftStatus("pending"), false);
  });

  test("validateAgentReviewEventType", () => {
    for (const v of ["review_queue_created", "review_item_created", "review_item_accepted", "action_draft_created"]) {
      assert.equal(validateAgentReviewEventType(v), true);
    }
    assert.equal(validateAgentReviewEventType("review_item_deleted"), false);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("Validation", () => {
  test("normalizeCreateAgentReviewQueueInput throws on missing workspaceId", () => {
    assert.throws(() => normalizeCreateAgentReviewQueueInput({
      workspaceId: "", queueKey: "my_queue", queueType: "personal", name: "My Queue",
    }), /workspaceId is required/);
  });

  test("normalizeCreateAgentReviewQueueInput throws on invalid queueType", () => {
    assert.throws(() => normalizeCreateAgentReviewQueueInput({
      workspaceId: "ws1", queueKey: "q1", queueType: "bogus", name: "Test",
    }), /invalid queueType/);
  });

  test("normalizeCreateAgentReviewQueueInput trims and limits name", () => {
    const n = normalizeCreateAgentReviewQueueInput({
      workspaceId: "ws1", queueKey: " my_key ", queueType: "personal", name: " My Queue ",
    });
    assert.equal(n.name, "My Queue");
    assert.equal(n.queueKey, "my_key");
    assert.equal(n.visibility, "workspace");
  });

  test("normalizeCreateAgentReviewItemInput throws on missing workspaceId", () => {
    assert.throws(() => normalizeCreateAgentReviewItemInput({
      workspaceId: "", queueId: "q1", sourceType: "manual", title: "T",
    }), /workspaceId is required/);
  });

  test("normalizeCreateAgentReviewItemInput clamps confidenceScore", () => {
    const n = normalizeCreateAgentReviewItemInput({
      workspaceId: "ws1", queueId: "q1", sourceType: "manual", title: "T", confidenceScore: 200,
    });
    assert.equal(n.confidenceScore, 100);
  });

  test("normalizeCreateAgentReviewItemInput defaults priority and riskLevel", () => {
    const n = normalizeCreateAgentReviewItemInput({
      workspaceId: "ws1", queueId: "q1", sourceType: "manual", title: "T",
    });
    assert.equal(n.priority, "normal");
    assert.equal(n.riskLevel, "medium");
  });

  test("normalizeCreateAgentReviewDecisionInput throws on invalid decisionType", () => {
    assert.throws(() => normalizeCreateAgentReviewDecisionInput({
      workspaceId: "ws1", reviewItemId: "ri1", decisionType: "approve",
    }), /invalid decisionType/);
  });

  test("normalizeCreateAgentReviewActionDraftInput throws on invalid draftType", () => {
    assert.throws(() => normalizeCreateAgentReviewActionDraftInput({
      workspaceId: "ws1", draftType: "live_email", title: "T",
    }), /invalid draftType/);
  });

  test("assertReviewPayloadSerializable throws on circular", () => {
    const obj = {};
    obj.self = obj;
    assert.throws(() => assertReviewPayloadSerializable(obj), /not JSON serializable/);
  });

  test("redactReviewPayload redacts known keys", () => {
    const result = redactReviewPayload({ password: "secret", name: "test", token: "abc" });
    assert.equal(result.password, "[REDACTED]");
    assert.equal(result.token, "[REDACTED]");
    assert.equal(result.name, "test");
  });

  test("redactReviewPayload redacts nested keys", () => {
    const result = redactReviewPayload({ auth: { apiKey: "xyz", user: "alice" } });
    assert.equal(result.auth.apiKey, "[REDACTED]");
    assert.equal(result.auth.user, "alice");
  });

  test("redactReviewPayload returns null for null input", () => {
    assert.equal(redactReviewPayload(null), null);
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("Registry — Queues", () => {
  const ws = "ws-queue-registry";

  test("createAgentReviewQueue returns record with defaults", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "my_queue", queueType: "personal", name: "My Queue" });
    assert.ok(q.id);
    assert.equal(q.queueStatus, "active");
    assert.equal(q.queueType, "personal");
    assert.equal(q.name, "My Queue");
    assert.ok(q.createdAt);
  });

  test("getAgentReviewQueueById returns null for wrong workspace", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "k1", queueType: "project", name: "Q1" });
    const found = await getAgentReviewQueueById("other-ws", q.id);
    assert.equal(found, null);
  });

  test("getAgentReviewQueueByKey finds by key", async () => {
    _clearReviewStores();
    await createAgentReviewQueue({ workspaceId: ws, queueKey: "find_me", queueType: "risk", name: "Find Me" });
    const found = await getAgentReviewQueueByKey(ws, "find_me");
    assert.ok(found);
    assert.equal(found.queueKey, "find_me");
  });

  test("listAgentReviewQueues returns workspace queues", async () => {
    _clearReviewStores();
    await createAgentReviewQueue({ workspaceId: ws, queueKey: "q1", queueType: "personal", name: "Q1" });
    await createAgentReviewQueue({ workspaceId: ws, queueKey: "q2", queueType: "project", name: "Q2" });
    await createAgentReviewQueue({ workspaceId: "other-ws", queueKey: "q3", queueType: "personal", name: "Q3" });
    const queues = await listAgentReviewQueues(ws);
    assert.equal(queues.length, 2);
  });
});

describe("Registry — Items", () => {
  const ws = "ws-item-registry";

  async function makeQueue() {
    return createAgentReviewQueue({ workspaceId: ws, queueKey: `q-${Date.now()}`, queueType: "project", name: "Test Queue" });
  }

  test("createAgentReviewItem returns record with queued status", async () => {
    _clearReviewStores();
    const q = await makeQueue();
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "Test Item" });
    assert.ok(item.id);
    assert.equal(item.itemStatus, "queued");
    assert.equal(item.priority, "normal");
    assert.equal(item.riskLevel, "medium");
    assert.equal(item.confidenceScore, 0);
    assert.deepEqual(item.tags, []);
  });

  test("getAgentReviewItemById returns null for wrong workspace", async () => {
    _clearReviewStores();
    const q = await makeQueue();
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    const found = await getAgentReviewItemById("other-ws", item.id);
    assert.equal(found, null);
  });

  test("listAgentReviewItems filters by itemStatus", async () => {
    _clearReviewStores();
    const q = await makeQueue();
    await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "A" });
    const item2 = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "B" });
    await updateAgentReviewItemStatus({ workspaceId: ws, reviewItemId: item2.id, itemStatus: "accepted" });
    const accepted = await listAgentReviewItems(ws, { itemStatus: "accepted" });
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].itemStatus, "accepted");
  });

  test("listAgentReviewItems filters by queueId", async () => {
    _clearReviewStores();
    const q1 = await makeQueue();
    const q2 = await makeQueue();
    await createAgentReviewItem({ workspaceId: ws, queueId: q1.id, sourceType: "manual", title: "A" });
    await createAgentReviewItem({ workspaceId: ws, queueId: q2.id, sourceType: "manual", title: "B" });
    const items = await listAgentReviewItems(ws, { queueId: q1.id });
    assert.equal(items.length, 1);
    assert.equal(items[0].queueId, q1.id);
  });

  test("updateAgentReviewItemStatus updates item status", async () => {
    _clearReviewStores();
    const q = await makeQueue();
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    const updated = await updateAgentReviewItemStatus({ workspaceId: ws, reviewItemId: item.id, itemStatus: "in_review" });
    assert.equal(updated.itemStatus, "in_review");
  });

  test("safePayload redacts sensitive keys", async () => {
    _clearReviewStores();
    const q = await makeQueue();
    const item = await createAgentReviewItem({
      workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T",
      payload: { token: "secret123", data: "public" },
    });
    assert.equal(item.safePayload?.token, "[REDACTED]");
    assert.equal(item.safePayload?.data, "public");
    assert.equal(item.payload?.token, "secret123");
  });
});

describe("Registry — Assignments", () => {
  const ws = "ws-assignment-registry";

  test("createAgentReviewAssignment and listAgentReviewAssignments", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "q1", queueType: "personal", name: "Q1" });
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    const asgn = await createAgentReviewAssignment({ workspaceId: ws, reviewItemId: item.id, assignedTo: "user-1", assignedBy: "user-0" });
    assert.ok(asgn.id);
    assert.equal(asgn.assignmentStatus, "assigned");
    const list = await listAgentReviewAssignments(ws, item.id);
    assert.equal(list.length, 1);
  });
});

describe("Registry — Decisions", () => {
  const ws = "ws-decision-registry";

  test("createAgentReviewDecision and listAgentReviewDecisions", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "q1", queueType: "project", name: "Q1" });
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    await createAgentReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "accept", decidedBy: "user-1" });
    await createAgentReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "reject", decidedBy: "user-2" });
    const decisions = await listAgentReviewDecisions(ws, item.id);
    assert.equal(decisions.length, 2);
    assert.equal(decisions[0].decisionType, "accept");
  });
});

describe("Registry — Action Drafts", () => {
  const ws = "ws-draft-registry";

  test("createAgentReviewActionDraft returns draft status", async () => {
    _clearReviewStores();
    const draft = await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_task", title: "My Task" });
    assert.ok(draft.id);
    assert.equal(draft.draftStatus, "draft");
    assert.equal(draft.draftType, "draft_task");
  });

  test("getAgentReviewActionDraftById returns null for wrong workspace", async () => {
    _clearReviewStores();
    const draft = await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_email", title: "T" });
    const found = await getAgentReviewActionDraftById("other-ws", draft.id);
    assert.equal(found, null);
  });

  test("updateAgentReviewActionDraftStatus updates status", async () => {
    _clearReviewStores();
    const draft = await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_task", title: "T" });
    const updated = await updateAgentReviewActionDraftStatus({ workspaceId: ws, actionDraftId: draft.id, draftStatus: "ready_for_approval" });
    assert.equal(updated.draftStatus, "ready_for_approval");
  });

  test("listAgentReviewActionDrafts filters by reviewItemId", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "q1", queueType: "project", name: "Q" });
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    await createAgentReviewActionDraft({ workspaceId: ws, reviewItemId: item.id, draftType: "draft_task", title: "D1" });
    await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_email", title: "D2" });
    const filtered = await listAgentReviewActionDrafts(ws, item.id);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].reviewItemId, item.id);
  });
});

describe("Registry — Events", () => {
  const ws = "ws-event-registry";

  test("recordAgentReviewEvent and listAgentReviewEvents", async () => {
    _clearReviewStores();
    const q = await createAgentReviewQueue({ workspaceId: ws, queueKey: "q1", queueType: "project", name: "Q" });
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "T" });
    await recordAgentReviewEvent({ workspaceId: ws, eventType: "review_item_created", reviewItemId: item.id });
    await recordAgentReviewEvent({ workspaceId: ws, eventType: "review_item_opened", reviewItemId: item.id });
    const events = await listAgentReviewEvents(ws, item.id);
    assert.equal(events.length, 2);
    assert.equal(events[0].eventType, "review_item_created");
  });
});

// ─── Service ──────────────────────────────────────────────────────────────────

describe("Service — createDefaultReviewQueues", () => {
  const ws = "ws-default-queues";

  test("creates 6 default queues", async () => {
    _clearReviewStores();
    const queues = await createDefaultReviewQueues(ws);
    assert.equal(queues.length, 6);
  });

  test("is idempotent — does not duplicate queues", async () => {
    _clearReviewStores();
    await createDefaultReviewQueues(ws);
    await createDefaultReviewQueues(ws);
    const all = await listAgentReviewQueues(ws);
    assert.equal(all.length, 6);
  });

  test("creates expected queue keys", async () => {
    _clearReviewStores();
    const queues = await createDefaultReviewQueues(ws);
    const keys = queues.map(q => q.queueKey);
    assert.ok(keys.includes("personal_review"));
    assert.ok(keys.includes("project_review"));
    assert.ok(keys.includes("pmo_governance"));
    assert.ok(keys.includes("risk_review"));
    assert.ok(keys.includes("compliance_review"));
    assert.ok(keys.includes("executive_review"));
  });
});

describe("Service — item lifecycle", () => {
  const ws = "ws-lifecycle";

  async function setup() {
    _clearReviewStores();
    await createDefaultReviewQueues(ws);
    const q = await getAgentReviewQueueByKey(ws, "project_review");
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "Lifecycle Item" });
    return item;
  }

  test("assignReviewItem creates assignment and sets status", async () => {
    const item = await setup();
    const asgn = await assignReviewItem({ workspaceId: ws, reviewItemId: item.id, assignedTo: "user-1", assignedBy: "user-0" });
    assert.ok(asgn.id);
    assert.equal(asgn.assignmentStatus, "assigned");
    const updated = await getAgentReviewItemById(ws, item.id);
    assert.equal(updated.itemStatus, "assigned");
    assert.equal(updated.assignedTo, "user-1");
  });

  test("openReviewItem sets status to in_review", async () => {
    const item = await setup();
    const updated = await openReviewItem({ workspaceId: ws, reviewItemId: item.id, actorId: "user-1" });
    assert.equal(updated.itemStatus, "in_review");
  });

  test("recordReviewDecision accept sets status to accepted", async () => {
    const item = await setup();
    const decision = await recordReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "accept", decidedBy: "user-1", rationale: "Looks good" });
    assert.equal(decision.decisionType, "accept");
    const updated = await getAgentReviewItemById(ws, item.id);
    assert.equal(updated.itemStatus, "accepted");
    assert.equal(updated.reviewedBy, "user-1");
  });

  test("recordReviewDecision reject sets status to rejected", async () => {
    const item = await setup();
    await recordReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "reject", decidedBy: "user-1" });
    const updated = await getAgentReviewItemById(ws, item.id);
    assert.equal(updated.itemStatus, "rejected");
  });

  test("recordReviewDecision escalate sets status to escalated", async () => {
    const item = await setup();
    await recordReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "escalate", decidedBy: "user-1" });
    const updated = await getAgentReviewItemById(ws, item.id);
    assert.equal(updated.itemStatus, "escalated");
  });

  test("recordReviewDecision request_more_evidence sets needs_more_evidence", async () => {
    const item = await setup();
    await recordReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "request_more_evidence", decidedBy: "user-1" });
    const updated = await getAgentReviewItemById(ws, item.id);
    assert.equal(updated.itemStatus, "needs_more_evidence");
  });
});

describe("Service — convertReviewItemToActionDraft", () => {
  const ws = "ws-convert";

  test("converts accepted item to action draft", async () => {
    _clearReviewStores();
    await createDefaultReviewQueues(ws);
    const q = await getAgentReviewQueueByKey(ws, "project_review");
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "execution_result", title: "Convert Me" });
    // First accept the item
    await recordReviewDecision({ workspaceId: ws, reviewItemId: item.id, decisionType: "accept", decidedBy: "user-1" });
    const draft = await convertReviewItemToActionDraft({ workspaceId: ws, reviewItemId: item.id, actorId: "user-1" });
    assert.ok(draft.id);
    assert.equal(draft.draftStatus, "draft");
    assert.equal(draft.reviewItemId, item.id);
  });

  test("blocks if item is not accepted", async () => {
    _clearReviewStores();
    await createDefaultReviewQueues(ws);
    const q = await getAgentReviewQueueByKey(ws, "project_review");
    const item = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "Not Accepted" });
    await assert.rejects(
      () => convertReviewItemToActionDraft({ workspaceId: ws, reviewItemId: item.id, actorId: "user-1" }),
      /accepted status/,
    );
  });
});

describe("Service — markActionDraftReadyForApproval and cancelActionDraft", () => {
  const ws = "ws-draft-lifecycle";

  test("markActionDraftReadyForApproval updates status", async () => {
    _clearReviewStores();
    const draft = await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_task", title: "T" });
    const updated = await markActionDraftReadyForApproval({ workspaceId: ws, actionDraftId: draft.id, actorId: "user-1" });
    assert.equal(updated.draftStatus, "ready_for_approval");
  });

  test("cancelActionDraft updates status", async () => {
    _clearReviewStores();
    const draft = await createAgentReviewActionDraft({ workspaceId: ws, draftType: "draft_email", title: "T" });
    const updated = await cancelActionDraft({ workspaceId: ws, actionDraftId: draft.id, actorId: "user-1" });
    assert.equal(updated.draftStatus, "cancelled");
  });
});

describe("Service — buildReviewInboxSummary", () => {
  const ws = "ws-summary";

  test("returns summary with correct counts", async () => {
    _clearReviewStores();
    await createDefaultReviewQueues(ws);
    const q = await getAgentReviewQueueByKey(ws, "project_review");
    await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "A" });
    const item2 = await createAgentReviewItem({ workspaceId: ws, queueId: q.id, sourceType: "manual", title: "B", priority: "high" });
    await updateAgentReviewItemStatus({ workspaceId: ws, reviewItemId: item2.id, itemStatus: "accepted" });

    const summary = await buildReviewInboxSummary(ws);
    assert.equal(summary.workspaceId, ws);
    assert.equal(summary.totalItems, 2);
    assert.ok(summary.byStatus.queued >= 1);
    assert.ok(summary.byStatus.accepted >= 1);
    assert.ok(summary.byPriority.high >= 1);
    assert.ok(summary.generatedAt);
  });
});

// ─── Migration File ───────────────────────────────────────────────────────────

describe("Migration file", () => {
  const migrationPath = resolve(ROOT, "supabase/migrations/20260802000000_agent_human_review_action_inbox.sql");

  test("migration file exists", () => {
    assert.ok(existsSync(migrationPath), "Migration file does not exist");
  });

  test("migration contains agent_review_queues table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_queues"), "Missing agent_review_queues table");
  });

  test("migration contains agent_review_items table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_items"), "Missing agent_review_items table");
  });

  test("migration contains agent_review_assignments table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_assignments"), "Missing assignments table");
  });

  test("migration contains agent_review_decisions table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_decisions"), "Missing decisions table");
  });

  test("migration contains agent_review_action_drafts table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_action_drafts"), "Missing action drafts table");
  });

  test("migration contains agent_review_events table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_review_events"), "Missing events table");
  });

  test("migration has RLS policies", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("row level security"), "Missing RLS");
    assert.ok(sql.includes("workspace_members_read_review_queues"), "Missing read policy");
  });

  test("migration uses workspace_memberships policy pattern", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("workspace_memberships"), "Missing workspace_memberships in policy");
    assert.ok(sql.includes("auth.uid()"), "Missing auth.uid() in policy");
  });
});

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database contract", () => {
  const contractPath = resolve(ROOT, "src/lib/db/database-contract.ts");

  test("contract contains AgentReviewQueueRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewQueueRow"));
  });

  test("contract contains AgentReviewItemRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewItemRow"));
  });

  test("contract contains AgentReviewAssignmentRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewAssignmentRow"));
  });

  test("contract contains AgentReviewDecisionRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewDecisionRow"));
  });

  test("contract contains AgentReviewActionDraftRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewActionDraftRow"));
  });

  test("contract contains AgentReviewEventRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentReviewEventRow"));
  });

  test("contract version includes agent-human-review-action-inbox", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("agent-human-review-action-inbox"), "VERSION not updated");
  });
});

// ─── API Route Files ──────────────────────────────────────────────────────────

describe("API route files exist", () => {
  const routeFiles = [
    "src/app/api/agents/execution/review/queues/route.ts",
    "src/app/api/agents/execution/review/queues/[queueId]/route.ts",
    "src/app/api/agents/execution/review/items/route.ts",
    "src/app/api/agents/execution/review/items/from-result/route.ts",
    "src/app/api/agents/execution/review/items/from-evidence/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/assign/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/open/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/accept/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/reject/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/request-more-evidence/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/archive/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/escalate/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/decisions/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/events/route.ts",
    "src/app/api/agents/execution/review/items/[reviewItemId]/action-draft/route.ts",
    "src/app/api/agents/execution/review/action-drafts/route.ts",
    "src/app/api/agents/execution/review/action-drafts/[actionDraftId]/route.ts",
    "src/app/api/agents/execution/review/action-drafts/[actionDraftId]/ready-for-approval/route.ts",
    "src/app/api/agents/execution/review/action-drafts/[actionDraftId]/cancel/route.ts",
    "src/app/api/agents/execution/review/summary/route.ts",
  ];

  for (const relPath of routeFiles) {
    test(`exists: ${relPath}`, () => {
      assert.ok(existsSync(resolve(ROOT, relPath)), `Missing: ${relPath}`);
    });
  }

  test("queues route contains createAgentReviewQueue", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/review/queues/route.ts"), "utf8");
    assert.ok(content.includes("createAgentReviewQueue"));
  });

  test("summary route contains buildReviewInboxSummary", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/review/summary/route.ts"), "utf8");
    assert.ok(content.includes("buildReviewInboxSummary"));
  });
});

// ─── Observability Types ──────────────────────────────────────────────────────

describe("Observability types updated", () => {
  const obsTypesPath = resolve(ROOT, "src/lib/agents/agent-observability-types.ts");

  test("agent_human_review_action_inbox source type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("agent_human_review_action_inbox"), "Missing source type");
  });

  test("review_queue_created event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("review_queue_created"), "Missing event type");
  });

  test("review_item_accepted event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("review_item_accepted"), "Missing event type");
  });

  test("action_draft_created event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("action_draft_created"), "Missing event type");
  });
});

// ─── Index Exports ────────────────────────────────────────────────────────────

describe("index.ts exports", () => {
  const indexPath = resolve(ROOT, "src/lib/agents/index.ts");

  test("exports createDefaultReviewQueues", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("createDefaultReviewQueues"));
  });

  test("exports buildReviewInboxSummary", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("buildReviewInboxSummary"));
  });

  test("exports validateAgentReviewQueueType", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("validateAgentReviewQueueType"));
  });

  test("exports _clearReviewStores", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("_clearReviewStores"));
  });
});

// ─── No-side-effect checks ────────────────────────────────────────────────────

describe("No prohibited patterns in service/registry", () => {
  const serviceContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-review-inbox-service.ts"), "utf8");
  const registryContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-review-inbox-registry.ts"), "utf8");

  test("service does not import openai/anthropic/gemini", () => {
    assert.ok(!serviceContent.includes("openai") && !serviceContent.includes("anthropic") && !serviceContent.includes("gemini"));
  });

  test("service does not call fetch(", () => {
    assert.ok(!serviceContent.match(/\bfetch\s*\(/));
  });

  test("service does not send emails or call external webhooks", () => {
    assert.ok(!serviceContent.includes("sendEmail") && !serviceContent.includes("send_email") && !serviceContent.includes("webhook"));
  });

  test("registry does not import supabase", () => {
    assert.ok(!registryContent.includes("supabase") && !registryContent.includes("@/lib/db"));
  });

  test("service does not import @/lib/db directly", () => {
    assert.ok(!serviceContent.includes("@/lib/db"));
  });
});

// ─── Regression — existing modules still importable ──────────────────────────

describe("Regression: existing agent modules still importable", () => {
  test("agent-tool-adapter-service exports runAgentToolAdapter", async () => {
    const mod = await import("../src/lib/agents/agent-tool-adapter-service.ts");
    assert.ok(typeof mod.runAgentToolAdapter === "function");
  });

  test("agent-execution-result-registry still importable via index", async () => {
    const mod = await import("../src/lib/agents/index.ts");
    assert.ok(typeof mod.createAgentExecutionResult === "function");
  });

  test("review inbox service exports via index", async () => {
    const mod = await import("../src/lib/agents/index.ts");
    assert.ok(typeof mod.createDefaultReviewQueues === "function");
    assert.ok(typeof mod.buildReviewInboxSummary === "function");
  });
});
