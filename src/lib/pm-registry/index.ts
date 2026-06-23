// ─────────────────────────────────────────────────────────────────────────────
// PM Registry Foundation — Public API
// Sprint 1: Project Manager as first-class governed entity
// ─────────────────────────────────────────────────────────────────────────────

// PM Registry
export {
  registerProjectManager,
  updateProjectManager,
  getProjectManager,
  listProjectManagers,
} from "./pm-registry";

// PM Assignments
export {
  assignProjectManager,
  unassignProjectManager,
  listProjectManagerProjects,
  listProjectAssignments,
  getActiveAssignment,
} from "./pm-assignments";

// PM Profiles
export {
  getProjectManagerProfile,
  upsertPMProfile,
  updatePMProfile,
} from "./pm-profiles";

// Explain
export { explainPMRegistry } from "./explain";
export type { PMRegistryExplanation } from "./explain";

// Types
export type {
  ProjectManagerRow,
  PMAssignmentRow,
  PMProfileRow,
  ProjectManagerStatus,
  PMAssignmentType,
  PMRole,
  PMExperienceLevel,
  PMRegistryResult,
  PMRegistryEventType,
  RegisterProjectManagerInput,
  UpdateProjectManagerInput,
  AssignProjectManagerInput,
  UnassignProjectManagerInput,
  ListProjectManagerProjectsInput,
  GetProjectManagerProfileInput,
  UpdatePMProfileInput,
  PMWithProfile,
  PMAssignmentWithProject,
} from "./types";

export {
  PM_ASSIGNMENT_TYPES,
  PM_STATUSES,
  PM_ROLES,
  PM_EXPERIENCE_LEVELS,
} from "./types";
