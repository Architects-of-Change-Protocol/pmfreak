/**
 * P2-12 — durable identity for ONE logical submission attempt.
 *
 * A canonical write in this experience is idempotent: the server reconciles a retry to
 * the row it already persisted, provided the retry carries the SAME submission identity.
 * That identity therefore has to outlive the thing most likely to disappear at exactly
 * the wrong moment — the React component. When a request is persisted but its response
 * is lost, the PM's natural recovery is to close the drawer, navigate, or refresh and try
 * again; a per-mount `useRef` token does not survive any of those, so the retry would
 * arrive with a fresh identity and either duplicate the canonical row (P2-09) or collide
 * with it (P2-06).
 *
 * What is stored here is deliberately minimal and deliberately NOT canonical:
 *
 *   - `attemptId` is an opaque client-owned nonce. It is never a canonical entity id,
 *     never a correlation id, never a causation id, and is never persisted as domain
 *     identity. It only ever contributes to an idempotency key.
 *   - `startedAt` is the single wall-clock reading for the whole attempt, so a retry
 *     re-sends the same timestamps rather than minting new ones. P2-06 folds `createdAt`
 *     and `expiresAt` into the proposal digest, so a fresh `new Date()` on retry turns an
 *     idempotent replay into `material_action_idempotency_conflict`.
 *   - `lastKey` is the idempotency key the attempt last submitted, kept so persisted
 *     state can prove the attempt succeeded and retire it.
 *
 * Nothing secret is written. Storage failures are never fatal: an in-memory map backs the
 * same contract, so the identity still survives a component remount within the page.
 *
 * An attempt is retired when EITHER the server accepts it, OR persisted canonical state
 * proves it landed, OR it ages past `ttlMs`. The TTL matters: an attempt is only a
 * "retry of the same submission" for as long as that submission could still be accepted.
 * Past that window the next submission is a genuinely new one and must take a new
 * identity — which is exactly the reauthorization path an expired Material Action needs.
 */

export type SubmissionAttempt = {
  /** Opaque per-attempt nonce. Not a canonical id. */
  attemptId: string;
  /** The one wall-clock reading for this attempt, ISO-8601. */
  startedAt: string;
  /** Idempotency key last submitted under this attempt, if any. */
  lastKey?: string;
  /**
   * The server accepted the write, but persisted state has not yet confirmed it here.
   *
   * An acknowledged attempt is NOT retired. The post-write summary refresh is a separate
   * request that can fail on its own, and if it does the PM still sees the submission form
   * over stale state. Retiring on the POST response alone would let their next click mint
   * a fresh identity and append a duplicate canonical row. Only persisted state — or the
   * TTL — retires an attempt.
   */
  acknowledgedAt?: string;
};

/** Attempts are per-tab, per-actor working state, so the store is namespaced and scoped
 *  by the canonical ids the attempt belongs to — never global. */
export const ATTEMPT_KEY_PREFIX = "pmfreak.p2-12.attempt";

/**
 * Scoped by the Decision AND the classification being proposed.
 *
 * The draft digest is what makes "the same submission" mean the same thing here as it
 * does to P2-06. Keyed on the Decision alone, a PM who corrected a misclassification
 * after a failed request would resubmit under the retained identity with a different
 * digest and get `material_action_idempotency_conflict` — unable to fix their own answer
 * until the attempt aged out.
 */
export function materialActionAttemptKey(
  workspaceId: string,
  projectId: string,
  decisionId: string,
  draftDigest: string
): string {
  return `${ATTEMPT_KEY_PREFIX}.material-action.${workspaceId}.${projectId}.${decisionId}.${draftDigest}`;
}

export function observationAttemptKey(workspaceId: string, projectId: string, outcomeId: string): string {
  return `${ATTEMPT_KEY_PREFIX}.observation.${workspaceId}.${projectId}.${outcomeId}`;
}

/**
 * Scoped by the project, the intake MODE, and a digest of the content being captured.
 *
 * Intake has no prior canonical row to key on — the submission is what creates one — so
 * the submission itself is the identity. Mode is part of it because the same words
 * captured as DEMO / FIXTURE and as LIVE are two different provenance claims and must
 * never reconcile onto each other. The digest is part of it because the contract compares
 * the content digest on replay: an observer who edits their notes after a failed request
 * is making a NEW submission, and reusing the identity would meet
 * `intake_idempotency_conflict` instead of capturing the correction.
 */
export function intakeAttemptKey(
  workspaceId: string,
  projectId: string,
  mode: string,
  contentDigest: string
): string {
  return `${ATTEMPT_KEY_PREFIX}.intake.${workspaceId}.${projectId}.${mode}.${contentDigest}`;
}

/** Survives a remount even where `localStorage` is unavailable (SSR, private modes,
 *  storage denied). Same contract, smaller durability envelope — never an exception. */
const fallback = new Map<string, SubmissionAttempt>();

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage access can throw outright when blocked by policy.
    return null;
  }
}

