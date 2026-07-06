import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVERSATIONAL_DEMO_SCENARIOS,
  runConversationalDemoScenario,
} from "../src/lib/playbook-engine/conversation/demo/conversationalDemoScenarios.ts";

test("every demo scenario routes to its documented expected route", () => {
  for (const scenario of Object.values(CONVERSATIONAL_DEMO_SCENARIOS)) {
    const result = runConversationalDemoScenario(scenario.id);
    assert.equal(result.route, scenario.expectedRoute, `scenario '${scenario.id}' should route to '${scenario.expectedRoute}'`);
    assert.ok(result.response.length > 0, `scenario '${scenario.id}' must produce a non-empty response`);
  }
});

test("open PM advice scenario needs no project and gives useful guidance", () => {
  const result = runConversationalDemoScenario("open_pm_advice");
  assert.equal(result.intent, "general_pm_advice");
  assert.deepEqual(result.missingContext, []);
});

test("informal blocked project scenario detects operational blockage", () => {
  const result = runConversationalDemoScenario("informal_blocked_project");
  assert.equal(result.intent, "project_status_question");
  assert.ok(result.response.length > 0);
});

test("project status query scenario reflects the connected project's real evidence", () => {
  const result = runConversationalDemoScenario("project_status_query");
  assert.equal(result.mode, "project_specific_analysis");
  assert.equal(result.diagnostics.contextConfidence > 50, true);
});

test("draft follow-up email scenario always requires approval before sending", () => {
  const result = runConversationalDemoScenario("draft_follow_up_email");
  assert.equal(result.requiresApproval, true);
});

test("billing readiness scenario never falsely asserts readiness for a project pending sign-off", () => {
  const result = runConversationalDemoScenario("billing_readiness");
  assert.doesNotMatch(result.response, /completo — pero la decisión/);
  assert.equal(result.requiresApproval, true);
});

test("governance evidence scenario surfaces missing evidence rather than claiming coverage", () => {
  const result = runConversationalDemoScenario("governance_evidence");
  assert.equal(result.auditRelevant, true);
});

test("audit explanation scenario traces the escalation recommendation for a project with open critical risks", () => {
  const result = runConversationalDemoScenario("audit_explanation");
  assert.equal(result.route, "audit_handler");
  assert.match(result.response, /escalar/i);
});

test("unsupported trivia scenario redirects politely", () => {
  const result = runConversationalDemoScenario("unsupported_trivia");
  assert.equal(result.mode, "unsupported");
  assert.equal(result.requiresApproval, false);
});
