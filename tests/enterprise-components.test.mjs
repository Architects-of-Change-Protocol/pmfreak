import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

// No React Testing Library / jsdom exists in this repo (confirmed during PR9
// planning) — these are source-conformance tests against the seven
// Enterprise Components' documented, binding behavior
// (08-design-system.md §3, 08-ai-interaction-patterns.md,
// 08-accessibility-guidelines.md), the same style already used for
// source-level contract verification elsewhere in this suite.

const riskBadge = readFileSync("src/platform/components/RiskBadge.tsx", "utf8");
const healthIndicator = readFileSync("src/platform/components/HealthIndicator.tsx", "utf8");
const confidenceScore = readFileSync("src/platform/components/ConfidenceScore.tsx", "utf8");
const decisionCard = readFileSync("src/platform/components/DecisionCard.tsx", "utf8");
const evidenceViewer = readFileSync("src/platform/components/EvidenceViewer.tsx", "utf8");
const agentStatus = readFileSync("src/platform/components/AgentStatus.tsx", "utf8");
const approvalFlow = readFileSync("src/platform/components/ApprovalFlow.tsx", "utf8");

describe("color independence (08-accessibility-guidelines.md §4)", () => {
  test("RiskBadge always renders an icon and a text label alongside its color", () => {
    assert.match(riskBadge, /aria-hidden="true">\{config\.icon\}/);
    assert.match(riskBadge, /\{label \?\? config\.label\}/);
  });

  test("HealthIndicator always co-renders the numeric percentage with the qualitative band text", () => {
    assert.match(healthIndicator, /\{clamped\}%/);
    assert.match(healthIndicator, /\{config\.label\}/);
  });

  test("ConfidenceScore is never color-coded — it renders a number and a basis string only", () => {
    assert.doesNotMatch(confidenceScore, /pmf-severity|backgroundColor|borderColor/);
    assert.match(confidenceScore, /basis/);
  });
});

describe("Decision and Recommendation composition (08-ai-interaction-patterns.md)", () => {
  test("DecisionCard renders all five parts: Problem, AI Analysis, Recommendation, Impact, Evidence+Approval", () => {
    for (const heading of ["Problem", "AI Analysis", "Recommendation", "Impact", "Approval"]) {
      assert.match(decisionCard, new RegExp(heading));
    }
    assert.match(decisionCard, /evidenceHref/);
  });

  test("DecisionCard never dispatches a Command itself — approval actions are passed in as a prop", () => {
    assert.match(decisionCard, /approvalActions\?:\s*ReactNode/);
    assert.doesNotMatch(decisionCard, /fetch\(|await (approve|reject)/);
  });
});

describe("Evidence Panel (08-ai-interaction-patterns.md §5)", () => {
  test("EvidenceViewer renders all required sections and conditionally omits Agent Reasoning when absent", () => {
    for (const heading of ["Source Documents", "Historical Data", "Metrics", "Agent Reasoning", "Confidence"]) {
      assert.match(evidenceViewer, new RegExp(heading));
    }
    assert.match(evidenceViewer, /agentReasoning \? \(/);
  });

  test("EvidenceViewer never inlines a full source document — every source is a link", () => {
    assert.match(evidenceViewer, /<a href=\{doc\.href\}/);
    assert.doesNotMatch(evidenceViewer, /dangerouslySetInnerHTML/);
  });
});

describe("AgentStatus (08-ai-interaction-patterns.md §4)", () => {
  test("AgentStatus links to the Agent Run rather than inlining full run detail", () => {
    assert.match(agentStatus, /href=\{lastRun\.href\}/);
    assert.doesNotMatch(agentStatus, /run\.actions|run\.output/);
  });
});

describe("ApprovalFlow (08-ai-interaction-patterns.md §6, 08-accessibility-guidelines.md §2-3)", () => {
  test("requires confirmation before submitting either action", () => {
    assert.match(approvalFlow, /requestConfirmation/);
    assert.match(approvalFlow, /role="dialog"/);
    assert.match(approvalFlow, /aria-modal="true"/);
  });

  test("traps focus within the confirmation dialog and closes on Escape", () => {
    assert.match(approvalFlow, /event\.key === "Escape"/);
    assert.match(approvalFlow, /event\.key !== "Tab"/);
  });

  test("announces pending/success/error state via an ARIA live region, not only a disabled button", () => {
    assert.match(approvalFlow, /role="status" aria-live="polite"/);
    assert.match(approvalFlow, /"submitting"|"succeeded"|"failed"/);
  });

  test("restores focus to the triggering control when the dialog is dismissed", () => {
    assert.match(approvalFlow, /triggerRef\.current\?\.focus\(\)/);
  });
});
