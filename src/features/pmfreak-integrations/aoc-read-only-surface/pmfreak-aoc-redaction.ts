// PMFreak AOC Read-Only Integration Surface v1 — redaction / safe normalization
//
// This is a surface safety layer, not a DLP product: it catches obvious
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

import type { PMFreakAocSurfaceSnapshot } from "./pmfreak-aoc-surface-snapshot";
import type { PMFreakAocReadOnlySurfaceRedactionMode } from "./pmfreak-aoc-read-only-surface-types";

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

export function redactPMFreakAocSurfaceValue(
  value: unknown,
  mode: PMFreakAocReadOnlySurfaceRedactionMode
): unknown {
  if (mode === "none") {
    return deepClone(value);
  }
  return redactNode(deepClone(value), mode);
}

export function redactPMFreakAocSurfaceSnapshot(
  snapshot: PMFreakAocSurfaceSnapshot,
  mode: PMFreakAocReadOnlySurfaceRedactionMode
): PMFreakAocSurfaceSnapshot {
  return {
    ...snapshot,
    projects: redactPMFreakAocSurfaceValue(snapshot.projects, mode) as PMFreakAocSurfaceSnapshot["projects"],
    agents: redactPMFreakAocSurfaceValue(snapshot.agents, mode) as PMFreakAocSurfaceSnapshot["agents"],
    milestones: redactPMFreakAocSurfaceValue(snapshot.milestones, mode) as PMFreakAocSurfaceSnapshot["milestones"],
    tasks: redactPMFreakAocSurfaceValue(snapshot.tasks, mode) as PMFreakAocSurfaceSnapshot["tasks"],
    risks: redactPMFreakAocSurfaceValue(snapshot.risks, mode) as PMFreakAocSurfaceSnapshot["risks"],
    evidenceReferences: redactPMFreakAocSurfaceValue(
      snapshot.evidenceReferences,
      mode
    ) as PMFreakAocSurfaceSnapshot["evidenceReferences"],
    approvalReferences: redactPMFreakAocSurfaceValue(
      snapshot.approvalReferences,
      mode
    ) as PMFreakAocSurfaceSnapshot["approvalReferences"],
    actionProposals: redactPMFreakAocSurfaceValue(
      snapshot.actionProposals,
      mode
    ) as PMFreakAocSurfaceSnapshot["actionProposals"],
  };
}
