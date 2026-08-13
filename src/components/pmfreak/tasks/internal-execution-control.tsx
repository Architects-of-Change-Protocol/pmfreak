"use client";

import { useState } from "react";
import useSWR from "swr";
import type {
  ExecutionTaskRow,
  InternalTaskExecutionRow,
  InternalTaskExecutionStatus,
} from "@/lib/db/database-contract";
import type { InternalExecutionCommand } from "@/lib/execution-tasks/internal-execution-provider";

type Envelope = {
  ok: boolean;
  error?: string;
  failureClass?: string;
  task?: ExecutionTaskRow;
  execution?: InternalTaskExecutionRow | null;
};

const STATUS_LABELS: Record<InternalTaskExecutionStatus, string> = {
  queued: "Queued",
  running: "Running",
  blocked: "Blocked",
  failed: "Failed",
  completed: "Completed",
};

const fetcher = async (url: string): Promise<Envelope> => {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as Envelope;
  if (!response.ok || !json.ok) throw new Error(json.error ?? "Unable to load internal execution.");
  return json;
};

function commandsFor(status: InternalTaskExecutionStatus | null): Array<{
  command: InternalExecutionCommand;
  label: string;
}> {
  if (status === null) return [{ command: "queue", label: "Queue execution" }];
  if (status === "queued") {
    return [
      { command: "start", label: "Start" },
      { command: "block", label: "Block" },
      { command: "fail", label: "Mark failed" },
    ];
  }
  if (status === "running") {
    return [
      { command: "block", label: "Block" },
      { command: "fail", label: "Mark failed" },
      { command: "complete", label: "Complete" },
    ];
  }
  if (status === "blocked") {
    return [
      { command: "start", label: "Resume" },
      { command: "fail", label: "Mark failed" },
    ];
  }
  if (status === "failed") return [{ command: "retry", label: "Retry" }];
  return [];
}

export function InternalExecutionControl({
  task,
  canEdit,
  onTaskUpdated,
}: {
  task: ExecutionTaskRow;
  canEdit: boolean;
  onTaskUpdated?: () => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<Envelope>(
    `/api/execution-tasks/internal-execution?taskId=${encodeURIComponent(task.id)}`,
    fetcher,
  );
  const [busy, setBusy] = useState<InternalExecutionCommand | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function run(command: InternalExecutionCommand) {
    setBusy(command);
    setMutationError(null);
    try {
      const response = await fetch("/api/execution-tasks/internal-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, command }),
      });
      const json = (await response.json()) as Envelope;
      if (!response.ok || !json.ok) {
        setMutationError(json.error ?? json.failureClass ?? "Execution transition failed.");
        return;
      }
      await mutate();
      onTaskUpdated?.();
    } catch {
      setMutationError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return <span className="text-xs text-slate-400">Loading execution…</span>;
  }

  if (error) {
    return (
      <div className="text-xs text-rose-700" role="alert">
        Unable to load internal execution.
      </div>
    );
  }

  const execution = data?.execution ?? null;
  const status = execution?.status ?? null;
  const commands = commandsFor(status);

  return (
    <div className="space-y-2" data-testid={`internal-execution-${task.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          {status ? STATUS_LABELS[status] : "Not queued"}
        </span>
        {execution && (
          <span className="text-[11px] text-slate-400">
            Attempt {execution.attempt_count}
          </span>
        )}
      </div>

      {canEdit && commands.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {commands.map(({ command, label }) => (
            <button
              key={command}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(command)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              data-testid={`internal-execution-${command}-${task.id}`}
            >
              {busy === command ? "Saving…" : label}
            </button>
          ))}
        </div>
      )}

      {(mutationError || data?.error) && (
        <p className="text-xs text-rose-700" role="alert">
          {mutationError ?? data?.error}
        </p>
      )}

      <p className="text-[11px] text-slate-400">
        Internal provider · Task completion does not create Outcome.
      </p>
    </div>
  );
}