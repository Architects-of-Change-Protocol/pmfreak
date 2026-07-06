/**
 * Sprint 11R — Golden Intent Evaluation Set.
 *
 * Pure, read-only evaluation harness on top of the Sprint 10R adapter/shadow-mode module
 * (`intentCompatibilityAdapter.ts`). This module does not classify anything itself — it takes a
 * corpus of golden cases (see `tests/fixtures/conversational-brain-golden-intents.ts`), runs
 * `runIntentClassifierShadowComparison()` for each one, and compares the result against the
 * recorded expectations to measure how compatible the production and enriched classifiers
 * actually are on realistic PMFreak PM phrasing.
 *
 * Does not call the router, composer, or any handler. Does not touch a database, Supabase, or any
 * external service. Does not activate the enriched classifier in production — there is still no
 * feature flag wired to anything. This is purely an offline measurement tool.
 */

import type { ConversationIntent as ProductionConversationIntent } from "../types";
import type { ConversationIntentFamily as EnrichedConversationIntentFamily } from "@/lib/conversational-brain";

import {
  runIntentClassifierShadowComparison,
  type IntentMappingWarning,
  type ShadowComparisonOptions,
} from "./intentCompatibilityAdapter";

export type GoldenIntentCategory =
  | "general_pm_advice"
  | "project_status"
  | "playbook_analysis"
  | "communication_draft"
  | "closure_billing"
  | "governance_audit"
  | "risk_issue_dependency"
  | "task_action"
  | "decision_support"
  | "ambiguous_or_unknown";

export type GoldenIntentCase = {
  /** Unique identifier within the corpus, e.g. "cb-01". */
  id: string;
  /** Natural-language PM phrase, in Spanish or English, as a real PMFreak user would type it. */
  input: string;
  category: GoldenIntentCategory;
  /** The production classifier's actual output for `input`, recorded at authoring time. */
  expectedProductionIntent: ProductionConversationIntent;
  /** The enriched classifier's actual family for `input`, recorded at authoring time. Optional
   * because some cases only care about the production/mapped comparison. */
  expectedEnrichedFamily?: EnrichedConversationIntentFamily;
  /** What `mapEnrichedIntentToProductionIntent()` actually produces for `input`, recorded at
   * authoring time. */
  expectedMappedIntent: ProductionConversationIntent;
  /** Whether `expectedProductionIntent === expectedMappedIntent` — i.e. whether this case is
   * expected to be a shadow-mode "compatible" observation. Recorded explicitly (rather than
   * derived) so a corpus reviewer can see the claim without recomputing it. */
  shouldBeCompatible: boolean;
  /** Free-text explanation for non-obvious cases — e.g. documented vocabulary overlaps between
   * families, or gaps in one classifier's pattern list relative to the other's. */
  notes?: string;
};

export type GoldenIntentCaseMatches = {
  productionIntent: boolean;
  enrichedFamily: boolean | null;
  mappedIntent: boolean;
  shouldBeCompatible: boolean;
};

export type GoldenIntentCaseResult = {
  id: string;
  category: GoldenIntentCategory;
  input: string;
  notes?: string;
  actual: {
    productionIntent: ProductionConversationIntent;
    enrichedFamily: EnrichedConversationIntentFamily;
    mappedIntent: ProductionConversationIntent;
    compatible: boolean;
    differences: string[];
    migrationWarnings: IntentMappingWarning[];
  };
  expected: {
    productionIntent: ProductionConversationIntent;
    enrichedFamily: EnrichedConversationIntentFamily | undefined;
    mappedIntent: ProductionConversationIntent;
    shouldBeCompatible: boolean;
  };
  /** Whether the live run agrees with each recorded expectation — a `false` here means the golden
   * corpus is stale relative to current classifier behavior (a real regression signal), not that
   * shadow-mode compatibility itself failed. */
  matches: GoldenIntentCaseMatches;
};

export type GoldenIntentCategorySummary = {
  category: GoldenIntentCategory;
  totalCases: number;
  compatibleCount: number;
  incompatibleCount: number;
  compatibilityRate: number;
  expectedMappedIntentPassCount: number;
  expectedMappedIntentFailCount: number;
};

export type GoldenIntentDifference = {
  id: string;
  category: GoldenIntentCategory;
  input: string;
  actualProductionIntent: ProductionConversationIntent;
  actualMappedIntent: ProductionConversationIntent;
  differences: string[];
};

