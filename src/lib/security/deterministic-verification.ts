import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { logSecurityEvent } from "@/lib/security/telemetry";

type TrustDecisionInput = {
  anchorSet?: unknown[];
  policy?: { status?: string };
  replayWindow?: { isReplay?: boolean; [key: string]: unknown };
  trustPath?: { trusted?: boolean; [key: string]: unknown };
  evaluationTimestamp?: unknown;
  revocations?: unknown[];
};

type VerificationReceiptInput = {
  receiptId?: string;
  verifierId?: string;
  trustDomain?: string;
  verificationDecision?: string;
  verificationReason?: string;
  evaluatedPolicies?: unknown[];
  evaluatedAnchors?: unknown[];
  evaluatedRevocations?: unknown[];
  evaluatedTrustPath?: unknown;
  replayValidation?: unknown;
  snapshotHash?: string;
  verifierStateHash?: string;
  canonicalEventHash?: string;
  verifiedAt?: string;
};

type VerificationReceipt = {
  receiptId: string;
  verifierId: unknown;
  trustDomain: unknown;
  verificationDecision: unknown;
  verificationReason: unknown;
  evaluatedPolicies: unknown[];
  evaluatedAnchors: unknown[];
  evaluatedRevocations: unknown[];
  evaluatedTrustPath: unknown;
  replayValidation: unknown;
  snapshotHash: unknown;
  verifierStateHash: unknown;
  canonicalEventHash: unknown;
  verifiedAt: unknown;
  signature: string | null;
};

type VerifierOutcomeInput = {
  left: Record<string, unknown>;
  right: Record<string, unknown>;
};

type ReplayScenarioInput = {
  historical: TrustDecisionInput;
  current: TrustDecisionInput;
};

function normalizeUnicode(value: string) { return value.normalize("NFC").replace(/\s+/g, " ").trim(); }
function normalizeTimestamp(value: unknown) {
  if (typeof value === "string" || value instanceof Date || typeof value === "number") {
    const d = new Date(value as string | number | Date);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return value;
}

function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return normalizeUnicode(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalizeValue);
    return normalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en", { sensitivity: "base" }));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj).sort()) {
      const maybeTs = key.endsWith("_at") || key.toLowerCase().includes("timestamp") ? normalizeTimestamp(obj[key]) : obj[key];
      out[key] = canonicalizeValue(maybeTs);
    }
    return out;
  }
  return String(value);
}

function canonicalize(input: Record<string, unknown>) { return JSON.stringify(canonicalizeValue(input)); }

export const canonicalizeTrustEvent = (event: Record<string, unknown>) => canonicalize(event);
export const canonicalizeTrustPolicy = (policy: Record<string, unknown>) => canonicalize(policy);
export const canonicalizeTrustAnchor = (anchor: Record<string, unknown>) => canonicalize(anchor);
export const canonicalizeTrustGraphEdge = (edge: Record<string, unknown>) => canonicalize(edge);

function hashCanonical(serialized: string) { return createHash("sha256").update(Buffer.from(serialized, "utf8")).digest("hex"); }

export function hashTrustAnchorState(anchors: Record<string, unknown>[]) { const hash = hashCanonical(canonicalize({ anchors })); void logSecurityEvent("state_hash_generated", { metadata: { state: "anchor", hash } }); return hash; }
export function hashTrustPolicyState(policies: Record<string, unknown>[]) { const hash = hashCanonical(canonicalize({ policies })); void logSecurityEvent("state_hash_generated", { metadata: { state: "policy", hash } }); return hash; }
export function hashRevocationState(revocations: Record<string, unknown>[]) { const hash = hashCanonical(canonicalize({ revocations })); void logSecurityEvent("state_hash_generated", { metadata: { state: "revocation", hash } }); return hash; }
export function hashTrustGraphState(edges: Record<string, unknown>[]) { const hash = hashCanonical(canonicalize({ edges })); void logSecurityEvent("state_hash_generated", { metadata: { state: "graph", hash } }); return hash; }
export function hashReplayWindow(replay: Record<string, unknown>) { const hash = hashCanonical(canonicalize(replay)); void logSecurityEvent("state_hash_generated", { metadata: { state: "replay", hash } }); return hash; }
export function hashVerifierState(input: { anchors: Record<string, unknown>[]; policies: Record<string, unknown>[]; revocations: Record<string, unknown>[]; graph: Record<string, unknown>[]; replayWindow: Record<string, unknown>; verifierConfig: Record<string, unknown>; }) {
  return hashCanonical(canonicalize({
    anchorStateHash: hashTrustAnchorState(input.anchors),
    policyStateHash: hashTrustPolicyState(input.policies),
    revocationStateHash: hashRevocationState(input.revocations),
    graphStateHash: hashTrustGraphState(input.graph),
    replayWindowHash: hashReplayWindow(input.replayWindow),
    verifierConfigHash: hashCanonical(canonicalize(input.verifierConfig)),
  }));
}

