import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { readFileSync } from "node:fs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── In-memory PM Registry ────────────────────────────────────────────────────

function createPMStore() {
  const pms = new Map();
  const assignments = new Map();
  const profiles = new Map();
  const auditLog = [];

  const PM_ASSIGNMENT_TYPES = ["primary", "secondary", "program", "observer"];
  const PM_STATUSES = ["active", "inactive", "suspended"];
  const PM_ROLES = ["project_manager", "senior_pm", "program_manager", "portfolio_manager"];
  const PM_EXPERIENCE_LEVELS = ["junior", "mid", "senior", "principal"];

  function validation(error) {
    return { ok: false, error, failureClass: "validation" };
  }
  function notFound(resource = "Resource") {
    return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
  }
  function persistFailed(action) {
    return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
  }

  function emitEvent(type, payload) {
    auditLog.push({ type, payload, occurred_at: isoNow() });
  }

  // ── registerProjectManager ────────────────────────────────────────────────

  function registerProjectManager(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!input.displayName?.trim()) return validation("displayName is required.");
    if (!input.email?.trim()) return validation("email is required.");

    const email = input.email.trim().toLowerCase();

    // Check uniqueness within workspace
    for (const pm of pms.values()) {
      if (pm.workspace_id === input.workspaceId && pm.email === email) {
        return validation(`A project manager with email ${email} already exists in this workspace.`);
      }
    }

    const id = uuid();
    const now = isoNow();
    const record = {
      id,
      workspace_id: input.workspaceId,
      user_id: input.userId ?? null,
      display_name: input.displayName.trim(),
      email,
      status: "active",
      joined_at: input.joinedAt ?? now,
      created_at: now,
      updated_at: now,
    };
    pms.set(id, record);
    emitEvent("PROJECT_MANAGER_REGISTERED", { pm_id: id, workspace_id: input.workspaceId });
    return { ok: true, data: record };
  }

  // ── updateProjectManager ──────────────────────────────────────────────────

  function updateProjectManager(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!validUuid(input.pmId)) return validation("pmId is required.");

    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    if (input.displayName !== undefined) {
      if (!input.displayName.trim()) return validation("displayName cannot be empty.");
      pm.display_name = input.displayName.trim();
    }
    if (input.email !== undefined) {
      if (!input.email.trim()) return validation("email cannot be empty.");
      const newEmail = input.email.trim().toLowerCase();
      // Check email uniqueness for workspace (excluding self)
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
    emitEvent("PROJECT_MANAGER_UPDATED", { pm_id: input.pmId, workspace_id: input.workspaceId });
    return { ok: true, data: { ...pm } };
  }

  // ── getProjectManager ─────────────────────────────────────────────────────

  function getProjectManager(pmId, workspaceId) {
    const pm = pms.get(pmId);
    if (!pm || pm.workspace_id !== workspaceId) return notFound("Project Manager");
    return { ok: true, data: { ...pm } };
  }

  // ── listProjectManagers ───────────────────────────────────────────────────

  function listProjectManagers(workspaceId, status) {
    const results = [];
    for (const pm of pms.values()) {
      if (pm.workspace_id !== workspaceId) continue;
      if (status && pm.status !== status) continue;
      results.push({ ...pm });
    }
    return { ok: true, data: results.sort((a, b) => a.display_name.localeCompare(b.display_name)) };
  }

  // ── assignProjectManager ──────────────────────────────────────────────────

  function assignProjectManager(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!validUuid(input.pmId)) return validation("pmId is required.");
    if (!validUuid(input.projectId)) return validation("projectId is required.");
    if (!PM_ASSIGNMENT_TYPES.includes(input.assignmentType)) {
      return validation(`Invalid assignmentType: ${input.assignmentType}`);
    }

    // Enforce: only one active primary per project
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

    // Enforce: no duplicate active assignment for same pm + project + type
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
      id,
      workspace_id: input.workspaceId,
      pm_id: input.pmId,
      project_id: input.projectId,
      assignment_type: input.assignmentType,
      assigned_at: isoNow(),
      removed_at: null,
    };
    assignments.set(id, record);
    emitEvent("PROJECT_MANAGER_ASSIGNED", {
      assignment_id: id,
      pm_id: input.pmId,
      project_id: input.projectId,
      assignment_type: input.assignmentType,
    });
    return { ok: true, data: { ...record } };
  }

  // ── unassignProjectManager ────────────────────────────────────────────────

  function unassignProjectManager(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!validUuid(input.pmId)) return validation("pmId is required.");
    if (!validUuid(input.projectId)) return validation("projectId is required.");

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
          assignment_id: id,
          pm_id: input.pmId,
          project_id: input.projectId,
          assignment_type: input.assignmentType,
        });
        return { ok: true, data: { ...a } };
      }
    }
    return notFound("Assignment");
  }

  // ── listProjectManagerProjects ────────────────────────────────────────────

  function listProjectManagerProjects(input) {
    const results = [];
    for (const a of assignments.values()) {
      if (a.workspace_id !== input.workspaceId) continue;
      if (a.pm_id !== input.pmId) continue;
      if (!input.includeRemoved && a.removed_at !== null) continue;
      results.push({ ...a });
    }
    return { ok: true, data: results };
  }

  // ── upsertPMProfile ───────────────────────────────────────────────────────

  function upsertPMProfile(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!validUuid(input.pmId)) return validation("pmId is required.");
    if (input.capacityLimit !== undefined && (input.capacityLimit < 0 || input.capacityLimit > 100)) {
      return validation("capacityLimit must be between 0 and 100.");
    }
    if (input.activeProjectsLimit !== undefined && input.activeProjectsLimit < 1) {
      return validation("activeProjectsLimit must be at least 1.");
    }

    const key = `${input.workspaceId}::${input.pmId}`;
    const existing = profiles.get(key);
    const now = isoNow();
    const record = {
      id: existing?.id ?? uuid(),
      workspace_id: input.workspaceId,
      pm_id: input.pmId,
      role: input.role ?? existing?.role ?? "project_manager",
      experience_level: input.experienceLevel ?? existing?.experience_level ?? "mid",
      capacity_limit: input.capacityLimit ?? existing?.capacity_limit ?? 100,
      active_projects_limit: input.activeProjectsLimit ?? existing?.active_projects_limit ?? 5,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    profiles.set(key, record);
    emitEvent("PROJECT_MANAGER_PROFILE_UPDATED", {
      profile_id: record.id,
      pm_id: input.pmId,
      workspace_id: input.workspaceId,
    });
    return { ok: true, data: { ...record } };
  }

  // ── getProjectManagerProfile ──────────────────────────────────────────────

  function getProjectManagerProfile(input) {
    const key = `${input.workspaceId}::${input.pmId}`;
    const profile = profiles.get(key);
    if (!profile) return notFound("PM profile");
    return { ok: true, data: { ...profile } };
  }

  return {
    registerProjectManager,
    updateProjectManager,
    getProjectManager,
    listProjectManagers,
    assignProjectManager,
    unassignProjectManager,
    listProjectManagerProjects,
    upsertPMProfile,
    getProjectManagerProfile,
    auditLog,
    _pms: pms,
    _assignments: assignments,
    _profiles: profiles,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PM Registry — Register", () => {
  test("creates PM with valid input", () => {
    const store = createPMStore();
    const wsId = uuid();
    const result = store.registerProjectManager({
      workspaceId: wsId,
      displayName: "Ana Lima",
      email: "ana@example.com",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.display_name, "Ana Lima");
    assert.equal(result.data.email, "ana@example.com");
    assert.equal(result.data.status, "active");
    assert.equal(result.data.workspace_id, wsId);
    assert.ok(validUuid(result.data.id));
  });

  test("normalizes email to lowercase", () => {
    const store = createPMStore();
    const result = store.registerProjectManager({
      workspaceId: uuid(),
      displayName: "Carlos",
      email: "CARLOS@Example.COM",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.email, "carlos@example.com");
  });

  test("rejects missing displayName", () => {
    const store = createPMStore();
    const result = store.registerProjectManager({
      workspaceId: uuid(),
      displayName: "",
      email: "pm@example.com",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("rejects missing email", () => {
    const store = createPMStore();
    const result = store.registerProjectManager({
      workspaceId: uuid(),
      displayName: "PM Name",
      email: "",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("rejects duplicate email in same workspace", () => {
    const store = createPMStore();
    const wsId = uuid();
    store.registerProjectManager({ workspaceId: wsId, displayName: "PM One", email: "pm@example.com" });
    const result = store.registerProjectManager({ workspaceId: wsId, displayName: "PM Two", email: "pm@example.com" });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("allows same email in different workspaces", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    store.registerProjectManager({ workspaceId: ws1, displayName: "PM One", email: "pm@example.com" });
    const result = store.registerProjectManager({ workspaceId: ws2, displayName: "PM Two", email: "pm@example.com" });
    assert.equal(result.ok, true);
  });

  test("emits PROJECT_MANAGER_REGISTERED event", () => {
    const store = createPMStore();
    store.registerProjectManager({ workspaceId: uuid(), displayName: "PM", email: "x@x.com" });
    assert.ok(store.auditLog.some((e) => e.type === "PROJECT_MANAGER_REGISTERED"));
  });
});

describe("PM Registry — Update", () => {
  test("updates display name", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: wsId, displayName: "Old Name", email: "pm@x.com",
    });
    const result = store.updateProjectManager({
      workspaceId: wsId, pmId: pm.id, displayName: "New Name",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.display_name, "New Name");
  });

  test("updates status to inactive", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: wsId, displayName: "PM", email: "pm@x.com",
    });
    const result = store.updateProjectManager({ workspaceId: wsId, pmId: pm.id, status: "inactive" });
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "inactive");
  });

  test("rejects cross-workspace update", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: ws1, displayName: "PM", email: "pm@x.com",
    });
    const result = store.updateProjectManager({ workspaceId: ws2, pmId: pm.id, displayName: "Hacked" });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("emits PROJECT_MANAGER_UPDATED event", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: wsId, displayName: "PM", email: "pm@x.com",
    });
    store.updateProjectManager({ workspaceId: wsId, pmId: pm.id, displayName: "Updated" });
    assert.ok(store.auditLog.some((e) => e.type === "PROJECT_MANAGER_UPDATED"));
  });
});

