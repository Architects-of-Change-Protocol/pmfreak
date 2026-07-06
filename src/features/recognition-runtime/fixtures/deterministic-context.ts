import type { RecognitionRuntimeContext } from "../domain";

// A fully deterministic clock/id pair for fixtures and tests: no
// Date.now(), no randomness. Each clock tick advances by exactly one
// second; each id is a stable, human-readable sequence per prefix.
export function createDeterministicContext(startEpochSeconds = 1750000000): RecognitionRuntimeContext {
  let seconds = startEpochSeconds;
  const counters = new Map<string, number>();

  return {
    clock: {
      now() {
        const iso = new Date(seconds * 1000).toISOString();
        seconds += 1;
        return iso;
      },
    },
    ids: {
      nextId(prefix) {
        const next = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, next);
        return `${prefix}-${String(next).padStart(4, "0")}`;
      },
    },
  };
}
