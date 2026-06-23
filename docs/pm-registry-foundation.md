# PM Registry Foundation

Sprint 1 — PM Registry Foundation introduces the Project Manager as a first-class governed entity in PMFreak.

## Architecture

The PM Registry is a workspace-scoped domain module under `src/lib/pm-registry/`. It follows the same layered pattern as other PMFreak domain modules:

```
src/lib/pm-registry/
├── types.ts            — Domain types, constants, result types, input types
├── pm-registry.ts      — PM CRUD (register, update, get, list)
├── pm-assignments.ts   — Assignment lifecycle (assign, unassign, list)
├── pm-profiles.ts      — PM profile upsert and retrieval
├── explain.ts          — explainPMRegistry() — full system explanation
└── index.ts            — Public API surface
```

The database contract entries live in `src/lib/db/database-contract.ts` and the migration in `supabase/migrations/20260623000000_pm_registry_foundation.sql`.

## Data Model

### project_managers

Core PM entity. One record per PM per workspace. Optionally linked to a system user.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace scope (mandatory) |
| user_id | uuid? | Optional link to auth.users |
| display_name | text | Human-readable name |
| email | text | Contact email, unique within workspace |
| status | text | `active` \| `inactive` \| `suspended` |
| joined_at | timestamptz | When PM formally joined the workspace |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last modification |

### pm_assignments

Auditable PM↔Project relationship. Soft-deleted via `removed_at`.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace scope |
| pm_id | uuid | References project_managers |
| project_id | uuid | References projects |
| assignment_type | text | `primary` \| `secondary` \| `program` \| `observer` |
| assigned_at | timestamptz | Assignment effective date |
| removed_at | timestamptz? | Null = active. Set = removed. |

Database constraints enforce:
- Only one active `primary` assignment per `(workspace_id, project_id)` (partial unique index)
- No duplicate active `(workspace_id, pm_id, project_id, assignment_type)` (partial unique index)

### pm_profiles

PM governance profile. One per PM per workspace.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| workspace_id | uuid | Workspace scope |
| pm_id | uuid | References project_managers (unique per workspace) |
| role | text | `project_manager` \| `senior_pm` \| `program_manager` \| `portfolio_manager` |
| experience_level | text | `junior` \| `mid` \| `senior` \| `principal` |
| capacity_limit | integer | Max capacity % (0-100). Foundation for Capacity Intelligence. |
| active_projects_limit | integer | Max active projects. Foundation for Capacity Intelligence. |
| created_at | timestamptz | Profile creation |
| updated_at | timestamptz | Last modification |

## Assignments

Assignment types encode the PM's governance role on a project:

| Type | Meaning |
|------|---------|
| `primary` | Full ownership and governance accountability. Only one per project. |
| `secondary` | Supporting PM. Shares execution without owning governance. |
| `program` | Program-level oversight. Governs the project as part of a program. |
| `observer` | Passive monitor. Visibility without authority. |

Assignment rules:
1. Only one active `primary` per project — enforced by unique partial index
2. No duplicate active assignments for same PM + project + type
3. Assignments are soft-deleted (`removed_at` is set, row is preserved)
4. Full assignment history is preserved for audit

## Responsibility Model

```
Portfolio Manager
  └── Program Manager (program assignment on multiple projects)
        └── Senior PM / Project Manager (primary assignment on project)
              └── Secondary PM (secondary assignment, supports delivery)
                    └── Observer (observer assignment, governance visibility)
```

The primary PM bears governance accountability: they are the single point of responsibility for project health signals, escalations, and constitutional compliance.

## Ownership Rules

1. **Primary = ownership**. The primary PM is accountable for project governance.
2. **Secondary = execution support**. Shares workload without transferring accountability.
3. **Program = hierarchical governance**. Governs within a program board context.
4. **Observer = passive governance**. Visibility without authority.
5. **Ownership transfer requires explicit unassign + reassign**. No implicit transfer.

## Audit Events

Every mutation emits an audit event:

| Event | Trigger |
|-------|---------|
| `PROJECT_MANAGER_REGISTERED` | New PM created in workspace |
| `PROJECT_MANAGER_UPDATED` | PM name, email, or status changed |
| `PROJECT_MANAGER_ASSIGNED` | PM assigned to a project |
| `PROJECT_MANAGER_UNASSIGNED` | PM assignment removed from project |
| `PROJECT_MANAGER_PROFILE_UPDATED` | PM profile created or updated |

Events carry `workspace_id`, `pm_id`, and entity-specific metadata.

## Capabilities

```typescript
// Register a new PM
registerProjectManager({ workspaceId, displayName, email, userId?, joinedAt? })

// Update PM identity or status
updateProjectManager({ workspaceId, pmId, displayName?, email?, status? })

// Query PM
getProjectManager(pmId, workspaceId)
listProjectManagers(workspaceId, status?)

// Assign PM to project
assignProjectManager({ workspaceId, pmId, projectId, assignmentType })

// Remove assignment
unassignProjectManager({ workspaceId, pmId, projectId, assignmentType })

// Query assignments
listProjectManagerProjects({ workspaceId, pmId, includeRemoved? })
listProjectAssignments(workspaceId, projectId, activeOnly?)
getActiveAssignment(workspaceId, pmId, projectId, assignmentType)

// Profile
upsertPMProfile({ workspaceId, pmId, role?, experienceLevel?, capacityLimit?, activeProjectsLimit? })
updatePMProfile({ workspaceId, pmId, role?, experienceLevel?, capacityLimit?, activeProjectsLimit? })
getProjectManagerProfile({ workspaceId, pmId })

// Explain
explainPMRegistry()
```

## Examples

### Register a PM and assign as primary

```typescript
import {
  registerProjectManager,
  assignProjectManager,
  upsertPMProfile,
} from "@/lib/pm-registry";

const pm = await registerProjectManager({
  workspaceId: "ws-123",
  displayName: "Ana Lima",
  email: "ana@company.com",
});

await upsertPMProfile({
  workspaceId: "ws-123",
  pmId: pm.data.id,
  role: "senior_pm",
  experienceLevel: "senior",
  capacityLimit: 80,
  activeProjectsLimit: 4,
});

await assignProjectManager({
  workspaceId: "ws-123",
  pmId: pm.data.id,
  projectId: "proj-456",
  assignmentType: "primary",
});
```

### Transfer primary ownership

```typescript
import { unassignProjectManager, assignProjectManager } from "@/lib/pm-registry";

// Remove existing primary
await unassignProjectManager({
  workspaceId, pmId: currentPrimaryId, projectId, assignmentType: "primary",
});

// Assign new primary
await assignProjectManager({
  workspaceId, pmId: newPrimaryId, projectId, assignmentType: "primary",
});
```

### Explain the PM Registry

```typescript
import { explainPMRegistry } from "@/lib/pm-registry";

const explanation = explainPMRegistry();
console.log(explanation.concept);
console.log(explanation.businessRules);
console.log(explanation.assignmentModel);
```

## PM Intelligence Foundation

This sprint establishes the data foundation for future PM intelligence capabilities:

- **PM Performance Intelligence** (future): Uses assignment history and project outcomes to evaluate PM effectiveness.
- **Capacity Intelligence** (future): Uses `capacity_limit` and `active_projects_limit` from `pm_profiles` to detect overallocation and alert before it impacts delivery.
- **PMO Command Center** (future): Aggregates PM assignments, profiles, and signals across the workspace for portfolio-level governance visibility.

The PM Registry is intentionally minimal — it registers the entity and its relationships, without attempting to measure, score, or govern PM behavior. That is the domain of future sprints.
