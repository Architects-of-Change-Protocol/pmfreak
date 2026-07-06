/**
 * Sprint 10R — Intent Compatibility Adapter + Shadow Mode.
 *
 * Pure, read-only bridge between the two conversation intent classifiers that currently coexist
 * in this repo (see `docs/conversational-brain-pipeline-reconciliation.md`, Sprint 9R):
 *
 *  - Production: `classifier/intentClassifier.ts` (this directory) — flat `ConversationIntent`
 *    string union, wired to `POST /api/command-center/chat` via the gateway/router/composer/
 *    handlers in this package.
 *  - Enriched: `@/lib/conversational-brain` (Sprint 9) — structured family+type classifier with
 *    declarative flags, not wired to production anywhere.
 *
 * This module does not replace, wrap, or call the router/composer/handlers, does not change what
 * `runConversationalBrainGateway()` returns, and is not imported by any production wiring. It only
 * (a) maps an enriched classification onto the closest production-compatible intent value, and
 * (b) runs both classifiers side by side for observation/comparison ("shadow mode"). Nothing here
 * touches a database, calls an external service, or produces audit events.
 */

import type { ConversationIntent as ProductionConversationIntent, IntentClassification } from "../types";
import { classifyConversationIntent as classifyProductionIntent } from "./intentClassifier";

import type {
  ClassifyIntentOptions,
  ConversationIntent as EnrichedConversationIntent,
  NormalizedConversationInput,
} from "@/lib/conversational-brain";
import { classifyConversationIntent as classifyEnrichedIntent } from "@/lib/conversational-brain";

export type { ProductionConversationIntent, EnrichedConversationIntent };

export type IntentMappingWarningSeverity = "info" | "caution";

export type IntentMappingWarning = {
  code: string;
  message: string;
  severity: IntentMappingWarningSeverity;
};

export type IntentCompatibilityResult = {
  /** The production-compatible intent value the enriched classification maps onto. */
  productionIntent: ProductionConversationIntent;
  sourceFamily: EnrichedConversationIntent["intentFamily"];
  sourceIntentType: EnrichedConversationIntent["intentType"];
  /** Human-readable description of which mapping rule fired, for logs/debugging. */
  mappingRule: string;
  warnings: IntentMappingWarning[];
};

export type IntentShadowComparison = {
  productionIntent: ProductionConversationIntent;
  enrichedIntent: EnrichedConversationIntent;
  mappedIntent: ProductionConversationIntent;
  /** True when the production classifier's own output already matches the mapped-from-enriched value. */
  compatible: boolean;
  differences: string[];
  migrationWarnings: IntentMappingWarning[];
};

/**
 * Maps a single enriched (`conversational-brain`) classification onto the closest production
 * (`playbook-engine/conversation`) intent value. Pure function — no side effects.
 *
 * Mapping table (see Sprint 10R section of `docs/conversational-brain-pipeline-reconciliation.md`
 * for the full rationale of every documented decision below):
 *
 *  - general_pm_advice                          -> general_pm_advice
 *  - project_status                             -> project_status_question
 *  - playbook_analysis                          -> recommendation_request
 *  - risk_issue_dependency                      -> risk_analysis
 *  - communication_draft                        -> communication_draft
 *  - closure_billing + billing_*                -> billing_question
 *  - closure_billing + closure_* / reception_* / acceptance_* -> closure_question
 *  - governance_audit + audit_trail_request/recommendation_explanation/why_recommended_request -> audit_question
 *  - governance_audit + evidence_request (or unmatched) -> governance_question
 *  - task_action                                -> task_or_action_request
 *  - decision_support                           -> unsupported (documented decision, no production equivalent)
 *  - unknown                                    -> unsupported
 *  - needs_clarification                        -> general_pm_advice (documented decision)
 */
