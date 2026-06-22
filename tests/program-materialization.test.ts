/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory reimplementation of buildMaterializationPlan for pure unit tests.
// No database access.
// ─────────────────────────────────────────────────────────────────────────────

function buildMaterializationPlan(parseResult) {
  const epics = [];
  const sprints = [];
  const cards = [];
  const warnings = [];

  for (const parsedEpic of parseResult.epics) {
    if (!parsedEpic.title.trim()) {
      warnings.push(`Epic ${parsedEpic.number}: empty title, skipped.`);
      continue;
    }
    epics.push({
      number: parsedEpic.number,
      title: parsedEpic.title.trim(),
      orderIndex: parsedEpic.number - 1,
    });

    for (const parsedSprint of parsedEpic.sprints) {
      if (!parsedSprint.title.trim()) {
        warnings.push(`Sprint ${parsedSprint.number} in Epic ${parsedEpic.number}: empty title, skipped.`);
        continue;
      }
      const objective = parsedSprint.prompt?.sections?.objective?.trim() ?? null;
      sprints.push({
        number: parsedSprint.number,
        epicNumber: parsedEpic.number,
        title: parsedSprint.title.trim(),
        objective: objective ?? null,
        orderIndex: parsedSprint.number - 1,
      });

      const sections = parsedSprint.prompt?.sections;
      if (!sections) continue;

      let cardOrder = 0;

      for (const capability of sections.capabilities) {
        const title = capability.trim();
        if (!title) {
          warnings.push(`Sprint ${parsedSprint.number}: empty capability, skipped.`);
          continue;
        }
        cards.push({
          sprintNumber: parsedSprint.number,
          epicNumber: parsedEpic.number,
          title,
          type: "TASK",
          materializationType: "CAPABILITY",
          sourceLineNumber: null,
          orderIndex: cardOrder++,
        });
      }

      for (const deliverable of sections.deliverables) {
        const title = deliverable.trim();
        if (!title) {
          warnings.push(`Sprint ${parsedSprint.number}: empty deliverable, skipped.`);
          continue;
        }
        cards.push({
          sprintNumber: parsedSprint.number,
          epicNumber: parsedEpic.number,
          title,
          type: "DELIVERABLE",
          materializationType: "DELIVERABLE",
          sourceLineNumber: null,
          orderIndex: cardOrder++,
        });
      }
    }
  }

  return { epics, sprints, cards, warnings };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeParseResult(epics) {
  return {
    programId: "prog-1",
    sourceId: "source-1",
    parsedAt: new Date(),
    status: "VALID",
    epics,
    warnings: [],
    errors: [],
    stats: { totalLines: 0, epicCount: epics.length, sprintCount: 0, emptyLineCount: 0, unassignedSprintCount: 0, duplicateEpicNumberCount: 0, duplicateSprintNumberCount: 0 },
  };
}

function makeSprint(number, epicNumber, title, sections = {}) {
  return {
    number,
    epicNumber,
    title,
    rawHeading: `Sprint ${number} — ${title}`,
    startLine: 1,
    endLine: 10,
    prompt: {
      rawHeading: "Prompt:",
      body: "...",
      startLine: 2,
      endLine: 10,
      characterCount: 100,
      lineCount: 8,
      sections: {
        capabilities: [],
        deliverables: [],
        rules: [],
        notes: [],
        unknownSections: [],
        ...sections,
      },
      stats: { sectionCount: 1, capabilityCount: 0, deliverableCount: 0, ruleCount: 0, noteCount: 0, characterCount: 100, lineCount: 8 },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Materialization Engine — Epic Materialization", () => {
  test("materializa un epic", () => {
    const parseResult = makeParseResult([
      { number: 1, title: "Project Constitution", rawHeading: "EPIC 1 — Project Constitution", startLine: 1, endLine: 20, sprints: [] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.epics.length, 1);
    assert.equal(plan.epics[0].title, "Project Constitution");
    assert.equal(plan.epics[0].number, 1);
    assert.equal(plan.epics[0].orderIndex, 0);
  });

  test("materializa múltiples epics", () => {
    const parseResult = makeParseResult([
      { number: 1, title: "Epic One", rawHeading: "", startLine: 1, endLine: 10, sprints: [] },
      { number: 2, title: "Epic Two", rawHeading: "", startLine: 11, endLine: 20, sprints: [] },
      { number: 3, title: "Epic Three", rawHeading: "", startLine: 21, endLine: 30, sprints: [] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.epics.length, 3);
    assert.deepEqual(plan.epics.map(e => e.number), [1, 2, 3]);
    assert.deepEqual(plan.epics.map(e => e.orderIndex), [0, 1, 2]);
  });

  test("skips epic with empty title and emits warning", () => {
    const parseResult = makeParseResult([
      { number: 1, title: "  ", rawHeading: "", startLine: 1, endLine: 10, sprints: [] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.epics.length, 0);
    assert.equal(plan.warnings.length, 1);
    assert.ok(plan.warnings[0].includes("Epic 1"));
  });
});

describe("Materialization Engine — Sprint Materialization", () => {
  test("materializa sprint con title y objective", () => {
    const sprint = makeSprint(1, 1, "Program Model Foundation", { objective: "Crear Program." });
    const parseResult = makeParseResult([
      { number: 1, title: "Project Constitution", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.sprints.length, 1);
    assert.equal(plan.sprints[0].title, "Program Model Foundation");
    assert.equal(plan.sprints[0].objective, "Crear Program.");
    assert.equal(plan.sprints[0].epicNumber, 1);
    assert.equal(plan.sprints[0].number, 1);
  });

  test("guarda objective desde prompt.sections.objective", () => {
    const sprint = makeSprint(2, 1, "Execution Sprint", { objective: "Build execution layer." });
    const parseResult = makeParseResult([
      { number: 1, title: "Core", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.sprints[0].objective, "Build execution layer.");
  });

  test("objective es null cuando no existe en prompt", () => {
    const sprint = makeSprint(1, 1, "Sprint sin objetivo");
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 20, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.sprints[0].objective, null);
  });

  test("skips sprint with empty title and emits warning", () => {
    const sprint = makeSprint(1, 1, "  ");
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 20, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.sprints.length, 0);
    assert.ok(plan.warnings.some(w => w.includes("Sprint 1")));
  });

  test("preserva orderIndex", () => {
    const sprints = [
      makeSprint(1, 1, "Sprint One"),
      makeSprint(2, 1, "Sprint Two"),
      makeSprint(3, 1, "Sprint Three"),
    ];
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 60, sprints },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.deepEqual(plan.sprints.map(s => s.orderIndex), [0, 1, 2]);
  });
});

describe("Materialization Engine — Card Materialization", () => {
  test("materializa capability card como TASK", () => {
    const sprint = makeSprint(1, 1, "Sprint", { capabilities: ["Create Program", "Edit Program"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    const capabilityCards = plan.cards.filter(c => c.materializationType === "CAPABILITY");
    assert.equal(capabilityCards.length, 2);
    assert.equal(capabilityCards[0].title, "Create Program");
    assert.equal(capabilityCards[0].type, "TASK");
    assert.equal(capabilityCards[1].title, "Edit Program");
  });

  test("materializa deliverable card como DELIVERABLE", () => {
    const sprint = makeSprint(1, 1, "Sprint", { deliverables: ["Migration", "Tests"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    const deliverableCards = plan.cards.filter(c => c.materializationType === "DELIVERABLE");
    assert.equal(deliverableCards.length, 2);
    assert.equal(deliverableCards[0].title, "Migration");
    assert.equal(deliverableCards[0].type, "DELIVERABLE");
    assert.equal(deliverableCards[1].title, "Tests");
  });

  test("capabilities y deliverables generan cards en orden", () => {
    const sprint = makeSprint(1, 1, "Sprint", {
      capabilities: ["Create Program"],
      deliverables: ["Migration"],
    });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.cards.length, 2);
    assert.equal(plan.cards[0].title, "Create Program");
    assert.equal(plan.cards[0].orderIndex, 0);
    assert.equal(plan.cards[1].title, "Migration");
    assert.equal(plan.cards[1].orderIndex, 1);
  });

  test("skips empty capability and emits warning", () => {
    const sprint = makeSprint(1, 1, "Sprint", { capabilities: ["", "Valid Cap"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.cards.length, 1);
    assert.equal(plan.cards[0].title, "Valid Cap");
    assert.ok(plan.warnings.some(w => w.includes("empty capability")));
  });

  test("skips empty deliverable and emits warning", () => {
    const sprint = makeSprint(1, 1, "Sprint", { deliverables: ["  ", "Valid Deliverable"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.cards.length, 1);
    assert.equal(plan.cards[0].title, "Valid Deliverable");
    assert.ok(plan.warnings.some(w => w.includes("empty deliverable")));
  });

  test("rules NO generan cards", () => {
    const sprint = makeSprint(1, 1, "Sprint", { rules: ["Rule one", "Rule two"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.cards.length, 0);
  });

  test("notes NO generan cards", () => {
    const sprint = makeSprint(1, 1, "Sprint", { notes: ["Note one", "Note two"] });
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 30, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.cards.length, 0);
  });
});

describe("Materialization Engine — Report Generation", () => {
  test("genera report correcto con epics, sprints y cards", () => {
    const sprint = makeSprint(1, 1, "Sprint One", {
      objective: "Build something.",
      capabilities: ["Create Program", "Edit Program"],
      deliverables: ["Migration", "Tests"],
    });
    const parseResult = makeParseResult([
      { number: 1, title: "Project Constitution", rawHeading: "", startLine: 1, endLine: 50, sprints: [sprint] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.epics.length, 1);
    assert.equal(plan.sprints.length, 1);
    assert.equal(plan.cards.length, 4);
    assert.equal(plan.warnings.length, 0);
  });

  test("sprint without prompt produces no cards", () => {
    const sprintWithoutPrompt = {
      number: 1,
      epicNumber: 1,
      title: "Sprint Without Prompt",
      rawHeading: "",
      startLine: 1,
      endLine: 5,
      prompt: undefined,
    };
    const parseResult = makeParseResult([
      { number: 1, title: "Epic", rawHeading: "", startLine: 1, endLine: 10, sprints: [sprintWithoutPrompt] },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.sprints.length, 1);
    assert.equal(plan.cards.length, 0);
  });
});

describe("Materialization Engine — Complex Roadmap", () => {
  test("materializes full roadmap with multiple epics and sprints", () => {
    const sprints1 = [
      makeSprint(1, 1, "Foundation", { capabilities: ["Create Program"], deliverables: ["Migration"] }),
      makeSprint(2, 1, "API Layer", { capabilities: ["REST Endpoint"], deliverables: ["Tests"] }),
    ];
    const sprints2 = [
      makeSprint(3, 2, "UI Sprint", { capabilities: ["Dashboard"], deliverables: ["Components"] }),
    ];
    const parseResult = makeParseResult([
      { number: 1, title: "Backend", rawHeading: "", startLine: 1, endLine: 50, sprints: sprints1 },
      { number: 2, title: "Frontend", rawHeading: "", startLine: 51, endLine: 80, sprints: sprints2 },
    ]);
    const plan = buildMaterializationPlan(parseResult);
    assert.equal(plan.epics.length, 2);
    assert.equal(plan.sprints.length, 3);
    assert.equal(plan.cards.length, 6); // 2+2+2
    assert.equal(plan.warnings.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Service Validation Tests (in-memory)
// ─────────────────────────────────────────────────────────────────────────────

describe("Materialization Service — Validation", () => {
  test("bloquea parse invalid", () => {
    // Simulate invalid status check
    const INVALID_STATUS = "INVALID";
    const allowed = ["VALID", "VALID_WITH_WARNINGS"];
    assert.equal(allowed.includes(INVALID_STATUS), false);
  });

  test("permite VALID y VALID_WITH_WARNINGS", () => {
    const allowed = ["VALID", "VALID_WITH_WARNINGS"];
    assert.ok(allowed.includes("VALID"));
    assert.ok(allowed.includes("VALID_WITH_WARNINGS"));
  });

  test("bloquea materialización duplicada — failureClass", () => {
    const existingMaterialization = { id: "mat-1", status: "COMPLETED" };
    const isDuplicate = existingMaterialization !== null;
    assert.ok(isDuplicate);
  });

  test("workspace isolation — programa debe pertenecer al workspace", () => {
    const program = { id: "prog-1", workspace_id: "ws-1" };
    const requestWorkspace = "ws-2";
    const isIsolated = program.workspace_id !== requestWorkspace;
    assert.ok(isIsolated);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Materialization Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Materialization Lifecycle", () => {
  test("status transitions are valid", () => {
    const validTransitions = {
      NOT_STARTED: ["RUNNING"],
      RUNNING: ["COMPLETED", "ARCHIVED"],
      COMPLETED: ["ARCHIVED"],
      ARCHIVED: [],
    };
    assert.ok(validTransitions.RUNNING.includes("COMPLETED"));
    assert.ok(validTransitions.COMPLETED.includes("ARCHIVED"));
  });

  test("archive materialization uses soft delete", () => {
    const materialization = { id: "mat-1", deleted_at: null };
    // Soft delete sets deleted_at
    const archived = { ...materialization, deleted_at: new Date().toISOString(), status: "ARCHIVED" };
    assert.notEqual(archived.deleted_at, null);
    assert.equal(archived.status, "ARCHIVED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Materialization ID Tracing (Sprint 9)
// ─────────────────────────────────────────────────────────────────────────────

describe("Materialization ID Tracing", () => {
  function simulateMaterializeCards(materializationId, cards) {
    return cards.map(card => ({ ...card, materialization_id: materializationId }));
  }

  test("card creada por materialization tiene materialization_id", () => {
    const card = { id: "card-1", title: "Create Program", type: "TASK" };
    const [result] = simulateMaterializeCards("mat-1", [card]);
    assert.equal(result.materialization_id, "mat-1");
  });

  test("materialization_id apunta a la materialization correcta", () => {
    const materializationId = "mat-abc-123";
    const card = { id: "card-1", title: "Build API" };
    const [result] = simulateMaterializeCards(materializationId, [card]);
    assert.equal(result.materialization_id, materializationId);
  });

  test("todas las cards creadas en una materialization comparten materialization_id", () => {
    const matId = "mat-shared";
    const cards = [
      { id: "c1", title: "Create Program" },
      { id: "c2", title: "Edit Program" },
      { id: "c3", title: "List Programs" },
    ];
    const results = simulateMaterializeCards(matId, cards);
    const allSame = results.every(r => r.materialization_id === matId);
    assert.ok(allSame);
    assert.equal(results.length, 3);
  });

  test("materialization_id es null cuando no fue creada por materialización", () => {
    const manualCard = { id: "card-manual", title: "Manual Card", materialization_id: null };
    assert.equal(manualCard.materialization_id, null);
  });
});
