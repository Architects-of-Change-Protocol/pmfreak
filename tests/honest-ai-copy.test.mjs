/**
 * Pilot Gate Sprint 01 — Task 6 (M-02 / ERR-02, honest AI experience).
 *
 * Verified surface classification (per the independent review errata and
 * re-verified at HEAD in this sprint):
 *   - Command Center chat  → deterministic rule-based gateway (no LLM)
 *   - First Insight brief  → deterministic engine over onboarding answers
 *   - Onboarding transition → fixed-duration animation (no analysis at all)
 *   - Copilot (/api/copilot) → REAL LLM inference (may claim AI)
 *
 * These tests pin the honest-labeling decisions so copy regressions that
 * re-promise AI on deterministic surfaces fail CI.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

test("command-center chat route remains deterministic (no LLM imports)", () => {
  const routeSrc = read("src/app/api/command-center/chat/route.ts");
  assert.ok(!/runInference|openai-provider|OPENAI_API_KEY/.test(routeSrc),
    "chat route now touches LLM inference — update the chat disclosure copy and this test together");
});

test("command-center chat input discloses the deterministic nature", () => {
  const src = read("src/features/command-center/command-feed.tsx");
  assert.ok(src.includes("chat-determinism-disclosure"), "determinism disclosure removed from chat input");
  assert.ok(/deterministic rules/.test(src), "disclosure copy must say responses are rule-based");
  assert.ok(!/Ask this project anything/.test(src), "open-ended placeholder implies generative AI");
});

test("onboarding transition copy does not claim live analysis or AI activation", () => {
  const src = read("src/components/pmfreak/onboarding/AIActivationTransition.tsx");
  for (const banned of [
    /Analyzing stakeholder structure/,
    /Activating PMFreak agents/,
    /Operational intelligence (?:layer|active)/,
    /Calibrating project intelligence/,
  ]) {
    assert.ok(!banned.test(src), `transition copy claims analysis that never runs: ${banned}`);
  }
});

test("getting-started flow does not promise AI sensing/detection on deterministic paths", () => {
  const src = read("src/components/pmfreak/activation/getting-started-flow.tsx");
  for (const banned of [
    /sensing stakeholder confidence drift/,
    /detection accuracy/,
    /calibrate escalation sensitivity/,
    /Agents are sleeping/,
  ]) {
    assert.ok(!banned.test(src), `getting-started copy overstates AI capability: ${banned}`);
  }
});

test("first-insight brief engine remains deterministic (no LLM imports)", () => {
  const src = read("src/lib/projects/first-insight/operational-governance-brief-engine.ts");
  assert.ok(!/runInference|openai|OPENAI_API_KEY/i.test(src),
    "first-insight engine now uses inference — revisit brief labeling copy and this test together");
});
