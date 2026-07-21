/**
 * Command Center — public entry point (strangler seam).
 *
 * This barrel is the single public entry point over the legacy
 * `src/features/command-center/` folder. It re-exports ONLY the surface the
 * Routes layer legitimately composes; consumers must import from here rather
 * than deep-importing internal files (`07-frontend-module-boundaries.md` §3).
 *
 * It is a transitional seam, not a ratified module: there is no "Command Center"
 * bounded context, so a Command Center is a per-scope screen owned by its
 * scoping module (Workspace / Project / PMO / …). During migration the exports
 * below move behind `modules/workspace` and `modules/project` public entry
 * points. See `docs/product-architecture/command-center-frontend-module-boundary.md`.
 *
 * No business logic lives here — re-exports only.
 */

export { CommandCenterClient } from "./command-center-client";
export { CommandCenterEmptyState } from "./command-center-empty-state";

// View-model types that describe the screen's public props vocabulary.
export type { ProjectListItem, ToneBadge, StatusTone } from "./types";
