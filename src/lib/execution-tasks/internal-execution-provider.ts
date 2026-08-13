import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExecutionTaskRow,
  InternalTaskExecutionRow,
} from "@/lib/db/database-contract";

export const INTERNAL_EXECUTION_PROVIDER_KEY = "pmfreak/internal-state-machine:v1" as const;

export type InternalExecutionCommand =
  | "queue"
  | "start"
  | "block"
  | "fail"
  | "retry"
  | "complete";

export type InternalExecutionMutationResult = {
  disposition?: "queued" | "transitioned" | "existing" | "denied" | "conflict";
  failureClass?: string;
  governanceState?: string;
  reason?: string;
  execution?: InternalTaskExecutionRow;
  task?: ExecutionTaskRow;
  idempotentReplay?: boolean;
  nonOutcome?: {
    executionRecorded?: boolean;
    outcomeCreated?: boolean;
    observationCreated?: boolean;
    remoteAocWriteback?: boolean;
  };
};

export function isInternalExecutionCommand(value: unknown): value is InternalExecutionCommand {
  return (
    value === "queue" ||
    value === "start" ||
    value === "block" ||
    value === "fail" ||
    value === "retry" ||
    value === "complete"
  );
}

export function isGovernedExecutionTask(task: Pick<ExecutionTaskRow, "source_payload">): boolean {
  const payload = task.source_payload as { source?: unknown } | null;
  return payload?.source === "governed_action";
}

function unwrap(
  result: { data: unknown; error: { message: string } | null },
  operation: string,
): InternalExecutionMutationResult {
  if (result.error || !result.data) {
    throw new Error(`${operation}:${result.error?.message ?? "no_data"}`);
  }
  return result.data as InternalExecutionMutationResult;
}

export async function queueInternalTaskExecution(
  client: SupabaseClient,
  taskId: string,
): Promise<InternalExecutionMutationResult> {
  const result = await client.rpc("dispatch_internal_task_execution", {
    p_task_id: taskId,
  });
  return unwrap(result, "dispatch_internal_task_execution");
}

export async function transitionInternalTaskExecution(
  client: SupabaseClient,
  taskId: string,
  command: Exclude<InternalExecutionCommand, "queue">,
): Promise<InternalExecutionMutationResult> {
  const result = await client.rpc("transition_internal_task_execution", {
    p_task_id: taskId,
    p_command: command,
  });
  return unwrap(result, "transition_internal_task_execution");
}