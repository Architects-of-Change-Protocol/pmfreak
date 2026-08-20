/**
 * P2-13 — secret-safe reporting and honest stage accounting.
 *
 * PURE MODULE. Two responsibilities, both of which the delivery gate has to
 * be able to prove independently of a database:
 *
 *  1. Nothing this harness prints may carry a key, token, password or raw
 *     provider error (P2-13 §15, §18.15).
 *  2. A seed that only partly persisted must report PARTIAL_SEED with the
 *     exact completed stages — never success (P2-13 §19, §31.D).
 */

/** Shapes that are credentials regardless of which variable they came from. */
const SECRET_SHAPES = Object.freeze([
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, // JWT
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]{8,}\b/g, // Supabase API keys
  /\bpostgres(?:ql)?:\/\/[^\s"']+/gi, // any postgres URL (carries a password)
  /\bsbp_[A-Za-z0-9]{16,}\b/g, // Supabase access token
]);

export const REDACTED = "[REDACTED]";

/**
 * Build a redactor bound to the exact secret values in play plus the shape
 * rules above. Bound values are matched first so a short key that no shape
 * rule recognises is still removed.
 */
export function createSecretRedactor(secretValues = []) {
  const literals = [...new Set(secretValues.filter((value) => typeof value === "string" && value.length >= 8))]
    // Longest first: redacting a prefix before its superset would leave a tail.
    .sort((a, b) => b.length - a.length);

  const redactString = (input) => {
    let output = input;
    for (const literal of literals) {
      if (output.includes(literal)) output = output.split(literal).join(REDACTED);
    }
    for (const shape of SECRET_SHAPES) {
      output = output.replace(new RegExp(shape.source, shape.flags), REDACTED);
    }
    return output;
  };

  const redact = (value, seen = new WeakSet()) => {
    if (typeof value === "string") return redactString(value);
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((entry) => redact(entry, seen));
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [redactString(key), redact(entry, seen)]),
    );
  };

  return redact;
}

/**
 * Reduce an arbitrary (possibly provider-originated) failure to a stable,
 * printable reason. Provider internals are deliberately dropped rather than
 * echoed: a Supabase/PostgREST error can embed a connection string.
 */
export function safeFailureReason(error, redact = (value) => value) {
  if (!error) return "unknown_error";
  const raw =
    typeof error === "string"
      ? error
      : // PostgREST failures sometimes carry an empty `message` and put the
        // real signal in `code`/`details`. Losing that would turn a real
        // failure into an unexplained blank.
        [error.message, error.code, error.details, error.hint]
          .filter((part) => typeof part === "string" && part.trim() !== "")
          .join(" | ") || String(error);
  const redacted = String(redact(raw));
  // Keep it short and single-line so a stack or SQL dump cannot ride along.
  return redacted.split("\n")[0].slice(0, 300);
}

export const STAGE_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
});

export const RUN_STATUS = Object.freeze({
  COMPLETE: "COMPLETE",
  PARTIAL_SEED: "PARTIAL_SEED",
  REFUSED: "REFUSED",
  NOT_RUN: "NOT_RUN",
});

/**
 * Ordered stage tracker.
 *
 * The declared stage list is fixed up front so a run that dies early still
 * reports every stage it never reached, rather than implying the plan was
 * shorter than it was.
 */
export function createStageTracker(stageNames) {
  const stages = stageNames.map((name) => ({ name, status: STAGE_STATUS.PENDING, detail: null }));
  const find = (name) => {
    const stage = stages.find((entry) => entry.name === name);
    if (!stage) throw new Error(`p2_13_unknown_stage:${name}`);
    return stage;
  };

  return {
    begin(name) {
      find(name).status = STAGE_STATUS.RUNNING;
    },
    complete(name, detail = null) {
      const stage = find(name);
      stage.status = STAGE_STATUS.COMPLETED;
      stage.detail = detail;
    },
    fail(name, detail) {
      const stage = find(name);
      stage.status = STAGE_STATUS.FAILED;
      stage.detail = detail;
    },
    skip(name, detail = null) {
      const stage = find(name);
      stage.status = STAGE_STATUS.SKIPPED;
      stage.detail = detail;
    },
    /**
     * COMPLETE only when every declared stage completed. Anything else — a
     * failure, an unreached stage, a stage still marked running because the
     * process was interrupted — is PARTIAL_SEED.
     */
    snapshot() {
      const completed = stages.filter((entry) => entry.status === STAGE_STATUS.COMPLETED);
      const failed = stages.filter((entry) => entry.status === STAGE_STATUS.FAILED);
      const unreached = stages.filter(
        (entry) => entry.status === STAGE_STATUS.PENDING || entry.status === STAGE_STATUS.RUNNING,
      );
      const everyStageCompleted = completed.length === stages.length;
      return {
        status: everyStageCompleted ? RUN_STATUS.COMPLETE : RUN_STATUS.PARTIAL_SEED,
        completedStages: completed.map((entry) => entry.name),
        failedStages: failed.map((entry) => ({ name: entry.name, detail: entry.detail })),
        unreachedStages: unreached.map((entry) => entry.name),
        stages: stages.map((entry) => ({ ...entry })),
      };
    },
  };
}

/**
 * Print a report that is guaranteed to have passed through the redactor.
 *
 * Callers must not `console.log` a raw payload anywhere else; this is the one
 * output boundary the tests assert against.
 */
export function emitReport(report, redact) {
  process.stdout.write(`${JSON.stringify(redact(report), null, 2)}\n`);
}