export function mapEnrichedIntentToProductionIntent(
  enrichedIntent: EnrichedConversationIntent,
): IntentCompatibilityResult {
  const { intentFamily, intentType } = enrichedIntent;
  const warnings: IntentMappingWarning[] = [];
  let productionIntent: ProductionConversationIntent;
  let mappingRule: string;

  switch (intentFamily) {
    case "general_pm_advice":
      productionIntent = "general_pm_advice";
      mappingRule = "Direct 1:1 family mapping (general_pm_advice -> general_pm_advice).";
      break;

    case "project_status":
      productionIntent = "project_status_question";
      mappingRule =
        "Direct family mapping (project_status -> project_status_question); production's projectStatusHandler " +
        "does not yet branch on the summary/health/timeline/blockers subtypes B distinguishes.";
      break;

    case "playbook_analysis":
      productionIntent = "recommendation_request";
      mappingRule = "Direct family mapping (playbook_analysis -> recommendation_request) per the Sprint 10R initial table.";
      warnings.push({
        code: "playbook_analysis_audit_overlap_risk",
        message:
          "playbook_rule_explanation / governed_next_action_request subtypes may semantically overlap with " +
          "governance_audit in production (documented as 'Alto riesgo' in the Sprint 9R reconciliation doc, §3). " +
          "This flat mapping is a documented simplification for shadow mode, not a disambiguation.",
        severity: "caution",
      });
      break;

    case "risk_issue_dependency":
      productionIntent = "risk_analysis";
      mappingRule =
        "Direct family mapping (risk_issue_dependency -> risk_analysis); production's riskHandler does not yet " +
        "branch on the issue_check/dependency_check/blocker_check subtypes B distinguishes.";
      break;

    case "communication_draft":
      productionIntent = "communication_draft";
      mappingRule = "Direct family mapping (communication_draft -> communication_draft), regardless of subtype.";
      break;

    case "closure_billing": {
      if (intentType.startsWith("billing_")) {
        productionIntent = "billing_question";
        mappingRule = `closure_billing/${intentType} -> billing_question (billing_* subtype).`;
      } else {
        productionIntent = "closure_question";
        mappingRule = `closure_billing/${intentType} -> closure_question (closure_* subtype, or documented fallback).`;
        if (intentType === "reception_status_check" || intentType === "acceptance_status_check") {
          warnings.push({
            code: "closure_billing_subtype_not_billing_or_closure_prefixed",
            message:
              `${intentType} does not literally start with "billing_" or "closure_" from the Sprint 10R mapping ` +
              "table. Documented decision: mapped to closure_question as the closer lifecycle fit — production's " +
              "closureBillingHandler already treats reception/acceptance readiness as part of the closure " +
              "assessment, not a billing question.",
            severity: "info",
          });
        }
      }
      break;
    }

    case "governance_audit": {
      if (
        intentType === "audit_trail_request" ||
        intentType === "recommendation_explanation" ||
        intentType === "why_recommended_request"
      ) {
        productionIntent = "audit_question";
        mappingRule = `governance_audit/${intentType} -> audit_question.`;
      } else {
        productionIntent = "governance_question";
        mappingRule = `governance_audit/${intentType} -> governance_question (evidence_request, or unmatched subtype default).`;
        if (intentType !== "evidence_request") {
          warnings.push({
            code: "governance_audit_unmatched_subtype_default",
            message:
              `governance_audit/${intentType} did not match a known audit_* subtype; defaulted to governance_question ` +
              "as the safer of the two production intents (governanceHandler never asserts unavailable evidence).",
            severity: "info",
          });
        }
      }
      break;
    }

    case "task_action":
      productionIntent = "task_or_action_request";
      mappingRule = "Direct family mapping (task_action -> task_or_action_request).";
      break;

    case "decision_support":
      productionIntent = "unsupported";
      mappingRule =
        "decision_support has no production intent, route, or handler yet (see reconciliation doc §3/§6, PR3 " +
        "candidate). Documented decision: mapped to unsupported rather than governance_question, to avoid " +
        "misrepresenting an unanswered 'what decision is needed' as a governance/evidence answer.";
      warnings.push({
        code: "decision_support_no_production_equivalent",
        message:
          "decision_support is a genuinely new family with no production equivalent. Mapped to 'unsupported' as " +
          "the safest default until a dedicated handler exists — this is a known, tracked gap, not a bug.",
        severity: "caution",
      });
      break;

    case "unknown":
      productionIntent = "unsupported";
      mappingRule =
        "unknown -> unsupported (documented default). Note: production's own router can still fall back from " +
        "'unknown' to general_pm_advisor via the WEAK_PM_SIGNAL heuristic in brainRouter.ts — that fallback lives " +
        "at the routing layer, not the classifier layer, so it is intentionally not reproduced here.";
      break;

    case "needs_clarification":
      productionIntent = "general_pm_advice";
      mappingRule =
        "needs_clarification -> general_pm_advice (documented decision): production's own 'clarification' intent " +
        "is already routed to general_pm_advisor (see DIRECT_ROUTES in brainRouter.ts), so mapping to " +
        "general_pm_advice preserves that behavioral equivalence without introducing a new legacy intent value.";
      warnings.push({
        code: "needs_clarification_mapped_to_general_pm_advice",
        message:
          "needs_clarification is mapped to general_pm_advice rather than 'unsupported' because production's " +
          "clarification fallback already resolves to the same general_pm_advisor handler; treating it as " +
          "unsupported would be a stricter behavior change than production's current fallback.",
        severity: "info",
      });
      break;

    default: {
      const exhaustiveCheck: never = intentFamily;
      throw new Error(`intentCompatibilityAdapter: unmapped enriched intent family '${String(exhaustiveCheck)}'.`);
    }
  }

  return { productionIntent, sourceFamily: intentFamily, sourceIntentType: intentType, mappingRule, warnings };
}

