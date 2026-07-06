// AOC Recognition Runtime — deterministic canonical hashing for audit events.
//
// No nondeterministic hashing: same logical payload always produces the
// same hash, regardless of key insertion order.

import { createHash } from "node:crypto";

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

export const canonicalize = (value: unknown): string => JSON.stringify(sortValue(value));

export const hashPayload = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value)).digest("hex");