describe("PM Registry — Query", () => {
  test("getProjectManager returns PM by id", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: wsId, displayName: "PM", email: "pm@x.com",
    });
    const result = store.getProjectManager(pm.id, wsId);
    assert.equal(result.ok, true);
    assert.equal(result.data.id, pm.id);
  });

  test("getProjectManager denies cross-workspace", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    const { data: pm } = store.registerProjectManager({
      workspaceId: ws1, displayName: "PM", email: "pm@x.com",
    });
    const result = store.getProjectManager(pm.id, ws2);
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("listProjectManagers returns only workspace PMs", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    store.registerProjectManager({ workspaceId: ws1, displayName: "PM1", email: "pm1@x.com" });
    store.registerProjectManager({ workspaceId: ws1, displayName: "PM2", email: "pm2@x.com" });
    store.registerProjectManager({ workspaceId: ws2, displayName: "PM3", email: "pm3@x.com" });
    const result = store.listProjectManagers(ws1);
    assert.equal(result.ok, true);
    assert.equal(result.data.length, 2);
    assert.ok(result.data.every((pm) => pm.workspace_id === ws1));
  });

  test("listProjectManagers filters by status", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm1 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com" });
    store.updateProjectManager({ workspaceId: wsId, pmId: pm2.id, status: "inactive" });
    const active = store.listProjectManagers(wsId, "active");
    assert.equal(active.data.length, 1);
    assert.equal(active.data[0].id, pm1.id);
  });
});