export type GoldenIntentEvaluationSummary = {
  totalCases: number;
  compatibleCount: number;
  incompatibleCount: number;
  /** 0-100, one decimal of precision. */
  compatibilityRate: number;
  expectedMappedIntentPassCount: number;
  expectedMappedIntentFailCount: number;
  byCategory: Record<GoldenIntentCategory, GoldenIntentCategorySummary>;
  /** Deduplicated, human-readable notices: caution-severity migration warnings observed across
   * the corpus, plus drift warnings for any case whose live output no longer matches its recorded
   * `expected*` fields. */
  warnings: string[];
  /** The incompatible cases (production vs. mapped-from-enriched disagree), most-recent-corpus-
   * order, capped to a reasonable review size. */
  topDifferences: GoldenIntentDifference[];
};

export type GoldenIntentEvaluationResult = {
  results: GoldenIntentCaseResult[];
  summary: GoldenIntentEvaluationSummary;
};

const GOLDEN_CATEGORIES: GoldenIntentCategory[] = [
  "general_pm_advice",
  "project_status",
  "playbook_analysis",
  "communication_draft",
  "closure_billing",
  "governance_audit",
  "risk_issue_dependency",
  "task_action",
  "decision_support",
  "ambiguous_or_unknown",
];

const TOP_DIFFERENCES_LIMIT = 25;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyCategorySummary(category: GoldenIntentCategory): GoldenIntentCategorySummary {
  return {
    category,
    totalCases: 0,
    compatibleCount: 0,
    incompatibleCount: 0,
    compatibilityRate: 0,
    expectedMappedIntentPassCount: 0,
    expectedMappedIntentFailCount: 0,
  };
}

/**
 * Runs the Sprint 10R shadow comparison for every case in the corpus and scores each result
 * against its recorded expectations. Pure — never mutates `cases`, never calls the router,
 * composer, handlers, DB, or any external service.
 */
export function runGoldenIntentEvaluation(
  cases: GoldenIntentCase[],
  options: ShadowComparisonOptions = {},
): GoldenIntentEvaluationResult {
  const results: GoldenIntentCaseResult[] = cases.map((goldenCase) => {
    const shadow = runIntentClassifierShadowComparison(
      { workspaceId: "golden-eval", userId: "golden-eval", message: goldenCase.input },
      options,
    );

    const actual = {
      productionIntent: shadow.productionIntent,
      enrichedFamily: shadow.enrichedIntent.intentFamily,
      mappedIntent: shadow.mappedIntent,
      compatible: shadow.compatible,
      differences: shadow.differences,
      migrationWarnings: shadow.migrationWarnings,
    };

    const matches: GoldenIntentCaseMatches = {
      productionIntent: actual.productionIntent === goldenCase.expectedProductionIntent,
      enrichedFamily:
        goldenCase.expectedEnrichedFamily === undefined
          ? null
          : actual.enrichedFamily === goldenCase.expectedEnrichedFamily,
      mappedIntent: actual.mappedIntent === goldenCase.expectedMappedIntent,
      shouldBeCompatible: actual.compatible === goldenCase.shouldBeCompatible,
    };

    return {
      id: goldenCase.id,
      category: goldenCase.category,
      input: goldenCase.input,
      notes: goldenCase.notes,
      actual,
      expected: {
        productionIntent: goldenCase.expectedProductionIntent,
        enrichedFamily: goldenCase.expectedEnrichedFamily,
        mappedIntent: goldenCase.expectedMappedIntent,
        shouldBeCompatible: goldenCase.shouldBeCompatible,
      },
      matches,
    };
  });

  const byCategory: Record<GoldenIntentCategory, GoldenIntentCategorySummary> = Object.fromEntries(
    GOLDEN_CATEGORIES.map((category) => [category, emptyCategorySummary(category)]),
  ) as Record<GoldenIntentCategory, GoldenIntentCategorySummary>;

  let compatibleCount = 0;
  let expectedMappedIntentPassCount = 0;
  const warningSet = new Map<string, string>();
  const topDifferences: GoldenIntentDifference[] = [];

  for (const result of results) {
    const categorySummary = byCategory[result.category];
    categorySummary.totalCases += 1;

    if (result.actual.compatible) {
      compatibleCount += 1;
      categorySummary.compatibleCount += 1;
    } else {
      categorySummary.incompatibleCount += 1;
      if (topDifferences.length < TOP_DIFFERENCES_LIMIT) {
        topDifferences.push({
          id: result.id,
          category: result.category,
          input: result.input,
          actualProductionIntent: result.actual.productionIntent,
          actualMappedIntent: result.actual.mappedIntent,
          differences: result.actual.differences,
        });
      }
    }

    if (result.matches.mappedIntent) {
      expectedMappedIntentPassCount += 1;
      categorySummary.expectedMappedIntentPassCount += 1;
    } else {
      categorySummary.expectedMappedIntentFailCount += 1;
      warningSet.set(
        `drift:${result.id}`,
        `Case "${result.id}" (${result.category}): live mappedIntent="${result.actual.mappedIntent}" no longer matches ` +
          `the corpus's recorded expectedMappedIntent="${result.expected.mappedIntent}" — the golden corpus may be stale ` +
          "relative to a classifier/adapter change.",
      );
    }

    if (!result.matches.productionIntent) {
      warningSet.set(
        `drift-production:${result.id}`,
        `Case "${result.id}" (${result.category}): live productionIntent="${result.actual.productionIntent}" no longer ` +
          `matches the corpus's recorded expectedProductionIntent="${result.expected.productionIntent}".`,
      );
    }

    for (const warning of result.actual.migrationWarnings) {
      if (warning.severity === "caution") {
        warningSet.set(`${warning.code}`, `${warning.code}: ${warning.message}`);
      }
    }
  }

  for (const category of GOLDEN_CATEGORIES) {
    const categorySummary = byCategory[category];
    categorySummary.compatibilityRate =
      categorySummary.totalCases > 0 ? round1((categorySummary.compatibleCount / categorySummary.totalCases) * 100) : 0;
  }

  const totalCases = results.length;
  const incompatibleCount = totalCases - compatibleCount;
  const compatibilityRate = totalCases > 0 ? round1((compatibleCount / totalCases) * 100) : 0;

  const summary: GoldenIntentEvaluationSummary = {
    totalCases,
    compatibleCount,
    incompatibleCount,
    compatibilityRate,
    expectedMappedIntentPassCount,
    expectedMappedIntentFailCount: totalCases - expectedMappedIntentPassCount,
    byCategory,
    warnings: Array.from(warningSet.values()),
    topDifferences,
  };

  return { results, summary };
}

