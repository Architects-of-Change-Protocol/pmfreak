// AOC PMFreak Read-Only Connector v1 — redaction / safe normalization
//
// This is a connector safety layer, not a DLP product: it catches obvious
// email addresses, token/secret/authorization-shaped fields, and
// connection-string-shaped values. It never mutates its input — every
// function here returns a new, deep-copied value.
//
// Modes:
//   none      — deep copy only, no redaction applied.
//   safe_demo — redacts obvious emails, tokens, secrets, authorization
//               values, and connection strings.
//   strict    — safe_demo, plus empties `metadata` objects and redacts
//               `sourceUrl` fields.

import type { AocPMFreakConnectorSnapshot } from "./pmfreak-connector-snapshot";
import type { AocPMFreakReadOnlyConnectorRedactionMode } from "./pmfreak-read-only-connector-types";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const CONNECTION_STRING_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s]*:[^/\s@]*@/;
const TOKEN_LIKE_KEY_PATTERN = /token|secret|authorization|password|credential|api[-_]?key/i;
const CONNECTION_STRING_KEY_PATTERN = /connection[-_]?string|connectionurl|dsn|database[-_]?url/i;

function deepClone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function redactString(value: string): string {
  if (CONNECTION_STRING_PATTERN.test(value)) return "[redacted-secret]";
  if (EMAIL_PATTERN.test(value)) return "[redacted-email]";
  return value;
}

function redactNode(node: unknown, mode: "safe_demo" | "strict"): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => redactNode(item, mode));
  }

  if (node !== null && typeof node === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (mode === "strict" && key === "metadata" && value !== null && typeof value === "object") {
        result[key] = {};
      } else if (mode === "strict" && key === "sourceUrl" && typeof value === "string") {
        result[key] = "[redacted-url]";
      } else if (TOKEN_LIKE_KEY_PATTERN.test(key)) {
        result[key] = "[redacted-secret]";
      } else if (CONNECTION_STRING_KEY_PATTERN.test(key)) {
        result[key] = "[redacted-secret]";
      } else {
        result[key] = redactNode(value, mode);
      }
    }
    return result;
  }

  if (typeof node === "string") {
    return redactString(node);
  }

  return node;
}

export function redactAocPMFreakConnectorValue(
  value: unknown,
  mode: AocPMFreakReadOnlyConnectorRedactionMode
): unknown {
  if (mode === "none") {
    return deepClone(value);
  }
  return redactNode(deepClone(value), mode);
}

export function redactAocPMFreakConnectorSnapshot(
  snapshot: AocPMFreakConnectorSnapshot,
  mode: AocPMFreakReadOnlyConnectorRedactionMode
): AocPMFreakConnectorSnapshot {
  return {
    ...snapshot,
    projects: redactAocPMFreakConnectorValue(snapshot.projects, mode) as AocPMFreakConnectorSnapshot["projects"],
    agents: redactAocPMFreakConnectorValue(snapshot.agents, mode) as AocPMFreakConnectorSnapshot["agents"],
    milestones: redactAocPMFreakConnectorValue(snapshot.milestones, mode) as AocPMFreakConnectorSnapshot["milestones"],
    tasks: redactAocPMFreakConnectorValue(snapshot.tasks, mode) as AocPMFreakConnectorSnapshot["tasks"],
    risks: redactAocPMFreakConnectorValue(snapshot.risks, mode) as AocPMFreakConnectorSnapshot["risks"],
    evidenceReferences: redactAocPMFreakConnectorValue(
      snapshot.evidenceReferences,
      mode
    ) as AocPMFreakConnectorSnapshot["evidenceReferences"],
    approvalReferences: redactAocPMFreakConnectorValue(
      snapshot.approvalReferences,
      mode
    ) as AocPMFreakConnectorSnapshot["approvalReferences"],
    actionProposals: redactAocPMFreakConnectorValue(
      snapshot.actionProposals,
      mode
    ) as AocPMFreakConnectorSnapshot["actionProposals"],
  };
}
