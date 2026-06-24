/**
 * PM Registry Operationalization Tests
 *
 * Tests the production service layer behavior including:
 * - Domain/service validation rules
 * - Audit event emission on mutations
 * - Assignment constraint enforcement
 * - Profile validation
 *
 * Uses an in-memory implementation that mirrors the production service contracts.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow() {
  return new Date().toISOString();
}

// ─── Production-mirroring store ───────────────────────────────────────────────
// This store mirrors the exact validation contracts of the production service
// functions (pm-registry.ts, pm-assignments.ts, pm-profiles.ts).
// Tests here validate contracts; integration tests against the real Supabase
// client are in the CI database test suite.

function createStore() {
  const pms = new Map();
  const assignments = new Map();
  const profiles = new Map();
  const auditLog = [];

  const PM_ASSIGNMENT_TYPES = ["primary", "secondary", "program", "observer"];
  const PM_STATUSES = ["active", "inactive", "suspended"];
  const PM_ROLES = ["project_manager", "senior_pm", "program_manager", "portfolio_manager"];
  const PM_EXPERIENCE_LEVELS = ["junior", "mid", "senior", "principal"];

  function validation(error) { return { ok: false, error, failureClass: "validation" }; }
  function notFound(r = "Resource") { return { ok: false, error: `${r} not found.`, failureClass: "not_found" }; }

  function emitEvent(type, payload) {
    auditLog.push({ type, payload, occurred_at: isoNow() });
  }

  // ── registerProjectManager ────────────────────────────────────────────────

  function registerProjectManager(input) {
    if (!input.workspaceId) return validation("workspaceId is required.");
    if (!input.displayName?.trim()) return validation("displayName is required.");
    if (!input.email?.trim()) return validation("email is required.");

    const email = input.email.trim().toLowerCase();

    for (const pm of pms.values()) {
      if (pm.workspace_id === input.workspaceId && pm.email === email) {
        return validation(`A project manager with email ${email} already exists in this workspace.`);
      }
    }

    const id = uuid();
    const now = isoNow();
    const record = {
      id, workspace_id: input.workspaceId, user_id: input.userId ?? null,
      display_name: input.displayName.trim(), email,
      status: "active", joined_at: input.joinedAt ?? now,
      created_at: now, updated_at: now,
    };
    pms.set(id, record);
    emitEvent("PROJECT_MANAGER_REGISTERED", {
      pm_id: id, workspace_id: input.workspaceId,
      actor_user_id: input.actorId ?? null, source: "pm_registry",
    });
    return { ok: true, data: { ...record } };
  }

  // ── updateProjectManager ──────────────────────────────────────────────────

  function updateProjectManager(input) {
    if (!input.workspaceId) return validation("workspaceId is required.");
    if (!input.pmId) return validation("pmId is required.");

    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const previousStatus = pm.status;

    if (input.displayName !== undefined) {
      if (!input.displayName.trim()) return validation("displayName cannot be empty.");
      pm.display_name = input.displayName.trim();
    }
    if (input.email !== undefined) {
      if (!input.email.trim()) return validation("email cannot be empty.");
      const newEmail = input.email.trim().toLowerCase();
      for (const [eid, existing] of pms) {
        if (eid !== input.pmId && existing.workspace_id === input.workspaceId && existing.email === newEmail) {
          return validation(`Email ${newEmail} is already in use in this workspace.`);
        }
      }
      pm.email = newEmail;
    }
    if (input.status !== undefined) {
      if (!PM_STATUSES.includes(input.status)) return validation("Invalid status.");
      pm.status = input.status;
    }
    pm.updated_at = isoNow();
    emitEvent("PROJECT_MANAGER_UPDATED", {
      pm_id: input.pmId, workspace_id: input.workspaceId,
      actor_user_id: input.actorId ?? null,
      previous_status: previousStatus, new_status: pm.status,
      source: "pm_registry",
    });
    return { ok: true, data: { ...pm } };
  }

  // ── assignProjectManager ──────────────────────────────────────────────────

  // Assignment types that count toward capacity load (observer excluded)
  const CAPACITY_COUNTING_TYPES = ["primary", "secondary", "program"];

  function assignProjectManager(input) {
    if (!input.workspaceId) return validation("workspaceId is required.");
    if (!input.pmId) return validation("pmId is required.");
    if (!input.projectId) return validation("projectId is required.");
    if (!PM_ASSIGNMENT_TYPES.includes(input.assignmentType)) {
      return validation(`Invalid assignmentType: ${input.assignmentType}`);
    }

    // PM must exist and be active
    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) {
      return validation("Project Manager not found in this workspace.");
    }
    if (pm.status !== "active") {
      return validation(`Cannot assign a PM with status '${pm.status}'. Only active PMs may be assigned.`);
    }

    // Capacity enforcement: primary/secondary/program count toward active_projects_limit
    if (CAPACITY_COUNTING_TYPES.includes(input.assignmentType)) {
      const profileKey = `${input.workspaceId}::${input.pmId}`;
      const profile = profiles.get(profileKey);
      const limit = profile?.active_projects_limit ?? 5;
      let currentCount = 0;
      for (const a of assignments.values()) {
        if (
          a.workspace_id === input.workspaceId &&
          a.pm_id === input.pmId &&
          CAPACITY_COUNTING_TYPES.includes(a.assignment_type) &&
          a.removed_at === null
        ) {
          currentCount++;
        }
      }
      if (currentCount >= limit) {
        return {
          ok: false,
          error: `PM has reached their active project limit (${currentCount}/${limit}). Unassign a project or increase the limit in their profile.`,
          failureClass: "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED",
          details: { current_count: currentCount, limit, attempted_assignment_type: input.assignmentType },
        };
      }
    }

    // Only one active primary per project
    if (input.assignmentType === "primary") {
      for (const a of assignments.values()) {
        if (
          a.workspace_id === input.workspaceId &&
          a.project_id === input.projectId &&
          a.assignment_type === "primary" &&
          a.removed_at === null
        ) {
          return validation("This project already has a primary PM. Unassign the current primary first.");
        }
      }
    }

    // No duplicate active assignment
    for (const a of assignments.values()) {
      if (
        a.workspace_id === input.workspaceId &&
        a.pm_id === input.pmId &&
        a.project_id === input.projectId &&
        a.assignment_type === input.assignmentType &&
        a.removed_at === null
      ) {
        return validation("This PM is already assigned to this project with the same assignment type.");
      }
    }

    const id = uuid();
    const record = {
      id, workspace_id: input.workspaceId, pm_id: input.pmId,
      project_id: input.projectId, assignment_type: input.assignmentType,
      assigned_at: isoNow(), removed_at: null,
    };
    assignments.set(id, record);
    emitEvent("PROJECT_MANAGER_ASSIGNED", {
      assignment_id: id, pm_id: input.pmId, project_id: input.projectId,
      assignment_type: input.assignmentType, workspace_id: input.workspaceId,
      actor_user_id: input.actorId ?? null, source: "pm_registry",
    });
    return { ok: true, data: { ...record } };
  }

  // ── unassignProjectManager ────────────────────────────────────────────────

  function unassignProjectManager(input) {
    if (!input.workspaceId) return validation("workspaceId is required.");
    if (!input.pmId) return validation("pmId is required.");
    if (!input.projectId) return validation("projectId is required.");

    for (const [id, a] of assignments) {
      if (
        a.workspace_id === input.workspaceId &&
        a.pm_id === input.pmId &&
        a.project_id === input.projectId &&
        a.assignment_type === input.assignmentType &&
        a.removed_at === null
      ) {
        a.removed_at = isoNow();
        emitEvent("PROJECT_MANAGER_UNASSIGNED", {
          assignment_id: id, pm_id: input.pmId, project_id: input.projectId,
          assignment_type: input.assignmentType, workspace_id: input.workspaceId,
          actor_user_id: input.actorId ?? null, source: "pm_registry",
        });
        return { ok: true, data: { ...a } };
      }
    }
    return notFound("Assignment");
  }

  // ── upsertPMProfile ───────────────────────────────────────────────────────

  function upsertPMProfile(input) {
    if (!input.workspaceId) return validation("workspaceId is required.");
    if (!input.pmId) return validation("pmId is required.");
    if (input.capacityLimit !== undefined && (input.capacityLimit < 0 || input.capacityLimit > 100)) {
      return validation("capacityLimit must be between 0 and 100.");
    }
    if (input.activeProjectsLimit !== undefined && input.activeProjectsLimit < 1) {
      return validation("activeProjectsLimit must be at least 1.");
    }
    if (input.role !== undefined && !PM_ROLES.includes(input.role)) {
      return validation(`role must be one of: ${PM_ROLES.join(", ")}.`);
    }
    if (input.experienceLevel !== undefined && !PM_EXPERIENCE_LEVELS.includes(input.experienceLevel)) {
      return validation(`experienceLevel must be one of: ${PM_EXPERIENCE_LEVELS.join(", ")}.`);
    }

    const key = `${input.workspaceId}::${input.pmId}`;
    const existing = profiles.get(key);
    const now = isoNow();
    const record = {
      id: existing?.id ?? uuid(),
      workspace_id: input.workspaceId, pm_id: input.pmId,
      role: input.role ?? existing?.role ?? "project_manager",
      experience_level: input.experienceLevel ?? existing?.experience_level ?? "mid",
      capacity_limit: input.capacityLimit ?? existing?.capacity_limit ?? 100,
      active_projects_limit: input.activeProjectsLimit ?? existing?.active_projects_limit ?? 5,
      created_at: existing?.created_at ?? now, updated_at: now,
    };
    profiles.set(key, record);
    emitEvent("PROJECT_MANAGER_PROFILE_UPDATED", {
      pm_id: input.pmId, workspace_id: input.workspaceId,
      actor_user_id: input.actorId ?? null, source: "pm_registry",
    });
    return { ok: true, data: { ...record } };
  }

  function listProjectManagerProjects(input) {
    const results = [];
    for (const a of assignments.values()) {
      if (a.workspace_id !== input.workspaceId || a.pm_id !== input.pmId) continue;
      if (!input.includeRemoved && a.removed_at !== null) continue;
      results.push({ ...a });
    }
    return { ok: true, data: results };
  }

  return {
    registerProjectManager, updateProjectManager, assignProjectManager,
    unassignProjectManager, upsertPMProfile, listProjectManagerProjects,
    auditLog, _pms: pms, _assignments: assignments,
  };
}

// ─── Domain/Service Tests ─────────────────────────────────────────────────────

describe("Service: registerProjectManager", () => {
  test("creates PM with valid input and returns active status", () => {
    const s = createStore();
    const r = s.registerProjectManager({ workspaceId: uuid(), displayName: "Ana Lima", email: "ana@example.com", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.status, "active");
    assert.equal(r.data.display_name, "Ana Lima");
    assert.equal(r.data.email, "ana@example.com");
  });

  test("normalizes email to lowercase", () => {
    const s = createStore();
    const r = s.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "PM@EXAMPLE.COM", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.email, "pm@example.com");
  });

  test("rejects duplicate email in same workspace", () => {
    const s = createStore();
    const wsId = uuid();
    s.registerProjectManager({ workspaceId: wsId, displayName: "PM One", email: "pm@example.com", actorId: uuid() });
    const r = s.registerProjectManager({ workspaceId: wsId, displayName: "PM Two", email: "pm@example.com", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });

  test("allows same email in different workspaces", () => {
    const s = createStore();
    s.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "pm@x.com", actorId: uuid() });
    assert.equal(r.ok, true);
  });

  test("rejects missing displayName", () => {
    const r = createStore().registerProjectManager({ workspaceId: uuid(), displayName: "", email: "pm@x.com" });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });

  test("rejects missing email", () => {
    const r = createStore().registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "" });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });
});

describe("Service: updateProjectManager", () => {
  test("updates display name", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "Old", email: "pm@x.com", actorId: uuid() });
    const r = s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, displayName: "New", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.display_name, "New");
  });

  test("updates status to inactive", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, status: "inactive", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.status, "inactive");
  });

  test("rejects cross-workspace update", () => {
    const s = createStore();
    const { data: pm } = s.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.updateProjectManager({ workspaceId: uuid(), pmId: pm.id, displayName: "Hacked", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "not_found");
  });
});

describe("Service: assignProjectManager", () => {
  test("assigns active PM as primary", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.assignment_type, "primary");
    assert.equal(r.data.removed_at, null);
  });

  test("cannot assign inactive PM", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, status: "inactive", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
    assert.match(r.error, /inactive/i);
  });

  test("cannot assign suspended PM", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, status: "suspended", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });

  test("cannot assign second active primary PM to same project", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm1 } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com", actorId: uuid() });
    const { data: pm2 } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm2.id, projectId, assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.match(r.error, /primary PM/i);
  });

  test("cannot create duplicate active assignment (same type)", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "secondary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.match(r.error, /already assigned/i);
  });

  test("allows secondary, program, observer types", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    for (const type of ["secondary", "program", "observer"]) {
      const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: type, actorId: uuid() });
      assert.equal(r.ok, true, `expected ok for type: ${type}`);
    }
  });

  test("allows new primary after unassigning previous", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm1 } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com", actorId: uuid() });
    const { data: pm2 } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary", actorId: uuid() });
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm2.id, projectId, assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, true);
  });

  test("rejects invalid assignment_type", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "boss", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });
});

describe("Service: unassignProjectManager", () => {
  test("unassigns by setting removed_at (soft delete)", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    const r = s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, true);
    assert.ok(r.data.removed_at !== null, "removed_at should be set");
    assert.ok(r.data.assigned_at, "assigned_at should be preserved");
  });

  test("does not hard delete — history preserved", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    const all = s.listProjectManagerProjects({ workspaceId: wsId, pmId: pm.id, includeRemoved: true });
    assert.equal(all.data.length, 1, "historical record preserved");
    const active = s.listProjectManagerProjects({ workspaceId: wsId, pmId: pm.id });
    assert.equal(active.data.length, 0, "not in active list");
  });

  test("returns not_found for non-existent assignment", () => {
    const s = createStore();
    const r = s.unassignProjectManager({ workspaceId: uuid(), pmId: uuid(), projectId: uuid(), assignmentType: "primary" });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "not_found");
  });
});

describe("Service: upsertPMProfile", () => {
  test("creates profile with defaults", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, actorId: uuid() });
    assert.equal(r.ok, true);
    assert.equal(r.data.role, "project_manager");
    assert.equal(r.data.capacity_limit, 100);
    assert.equal(r.data.active_projects_limit, 5);
  });

  test("rejects capacity_limit > 100", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, capacityLimit: 150 });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });

  test("rejects active_projects_limit < 1", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });

  test("rejects invalid role", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "janitor" });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "validation");
  });
});

// ─── Audit/Event Tests ────────────────────────────────────────────────────────

describe("Audit Events: mutation paths emit events", () => {
  test("registerProjectManager emits PROJECT_MANAGER_REGISTERED", () => {
    const s = createStore();
    s.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "pm@x.com", actorId: uuid() });
    assert.ok(s.auditLog.some((e) => e.type === "PROJECT_MANAGER_REGISTERED"));
  });

  test("updateProjectManager emits PROJECT_MANAGER_UPDATED", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, displayName: "Updated", actorId: uuid() });
    assert.ok(s.auditLog.some((e) => e.type === "PROJECT_MANAGER_UPDATED"));
  });

  test("upsertPMProfile emits PROJECT_MANAGER_PROFILE_UPDATED", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, actorId: uuid() });
    assert.ok(s.auditLog.some((e) => e.type === "PROJECT_MANAGER_PROFILE_UPDATED"));
  });

  test("assignProjectManager emits PROJECT_MANAGER_ASSIGNED", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    assert.ok(s.auditLog.some((e) => e.type === "PROJECT_MANAGER_ASSIGNED"));
  });

  test("unassignProjectManager emits PROJECT_MANAGER_UNASSIGNED", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    assert.ok(s.auditLog.some((e) => e.type === "PROJECT_MANAGER_UNASSIGNED"));
  });

  test("all 5 event types are emittable in a full workflow", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const actorId = uuid();

    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, displayName: "Updated PM", actorId });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "senior_pm", actorId });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId });
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId });

    const types = new Set(s.auditLog.map((e) => e.type));
    assert.ok(types.has("PROJECT_MANAGER_REGISTERED"), "missing REGISTERED");
    assert.ok(types.has("PROJECT_MANAGER_UPDATED"), "missing UPDATED");
    assert.ok(types.has("PROJECT_MANAGER_PROFILE_UPDATED"), "missing PROFILE_UPDATED");
    assert.ok(types.has("PROJECT_MANAGER_ASSIGNED"), "missing ASSIGNED");
    assert.ok(types.has("PROJECT_MANAGER_UNASSIGNED"), "missing UNASSIGNED");
  });

  test("event payload includes workspace_id and actor_user_id", () => {
    const s = createStore();
    const wsId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_REGISTERED");
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
  });

  test("assignment event payload includes pm_id, project_id, assignment_type", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "secondary", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_ASSIGNED");
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.project_id, projectId);
    assert.equal(event.payload.assignment_type, "secondary");
    assert.ok(event.payload.assignment_id, "assignment_id should be present");
  });

  test("failed mutations do not emit events", () => {
    const s = createStore();
    const initialCount = s.auditLog.length;
    s.registerProjectManager({ workspaceId: uuid(), displayName: "", email: "pm@x.com" });
    assert.equal(s.auditLog.length, initialCount, "no event on failed registration");
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("PM in workspace A is not visible in workspace B", () => {
    const s = createStore();
    const ws1 = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: ws1, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    const r = s.listProjectManagerProjects({ workspaceId: uuid(), pmId: pm.id });
    assert.equal(r.data.length, 0);
  });
});

// ─── Capacity Enforcement ─────────────────────────────────────────────────────

describe("Capacity Enforcement: active_projects_limit", () => {
  test("assignment below limit succeeds", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 3 });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, true);
  });

  test("assignment at limit fails for primary type", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 2 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "program", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED");
  });

  test("assignment at limit fails for secondary type", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED");
  });

  test("assignment at limit fails for program type", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "program", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED");
  });

  test("observer assignment does NOT count toward active project limit", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    // Fill the limit with primary
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    // Observer should still succeed even at the primary/secondary/program limit
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "observer", actorId: uuid() });
    assert.equal(r.ok, true, "observer assignment should succeed regardless of capacity");
  });

  test("limit defaults to 5 when no profile exists", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    // Assign 5 projects (default limit) — all should succeed
    for (let i = 0; i < 5; i++) {
      const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
      assert.equal(r.ok, true, `assignment ${i + 1} should succeed within default limit`);
    }
    // 6th should fail
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED");
  });

  test("capacity error includes current_count, limit, and attempted_assignment_type in details", () => {
    const s = createStore();
    const wsId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, false);
    assert.equal(r.failureClass, "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED");
    assert.ok(r.details, "details should be present");
    assert.equal(r.details.current_count, 1);
    assert.equal(r.details.limit, 1);
    assert.equal(r.details.attempted_assignment_type, "secondary");
  });

  test("unassigning a counting project restores capacity", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId: uuid() });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    // At limit — secondary should fail
    const fail = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(fail.ok, false);
    // Unassign and try again
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId: uuid() });
    const r = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId: uuid() });
    assert.equal(r.ok, true, "capacity should be restored after unassign");
  });
});

// ─── Strengthened Audit Event Payload Shape ───────────────────────────────────

describe("Audit Events: governance payload shape", () => {
  test("PROJECT_MANAGER_REGISTERED payload has all governance fields", () => {
    const s = createStore();
    const wsId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_REGISTERED");
    assert.ok(event, "event must exist");
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
    assert.ok(event.occurred_at, "occurred_at must be present");
  });

  test("PROJECT_MANAGER_ASSIGNED payload has assignment_id, pm_id, project_id, assignment_type, workspace_id, actor_user_id, source", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    const { data: assignment } = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_ASSIGNED");
    assert.ok(event, "event must exist");
    assert.equal(event.payload.assignment_id, assignment.id);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.project_id, projectId);
    assert.equal(event.payload.assignment_type, "primary");
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
    assert.ok(event.occurred_at, "occurred_at must be present");
  });

  test("PROJECT_MANAGER_UNASSIGNED payload has assignment_id and governance fields", () => {
    const s = createStore();
    const wsId = uuid();
    const projectId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    const { data: assignment } = s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId });
    s.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_UNASSIGNED");
    assert.ok(event, "event must exist");
    assert.equal(event.payload.assignment_id, assignment.id);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.project_id, projectId);
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
  });

  test("PROJECT_MANAGER_UPDATED payload includes previous_status and new_status", () => {
    const s = createStore();
    const wsId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    s.updateProjectManager({ workspaceId: wsId, pmId: pm.id, status: "inactive", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_UPDATED");
    assert.ok(event, "event must exist");
    assert.equal(event.payload.previous_status, "active");
    assert.equal(event.payload.new_status, "inactive");
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
  });

  test("PROJECT_MANAGER_PROFILE_UPDATED payload has workspace_id, pm_id, actor_user_id, source", () => {
    const s = createStore();
    const wsId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "senior_pm", actorId });
    const event = s.auditLog.find((e) => e.type === "PROJECT_MANAGER_PROFILE_UPDATED");
    assert.ok(event, "event must exist");
    assert.equal(event.payload.workspace_id, wsId);
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.actor_user_id, actorId);
    assert.equal(event.payload.source, "pm_registry");
  });

  test("failed capacity check does not emit an assignment event", () => {
    const s = createStore();
    const wsId = uuid();
    const actorId = uuid();
    const { data: pm } = s.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com", actorId });
    s.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 1 });
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "primary", actorId });
    const countBefore = s.auditLog.filter((e) => e.type === "PROJECT_MANAGER_ASSIGNED").length;
    // This should fail — no new event should be emitted
    s.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: uuid(), assignmentType: "secondary", actorId });
    const countAfter = s.auditLog.filter((e) => e.type === "PROJECT_MANAGER_ASSIGNED").length;
    assert.equal(countAfter, countBefore, "no event emitted on capacity-rejected assignment");
  });
});
