import crypto from "node:crypto";

// Shared invite-token primitives (Perilla 11 — beta release closure gate).
//
// Invite tokens are bearer credentials: the database must never hold the
// plaintext. Storage keeps only sha256(token); the plaintext exists exactly
// once, inside the accept URL handed back at creation time. A plain (unsalted)
// sha256 is safe here because the token carries 192 bits of CSPRNG entropy —
// the hash is not invertible or brute-forceable the way a low-entropy password
// hash would be. Do NOT reuse these helpers for user-chosen secrets.
//
// The early-access flow (src/lib/early-access.ts) uses the same construction
// for its own table; these helpers are the workspace-invitation counterpart.

const INVITE_TOKEN_BYTES = 24; // 192 bits of entropy, base64url → 32 chars

export const createWorkspaceInviteToken = (): string => crypto.randomBytes(INVITE_TOKEN_BYTES).toString("base64url");

export const hashWorkspaceInviteToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

const DEFAULT_INVITE_TTL_HOURS = 24 * 7;
const MAX_INVITE_TTL_HOURS = 24 * 30;

/**
 * Invite lifetime in hours. `INVITE_TOKEN_TTL_HOURS` may narrow or extend it
 * within [1h, 30d]; anything unparsable or outside that range falls back to
 * the 7-day default rather than producing an unbounded or zero TTL.
 */
export function resolveInviteTtlHours(rawValue: string | undefined = process.env.INVITE_TOKEN_TTL_HOURS): number {
  if (!rawValue) return DEFAULT_INVITE_TTL_HOURS;
  const parsed = Number(rawValue.trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_INVITE_TTL_HOURS) return DEFAULT_INVITE_TTL_HOURS;
  return parsed;
}
