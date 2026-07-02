/**
 * Agents stay idle until there is real Command Center or project data to
 * reason about — see AGENTS.md first-launch requirements. This is the single
 * source of truth for the three idle-state copy variants.
 */
export function agentIdleCopy(hasCommandCenter: boolean, hasProject: boolean): string | null {
  if (!hasCommandCenter) return "Agents are sleeping until your Command Center is ready.";
  if (!hasProject) return "Agents are waiting for project data.";
  return null;
}