export function evaluateDeterministicTrustDecision(input: TrustDecisionInput) {
  const checks = [
    { step: "anchor", ok: (input.anchorSet?.length ?? 0) > 0, reason: "anchor_missing" },
    { step: "policy", ok: input.policy?.status === "active", reason: "policy_inactive" },
    { step: "replay", ok: !input.replayWindow?.isReplay, reason: "replay_detected" },
    { step: "path", ok: input.trustPath?.trusted === true, reason: "trust_path_denied" },
  ];
  const failed = checks.find((c) => !c.ok);
  const decision = failed ? "deny" : "allow";
  const out = { decision, reasonChain: checks, evaluationGraph: { checks: checks.map((c) => ({ ...c })) }, proof: { evaluatedAt: normalizeTimestamp(input.evaluationTimestamp), replayWindow: canonicalizeValue(input.replayWindow), trustPath: canonicalizeValue(input.trustPath) } };
  void logSecurityEvent("deterministic_evaluation_completed", { metadata: { decision, reason: failed?.reason ?? "policy_allow" } });
  return out;
}

export function createVerificationReceipt(input: VerificationReceiptInput): VerificationReceipt {
  const receipt = { receiptId: input.receiptId ?? randomUUID(), verifierId: input.verifierId, trustDomain: input.trustDomain, verificationDecision: input.verificationDecision, verificationReason: input.verificationReason, evaluatedPolicies: input.evaluatedPolicies ?? [], evaluatedAnchors: input.evaluatedAnchors ?? [], evaluatedRevocations: input.evaluatedRevocations ?? [], evaluatedTrustPath: input.evaluatedTrustPath ?? null, replayValidation: input.replayValidation ?? null, snapshotHash: input.snapshotHash, verifierStateHash: input.verifierStateHash, canonicalEventHash: input.canonicalEventHash, verifiedAt: normalizeTimestamp(input.verifiedAt ?? new Date().toISOString()), signature: null };
  return receipt;
}
export function signVerificationReceipt(receipt: VerificationReceipt, secret: string) { const unsigned = { ...receipt, signature: undefined }; const signature = createHmac("sha256", secret).update(canonicalize(unsigned)).digest("base64url"); void logSecurityEvent("verification_receipt_signed", { metadata: { receiptId: receipt.receiptId } }); return { ...receipt, signature }; }
export function verifyVerificationReceipt(receipt: VerificationReceipt & { signature?: string }, secret: string) { const unsigned = { ...receipt, signature: undefined }; const expected = createHmac("sha256", secret).update(canonicalize(unsigned)).digest("base64url"); const valid = !!receipt.signature && timingSafeEqual(Buffer.from(receipt.signature), Buffer.from(expected)); void logSecurityEvent("verification_receipt_verified", { metadata: { receiptId: receipt.receiptId, valid } }); return valid; }
export function explainVerificationReceipt(receipt: VerificationReceipt) { return { receiptId: receipt.receiptId, decision: receipt.verificationDecision, reason: receipt.verificationReason, snapshotHash: receipt.snapshotHash, verifierStateHash: receipt.verifierStateHash, independentlyAuditable: true }; }

export function replayVerificationScenario(input: ReplayScenarioInput) {
  const historical = evaluateDeterministicTrustDecision(input.historical);
  const current = evaluateDeterministicTrustDecision(input.current);
  const changed = historical.decision !== current.decision;
  if (changed) void logSecurityEvent("replay_diff_detected", { metadata: { historical: historical.decision, current: current.decision } });
  void logSecurityEvent("forensic_replay_executed", { metadata: { changed } });
  return { historical, current, changed, diffs: { anchorDiff: [input.historical.anchorSet, input.current.anchorSet], graphDiff: [input.historical.trustPath, input.current.trustPath], revocationDiff: [input.historical.revocations, input.current.revocations], replayDiff: [input.historical.replayWindow, input.current.replayWindow] } };
}

export function compareVerifierOutcomes(input: VerifierOutcomeInput) {
  const divergence: string[] = [];
  if (input.left.verifierStateHash !== input.right.verifierStateHash) divergence.push("state_hash_mismatch");
  if (input.left.snapshotHash !== input.right.snapshotHash) divergence.push("snapshot_mismatch");
  if (input.left.decision !== input.right.decision) divergence.push("decision_mismatch");
  if (input.left.policyStateHash !== input.right.policyStateHash) divergence.push("policy_divergence");
  if (input.left.replayWindowHash !== input.right.replayWindowHash) divergence.push("replay-window mismatch");
  if (input.left.graphStateHash !== input.right.graphStateHash) divergence.push("graph mismatch");
  if (input.left.revocationStateHash !== input.right.revocationStateHash) divergence.push("stale revocation data");
  if (divergence.length) void logSecurityEvent("verifier_divergence_detected", { metadata: { divergence } });
  return { consistent: divergence.length === 0, divergence, explanation: divergence.length ? "verifier outcomes diverged" : "verifier outcomes consistent" };
}
