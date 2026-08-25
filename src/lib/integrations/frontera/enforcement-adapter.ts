/**
 * The PMFreak -> Frontera enforcement boundary.
 *
 * OWNERSHIP: PMFreak. This is PMFreak's anti-corruption adapter onto the frozen
 * `@aoc-enterprise/runtime` packaged artifact. It translates a PMFreak governed
 * Material Action dispatch intent into Frontera's own request vocabulary, and
 * translates Frontera's decision back into a PMFreak dispatch verdict.
 *
 * What this file is NOT:
 *
 *   * It is not a second PMFreak governance engine. It never reads, recomputes
 *     or reinterprets a PMFreak governance state. `evaluateGovernancePipeline`
 *     and the `dispatch_governed_action_to_internal_task` RPC remain the sole
 *     authorities on whether PMFreak's own workflow has reached an executable
 *     Material Action.
 *   * It is not a provisioning path. It imports the read/evaluate surface only.
 *     `createKernelAuthorityProvisioningService` is deliberately absent, and
 *     the access context built here (`system: false`) can never reach the
 *     store's write path — Frontera enforces that in
 *     `requireKernelAuthorityOperator`, so it is structural rather than a
 *     convention this file could drift away from.
 *
 * The two decisions compose by conjunction and Frontera may only narrow:
 *
 *     FINAL = PMFREAK_PRECONDITIONS  AND  FRONTERA_AUTHORIZATION
 *
 * A Frontera ALLOW can never rescue a PMFreak denial, because the RPC still
 * runs afterwards and re-checks every PMFreak precondition inside its own
 * transaction.
 */
import { createSqliteKernelAuthorityStore, createDurableKernelProviders } from "@aoc-enterprise/runtime/enterprise";
import type { KernelAuthorityStore } from "@aoc-enterprise/runtime/enterprise";
import { createAocKernel } from "@aoc-enterprise/runtime/kernel";
import { resolveFronteraEnforcementConfig, organizationIdForWorkspace } from "./config";

/**
 * The Frontera action PMFreak asks about.
 *
 * `execute.material-action` is Frontera's own documented action for an external
 * application executing a governed material action
 * (`docs/enterprise/AOC_DURABLE_KERNEL_AUTHORITY.md`, "How applications
 * evaluate"). It is used because upstream defines it for exactly this case —
 * not because a PMFreak route or task type was reshaped to look like it.
 */
export const FRONTERA_DISPATCH_ACTION = "execute.material-action";

/**
 * Frontera resource-scope grammar is hierarchical and colon-delimited: a grant
 * on `S` covers a request for `S` and for any `S:child`
 * (`capability-token-service.ts`, `resource === scope || resource.startsWith(scope + ':')`).
 * A grant on one project therefore cannot reach another.
 */
export function fronteraResourceScopeForProject(projectId: string): string {
  return `project:${projectId}`;
}

export type FronteraDispatchAuthorizationRequest = {
  /** PMFreak workspace the governed action belongs to. Becomes the Frontera organization. */
  readonly workspaceId: string;
  /** PMFreak project the governed action targets. Becomes the Frontera resource scope. */
  readonly projectId: string;
  /** The authenticated PMFreak principal asking to dispatch. Becomes the external subject id. */
  readonly principalUserId: string;
  /** The governed Material Action id. Reused as the Frontera request correlation. */
  readonly actionId: string;
};

export type FronteraDenialClass =
  | "frontera_actor_unbound"
  | "frontera_denied"
  | "frontera_unavailable"
  | "frontera_malformed_result";

export type FronteraDispatchAuthorization =
  | {
      readonly allowed: true;
      readonly decisionId: string;
      readonly reasonCodes: readonly string[];
      readonly fronteraActorId: string;
      readonly trustDomainId: string;
    }
  | {
      readonly allowed: false;
      readonly failureClass: FronteraDenialClass;
      readonly reasonCodes: readonly string[];
      readonly decisionId?: string;
      readonly diagnostic?: string;
    };

/**
 * Seam for tests only. Production passes nothing and gets the real packaged
 * runtime; a test may substitute an in-memory `KernelAuthorityStore` (also a
 * real Frontera store, not a stub decision).
 *
 * Note what this seam deliberately cannot do: it supplies a *store*, never a
 * verdict. Every decision below still comes from the real `AocKernel`.
 */
export type FronteraEnforcementDeps = {
  readonly openAuthorityStore?: () => Promise<KernelAuthorityStore>;
  /** When the caller owns the store's lifecycle (tests), it closes it itself. */
  readonly closeStore?: boolean;
};

