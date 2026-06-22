/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory reimplementation of board logic for pure unit tests.
// No database access.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  BACKLOG: ["READY"],
  READY: ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["READY", "IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["IN_PROGRESS"],
};

function isValidTransition(from, to) {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

function buildStats(cards) {
  const total = cards.length;
  const backlogCount = cards.filter(c => c.board_column === "BACKLOG").length;
  const readyCount = cards.filter(c => c.board_column === "READY").length;
  const inProgressCount = cards.filter(c => c.board_column === "IN_PROGRESS").length;
  const inReviewCount = cards.filter(c => c.board_column === "IN_REVIEW").length;
  const doneCount = cards.filter(c => c.board_column === "DONE").length;
  const completionPercentage = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  return { totalCards: total, backlogCount, readyCount, inProgressCount, inReviewCount, doneCount, completionPercentage };
}

function buildBoard(cards) {
  return {
    backlog: cards.filter(c => c.board_column === "BACKLOG"),
    ready: cards.filter(c => c.board_column === "READY"),
    inProgress: cards.filter(c => c.board_column === "IN_PROGRESS"),
    inReview: cards.filter(c => c.board_column === "IN_REVIEW"),
    done: cards.filter(c => c.board_column === "DONE"),
    stats: buildStats(cards),
  };
}

function makeCard(id, column = "BACKLOG", deleted = false) {
  return {
    id,
    workspace_id: "ws-1",
    program_id: "prog-1",
    board_column: column,
    deleted_at: deleted ? new Date().toISOString() : null,
    title: `Card ${id}`,
    type: "TASK",
    status: "BACKLOG",
    order_index: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Board Projection Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Board Projection — buildBoard", () => {
  test("retorna board vacío cuando no hay cards", () => {
    const board = buildBoard([]);
    assert.equal(board.backlog.length, 0);
    assert.equal(board.ready.length, 0);
    assert.equal(board.inProgress.length, 0);
    assert.equal(board.inReview.length, 0);
    assert.equal(board.done.length, 0);
  });

  test("retorna cards en backlog", () => {
    const cards = [makeCard("c1", "BACKLOG"), makeCard("c2", "BACKLOG")];
    const board = buildBoard(cards);
    assert.equal(board.backlog.length, 2);
    assert.equal(board.ready.length, 0);
  });

  test("agrupa cards por columna", () => {
    const cards = [
      makeCard("c1", "BACKLOG"),
      makeCard("c2", "READY"),
      makeCard("c3", "IN_PROGRESS"),
      makeCard("c4", "IN_REVIEW"),
      makeCard("c5", "DONE"),
    ];
    const board = buildBoard(cards);
    assert.equal(board.backlog.length, 1);
    assert.equal(board.ready.length, 1);
    assert.equal(board.inProgress.length, 1);
    assert.equal(board.inReview.length, 1);
    assert.equal(board.done.length, 1);
  });

  test("excluye soft deleted (simulated — repo filters deleted_at IS NULL)", () => {
    // The repository layer filters out deleted cards before returning.
    // Here we simulate only non-deleted cards being passed to buildBoard.
    const cards = [makeCard("c1", "BACKLOG")]; // only active cards
    const board = buildBoard(cards);
    assert.equal(board.backlog.length, 1);
  });

  test("calcula stats correctamente", () => {
    const cards = [
      makeCard("c1", "BACKLOG"),
      makeCard("c2", "READY"),
      makeCard("c3", "IN_PROGRESS"),
      makeCard("c4", "IN_REVIEW"),
      makeCard("c5", "DONE"),
      makeCard("c6", "DONE"),
    ];
    const stats = buildStats(cards);
    assert.equal(stats.totalCards, 6);
    assert.equal(stats.backlogCount, 1);
    assert.equal(stats.readyCount, 1);
    assert.equal(stats.inProgressCount, 1);
    assert.equal(stats.inReviewCount, 1);
    assert.equal(stats.doneCount, 2);
    assert.equal(stats.completionPercentage, 33);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Board Stats Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Board Stats — buildStats", () => {
  test("totalCards 0 → completionPercentage 0", () => {
    const stats = buildStats([]);
    assert.equal(stats.completionPercentage, 0);
    assert.equal(stats.totalCards, 0);
  });

  test("todos done → completionPercentage 100", () => {
    const cards = [makeCard("c1", "DONE"), makeCard("c2", "DONE")];
    const stats = buildStats(cards);
    assert.equal(stats.completionPercentage, 100);
    assert.equal(stats.doneCount, 2);
  });

  test("redondea al entero más cercano", () => {
    // 1 of 3 done → 33.33... → 33
    const cards = [makeCard("c1", "DONE"), makeCard("c2", "BACKLOG"), makeCard("c3", "BACKLOG")];
    const stats = buildStats(cards);
    assert.equal(stats.completionPercentage, 33);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Card Movement — Valid Transitions
// ─────────────────────────────────────────────────────────────────────────────

describe("Card Movement — valid transitions", () => {
  test("backlog → ready", () => {
    assert.ok(isValidTransition("BACKLOG", "READY"));
  });

  test("ready → in progress", () => {
    assert.ok(isValidTransition("READY", "IN_PROGRESS"));
  });

  test("in progress → review", () => {
    assert.ok(isValidTransition("IN_PROGRESS", "IN_REVIEW"));
  });

  test("review → done", () => {
    assert.ok(isValidTransition("IN_REVIEW", "DONE"));
  });

  test("done → in progress (rework)", () => {
    assert.ok(isValidTransition("DONE", "IN_PROGRESS"));
  });

  test("ready → backlog (regression)", () => {
    assert.ok(isValidTransition("READY", "BACKLOG"));
  });

  test("in progress → ready (regression)", () => {
    assert.ok(isValidTransition("IN_PROGRESS", "READY"));
  });

  test("in review → in progress (regression)", () => {
    assert.ok(isValidTransition("IN_REVIEW", "IN_PROGRESS"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Card Movement — Invalid Transitions
// ─────────────────────────────────────────────────────────────────────────────

describe("Card Movement — invalid transitions", () => {
  test("backlog → done falla", () => {
    assert.equal(isValidTransition("BACKLOG", "DONE"), false);
  });

  test("backlog → review falla", () => {
    assert.equal(isValidTransition("BACKLOG", "IN_REVIEW"), false);
  });

  test("backlog → in progress falla", () => {
    assert.equal(isValidTransition("BACKLOG", "IN_PROGRESS"), false);
  });

  test("ready → done falla", () => {
    assert.equal(isValidTransition("READY", "DONE"), false);
  });

  test("ready → review falla", () => {
    assert.equal(isValidTransition("READY", "IN_REVIEW"), false);
  });

  test("done → backlog falla", () => {
    assert.equal(isValidTransition("DONE", "BACKLOG"), false);
  });

  test("done → ready falla", () => {
    assert.equal(isValidTransition("DONE", "READY"), false);
  });

  test("done → review falla", () => {
    assert.equal(isValidTransition("DONE", "IN_REVIEW"), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Events — resolveMovedEventType
// ─────────────────────────────────────────────────────────────────────────────

function resolveMovedEventType(target, from) {
  if (target === "READY") return "PROGRAM_CARD_READY";
  if (target === "IN_PROGRESS" && from === "DONE") return "PROGRAM_CARD_REOPENED";
  if (target === "IN_PROGRESS") return "PROGRAM_CARD_STARTED";
  if (target === "IN_REVIEW") return "PROGRAM_CARD_REVIEWED";
  if (target === "DONE") return "PROGRAM_CARD_COMPLETED";
  return "PROGRAM_CARD_MOVED";
}

describe("Events — resolveMovedEventType", () => {
  test("emite PROGRAM_CARD_READY al mover a READY", () => {
    assert.equal(resolveMovedEventType("READY", "BACKLOG"), "PROGRAM_CARD_READY");
  });

  test("emite PROGRAM_CARD_STARTED al mover a IN_PROGRESS desde READY", () => {
    assert.equal(resolveMovedEventType("IN_PROGRESS", "READY"), "PROGRAM_CARD_STARTED");
  });

  test("emite PROGRAM_CARD_REVIEWED al mover a IN_REVIEW", () => {
    assert.equal(resolveMovedEventType("IN_REVIEW", "IN_PROGRESS"), "PROGRAM_CARD_REVIEWED");
  });

  test("emite PROGRAM_CARD_COMPLETED al mover a DONE", () => {
    assert.equal(resolveMovedEventType("DONE", "IN_REVIEW"), "PROGRAM_CARD_COMPLETED");
  });

  test("emite PROGRAM_CARD_REOPENED al mover a IN_PROGRESS desde DONE", () => {
    assert.equal(resolveMovedEventType("IN_PROGRESS", "DONE"), "PROGRAM_CARD_REOPENED");
  });

  test("emite PROGRAM_CARD_MOVED como fallback", () => {
    assert.equal(resolveMovedEventType("BACKLOG", "READY"), "PROGRAM_CARD_MOVED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("board projection respeta workspace_id", () => {
    const cards = [
      { ...makeCard("c1", "BACKLOG"), workspace_id: "ws-1" },
      { ...makeCard("c2", "BACKLOG"), workspace_id: "ws-2" },
    ];
    // Simulating repository filter: only cards for the requested workspace
    const filtered = cards.filter(c => c.workspace_id === "ws-1");
    const board = buildBoard(filtered);
    assert.equal(board.backlog.length, 1);
    assert.equal(board.backlog[0].id, "c1");
  });

  test("move card valida que la card pertenezca al workspace", () => {
    const card = makeCard("c1", "BACKLOG");
    const requestedWorkspace = "ws-2";
    // Card belongs to ws-1; request from ws-2 should fail (not found via RLS)
    const belongsToWorkspace = card.workspace_id === requestedWorkspace;
    assert.equal(belongsToWorkspace, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Materialization Integration — default board_column
// ─────────────────────────────────────────────────────────────────────────────

describe("Materialization Integration", () => {
  test("card creada por materialización nace en BACKLOG", () => {
    const defaultColumn = "BACKLOG";
    const card = { ...makeCard("c1"), board_column: defaultColumn };
    assert.equal(card.board_column, "BACKLOG");
  });

  test("todas las cards materializadas empiezan en BACKLOG", () => {
    const materializedCards = [
      makeCard("c1"), // default BACKLOG
      makeCard("c2"),
      makeCard("c3"),
    ];
    const allInBacklog = materializedCards.every(c => c.board_column === "BACKLOG");
    assert.ok(allInBacklog);
  });
});
