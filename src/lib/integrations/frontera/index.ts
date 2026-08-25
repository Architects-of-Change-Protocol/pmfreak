/**
 * PMFreak's Frontera integration boundary.
 *
 * Only the read/evaluate surface is re-exported. Frontera's operator
 * provisioning surface is intentionally NOT reachable from here, so no product
 * module can acquire it by importing this barrel.
 */
export {
  authorizeFronteraDispatch,
  fronteraResourceScopeForProject,
  FRONTERA_DISPATCH_ACTION,
} from "./enforcement-adapter";
export type {
  FronteraDispatchAuthorization,
  FronteraDispatchAuthorizationRequest,
  FronteraDenialClass,
  FronteraEnforcementDeps,
} from "./enforcement-adapter";
export {
  organizationIdForWorkspace,
  resolveFronteraEnforcementConfig,
  FronteraConfigurationError,
  DEFAULT_FRONTERA_EXTERNAL_SUBJECT_SYSTEM,
} from "./config";
export type { FronteraEnforcementConfig } from "./config";
