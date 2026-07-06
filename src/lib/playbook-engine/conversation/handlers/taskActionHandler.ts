import type { ContextResolution, HandlerResult } from "../types";

/**
 * Answers "create a task / schedule a meeting / assign this" style requests. This sprint never
 * creates anything real (no persistence) — the handler's job is to say exactly what's needed and
 * make explicit that creating a task/action always requires human approval before it becomes
 * real, never to pretend the task already exists.
 */
export function handleTaskOrActionRequest(resolution: ContextResolution): HandlerResult {
  return {
    mode: "draft",
    headline: "Puedo preparar esto como una acción por aprobar, pero no se crea nada automáticamente todavía.",
    body: [
      "Para dejarla lista para aprobar necesito: título claro de la tarea, dueño, y fecha límite. Sin esos tres datos queda como borrador incompleto.",
    ],
    recommendedNextSteps: ["Confirma título, dueño y fecha límite.", "Aprueba la creación — no se crea automáticamente."],
    missingContext: resolution.missingContext,
    requiresApproval: true,
    auditRelevant: true,
    confidence: 60,
    sourced: false,
  };
}