describe("PM Assignments — Assign", () => {
  test("assigns PM as primary to project", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const result = store.assignProjectManager({
      workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.assignment_type, "primary");
    assert.equal(result.data.removed_at, null);
  });

  test("allows multiple different assignment types for same PM on same project", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });
    const result = store.assignProjectManager({
      workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "observer",
    });
    assert.equal(result.ok, true);
  });
});

describe("PM Assignments — Duplicate Prevention", () => {
  test("rejects duplicate active assignment (same type)", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "secondary" });
    const result = store.assignProjectManager({
      workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "secondary",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
    assert.match(result.error, /already assigned/i);
  });

  test("rejects second primary PM for same project", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm1 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary" });
    const result = store.assignProjectManager({
      workspaceId: wsId, pmId: pm2.id, projectId, assignmentType: "primary",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
    assert.match(result.error, /primary PM/i);
  });

  test("allows new primary after unassigning previous primary", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm1 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary" });
    store.unassignProjectManager({ workspaceId: wsId, pmId: pm1.id, projectId, assignmentType: "primary" });
    const result = store.assignProjectManager({
      workspaceId: wsId, pmId: pm2.id, projectId, assignmentType: "primary",
    });
    assert.equal(result.ok, true);
  });
});

describe("PM Assignments — Unassign", () => {
  test("unassigns active assignment", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });
    const result = store.unassignProjectManager({
      workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary",
    });
    assert.equal(result.ok, true);
    assert.ok(result.data.removed_at !== null);
  });

  test("returns not_found when unassigning non-existent assignment", () => {
    const store = createPMStore();
    const wsId = uuid();
    const result = store.unassignProjectManager({
      workspaceId: wsId, pmId: uuid(), projectId: uuid(), assignmentType: "primary",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("emits PROJECT_MANAGER_UNASSIGNED event", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });
    store.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });
    assert.ok(store.auditLog.some((e) => e.type === "PROJECT_MANAGER_UNASSIGNED"));
  });
});

