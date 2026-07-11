// Prototype-pollution canary for untrusted file parsing.
//
// Introduced in Perilla 11 as mitigation for the vulnerable xlsx@0.18.5
// parser (GHSA-4r6h-8v6p-xvw6). Perilla 12 removed that dependency (replaced
// with exceljs — see docs/release/xlsx-replacement-decision.md), and the
// guard is retained as defense-in-depth for every untrusted-file parse: it
// snapshots Object.prototype / Array.prototype before the parse, and if the
// parse added properties to either, it (1) removes them, restoring the
// runtime, and (2) rejects the file by throwing. A crafted file fails its
// own upload but cannot poison the process for subsequent requests.

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

function snapshotPrototypes(): Array<Set<string>> {
  return GUARDED_PROTOTYPES.map(({ proto }) => new Set(Object.getOwnPropertyNames(proto)));
}

function buildDetectAndClean(snapshots: Array<Set<string>>): () => string[] {
  return (): string[] => {
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
}

export function withPrototypePollutionGuard<T>(context: string, operation: () => T): T {
  const detectAndClean = buildDetectAndClean(snapshotPrototypes());

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

// Async variant for parsers with promise-based APIs (Perilla 12: the exceljs
// workbook reader). Same contract: pollution is cleaned whether the parse
// succeeds or throws, and a polluting parse is rejected.
export async function withPrototypePollutionGuardAsync<T>(context: string, operation: () => Promise<T>): Promise<T> {
  const detectAndClean = buildDetectAndClean(snapshotPrototypes());

  let result: T;
  try {
    result = await operation();
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
