import type {
  ExecutionTaskRow,
  ExecutionTaskDependencyRow,
} from "@/lib/db/database-contract";
import type { ExecutionTaskDependencyType } from "./types";

export type ProposedDependency = {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: ExecutionTaskDependencyType;
  reason: string;
  confidenceScore: number;
  sourceType: "system";
  sourcePayload: Record<string, unknown>;
};

const ACTION_TYPE_ORDERING: Array<[string, string]> = [
  ["request_approval", "create_mitigation_plan"],
  ["clarify_requirement", "validate_scope"],
  ["schedule_meeting", "follow_up"],
];

function titleContains(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

export function inferExecutionTaskDependencies(
  tasks: ExecutionTaskRow[],
  existingDeps: ExecutionTaskDependencyRow[]
): ProposedDependency[] {
  const proposed: ProposedDependency[] = [];
  const existingSet = new Set(
    existingDeps.map((d) => `${d.predecessor_task_id}:${d.successor_task_id}:${d.dependency_type}`)
  );

  function addIfNew(dep: ProposedDependency) {
    const key = `${dep.predecessorTaskId}:${dep.successorTaskId}:${dep.dependencyType}`;
    if (!existingSet.has(key)) {
      existingSet.add(key);
      proposed.push(dep);
    }
  }

  // Rule 1: approval keywords → approval_required type
  const approvalTerms = ["approval", "sign-off", "authorize", "authorise"];
  const blockedByTerms = ["blocked by", "depends on", "requires"];

  for (const task of tasks) {
    const text = `${task.title} ${task.description ?? ""}`;

    if (titleContains(text, approvalTerms)) {
      // This task likely needs to precede related tasks — look for mitigation/plan tasks
      for (const other of tasks) {
        if (other.id === task.id) continue;
        const otherText = `${other.title} ${other.description ?? ""}`;
        if (
          titleContains(otherText, ["mitigat", "plan", "implement", "execute"]) &&
          other.raid_item_id === task.raid_item_id &&
          task.raid_item_id !== null
        ) {
          addIfNew({
            predecessorTaskId: task.id,
            successorTaskId: other.id,
            dependencyType: "approval_required",
            reason: "Approval task should precede implementation task on same RAID item.",
            confidenceScore: 72,
            sourceType: "system",
            sourcePayload: { inferenceRule: "approval_keyword", raidItemId: task.raid_item_id },
          });
        }
      }
    }

    if (titleContains(text, blockedByTerms)) {
      // Suggest finish_to_start for same-raid tasks
      for (const other of tasks) {
        if (other.id === task.id) continue;
        if (
          other.raid_item_id === task.raid_item_id &&
          task.raid_item_id !== null
        ) {
          addIfNew({
            predecessorTaskId: other.id,
            successorTaskId: task.id,
            dependencyType: "finish_to_start",
            reason: "Task text suggests dependency on related task.",
            confidenceScore: 60,
            sourceType: "system",
            sourcePayload: { inferenceRule: "blocked_by_keyword", raidItemId: task.raid_item_id },
          });
        }
      }
    }
  }

  // Rule 2: action-type sequencing based on source_payload.recommendedActionType
  for (const [predActionType, succActionType] of ACTION_TYPE_ORDERING) {
    const predTasks = tasks.filter(
      (t) =>
        (t.source_payload as Record<string, unknown>)?.recommended_action_type === predActionType ||
        t.title.toLowerCase().includes(predActionType.replace(/_/g, " "))
    );
    const succTasks = tasks.filter(
      (t) =>
        (t.source_payload as Record<string, unknown>)?.recommended_action_type === succActionType ||
        t.title.toLowerCase().includes(succActionType.replace(/_/g, " "))
    );

    for (const pred of predTasks) {
      for (const succ of succTasks) {
        if (pred.id === succ.id) continue;
        if (pred.project_id !== succ.project_id) continue;
        addIfNew({
          predecessorTaskId: pred.id,
          successorTaskId: succ.id,
          dependencyType: "finish_to_start",
          reason: `${predActionType.replace(/_/g, " ")} should precede ${succActionType.replace(/_/g, " ")}.`,
          confidenceScore: 68,
          sourceType: "system",
          sourcePayload: { inferenceRule: "action_type_ordering", predActionType, succActionType },
        });
      }
    }
  }

  // Rule 3: Same raid_item_id — suggest sequencing only when text implies order
  const raidGroups = new Map<string, ExecutionTaskRow[]>();
  for (const task of tasks) {
    if (!task.raid_item_id) continue;
    if (!raidGroups.has(task.raid_item_id)) raidGroups.set(task.raid_item_id, []);
    raidGroups.get(task.raid_item_id)!.push(task);
  }

  for (const [, group] of raidGroups) {
    if (group.length < 2) continue;
    const phaseTerms = ["phase 1", "step 1", "first", "initial", "prepare", "setup"];
    const laterTerms = ["phase 2", "step 2", "follow", "implement", "execute", "finalize"];

    const earlier = group.filter((t) => titleContains(t.title, phaseTerms));
    const later = group.filter((t) => titleContains(t.title, laterTerms));

    for (const pred of earlier) {
      for (const succ of later) {
        if (pred.id === succ.id) continue;
        addIfNew({
          predecessorTaskId: pred.id,
          successorTaskId: succ.id,
          dependencyType: "finish_to_start",
          reason: "Sequential phase/step ordering inferred from task titles in same RAID item.",
          confidenceScore: 55,
          sourceType: "system",
          sourcePayload: { inferenceRule: "raid_item_sequencing", raidItemId: pred.raid_item_id },
        });
      }
    }
  }

  return proposed;
}