export type GoldenIntentThresholdBand = "staging_candidate" | "needs_adjustment" | "not_ready";

export type GoldenIntentSummaryReport = {
  overall: {
    totalCases: number;
    compatibleCount: number;
    incompatibleCount: number;
    compatibilityRate: number;
    expectedMappedIntentPassCount: number;
    expectedMappedIntentFailCount: number;
    thresholdBand: GoldenIntentThresholdBand;
    recommendation: string;
  };
  byCategory: GoldenIntentCategorySummary[];
  incompatibleCases: GoldenIntentCaseResult[];
  casesWithWarnings: GoldenIntentCaseResult[];
  productionUnsupportedButEnrichedDetected: GoldenIntentCaseResult[];
  enrichedUnknownButProductionDetected: GoldenIntentCaseResult[];
  topDifferences: GoldenIntentDifference[];
};

/**
 * Soft threshold bands (see docs/conversational-brain-pipeline-reconciliation.md, Sprint 11R
 * section, and docs/conversational-brain-golden-intent-evaluation.md). These are documentation and
 * reporting only — nothing in this module or its tests fails a build because of a low
 * `compatibilityRate`. The only failures this evaluation should ever produce are structural (a
 * case crashing the shadow comparison, a malformed corpus, etc.).
 */
function thresholdBandFor(compatibilityRate: number): GoldenIntentThresholdBand {
  if (compatibilityRate >= 85) return "staging_candidate";
  if (compatibilityRate >= 70) return "needs_adjustment";
  return "not_ready";
}

function recommendationFor(band: GoldenIntentThresholdBand): string {
  switch (band) {
    case "staging_candidate":
      return "compatibilityRate >= 85%: reasonable candidate to start a staging shadow-mode capture (Sprint 10R PR 6).";
    case "needs_adjustment":
      return "compatibilityRate 70%-84%: mapping table or classifier pattern lists need adjustment before proposing a feature flag.";
    case "not_ready":
      return "compatibilityRate < 70%: do not integrate yet — resolve recurring incompatible categories first.";
  }
}

