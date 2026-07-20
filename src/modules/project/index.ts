// Screens are NOT re-exported here — see modules/recommendations/index.ts
// for why (keeps server-only Screen code out of any future cross-module
// client Feature's bundle graph).
export { useProjectHealth } from "./contracts/project-health.contract";
export type { ProjectHealth } from "./contracts/project-health.contract";
