// ─────────────────────────────────────────────────────────────────────────────
// PM Registry Foundation — Explain Capability
// ─────────────────────────────────────────────────────────────────────────────

export type PMRegistryExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  dataModel: {
    projectManagers: object;
    pmAssignments: object;
    pmProfiles: object;
  };
  assignmentModel: {
    types: Record<string, string>;
    rules: string[];
  };
  responsibilityModel: object;
  ownershipRules: Array<{ number: number; statement: string }>;
  capacityModel: object;
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  pmRoles: string[];
  pmStatuses: string[];
  assignmentTypes: string[];
  experienceLevels: string[];
  lineageChain: string[];
  useCases: string[];
};

export function explainPMRegistry(): PMRegistryExplanation {
  return {
    concept:
      "The PM Registry Foundation introduces the Project Manager as a first-class governed entity " +
      "within PMFreak. Before this sprint, PMFreak knew Projects and Workspaces. Now it knows " +
      "Project Managers — who they are, which projects they govern, and what their capacity and " +
      "responsibilities look like. This creates the foundation for PM Performance Intelligence, " +
      "Capacity Intelligence, and PMO Governance Intelligence in future sprints.",

    principles: [
      { number: 1, statement: "Every project must have a responsible PM — accountability is mandatory, not optional." },
      { number: 2, statement: "PMs are workspace-scoped entities — they exist within a workspace, not globally." },
      { number: 3, statement: "Every PM action is auditable — registration, updates, assignments, and unassignments all emit events." },
      { number: 4, statement: "A project may have multiple PMs but only one primary — governance clarity requires a single point of accountability." },
      { number: 5, statement: "Assignment types encode the PM's governance role on a project — primary is responsible, secondary supports, program oversees a program, observer monitors without authority." },
      { number: 6, statement: "Duplicate active assignments are prohibited — consistency and integrity of the registry are enforced at the database level." },
    ],

    dataModel: {
      projectManagers: {
        description:
          "Core PM entity. Workspace-scoped. Optionally linked to an auth user. " +
          "Carries display identity (name, email) and lifecycle status.",
        fields: {
          id: "UUID primary key",
          workspace_id: "Workspace scope (mandatory)",
          user_id: "Optional link to auth.users — a PM may be registered before they have a system account",
          display_name: "Human-readable name for display across the system",
          email: "Contact email, unique within workspace",
          status: "active | inactive | suspended",
          joined_at: "When the PM formally joined this workspace",
          created_at: "Record creation timestamp",
          updated_at: "Last modification timestamp",
        },
      },
      pmAssignments: {
        description:
          "Auditable PM-to-Project association records. Soft-deleted via removed_at. " +
          "Each row represents a specific governance role of a PM on a project.",
        fields: {
          id: "UUID primary key",
          workspace_id: "Workspace scope (mandatory for isolation)",
          pm_id: "References project_managers",
          project_id: "References projects",
          assignment_type: "primary | secondary | program | observer",
          assigned_at: "When this assignment became effective",
          removed_at: "When this assignment ended (null = still active)",
        },
        constraints: [
          "Unique constraint: only one active primary per (workspace, project)",
          "Unique constraint: no duplicate active (workspace, pm, project, type)",
        ],
      },
      pmProfiles: {
        description:
          "PM governance profile capturing role seniority, experience level, and capacity parameters. " +
          "One profile per PM per workspace. Created on first assignment or explicit profile update.",
        fields: {
          id: "UUID primary key",
          workspace_id: "Workspace scope",
          pm_id: "References project_managers (unique per workspace)",
          role: "project_manager | senior_pm | program_manager | portfolio_manager",
          experience_level: "junior | mid | senior | principal",
          capacity_limit: "Max capacity percentage (0-100). Foundation for Capacity Intelligence.",
          active_projects_limit: "Max active projects. Foundation for Capacity Intelligence.",
          created_at: "Profile creation timestamp",
          updated_at: "Last modification timestamp",
        },
      },
    },

    assignmentModel: {
      types: {
        primary:
          "Full ownership and accountability. Exactly one primary PM per project. " +
          "This PM is the single point of governance accountability.",
        secondary:
          "Supporting PM. Assists the primary. No exclusive constraint. " +
          "Can be assigned while a primary exists.",
        program:
          "Program-level oversight. Used when a PM governs a project as part of " +
          "a broader program hierarchy.",
        observer:
          "Read-only governance observer. Monitors project health without direct authority. " +
          "Useful for governance boards and audit trails.",
      },
      rules: [
        "Only one active primary assignment per project (enforced by unique partial index).",
        "No duplicate active assignments for same PM + project + type (enforced by unique partial index).",
        "Assignments are soft-deleted — removed_at is set rather than deleting the row.",
        "Historical assignments are preserved for full audit trail.",
        "A PM may have multiple assignment types on the same project (e.g., primary on one, observer on another).",
      ],
    },

    responsibilityModel: {
      description:
        "PM responsibility is tracked through assignment types and profiles. " +
        "The primary PM bears governance accountability. Secondary and program PMs share execution. " +
        "The profile captures capacity context for future intelligence.",
      responsibilityChain: [
        "Portfolio Manager → oversees multiple programs and workspaces",
        "Program Manager → governs program-level projects",
        "Senior PM → leads complex or strategic projects",
        "Project Manager → owns day-to-day project governance",
      ],
    },

    ownershipRules: [
      { number: 1, statement: "Primary assignment = governance ownership. The primary PM is accountable for project health signals, escalations, and constitutional compliance." },
      { number: 2, statement: "Secondary assignment = execution support. Secondary PMs share workload without taking governance ownership." },
      { number: 3, statement: "Program assignment = hierarchical governance. Program PMs govern the project as part of a program board." },
      { number: 4, statement: "Observer assignment = passive governance. Observers have visibility without authority." },
      { number: 5, statement: "Ownership transfer requires explicit unassign + reassign. No implicit transfer." },
    ],

    capacityModel: {
      description:
        "Capacity parameters are stored in pm_profiles as the foundation for future Capacity Intelligence. " +
        "This sprint only registers the parameters — enforcement and intelligence are Sprint 2+.",
      parameters: {
        capacity_limit:
          "Percentage-based workload ceiling (0-100). 100 = fully allocated. " +
          "Future intelligence will compare this against active project load.",
        active_projects_limit:
          "Maximum number of concurrent active projects. " +
          "Future intelligence will alert when a PM approaches or exceeds this limit.",
      },
      note: "Capacity enforcement and alerts are NOT part of this sprint. This sprint only registers the limits.",
    },

    auditEvents: [
      "PROJECT_MANAGER_REGISTERED",
      "PROJECT_MANAGER_UPDATED",
      "PROJECT_MANAGER_ASSIGNED",
      "PROJECT_MANAGER_UNASSIGNED",
      "PROJECT_MANAGER_PROFILE_UPDATED",
    ],

    businessRules: [
      { number: 1, statement: "Every project must have a PM responsible for it." },
      { number: 2, statement: "A PM can administer multiple projects." },
      { number: 3, statement: "A project can have multiple PMs, but only one primary." },
      { number: 4, statement: "Assignments are auditable — every assignment and unassignment is recorded." },
      { number: 5, statement: "Workspace isolation is mandatory — no cross-workspace PM access." },
      { number: 6, statement: "Duplicate active assignments are not permitted." },
      { number: 7, statement: "Every modification generates an audit event." },
    ],

    pmRoles: [
      "project_manager",
      "senior_pm",
      "program_manager",
      "portfolio_manager",
    ],

    pmStatuses: [
      "active",
      "inactive",
      "suspended",
    ],

    assignmentTypes: [
      "primary",
      "secondary",
      "program",
      "observer",
    ],

    experienceLevels: [
      "junior",
      "mid",
      "senior",
      "principal",
    ],

    lineageChain: [
      "Workspace",
      "Project Manager",
      "PM Profile",
      "PM Assignment",
      "Project",
      "Governance Signals (future)",
      "PM Performance Intelligence (future)",
      "Capacity Intelligence (future)",
      "PMO Command Center (future)",
    ],

    useCases: [
      "Register a new PM in a workspace: registerProjectManager() — creates the PM entity with identity and status.",
      "Assign a PM as primary owner of a project: assignProjectManager() with type=primary — establishes governance accountability.",
      "Add a secondary PM to support delivery: assignProjectManager() with type=secondary — shares execution without transferring ownership.",
      "Transfer primary ownership: unassignProjectManager() the current primary, then assignProjectManager() with type=primary for the new PM.",
      "Deactivate a PM on leave: updateProjectManager() with status=inactive — preserves history, prevents new assignments.",
      "Query all projects a PM is responsible for: listProjectManagerProjects() — returns active assignments with project references.",
      "Configure PM capacity for future intelligence: upsertPMProfile() — sets capacity_limit and active_projects_limit for Sprint 2 Capacity Intelligence.",
    ],
  };
}
