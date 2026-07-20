import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { composeProjectHealth } from "@/lib/projects/project-health";

function riskRow(overrides = {}) {
  return { category: "risk", status: "open", confidence_score: 50, ...overrides };
}

function taskRow(overrides = {}) {
  return {
    id: "task-1",
    status: "in_progress",
    planned_finish_date: null,
    forecast_finish_date: null,
    schedule_status: "on_track",
    milestone_id: null,
    ...overrides,
  };
}

describe("composeProjectHealth", () => {
  test("an empty project reports a neutral, non-crashing health score", () => {
    const health = composeProjectHealth({
      projectId: "p1",
      raidRows: [],
      tasks: [],
      milestones: [],
      dependencies: [],
      pendingDecisionsCount: 0,
    });

    assert.equal(health.raid.riskCount, 0);
    assert.equal(health.schedule.totalTasks, 0);
    assert.equal(health.forecast.varianceDays, 0);
    assert.equal(health.decisionsNeeded, 0);
    assert.ok(health.overallScore >= 0 && health.overallScore <= 100);
  });

  test("critical open risks push the health band toward at-risk", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    const criticalRisks = Array.from({ length: 6 }, () => riskRow({ confidence_score: 90 }));
    const health = composeProjectHealth({
      projectId: "p1",
      raidRows: criticalRisks,
      tasks: [
        taskRow({ id: "t1", planned_finish_date: "2026-07-01T00:00:00.000Z" }), // overdue
        taskRow({ id: "t2", schedule_status: "delayed" }),
      ],
      milestones: [],
      dependencies: [],
      pendingDecisionsCount: 2,
      now,
    });

    assert.equal(health.raid.criticalRiskCount, 6);
    assert.equal(health.schedule.overdueTasks, 1);
    assert.equal(health.schedule.delayedTasks, 1);
    assert.equal(health.decisionsNeeded, 2);
    assert.equal(health.band, "at-risk");
    assert.ok(health.overallScore < 50);
  });

  test("a healthy project with no issues bands as strong", () => {
    const health = composeProjectHealth({
      projectId: "p1",
      raidRows: [],
      tasks: [taskRow({ id: "t1", planned_finish_date: "2099-01-01T00:00:00.000Z" })],
      milestones: [{ id: "m1", status: "in_progress", target_date: "2099-01-01T00:00:00.000Z" }],
      dependencies: [],
      pendingDecisionsCount: 0,
    });

    assert.equal(health.band, "strong");
    assert.ok(health.overallScore >= 75);
  });

  test("closed/mitigated RAID items do not count toward open risk totals", () => {
    const health = composeProjectHealth({
      projectId: "p1",
      raidRows: [riskRow({ status: "closed" }), riskRow({ status: "mitigated" })],
      tasks: [],
      milestones: [],
      dependencies: [],
      pendingDecisionsCount: 0,
    });

    assert.equal(health.raid.riskCount, 0);
  });
});