/**
 * Compares an already-computed production classification against an already-computed enriched
 * classification (mapped onto the production model). Pure — takes both results as input rather
 * than running either classifier itself. Never routes, composes, persists, or emits audit events.
 */
export function compareProductionAndEnrichedIntent(input: {
  productionClassification: IntentClassification;
  enrichedIntent: EnrichedConversationIntent;
}): IntentShadowComparison {
  const { productionClassification, enrichedIntent } = input;
  const mapping = mapEnrichedIntentToProductionIntent(enrichedIntent);
  const compatible = productionClassification.intent === mapping.productionIntent;

  const differences: string[] = [];
  const migrationWarnings: IntentMappingWarning[] = [...mapping.warnings];

  if (!compatible) {
    differences.push(
      `production classifier returned "${productionClassification.intent}", but the enriched classifier ` +
        `(${enrichedIntent.intentFamily}/${enrichedIntent.intentType}) maps to "${mapping.productionIntent}".`,
    );
    migrationWarnings.push({
      code: "production_enriched_mismatch",
      message:
        `Divergence detected for this turn: production="${productionClassification.intent}", ` +
        `mapped-from-enriched="${mapping.productionIntent}". This is a shadow-mode observation only — no routing ` +
        "decision was changed.",
      severity: "caution",
    });
  }

  return {
    productionIntent: productionClassification.intent,
    enrichedIntent,
    mappedIntent: mapping.productionIntent,
    compatible,
    differences,
    migrationWarnings,
  };
}

export type ShadowComparisonOptions = ClassifyIntentOptions;

/**
 * Shadow mode entry point: runs the production classifier and the enriched classifier against the
 * same normalized turn, maps the enriched result onto the production model, and returns a
 * side-by-side comparison. Never changes real chat behavior — it doesn't call the gateway, router,
 * composer, or any handler, and it doesn't read/write a database or emit audit events. Safe to call
 * from a script, test, or diagnostic-only code path alongside production traffic without affecting
 * the response the user receives.
 */
export function runIntentClassifierShadowComparison(
  input: NormalizedConversationInput,
  options: ShadowComparisonOptions = {},
): IntentShadowComparison {
  const productionClassification = classifyProductionIntent(input.message ?? "");
  const { intent: enrichedIntent } = classifyEnrichedIntent(input, options);

  return compareProductionAndEnrichedIntent({ productionClassification, enrichedIntent });
}

export type IntentCompatibilityMappingExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  mappingTable: Array<{ enrichedFamily: string; productionIntent: string; rule: string }>;
  documentedDecisions: string[];
  integrationCriteria: string[];
  remainingRisks: string[];
};

/**
 * Capability explanation for the Sprint 10R adapter/shadow-mode module — mirrors the style of
 * `explainIntentClassifierCapability()` (Sprint 9) and `explainPlaybookEngineCapability()`. See
 * `docs/conversational-brain-pipeline-reconciliation.md` (Sprint 10R section) for full context.
 */
