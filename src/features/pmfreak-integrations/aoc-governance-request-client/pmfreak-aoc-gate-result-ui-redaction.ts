import { redactPMFreakAocGovernedActionGateValue } from "./pmfreak-aoc-governed-action-gate-redaction";
import type { PMFreakAocGateResultUIRedactionMode } from "./pmfreak-aoc-gate-result-ui-config";

// Reuses the governed action gate module's deterministic redaction
// (email/token/secret scrubbing, sensitive-key-name scrubbing, and
// strict-mode metadata clearing). Never mutates `value`.
export function redactPMFreakAocGateResultUIValue(value: unknown, mode: PMFreakAocGateResultUIRedactionMode): unknown {
  return redactPMFreakAocGovernedActionGateValue(value, mode);
}
