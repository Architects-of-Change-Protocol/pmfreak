"use client";

export type AssignableMemberOption = { userId: string; displayName: string };

/**
 * Renders real workspace members only — the member list always comes from
 * listWorkspaceMembersForAssignment via the caller, never a fabricated
 * directory. The server independently re-verifies membership on save.
 */
export function TaskAssigneeControl({
  assigneeId,
  ownerName,
  members,
  canEdit,
  busy,
  onChange,
  label,
  size = "sm",
}: {
  assigneeId: string | null;
  ownerName: string | null;
  members: AssignableMemberOption[];
  canEdit: boolean;
  busy?: boolean;
  onChange: (next: string | null) => void;
  label: string;
  size?: "sm" | "md";
}) {
  if (!canEdit) {
    return (
      <span className="text-xs text-slate-600" data-testid="task-assignee-readonly">
        {ownerName ?? "Unassigned"}
      </span>
    );
  }

  return (
    <select
      aria-label={label}
      value={assigneeId ?? ""}
      disabled={busy}
      onChange={(event) => onChange(event.target.value || null)}
      data-testid="task-assignee-control"
      className={`rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      <option value="">Unassigned</option>
      {members.map((member) => (
        <option key={member.userId} value={member.userId}>
          {member.displayName}
        </option>
      ))}
    </select>
  );
}
