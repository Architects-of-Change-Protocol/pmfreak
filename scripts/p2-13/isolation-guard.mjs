/**
 * P2-13 — fail-closed isolation guard.
 *
 * PURE MODULE (except for reading the env object handed to it). Everything is
 * a decision over explicit inputs so the guard itself is unit-testable without
 * infrastructure.
 *
 * The rule this file exists to enforce (P2-13 §0, §11):
 *
 *   unknown target                     -> REFUSE
 *   remote target                      -> REFUSE
 *   production target                  -> REFUSE
 *   missing explicit P2-13 opt-in      -> REFUSE
 *   missing destructive opt-in (reset) -> REFUSE
 *   local isolated target + opt-in     -> ALLOW
 *
 * There is deliberately no "probably localhost" heuristic anywhere below: a
 * signal either proves what it claims or it is a refusal. Several independent
 * signals must agree, so one misconfigured variable cannot open the gate.
 */

/** Literal loopback hosts only. A name that merely *contains* "localhost" is not enough. */
export const LOOPBACK_HOSTS = Object.freeze(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** The disposable local Supabase stack this repository standardises on. */
export const EXPECTED_SUPABASE_PORT = "54321";
export const EXPECTED_DATABASE_PORT = "54322";
export const EXPECTED_APP_ORIGIN = "http://localhost:3000";

/** Target classification emitted on success. Reported; never inferred later. */
export const LOCAL_ISOLATED = "LOCAL_ISOLATED";

/**
 * Hosts that are categorically not a disposable local target. Loopback checks
 * already exclude every one of these; this list is a second, independent
 * refusal so a future relaxation of the loopback rule cannot silently expose
 * hosted infrastructure.
 */
export const FORBIDDEN_HOST_PATTERNS = Object.freeze([
  /\.supabase\.co$/i,
  /\.supabase\.in$/i,
  /\.supabase\.net$/i,
  /\.supabase\.com$/i,
  /\.vercel\.app$/i,
  /\.fly\.dev$/i,
  /\.onrender\.com$/i,
  /(^|[.-])prod([.-]|$)/i,
  /(^|[.-])production([.-]|$)/i,
  /(^|[.-])staging([.-]|$)/i,
  /(^|[.-])stage([.-]|$)/i,
]);

/** Modes, ordered by how much authority they need. */
export const GUARD_MODES = Object.freeze({
  READ: "read",
  SEED: "seed",
  DESTRUCTIVE: "destructive",
});

function parseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function hostOf(url) {
  // `URL.hostname` strips the brackets IPv6 literals are written with, so
  // compare both forms rather than assuming one spelling.
  return url.hostname;
}

function isLoopback(url) {
  const host = hostOf(url);
  return LOOPBACK_HOSTS.includes(host) || LOOPBACK_HOSTS.includes(`[${host}]`);
}

function forbiddenHostMatch(url) {
  const host = hostOf(url);
  return FORBIDDEN_HOST_PATTERNS.find((pattern) => pattern.test(host)) ?? null;
}

function signal(name, ok, detail) {
  return { signal: name, ok: Boolean(ok), detail };
}

/**
 * Classify the configured target.
 *
 * Returns a plain object; it never throws and never prints. Callers decide
 * what to do with a refusal, which keeps the guard usable from tests.
 */
export function classifyP2_13Target(env = {}, options = {}) {
  const mode = options.mode ?? GUARD_MODES.SEED;
  if (!Object.values(GUARD_MODES).includes(mode)) {
    return {
      ok: false,
      mode,
      classification: "UNKNOWN",
      signals: [],
      refusals: [`unknown_guard_mode:${mode}`],
    };
  }

  const needsDestructiveAuthority = mode === GUARD_MODES.DESTRUCTIVE;
  const needsWriteCredentials = mode !== GUARD_MODES.READ;

  const supabaseUrlRaw = env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
  const appUrlRaw = env.OPERATIONAL_FLOW_TEST_BASE_URL;
  const databaseUrlRaw = env.OPERATIONAL_FLOW_TEST_DATABASE_URL;

  const supabaseUrl = parseUrl(supabaseUrlRaw);
  const appUrl = parseUrl(appUrlRaw);
  // A postgres URL is not parseable by WHATWG URL under its own scheme in a
  // way that exposes host/port consistently, so normalise the scheme first.
  // The credentials in it are never read, only the host and port.
  const databaseUrl = parseUrl(
    typeof databaseUrlRaw === "string"
      ? databaseUrlRaw.replace(/^postgres(ql)?:\/\//i, "http://")
      : databaseUrlRaw,
  );

  const signals = [];

  signals.push(
    signal(
      "explicit_p2_13_opt_in",
      env.P2_13_FOUNDER_FIXTURE_ENABLED === "true",
      'P2_13_FOUNDER_FIXTURE_ENABLED must be the exact string "true"',
    ),
  );

  if (needsDestructiveAuthority) {
    signals.push(
      signal(
        "explicit_local_reset_opt_in",
        env.P2_13_ALLOW_LOCAL_RESET === "true",
        'P2_13_ALLOW_LOCAL_RESET must be the exact string "true" for reset/reseed',
      ),
    );
    signals.push(
      signal(
        "existing_destructive_opt_in",
        env.OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE === "true",
        'the repository-canonical OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE must also be "true"',
      ),
    );
  }

  signals.push(
    signal(
      "node_env_not_production",
      env.NODE_ENV !== "production",
      "NODE_ENV must not be production",
    ),
  );

  signals.push(
    signal(
      "remote_override_absent",
      env.OPERATIONAL_FLOW_TEST_ALLOW_REMOTE !== "true",
      "P2-13 never honours OPERATIONAL_FLOW_TEST_ALLOW_REMOTE; a remote target is always refused",
    ),
  );

  signals.push(
    signal(
      "supabase_url_parsable",
      Boolean(supabaseUrl),
      "OPERATIONAL_FLOW_TEST_SUPABASE_URL must be a valid URL",
    ),
  );
  signals.push(
    signal(
      "supabase_url_loopback",
      Boolean(supabaseUrl) && isLoopback(supabaseUrl),
      `OPERATIONAL_FLOW_TEST_SUPABASE_URL must use a literal loopback host (${LOOPBACK_HOSTS.join(", ")})`,
    ),
  );
  signals.push(
    signal(
      "supabase_url_expected_port",
      Boolean(supabaseUrl) && supabaseUrl.port === EXPECTED_SUPABASE_PORT,
      `OPERATIONAL_FLOW_TEST_SUPABASE_URL must use the disposable local API port ${EXPECTED_SUPABASE_PORT}`,
    ),
  );
  signals.push(
    signal(
      "supabase_url_plaintext_loopback_scheme",
      Boolean(supabaseUrl) && supabaseUrl.protocol === "http:",
      "a disposable local Supabase API is served over http on loopback; https indicates a hosted target",
    ),
  );

  signals.push(
    signal(
      "app_origin_exact",
      typeof appUrlRaw === "string" && appUrlRaw.replace(/\/$/, "") === EXPECTED_APP_ORIGIN,
      `OPERATIONAL_FLOW_TEST_BASE_URL must be exactly ${EXPECTED_APP_ORIGIN}`,
    ),
  );

  signals.push(
    signal(
      "app_and_harness_share_one_target",
      typeof env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
        typeof supabaseUrlRaw === "string" &&
        env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "") === supabaseUrlRaw.replace(/\/$/, ""),
      "the running app (NEXT_PUBLIC_SUPABASE_URL) and this harness must address the same database",
    ),
  );

  if (needsDestructiveAuthority) {
    signals.push(
      signal(
        "database_url_parsable",
        Boolean(databaseUrl),
        "OPERATIONAL_FLOW_TEST_DATABASE_URL must be a valid postgres URL for scoped cleanup",
      ),
    );
    signals.push(
      signal(
        "database_url_loopback",
        Boolean(databaseUrl) && isLoopback(databaseUrl),
        "OPERATIONAL_FLOW_TEST_DATABASE_URL must use a literal loopback host",
      ),
    );
    signals.push(
      signal(
        "database_url_expected_port",
        Boolean(databaseUrl) && databaseUrl.port === EXPECTED_DATABASE_PORT,
        `OPERATIONAL_FLOW_TEST_DATABASE_URL must use the disposable local database port ${EXPECTED_DATABASE_PORT}`,
      ),
    );
  }

  const forbidden = [
    ["OPERATIONAL_FLOW_TEST_SUPABASE_URL", supabaseUrl],
    ["OPERATIONAL_FLOW_TEST_BASE_URL", appUrl],
    ["OPERATIONAL_FLOW_TEST_DATABASE_URL", databaseUrl],
  ]
    .filter(([, url]) => Boolean(url))
    .map(([name, url]) => [name, forbiddenHostMatch(url)])
    .filter(([, match]) => Boolean(match));

  signals.push(
    signal(
      "no_known_hosted_or_production_host",
      forbidden.length === 0,
      forbidden.length === 0
        ? "no configured host matches a hosted/staging/production pattern"
        : `refused hosts: ${forbidden.map(([name]) => name).join(", ")}`,
    ),
  );

  signals.push(
    signal(
      "anon_key_present",
      Boolean(env.OPERATIONAL_FLOW_TEST_ANON_KEY),
      "OPERATIONAL_FLOW_TEST_ANON_KEY is required",
    ),
  );
  signals.push(
    signal(
      "service_role_key_present",
      Boolean(env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY),
      "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY is required for fixture prerequisite setup only",
    ),
  );

  if (needsWriteCredentials) {
    signals.push(
      signal(
        "fixture_actor_password_present",
        typeof env.P2_13_FIXTURE_ACTOR_PASSWORD === "string" &&
          env.P2_13_FIXTURE_ACTOR_PASSWORD.length >= 12,
        "P2_13_FIXTURE_ACTOR_PASSWORD must be supplied by the environment (never hardcoded) and be at least 12 characters",
      ),
    );
  }

  const refusals = signals.filter((entry) => !entry.ok).map((entry) => entry.signal);

  return {
    ok: refusals.length === 0,
    mode,
    classification: refusals.length === 0 ? LOCAL_ISOLATED : "UNKNOWN",
    // Non-secret target description only: host and port, never credentials.
    target: {
      supabaseHost: supabaseUrl ? `${hostOf(supabaseUrl)}:${supabaseUrl.port || "(default)"}` : null,
      appOrigin: typeof appUrlRaw === "string" ? appUrlRaw.replace(/\/$/, "") : null,
      databaseHost: databaseUrl ? `${hostOf(databaseUrl)}:${databaseUrl.port || "(default)"}` : null,
    },
    signals,
    refusals,
  };
}

/** Convenience wrapper: refuse loudly, with the exact failing signals. */
export function assertIsolatedTarget(env, options) {
  const verdict = classifyP2_13Target(env, options);
  if (!verdict.ok) {
    const detail = verdict.signals
      .filter((entry) => !entry.ok)
      .map((entry) => `  - ${entry.signal}: ${entry.detail}`)
      .join("\n");
    const error = new Error(
      `P2-13 SAFETY REFUSAL (mode=${verdict.mode}). The target could not be proven local and isolated:\n${detail}`,
    );
    error.verdict = verdict;
    error.code = "P2_13_ISOLATION_REFUSED";
    throw error;
  }
  return verdict;
}
