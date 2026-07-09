import { PMFREAK_AOC_GATE_RESULT_UI_ID } from "./pmfreak-aoc-gate-result-ui-constants";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import { createPMFreakAocGateResultUIActionHints } from "./pmfreak-aoc-gate-result-ui-action-hint";
import type { PMFreakAocGateResultUIActionHint } from "./pmfreak-aoc-gate-result-ui-action-hint";
import { createPMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import type { PMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import { assertNoPMFreakAocGateResultUIOverclaim } from "./pmfreak-aoc-gate-result-ui-claim-safety";
import { createPMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import type { PMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import { createPMFreakAocGateRequirementListViewModel } from "./pmfreak-aoc-gate-result-ui-requirement-list";
import type { PMFreakAocGateRequirementListViewModel } from "./pmfreak-aoc-gate-result-ui-requirement-list";
import { redactPMFreakAocGateResultUIValue } from "./pmfreak-aoc-gate-result-ui-redaction";
import { createPMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";
import type { PMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";
import { createPMFreakAocGateTraceViewModel } from "./pmfreak-aoc-gate-result-ui-trace-view-model";
import type { PMFreakAocGateTraceViewModel } from "./pmfreak-aoc-gate-result-ui-trace-view-model";

export type PMFreakAocGateResultUIDisplayModel = {
  displayModelId: string;
  featureId: string;

  resultId: string;
  gateId: string;

  title: string;
  subtitle: string;

  badge: PMFreakAocGateResultUIBadge;

  verdict: PMFreakAocGovernedActionGateVerdict;
  canProceed: boolean;

  primaryMessage: string;
  secondaryMessage: string;
  safeNextStep: string;

  requirementList: PMFreakAocGateRequirementListViewModel;
  trace: PMFreakAocGateTraceViewModel;
  safetyDisclaimer: PMFreakAocGateSafetyDisclaimerViewModel;

  warnings: string[];
  errors: string[];
  safeLabels: string[];

  actionHints: PMFreakAocGateResultUIActionHint[];

  presentationOnly: true;
  actionExecutionCapable: false;
  mutationCapable: false;
  writebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
};

export type PMFreakAocGateResultUIDisplayModelInput = {
  result: PMFreakAocGovernedActionGateResult;
  config?: Partial<PMFreakAocGateResultUIConfig>;
};

// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

const SECONDARY_MESSAGE_CAN_PROCEED = "This proposed action can proceed based on the current AOC governance gate evaluation.";
const SECONDARY_MESSAGE_CANNOT_PROCEED = "This proposed action cannot proceed until the requirements above are satisfied.";

// Pure, deterministic view-model construction from an already-computed
// gate result. Only surfaces the result's own safe fields — no raw
// metadata or secrets, and no execution/mutation/writeback claims. Never
// mutates `input.result`.
export function createPMFreakAocGateResultUIDisplayModel(input: PMFreakAocGateResultUIDisplayModelInput): PMFreakAocGateResultUIDisplayModel {
  const { result } = input;
  const config = createPMFreakAocGateResultUIConfig(input.config);

  const badge = createPMFreakAocGateResultUIBadge(result);
  const requirementList = createPMFreakAocGateRequirementListViewModel(result);
  const trace = createPMFreakAocGateTraceViewModel(result);
  const safetyDisclaimer = createPMFreakAocGateSafetyDisclaimerViewModel(result);
  const actionHints = createPMFreakAocGateResultUIActionHints(result);

  const subtitle = result.actionTitle
    ? `Proposed action: ${result.actionTitle}`
    : `AOC governed action gate result for request ${result.requestId ?? "unspecified"}`;

  // Only free-text fields sourced from the governance response (warnings/
  // errors) are redacted here. Deterministic identifiers, labels and
  // fixed-copy strings (title/subtitle/badge/safeNextStep/etc.) are
  // intentionally left untouched: the redaction module's secret-like-token
  // pattern matches long hyphenated strings, which would otherwise corrupt
  // legitimate deterministic IDs.
  const redactedWarnings = redactPMFreakAocGateResultUIValue([...result.warnings], config.redactionMode) as string[];
  const redactedErrors = redactPMFreakAocGateResultUIValue([...result.errors], config.redactionMode) as string[];

  const candidate: PMFreakAocGateResultUIDisplayModel = {
    displayModelId: `pmfreak.aoc.gate.ui.display.${toSafeIdSegment(result.gateResultId)}.v1`,
    featureId: PMFREAK_AOC_GATE_RESULT_UI_ID,

    resultId: result.gateResultId,
    gateId: result.gateId,

    title: "AOC Gate Result",
    subtitle,

    badge,

    verdict: result.verdict,
    canProceed: result.canProceed,

    primaryMessage: result.safeSummary,
    secondaryMessage: result.canProceed ? SECONDARY_MESSAGE_CAN_PROCEED : SECONDARY_MESSAGE_CANNOT_PROCEED,
    safeNextStep: result.safeNextStep,

    requirementList,
    trace,
    safetyDisclaimer,

    warnings: config.showWarnings ? redactedWarnings : [],
    errors: config.showErrors ? redactedErrors : [],
    safeLabels: config.showSafeLabels ? [...result.safeLabels] : [],

    actionHints,

    presentationOnly: true,
    actionExecutionCapable: false,
    mutationCapable: false,
    writebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
  };

  // The safety disclaimer's `passed` copy legitimately negates several
  // prohibited-overclaim phrases ("does not mean ... legally approved").
  // Checking every other field individually (rather than the whole
  // candidate) mirrors the base gate module, which claim-safety checks
  // only its own newly-constructed summary/next-step text rather than
  // the full result object.
  assertNoPMFreakAocGateResultUIOverclaim({ ...candidate, safetyDisclaimer: undefined });

  return candidate;
}
