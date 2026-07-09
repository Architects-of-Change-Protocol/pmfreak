export type PMFreakAocGovernanceClientEnvironment =
  | "demo"
  | "development"
  | "staging"
  | "production";

export type PMFreakAocGovernanceTransportKind =
  | "local_mock"
  | "remote_http"
  | "unsupported_remote";

export type PMFreakAocGovernanceRequestMode = "dry_run" | "evaluate_only";

export type PMFreakAocGovernanceRedactionMode = "none" | "safe_demo" | "strict";
