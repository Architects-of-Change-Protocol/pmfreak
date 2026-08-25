// PMFreak governance authority domain — public surface.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
//
// This layer replaced the former src/aoc/protocol and src/aoc/enterprise trees,
// which carried canonical package names and paths while containing PMFreak's own
// governance logic. See docs/adr/ADR-PMF-075-pmfreak-governance-ownership.md
// and governance-ownership.lock.json.
export * from "./capability-claims";
export * from "./actor-model";
export * from "./ports";
export * from "./persistence/records";
