// Perilla 11 — prototype-pollution canary for untrusted file parsing.
//
// xlsx@0.18.5 (the last npm-published SheetJS build) has a known prototype-
// pollution advisory (GHSA-4r6h-8v6p-xvw6) fixed only in versions distributed
// via cdn.sheetjs.com, which this repo cannot yet consume (see
// docs/release/dependency-security-review.md). Until that upgrade lands, every
// untrusted-file parse runs inside this guard: it snapshots Object.prototype /
// Array.prototype before the parse, and if the parse added properties to
// either, it (1) removes them, restoring the runtime, and (2) rejects the file
// by throwing. A crafted workbook can then fail its own upload, but cannot
// poison the process for subsequent requests.
//
// This is defense-in-depth, not a substitute for the upgrade — the residual
// risk register tracks the real fix.

const GUARDED_PROTOTYPES: Array<{ label: string; proto: object }> = [
  { label: "Object.prototype", proto: Object.prototype },
  { label: "Array.prototype", proto: Array.prototype },
];

export class PrototypePollutionError extends Error {
  constructor(context: string, pollutedKeys: string[]) {
    super(`Prototype pollution detected while parsing untrusted input (${context}): ${pollutedKeys.join(", ")}`);
    this.name = "PrototypePollutionError";
  }
}

export function withPrototypePollutionGuard<T>(context: string, operation: () => T): T {
  const snapshots = GUARDED_PROTOTYPES.map(({ proto }) => new Set(Object.getOwnPropertyNames(proto)));

  const detectAndClean = (): string[] => {
    const polluted: string[] = [];
    GUARDED_PROTOTYPES.forEach(({ label, proto }, index) => {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (snapshots[index].has(name)) continue;
        polluted.push(`${label}.${name}`);
        try {
          delete (proto as Record<string, unknown>)[name];
        } catch {
          // A non-configurable injected property cannot be removed; the throw
          // below still rejects the file and surfaces the incident.
        }
      }
    });
    return polluted;
  };

  let result: T;
  try {
    result = operation();
  } catch (error) {
    detectAndClean();
    throw error;
  }

  const polluted = detectAndClean();
  if (polluted.length > 0) {
    throw new PrototypePollutionError(context, polluted);
  }
  return result;
}