export function explainIntentCompatibilityMapping(): IntentCompatibilityMappingExplain {
  return {
    capability: "playbook-engine-conversation-intent-compatibility-adapter",
    purpose:
      "Maps the enriched conversational-brain intent classification (family + type) onto the production " +
      "playbook-engine/conversation ConversationIntent model, and runs both classifiers side by side in shadow " +
      "mode for observation, without changing what the real chat endpoint returns.",
    doesNot: [
      "Does not replace, call, or modify classifier/intentClassifier.ts (production classifier stays the source of truth).",
      "Does not touch router/brainRouter.ts, composer/responseComposer.ts, or any handlers/*.ts.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or emit audit events.",
      "Does not activate the enriched classifier in production — there is no feature flag wired to anything yet.",
    ],
    mappingTable: [
      { enrichedFamily: "general_pm_advice", productionIntent: "general_pm_advice", rule: "Direct 1:1." },
      { enrichedFamily: "project_status", productionIntent: "project_status_question", rule: "Direct family mapping." },
      { enrichedFamily: "playbook_analysis", productionIntent: "recommendation_request", rule: "Direct family mapping." },
      { enrichedFamily: "risk_issue_dependency", productionIntent: "risk_analysis", rule: "Direct family mapping." },
      { enrichedFamily: "communication_draft", productionIntent: "communication_draft", rule: "Direct family mapping." },
      { enrichedFamily: "closure_billing (billing_*)", productionIntent: "billing_question", rule: "Prefix match on intentType." },
      {
        enrichedFamily: "closure_billing (closure_* / reception_* / acceptance_*)",
        productionIntent: "closure_question",
        rule: "Documented fallback for non-billing subtypes.",
      },
      {
        enrichedFamily: "governance_audit (audit_trail_request/recommendation_explanation/why_recommended_request)",
        productionIntent: "audit_question",
        rule: "Subtype match.",
      },
      {
        enrichedFamily: "governance_audit (evidence_request/unmatched)",
        productionIntent: "governance_question",
        rule: "Documented default.",
      },
      { enrichedFamily: "task_action", productionIntent: "task_or_action_request", rule: "Direct family mapping." },
      {
        enrichedFamily: "decision_support",
        productionIntent: "unsupported",
        rule: "Documented decision — no production equivalent yet.",
      },
      { enrichedFamily: "unknown", productionIntent: "unsupported", rule: "Documented default." },
      {
        enrichedFamily: "needs_clarification",
        productionIntent: "general_pm_advice",
        rule: "Documented decision — matches production's own clarification->general_pm_advisor routing.",
      },
    ],
    documentedDecisions: [
      "decision_support -> unsupported (not governance_question): avoids implying an evidence/audit answer for a family production cannot yet answer.",
      "needs_clarification -> general_pm_advice (not unsupported): mirrors production's existing clarification->general_pm_advisor route.",
      "closure_billing reception_status_check/acceptance_status_check -> closure_question: treated as closure-lifecycle subtypes, not billing.",
      "governance_audit unmatched subtypes default to governance_question, the less assertive of the two production intents.",
    ],
    integrationCriteria: [
      "Shadow comparisons must show a stable, near-100% compatible rate across the existing intent-classifier test corpora before any router/handler change is proposed.",
      "Any recurring incompatible case must be resolved by updating this mapping table (not by changing production behavior) until a dedicated integration PR is scoped.",
      "Wiring the enriched classifier into the real router (reconciliation doc §6, PR 6/PR 7) requires a feature flag, defaulting off, and this adapter's shadow comparison passing in staging first.",
    ],
    remainingRisks: [
      "playbook_analysis -> recommendation_request flat mapping may hide real overlap with governance_audit/audit_question for messages like '¿por qué el playbook recomienda esto?' (see reconciliation doc §3).",
      "decision_support has no production handler at all — every shadow comparison for that family will report a mapped intent ('unsupported') that no human-authored handler content backs yet.",
      "This adapter has its own test suite (this file's tests) but is not covered by the production intent-classifier regression suite; a future integration PR should reuse both corpora together before any router change.",
    ],
  };
}