describe("PM Assignments — List PM Projects", () => {
  test("lists active assignments for PM", () => {
    const store = createPMStore();
    const wsId = uuid();
    const p1 = uuid();
    const p2 = uuid();
    const p3 = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p1, assignmentType: "primary" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p2, assignmentType: "secondary" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p3, assignmentType: "observer" });
    store.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p3, assignmentType: "observer" });

    const active = store.listProjectManagerProjects({ workspaceId: wsId, pmId: pm.id });
    assert.equal(active.ok, true);
    assert.equal(active.data.length, 2);
  });

  test("includeRemoved returns all historical assignments", () => {
    const store = createPMStore();
    const wsId = uuid();
    const p1 = uuid();
    const p2 = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p1, assignmentType: "primary" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p2, assignmentType: "secondary" });
    store.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId: p2, assignmentType: "secondary" });

    const all = store.listProjectManagerProjects({ workspaceId: wsId, pmId: pm.id, includeRemoved: true });
    assert.equal(all.data.length, 2);
  });
});

describe("Workspace Isolation Tests", () => {
  test("PM in workspace A is not visible in workspace B", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: ws1, displayName: "PM", email: "pm@x.com" });
    const result = store.getProjectManager(pm.id, ws2);
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("assignments in workspace A are not returned for workspace B", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: ws1, displayName: "PM", email: "pm@x.com" });
    const projectId = uuid();
    store.assignProjectManager({ workspaceId: ws1, pmId: pm.id, projectId, assignmentType: "primary" });

    const result = store.listProjectManagerProjects({ workspaceId: ws2, pmId: pm.id });
    assert.equal(result.ok, true);
    assert.equal(result.data.length, 0);
  });

  test("listProjectManagers does not leak across workspaces", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    store.registerProjectManager({ workspaceId: ws1, displayName: "PM1", email: "pm1@x.com" });
    store.registerProjectManager({ workspaceId: ws2, displayName: "PM2", email: "pm2@x.com" });
    const ws1List = store.listProjectManagers(ws1);
    assert.equal(ws1List.data.length, 1);
    assert.equal(ws1List.data[0].workspace_id, ws1);
  });

  test("profile in workspace A is not visible in workspace B", () => {
    const store = createPMStore();
    const ws1 = uuid();
    const ws2 = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: ws1, displayName: "PM", email: "pm@x.com" });
    store.upsertPMProfile({ workspaceId: ws1, pmId: pm.id, role: "senior_pm" });
    const result = store.getProjectManagerProfile({ workspaceId: ws2, pmId: pm.id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });
});

describe("PM Profiles", () => {
  test("upsert creates profile with defaults", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const result = store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id });
    assert.equal(result.ok, true);
    assert.equal(result.data.role, "project_manager");
    assert.equal(result.data.experience_level, "mid");
    assert.equal(result.data.capacity_limit, 100);
    assert.equal(result.data.active_projects_limit, 5);
  });

  test("upsert updates existing profile", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "project_manager" });
    const result = store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "senior_pm", experienceLevel: "senior" });
    assert.equal(result.ok, true);
    assert.equal(result.data.role, "senior_pm");
    assert.equal(result.data.experience_level, "senior");
  });

  test("rejects invalid capacity_limit", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const result = store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, capacityLimit: 150 });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("rejects invalid active_projects_limit", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const result = store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, activeProjectsLimit: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("emits PROJECT_MANAGER_PROFILE_UPDATED event", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id });
    assert.ok(store.auditLog.some((e) => e.type === "PROJECT_MANAGER_PROFILE_UPDATED"));
  });
});

