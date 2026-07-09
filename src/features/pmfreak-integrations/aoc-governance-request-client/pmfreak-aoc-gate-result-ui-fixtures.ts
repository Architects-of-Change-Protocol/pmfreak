import {
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateErrorResult,
  demoPMFreakAocGovernedActionGateHeldResult,
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGateNeedsReviewResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "./pmfreak-aoc-governed-action-gate-fixtures";
import { createPMFreakAocGateResultBannerViewModel } from "./pmfreak-aoc-gate-result-ui-banner-view-model";
import type { PMFreakAocGateResultBannerViewModel } from "./pmfreak-aoc-gate-result-ui-banner-view-model";
import { createPMFreakAocGateResultBlockerViewModel } from "./pmfreak-aoc-gate-result-ui-blocker-view-model";
import type { PMFreakAocGateResultBlockerViewModel } from "./pmfreak-aoc-gate-result-ui-blocker-view-model";
import { createPMFreakAocGateResultCardViewModel } from "./pmfreak-aoc-gate-result-ui-card-view-model";
import type { PMFreakAocGateResultCardViewModel } from "./pmfreak-aoc-gate-result-ui-card-view-model";
import { createPMFreakAocGateResultDetailPanelViewModel } from "./pmfreak-aoc-gate-result-ui-detail-panel-view-model";
import type { PMFreakAocGateResultDetailPanelViewModel } from "./pmfreak-aoc-gate-result-ui-detail-panel-view-model";
import { createPMFreakAocGateResultUIDisplayModel } from "./pmfreak-aoc-gate-result-ui-display-model";
import type { PMFreakAocGateResultUIDisplayModel } from "./pmfreak-aoc-gate-result-ui-display-model";
import { createPMFreakAocGateResultUIEmptyState } from "./pmfreak-aoc-gate-result-ui-empty-state";
import type { PMFreakAocGateResultUIEmptyState } from "./pmfreak-aoc-gate-result-ui-empty-state";
import { createPMFreakAocGateResultUIErrorState } from "./pmfreak-aoc-gate-result-ui-error-state";
import type { PMFreakAocGateResultUIErrorState } from "./pmfreak-aoc-gate-result-ui-error-state";
import { createPMFreakAocGateRequirementListViewModel } from "./pmfreak-aoc-gate-result-ui-requirement-list";
import type { PMFreakAocGateRequirementListViewModel } from "./pmfreak-aoc-gate-result-ui-requirement-list";
import { createPMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";
import type { PMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";
import { createPMFreakAocGateTraceViewModel } from "./pmfreak-aoc-gate-result-ui-trace-view-model";
import type { PMFreakAocGateTraceViewModel } from "./pmfreak-aoc-gate-result-ui-trace-view-model";

// All fixtures below build on the existing, already-deterministic
// governed action gate fixtures (which themselves reuse fake/demo-only
// identifiers from pmfreak-aoc-fixtures.ts and
// pmfreak-aoc-decision-inbox-fixtures.ts): no real customer names,
// Datasys project IDs, real emails, contract numbers, invoice numbers or
// secrets.

export async function demoPMFreakAocGateResultUIPassedDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUIBlockedDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUIHeldDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateHeldResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUINeedsEvidenceDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUINeedsApprovalDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsApprovalResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUINeedsReviewDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUIErrorDisplayModel(): Promise<PMFreakAocGateResultUIDisplayModel> {
  const result = await demoPMFreakAocGovernedActionGateErrorResult();
  return createPMFreakAocGateResultUIDisplayModel({ result });
}

export async function demoPMFreakAocGateResultUIPassedBanner(): Promise<PMFreakAocGateResultBannerViewModel> {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  return createPMFreakAocGateResultBannerViewModel({ result });
}

export async function demoPMFreakAocGateResultUIBlockedBanner(): Promise<PMFreakAocGateResultBannerViewModel> {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  return createPMFreakAocGateResultBannerViewModel({ result });
}

export async function demoPMFreakAocGateResultUINeedsEvidenceCard(): Promise<PMFreakAocGateResultCardViewModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  return createPMFreakAocGateResultCardViewModel({ result });
}

export async function demoPMFreakAocGateResultUINeedsReviewDetailPanel(): Promise<PMFreakAocGateResultDetailPanelViewModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  return createPMFreakAocGateResultDetailPanelViewModel({ result });
}

export async function demoPMFreakAocGateResultUIBlocker(): Promise<PMFreakAocGateResultBlockerViewModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  return createPMFreakAocGateResultBlockerViewModel(result);
}

export async function demoPMFreakAocGateResultUIRequirementList(): Promise<PMFreakAocGateRequirementListViewModel> {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  return createPMFreakAocGateRequirementListViewModel(result);
}

export async function demoPMFreakAocGateResultUITrace(): Promise<PMFreakAocGateTraceViewModel> {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  return createPMFreakAocGateTraceViewModel(result);
}

export async function demoPMFreakAocGateResultUISafetyDisclaimer(): Promise<PMFreakAocGateSafetyDisclaimerViewModel> {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  return createPMFreakAocGateSafetyDisclaimerViewModel(result);
}

export function demoPMFreakAocGateResultUIEmptyState(): PMFreakAocGateResultUIEmptyState {
  return createPMFreakAocGateResultUIEmptyState();
}

export function demoPMFreakAocGateResultUIErrorState(): PMFreakAocGateResultUIErrorState {
  return createPMFreakAocGateResultUIErrorState();
}
