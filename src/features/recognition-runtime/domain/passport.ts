// AOC Recognition Runtime — Passport domain model
//
// A Passport is proof that an Actor has been recognized within a Trust
// Domain. Capability tokens are only meaningful when issued against a
// valid (active, unexpired, unrevoked) Passport.

export type PassportStatus = "active" | "suspended" | "revoked" | "expired";

export type Passport = {
  id: string;

  actorId: string;
  trustDomainId: string;

  status: PassportStatus;

  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;

  metadata?: Record<string, unknown>;
};
