import type {
  ProjectManagerRow,
  PMAssignmentRow,
  PMProfileRow,
} from "@/lib/db/database-contract";

export type { ProjectManagerRow, PMAssignmentRow, PMProfileRow };

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type ProjectManagerStatus = "active" | "inactive" | "suspended";

export type PMAssignmentType = "primary" | "secondary" | "program" | "observer";

export type PMRole =
  | "project_manager"
  | "senior_pm"
  | "program_manager"
  | "portfolio_manager";

export type PMExperienceLevel = "junior" | "mid" | "senior" | "principal";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PM_ASSIGNMENT_TYPES: PMAssignmentType[] = [
  "primary",
  "secondary",
  "program",
  "observer",
];

export const PM_STATUSES: ProjectManagerStatus[] = [
  "active",
  "inactive",
  "suspended",
];

export const PM_ROLES: PMRole[] = [
  "project_manager",
  "senior_pm",
  "program_manager",
  "portfolio_manager",
];

export const PM_EXPERIENCE_LEVELS: PMExperienceLevel[] = [
  "junior",
  "mid",
  "senior",
  "principal",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type PMRegistryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string; details?: Record<string, unknown> };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type PMRegistryEventType =
  | "PROJECT_MANAGER_REGISTERED"
  | "PROJECT_MANAGER_UPDATED"
  | "PROJECT_MANAGER_ASSIGNED"
  | "PROJECT_MANAGER_UNASSIGNED"
  | "PROJECT_MANAGER_PROFILE_UPDATED";

// ─── Input Types ──────────────────────────────────────────────────────────────

export type RegisterProjectManagerInput = {
  workspaceId: string;
  displayName: string;
  email: string;
  userId?: string;
  joinedAt?: string;
  actorId?: string;
};

export type UpdateProjectManagerInput = {
  workspaceId: string;
  pmId: string;
  displayName?: string;
  email?: string;
  status?: ProjectManagerStatus;
  actorId?: string;
};

export type AssignProjectManagerInput = {
  workspaceId: string;
  pmId: string;
  projectId: string;
  assignmentType: PMAssignmentType;
  actorId?: string;
};

export type UnassignProjectManagerInput = {
  workspaceId: string;
  pmId: string;
  projectId: string;
  assignmentType: PMAssignmentType;
  actorId?: string;
};

export type ListProjectManagerProjectsInput = {
  workspaceId: string;
  pmId: string;
  includeRemoved?: boolean;
};

export type GetProjectManagerProfileInput = {
  workspaceId: string;
  pmId: string;
};

export type UpdatePMProfileInput = {
  workspaceId: string;
  pmId: string;
  role?: PMRole;
  experienceLevel?: PMExperienceLevel;
  capacityLimit?: number;
  activeProjectsLimit?: number;
  actorId?: string;
};

// ─── Composite Types ──────────────────────────────────────────────────────────

export type PMWithProfile = ProjectManagerRow & {
  profile: PMProfileRow | null;
};

export type PMAssignmentWithProject = PMAssignmentRow & {
  project_name?: string;
};