function readRaw(key: string): SubmissionAttempt | null {
  const backing = store();
  if (backing) {
    try {
      const raw = backing.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SubmissionAttempt>;
        if (typeof parsed?.attemptId === "string" && typeof parsed?.startedAt === "string") {
          return {
            attemptId: parsed.attemptId,
            startedAt: parsed.startedAt,
            ...(typeof parsed.lastKey === "string" ? { lastKey: parsed.lastKey } : {}),
            ...(typeof parsed.acknowledgedAt === "string" ? { acknowledgedAt: parsed.acknowledgedAt } : {}),
          };
        }
      }
    } catch {
      // Unparseable or unreadable state is treated as no attempt, never as a crash.
    }
  }
  return fallback.get(key) ?? null;
}

function writeRaw(key: string, attempt: SubmissionAttempt): void {
  fallback.set(key, attempt);
  const backing = store();
  if (!backing) return;
  try {
    backing.setItem(key, JSON.stringify(attempt));
  } catch {
    // Quota or policy failure: the in-memory copy still holds the attempt.
  }
}

export function clearSubmissionAttempt(key: string): void {
  fallback.delete(key);
  const backing = store();
  if (!backing) return;
  try {
    backing.removeItem(key);
  } catch {
    // Nothing further to do; the authoritative in-memory copy is already gone.
  }
}

/** The pending attempt, without creating one. Used to reconcile against persisted state. */
export function peekSubmissionAttempt(key: string): SubmissionAttempt | null {
  return readRaw(key);
}

export type LoadAttemptOptions = {
  /** How long one submission stays "the same submission". Beyond it, a new identity. */
  ttlMs: number;
  now?: Date;
  mint?: () => string;
};

/**
 * The attempt identity to submit under. Returns the pending one while it is still live,
 * so a retry reconciles; mints a fresh one once no live attempt remains, so a genuinely
 * later submission is recorded as its own event rather than reconciling into an older row.
 */
export function loadSubmissionAttempt(key: string, options: LoadAttemptOptions): SubmissionAttempt {
  const now = options.now ?? new Date();
  const mint = options.mint ?? (() => crypto.randomUUID());
  const existing = readRaw(key);
  if (existing) {
    const startedAt = new Date(existing.startedAt).valueOf();
    if (Number.isFinite(startedAt) && now.valueOf() - startedAt < options.ttlMs) return existing;
    clearSubmissionAttempt(key);
  }
  const created: SubmissionAttempt = { attemptId: mint(), startedAt: now.toISOString() };
  writeRaw(key, created);
  return created;
}

/**
 * Marks an attempt as server-accepted without retiring it.
 *
 * The distinction matters: "the write committed" and "this client has seen it committed"
 * are different facts, and only the second one makes it safe to forget the identity that
 * would reconcile a retry.
 */
export function markSubmissionAcknowledged(key: string, now: Date = new Date()): void {
  const existing = readRaw(key);
  if (!existing) return;
  writeRaw(key, { ...existing, acknowledgedAt: now.toISOString() });
}

/** Records the idempotency key an attempt submitted, so persisted state can retire it. */
export function rememberSubmittedKey(key: string, idempotencyKey: string): void {
  const existing = readRaw(key);
  if (!existing) return;
  writeRaw(key, { ...existing, lastKey: idempotencyKey });
}

/**
 * Retires the attempt when persisted canonical state proves it landed.
 *
 * Called on every render with what the server actually returned, so a lost response is
 * reconciled by the next revalidation rather than leaving a token that would make a later
 * honest re-submission collide with the row it already wrote.
 */
/**
 * Retires ANY pending attempt under `prefix` whose submitted key now appears in persisted
 * state, without needing to reconstruct that attempt's storage key.
 *
 * A Material Action attempt is keyed partly by a digest of the draft, which the canonical
 * projection does not carry — so it cannot be addressed the way an Observation attempt can.
 * Matching on the submitted idempotency key instead is exact: that key is what was sent,
 * and finding it persisted is proof this attempt landed.
 */
export function reconcileSubmissionAttemptsByKey(prefix: string, persistedKeys: readonly string[]): void {
  const wanted = new Set(persistedKeys);
  const candidates = new Set<string>(fallback.keys());
  const backing = store();
  if (backing) {
    try {
      for (let index = 0; index < backing.length; index += 1) {
        const key = backing.key(index);
        if (key && key.startsWith(prefix)) candidates.add(key);
      }
    } catch {
      // Enumeration can be denied by policy; the in-memory keys still reconcile.
    }
  }
  for (const key of candidates) {
    if (!key.startsWith(prefix)) continue;
    const pending = readRaw(key);
    if (pending?.lastKey && wanted.has(pending.lastKey)) clearSubmissionAttempt(key);
  }
}

export function reconcileSubmissionAttempt(key: string, persistedKeys: readonly string[]): void {
  const pending = readRaw(key);
  if (!pending?.lastKey) return;
  if (persistedKeys.includes(pending.lastKey)) clearSubmissionAttempt(key);
}