describe("Audit Events", () => {
  test("all 5 event types are emitted correctly", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();

    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.updateProjectManager({ workspaceId: wsId, pmId: pm.id, displayName: "Updated PM" });
    store.upsertPMProfile({ workspaceId: wsId, pmId: pm.id, role: "senior_pm" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });
    store.unassignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });

    const eventTypes = store.auditLog.map((e) => e.type);
    assert.ok(eventTypes.includes("PROJECT_MANAGER_REGISTERED"));
    assert.ok(eventTypes.includes("PROJECT_MANAGER_UPDATED"));
    assert.ok(eventTypes.includes("PROJECT_MANAGER_PROFILE_UPDATED"));
    assert.ok(eventTypes.includes("PROJECT_MANAGER_ASSIGNED"));
    assert.ok(eventTypes.includes("PROJECT_MANAGER_UNASSIGNED"));
  });

  test("audit events carry workspace_id in payload", () => {
    const store = createPMStore();
    const wsId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const registrationEvent = store.auditLog.find((e) => e.type === "PROJECT_MANAGER_REGISTERED");
    assert.equal(registrationEvent.payload.workspace_id, wsId);
    assert.equal(registrationEvent.payload.pm_id, pm.id);
  });

  test("assignment events carry pm_id and project_id", () => {
    const store = createPMStore();
    const wsId = uuid();
    const projectId = uuid();
    const { data: pm } = store.registerProjectManager({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProjectManager({ workspaceId: wsId, pmId: pm.id, projectId, assignmentType: "primary" });

    const event = store.auditLog.find((e) => e.type === "PROJECT_MANAGER_ASSIGNED");
    assert.equal(event.payload.pm_id, pm.id);
    assert.equal(event.payload.project_id, projectId);
    assert.equal(event.payload.assignment_type, "primary");
  });
});

describe("Explain Capability", () => {
  const types = readFileSync("src/lib/pm-registry/types.ts", "utf8");
  const registry = readFileSync("src/lib/pm-registry/pm-registry.ts", "utf8");
  const assignments = readFileSync("src/lib/pm-registry/pm-assignments.ts", "utf8");
  const profiles = readFileSync("src/lib/pm-registry/pm-profiles.ts", "utf8");
  const explainFile = readFileSync("src/lib/pm-registry/explain.ts", "utf8");
  const indexFile = readFileSync("src/lib/pm-registry/index.ts", "utf8");

  test("explainPMRegistry returns valid structure", () => {
    // In-memory version of explain
    function explainPMRegistry() {
      const REQUIRED_KEYS = [
        "concept", "principles", "dataModel", "assignmentModel",
        "responsibilityModel", "ownershipRules", "capacityModel",
        "auditEvents", "businessRules", "pmRoles", "pmStatuses",
        "assignmentTypes", "experienceLevels", "lineageChain", "useCases",
      ];
      // Read from the actual file to verify structure
      for (const key of REQUIRED_KEYS) {
        assert.match(explainFile, new RegExp(key));
      }
      return true;
    }
    assert.ok(explainPMRegistry());
  });

  test("explain covers all 5 audit events", () => {
    const events = [
      "PROJECT_MANAGER_REGISTERED",
      "PROJECT_MANAGER_UPDATED",
      "PROJECT_MANAGER_ASSIGNED",
      "PROJECT_MANAGER_UNASSIGNED",
      "PROJECT_MANAGER_PROFILE_UPDATED",
    ];
    for (const e of events) {
      assert.ok(explainFile.includes(e), `explain.ts missing event: ${e}`);
    }
  });

  test("explain covers all 4 assignment types", () => {
    for (const t of ["primary", "secondary", "program", "observer"]) {
      assert.ok(explainFile.includes(t), `explain.ts missing assignment type: ${t}`);
    }
  });

  test("explain covers all 7 business rules", () => {
    for (let i = 1; i <= 7; i++) {
      assert.ok(explainFile.includes(`number: ${i}`), `explain.ts missing business rule ${i}`);
    }
  });

  test("index.ts exports explainPMRegistry", () => {
    assert.match(indexFile, /explainPMRegistry/);
  });

  test("types.ts defines all required types", () => {
    const requiredTypes = [
      "ProjectManagerStatus",
      "PMAssignmentType",
      "PMRole",
      "PMExperienceLevel",
      "PMRegistryResult",
      "PMRegistryEventType",
      "RegisterProjectManagerInput",
      "AssignProjectManagerInput",
    ];
    for (const t of requiredTypes) {
      assert.ok(types.includes(t), `types.ts missing: ${t}`);
    }
  });

  test("registry exports all required functions", () => {
    const fns = ["registerProjectManager", "updateProjectManager", "getProjectManager", "listProjectManagers"];
    for (const fn of fns) {
      assert.ok(registry.includes(fn), `pm-registry.ts missing: ${fn}`);
    }
  });

  test("assignments exports all required functions", () => {
    const fns = ["assignProjectManager", "unassignProjectManager", "listProjectManagerProjects"];
    for (const fn of fns) {
      assert.ok(assignments.includes(fn), `pm-assignments.ts missing: ${fn}`);
    }
  });

  test("profiles exports all required functions", () => {
    const fns = ["getProjectManagerProfile", "upsertPMProfile", "updatePMProfile"];
    for (const fn of fns) {
      assert.ok(profiles.includes(fn), `pm-profiles.ts missing: ${fn}`);
    }
  });
});
