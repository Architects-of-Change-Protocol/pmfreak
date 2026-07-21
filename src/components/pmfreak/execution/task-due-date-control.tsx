"use client";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Timezone-safe: reads/writes the due date as a plain calendar date in the browser's local zone, never a raw UTC slice. */
export function TaskDueDateControl({
  dueDate,
  canEdit,
  busy,
  onChange,
  label,
  size = "sm",
}: {
  dueDate: string | null;
  canEdit: boolean;
  busy?: boolean;
  onChange: (next: string | null) => void;
  label: string;
  size?: "sm" | "md";
}) {
  if (!canEdit) {
    return (
      <span className="text-xs text-slate-600" data-testid="task-due-date-readonly">
        {dueDate ? new Date(dueDate).toLocaleDateString() : "No due date"}
      </span>
    );
  }

  return (
    <input
      type="date"
      aria-label={label}
      value={toDateInputValue(dueDate)}
      disabled={busy}
      onChange={(event) => {
        const value = event.target.value;
        onChange(value ? new Date(`${value}T00:00:00`).toISOString() : null);
      }}
      data-testid="task-due-date-control"
      className={`rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    />
  );
}