/**
 * Asks Frontera whether this principal may dispatch this governed Material
 * Action, against durable authority Frontera alone owns.
 *
 * Never throws. Every failure — configuration, store, hydration, kernel,
 * malformed result — resolves to `allowed: false`, because the caller's only
 * safe reading of an exception here would be "do not dispatch", and returning
 * that explicitly is clearer than making every call site remember to catch.
 *
 * Freshness: the store is opened and the world hydrated per evaluation, so a
 * revocation committed by a *different* process (the operator) is observed on
 * the very next dispatch. Frontera's v1 propagation model is single-writer —
 * a long-lived cached provider set would answer out of a world that silently
 * lagged its store, which is precisely how a revoked actor keeps a stale
 * ALLOW. See `DurableKernelProviderSet.reload()` upstream.
 */
export async function authorizeFronteraDispatch(
  request: FronteraDispatchAuthorizationRequest,
  deps: FronteraEnforcementDeps = {},
): Promise<FronteraDispatchAuthorization> {
  const organizationId = organizationIdForWorkspace(request.workspaceId);
  let store: KernelAuthorityStore | undefined;
  let ownsStore = false;

  try {
    if (deps.openAuthorityStore) {
      store = await deps.openAuthorityStore();
      ownsStore = deps.closeStore === true;
    } else {
      const config = resolveFronteraEnforcementConfig();
      store = await createSqliteKernelAuthorityStore(config.authorityStorePath);
      ownsStore = true;
    }

    const externalSubjectSystem = deps.openAuthorityStore
      ? resolveExternalSubjectSystemSafely()
      : resolveFronteraEnforcementConfig().externalSubjectSystem;

    // Organization-scoped READ context. `system: false` is what makes
    // self-provisioning structurally impossible: no context of this shape can
    // reach the store's write path.
    const readContext = { system: false as const, organizationId };

    const actorRecord = await store.findActorByExternalSubject(readContext, organizationId, {
      system: externalSubjectSystem,
      subjectId: request.principalUserId,
    });

    // An unbound principal stays unbound. Nothing is minted here.
    if (!actorRecord || actorRecord.status !== "active") {
      return {
        allowed: false,
        failureClass: "frontera_actor_unbound",
        reasonCodes: actorRecord ? ["FRONTERA_ACTOR_REVOKED"] : ["FRONTERA_ACTOR_UNBOUND"],
      };
    }

    const trustDomainId = actorRecord.trustDomainId;
    if (!trustDomainId) {
      return {
        allowed: false,
        failureClass: "frontera_actor_unbound",
        reasonCodes: ["FRONTERA_ACTOR_TRUST_DOMAIN_MISSING"],
      };
    }

    const providers = await createDurableKernelProviders({ store, organizationId });
    const kernel = createAocKernel({
      recognitionProvider: providers.recognitionProvider,
      clock: providers.clock,
      idGenerator: providers.idGenerator,
    });

    const decision = await kernel.evaluate({
      // The Material Action id IS the request identity. Frontera mints its own
      // decision id; the two are correlated, never conflated.
      requestId: request.actionId,
      actor: { id: actorRecord.entityId, trustDomainId },
      action: {
        type: FRONTERA_DISPATCH_ACTION,
        resourceScope: fronteraResourceScopeForProject(request.projectId),
      },
      organization: { id: organizationId },
      requestedAt: new Date().toISOString(),
    });

    if (!decision || typeof decision.status !== "string" || !Array.isArray(decision.reasonCodes)) {
      return {
        allowed: false,
        failureClass: "frontera_malformed_result",
        reasonCodes: ["FRONTERA_MALFORMED_RESULT"],
      };
    }

    // Only an explicit `allowed` proceeds. `approval_required` and
    // `indeterminate` are not near-misses to be rounded up — they are non-allow.
    if (decision.status !== "allowed") {
      return {
        allowed: false,
        failureClass: "frontera_denied",
        reasonCodes: decision.reasonCodes,
        decisionId: decision.decisionId,
      };
    }

    return {
      allowed: true,
      decisionId: decision.decisionId,
      reasonCodes: decision.reasonCodes,
      fronteraActorId: actorRecord.entityId,
      trustDomainId,
    };
  } catch (error) {
    // Infrastructure failure is reported as its own class rather than dressed
    // up as a policy denial — the distinction matters to an operator — but both
    // fail closed with respect to dispatch.
    return {
      allowed: false,
      failureClass: "frontera_unavailable",
      reasonCodes: ["FRONTERA_EVALUATION_UNAVAILABLE"],
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (store && ownsStore) {
      try {
        await store.close();
      } catch {
        // A close failure cannot retroactively authorize anything.
      }
    }
  }
}

function resolveExternalSubjectSystemSafely(): string {
  try {
    return resolveFronteraEnforcementConfig().externalSubjectSystem;
  } catch {
    // A test supplying its own store need not configure a store path.
    return "pmfreak";
  }
}
