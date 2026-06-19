// ─── Foundation functions (Sprint 1 API) ─────────────────────────────────────
export {
  createProjectConstitution,
  updateProjectConstitution,
  softDeleteProjectConstitution,
  getProjectConstitution,
  listProjectConstitutions,
  listConstitutions,
  exportConstitution,
} from "./constitution-service";

// ─── Lifecycle functions (Sprint 2 API) ──────────────────────────────────────
export {
  changeConstitutionStatus,
  getConstitutionLifecycleHistory,
} from "./constitution-service";

// ─── State machine ────────────────────────────────────────────────────────────
export { allowedTransitions, TERMINAL_STATES, validateConstitutionTransition } from "./state-machine";

// ─── Explain capabilities ─────────────────────────────────────────────────────
export { explainConstitutionLifecycle } from "./lifecycle-explanation";
export { explainProjectConstitutionCapability } from "./capability-explain";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ConstitutionExport,
  ConstitutionLifecycleEventName,
  ConstitutionLifecycleExplanation,
  ConstitutionLifecycleHistoryEntry,
  ConstitutionListFilters,
  ConstitutionResult,
  ConstitutionStatus,
  CreateProjectConstitutionInput,
  ProjectConstitutionRecord,
  ProjectConstitutionSummary,
  Result,
  SoftDeleteProjectConstitutionInput,
  UpdateProjectConstitutionInput,
} from "./types";
export type { ProjectConstitutionCapabilityExplain } from "./capability-explain";
