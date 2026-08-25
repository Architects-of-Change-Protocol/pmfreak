/**
 * Deployment configuration for the PMFreak -> Frontera enforcement boundary.
 *
 * OWNERSHIP: PMFreak. This file configures how PMFreak *reaches* Frontera; it
 * defines no authority of its own and can grant nothing.
 *
 * The SQLite path reuses Frontera's own documented configuration name
 * (`AOC_ENTERPRISE_KERNEL_AUTHORITY_SQLITE_PATH`, see
 * `docs/enterprise/AOC_DURABLE_KERNEL_AUTHORITY.md` upstream) rather than
 * minting a PMFreak synonym for the same file, so an operator configures one
 * store once for every process that reads it.
 *
 * There is deliberately no `AOC_ENTERPRISE_KERNEL_AUTHORITY_ORGANIZATION_ID`
 * here. That variable pins a single-organization Frontera host to one
 * organization; PMFreak serves many tenants in one process and derives the
 * organization from the workspace being acted in (see `organizationIdForWorkspace`).
 * Reading a process-wide organization id would be exactly the cross-tenant
 * bug this boundary exists to prevent.
 */

/** The external identity system PMFreak presents itself as to Frontera. */
export const DEFAULT_FRONTERA_EXTERNAL_SUBJECT_SYSTEM = "pmfreak";

export type FronteraEnforcementConfig = {
  /** Absolute or process-relative path to the Frontera-owned authority SQLite store. */
  readonly authorityStorePath: string;
  /** `KernelAuthorityExternalSubject.system` for every PMFreak principal. */
  readonly externalSubjectSystem: string;
};

export class FronteraConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FronteraConfigurationError";
  }
}

/**
 * Resolves the boundary configuration, or throws.
 *
 * Throwing is the fail-closed behaviour, not an inconvenience: a missing
 * authority store must never degrade into "skip the check". The caller turns
 * this throw into a denial, and no Task is dispatched.
 */
export function resolveFronteraEnforcementConfig(
  env: NodeJS.ProcessEnv = process.env,
): FronteraEnforcementConfig {
  const authorityStorePath = env.AOC_ENTERPRISE_KERNEL_AUTHORITY_SQLITE_PATH?.trim();
  if (!authorityStorePath) {
    throw new FronteraConfigurationError(
      "AOC_ENTERPRISE_KERNEL_AUTHORITY_SQLITE_PATH is not configured; the Frontera authority store cannot be read.",
    );
  }
  const externalSubjectSystem =
    env.PMFREAK_FRONTERA_EXTERNAL_SUBJECT_SYSTEM?.trim() || DEFAULT_FRONTERA_EXTERNAL_SUBJECT_SYSTEM;
  return { authorityStorePath, externalSubjectSystem };
}

/**
 * PMFreak workspace -> Frontera organization.
 *
 * The workspace is PMFreak's tenancy root: `workspace_memberships` carries
 * every authority grant, every project belongs to exactly one workspace, and
 * RLS isolates on it. There is no PMFreak entity above a workspace, so the
 * workspace is the only honest candidate for the Frontera organization — the
 * boundary Frontera refuses to answer across.
 *
 * Identity, not a formatted string: a prefix would have to be parsed back out
 * somewhere, and two spellings of one tenant boundary is how cross-tenant
 * leaks start.
 */
export function organizationIdForWorkspace(workspaceId: string): string {
  return workspaceId;
}
