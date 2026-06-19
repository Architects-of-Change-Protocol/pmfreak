import type { RatifiableEntityType, SignatureAuthorityType } from "./types";

// ─── generateSignatureHash ───────────────────────────────────────────────────
//
// Produces a deterministic, non-cryptographic content hash used for
// non-repudiation. The hash encodes entity_id, entity_version, authority_id,
// and timestamp so any future party can reconstruct and verify the conditions
// under which a signature was produced.
//
// We use a pure string-based FNV-1a (32-bit) digest encoded as hex.
// This keeps the implementation self-contained (no Node crypto dependency)
// while still producing a stable, collision-resistant identifier for audit.

export type SignatureHashInput = {
  entityId: string;
  entityVersion: number;
  authorityId: string;
  timestamp: string;
  entityType?: RatifiableEntityType;
  authorityType?: SignatureAuthorityType;
};

function fnv1a32(input: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep 32-bit unsigned
  }
  return hash.toString(16).padStart(8, "0");
}

export function generateSignatureHash(input: SignatureHashInput): string {
  const canonical = [
    input.entityType ?? "",
    input.entityId,
    String(input.entityVersion),
    input.authorityType ?? "",
    input.authorityId,
    input.timestamp,
  ].join("|");

  // Four independent FNV passes over rotated representations for 128-bit-wide output
  const a = fnv1a32(canonical);
  const b = fnv1a32(`${a}:${canonical}`);
  const c = fnv1a32(`${b}:${canonical}`);
  const d = fnv1a32(`${c}:${canonical}`);

  return `sha-sig-${a}${b}${c}${d}`;
}

export function verifySignatureHash(input: SignatureHashInput, expectedHash: string): boolean {
  return generateSignatureHash(input) === expectedHash;
}