/**
 * Turns a `runGoldenIntentEvaluation()` result into a review-ready report: global + per-category
 * summaries, the incompatible cases, cases carrying caution-level warnings, and the two specific
 * "one classifier saw something, the other didn't" slices called out in the Sprint 11R spec. Pure
 * — takes an already-computed evaluation result rather than re-running anything.
 */
export function summarizeGoldenIntentEvaluation(evaluation: GoldenIntentEvaluationResult): GoldenIntentSummaryReport {
  const { results, summary } = evaluation;

  const incompatibleCases = results.filter((r) => !r.actual.compatible);
  const casesWithWarnings = results.filter((r) => r.actual.migrationWarnings.length > 0);
  const productionUnsupportedButEnrichedDetected = results.filter(
    (r) => r.actual.productionIntent === "unsupported" && r.actual.enrichedFamily !== "unknown",
  );
  const enrichedUnknownButProductionDetected = results.filter(
    (r) =>
      r.actual.enrichedFamily === "unknown" &&
      r.actual.productionIntent !== "unsupported" &&
      r.actual.productionIntent !== "unknown" &&
      r.actual.productionIntent !== "clarification",
  );

  const band = thresholdBandFor(summary.compatibilityRate);

  return {
    overall: {
      totalCases: summary.totalCases,
      compatibleCount: summary.compatibleCount,
      incompatibleCount: summary.incompatibleCount,
      compatibilityRate: summary.compatibilityRate,
      expectedMappedIntentPassCount: summary.expectedMappedIntentPassCount,
      expectedMappedIntentFailCount: summary.expectedMappedIntentFailCount,
      thresholdBand: band,
      recommendation: recommendationFor(band),
    },
    byCategory: GOLDEN_CATEGORIES.map((category) => summary.byCategory[category]),
    incompatibleCases,
    casesWithWarnings,
    productionUnsupportedButEnrichedDetected,
    enrichedUnknownButProductionDetected,
    topDifferences: summary.topDifferences,
  };
}

export type IntentGoldenEvaluationExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  categories: GoldenIntentCategory[];
  thresholdBands: Array<{ band: GoldenIntentThresholdBand; range: string; meaning: string }>;
  integrationCriteria: string[];
};

/**
 * Capability explanation for the Sprint 11R golden evaluation module — mirrors the style of
 * `explainIntentCompatibilityMapping()` (Sprint 10R) and `explainIntentClassifierCapability()`
 * (Sprint 9). See docs/conversational-brain-pipeline-reconciliation.md (Sprint 11R section) and
 * docs/conversational-brain-golden-intent-evaluation.md for full context.
 */
export function explainGoldenIntentEvaluation(): IntentGoldenEvaluationExplain {
  return {
    capability: "playbook-engine-conversation-intent-golden-evaluation",
    purpose:
      "Measures real compatibility between the production playbook-engine/conversation classifier and the enriched " +
      "conversational-brain classifier over a golden corpus of realistic PMFreak PM phrasing, without changing " +
      "production behavior or activating the enriched classifier anywhere.",
    doesNot: [
      "Does not replace, call, or modify classifier/intentClassifier.ts.",
      "Does not touch router/brainRouter.ts, composer/responseComposer.ts, or any handlers/*.ts.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or emit audit events.",
      "Does not activate the enriched classifier in production — there is still no feature flag wired to anything.",
      "Does not fail a build or test suite because of a low compatibilityRate — only structural corpus/evaluation " +
        "errors should do that.",
    ],
    categories: GOLDEN_CATEGORIES,
    thresholdBands: [
      {
        band: "staging_candidate",
        range: ">= 85%",
        meaning: "Reasonable candidate to start a staging shadow-mode capture (Sprint 10R PR 6).",
      },
      {
        band: "needs_adjustment",
        range: "70% - 84%",
        meaning: "Requires mapping-table or classifier pattern adjustments before proposing a feature flag.",
      },
      {
        band: "not_ready",
        range: "< 70%",
        meaning: "Do not integrate yet — resolve recurring incompatible categories first.",
      },
    ],
    integrationCriteria: [
      "A category should not move toward integration while its own compatibilityRate sits in the not_ready band.",
      "Any recurring incompatible case is resolved by updating the adapter's mapping table or a classifier's pattern " +
        "list (not by changing production router/handler behavior) until a dedicated integration PR is scoped.",
      "Sprint 12R scoping should start from `topDifferences` and `byCategory`, prioritizing categories with the " +
        "largest gap between compatibilityRate and the 85% staging threshold.",
    ],
  };
}
