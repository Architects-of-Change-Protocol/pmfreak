// ─── Agent Tool Approval — Validation ────────────────────────────────────────

import type {
  CreateAgentToolRequestInput,
  DecideAgentToolApprovalInput,
  AgentToolApprovalDecision,
} from "./agent-tool-approval-types";

// ─── Sensitive payload guard ──────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "stripe_secret",
  "private_key",
]);

export function detectSensitivePayloadKeys(
  context: Record<string, unknown>
): string[] {
  const found: string[] = [];
  function scan(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const qualifiedKey = prefix ? `${prefix}.${key}` : key;
      if (SENSITIVE_KEYS.has(key)) {
        found.push(qualifiedKey);
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        scan(value as Record<string, unknown>, qualifiedKey);
      }
    }
  }
  scan(context);
  return found;
}

export function validateRequestContext(
  context: Record<string, unknown>
): string | null {
  const sensitiveKeys = detectSensitivePayloadKeys(context);
  if (sensitiveKeys.length > 0) {
    return `Request context contains sensitive keys: ${sensitiveKeys.join(", ")}. Remove these before submitting.`;
  }
  return null;
}

// ─── Request input validation ─────────────────────────────────────────────────

export function validateCreateAgentToolRequestInput(
  input: CreateAgentToolRequestInput
): string | null {
  if (!input.workspaceId?.trim()) return "workspaceId is required";
  if (!input.agentId?.trim()) return "agentId is required";
  if (!input.agentType?.trim()) return "agentType is required";
  if (!input.toolKey?.trim()) return "toolKey is required";

  if (input.requestReason !== undefined && input.requestReason !== null) {
    if (typeof input.requestReason !== "string") return "requestReason must be a string";
    if (input.requestReason.length > 2000) return "requestReason must be 2000 characters or fewer";
  }

  if (input.requestContext) {
    const contextError = validateRequestContext(input.requestContext);
    if (contextError) return contextError;
  }

  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    const d = new Date(input.expiresAt);
    if (isNaN(d.getTime())) return "expiresAt must be a valid ISO date string";
    if (d <= new Date()) return "expiresAt must be in the future";
  }

  return null;
}

// ─── Decision input validation ────────────────────────────────────────────────

const VALID_DECISIONS = new Set<string>(["approved", "rejected"]);

export function validateDecideAgentToolApprovalInput(
  input: DecideAgentToolApprovalInput
): string | null {
  if (!input.requestId?.trim()) return "requestId is required";
  if (!input.workspaceId?.trim()) return "workspaceId is required";
  if (!input.decidedBy?.trim()) return "decidedBy is required";
  if (!input.decision) return "decision is required";
  if (!VALID_DECISIONS.has(input.decision)) {
    return `decision must be one of: ${[...VALID_DECISIONS].join(", ")}`;
  }
  if (input.decisionNote !== undefined && input.decisionNote !== null) {
    if (typeof input.decisionNote !== "string") return "decisionNote must be a string";
    if (input.decisionNote.length > 2000) return "decisionNote must be 2000 characters or fewer";
  }
  return null;
}

// ─── Decision type guard ──────────────────────────────────────────────────────

export function isValidApprovalDecision(
  value: string
): value is AgentToolApprovalDecision {
  return VALID_DECISIONS.has(value);
}
