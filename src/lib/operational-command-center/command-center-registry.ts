import { createPlatformEvent } from "@/lib/platform-events";
import { dbListProjectOSAttentionItems } from "@/lib/project-operating-system/project-os-repository";
import {
  dbCreateCommandCenter,
  dbFindCommandCenterById,
  dbListCommandCenters,
  dbUpdateCommandCenterStatus,
  dbCreateFocusItem,
  dbFindFocusItemById,
  dbListFocusItemsByCommandCenter,
  dbUpdateFocusItemStatus,
  dbCreateFocusLink,
} from "./command-center-repository";
import { generateFocusItemsFromAttention } from "./focus-detection-engine";
import {
  calculateOverallPriority,
  calculateCommandCenterFocusScore,
} from "./priority-engine";
import { calculateCommandCenterHealth } from "./health-engine";
import { getOperationalFocusLineage } from "./lineage-engine";
import type {
  CommandCenterResult,
  OperationalCommandCenterRow,
  OperationalFocusItemRow,
  OperationalFocus,
  CommandCenterHealth,
  CommandCenterLineage,
  CommandCenterEventType,
  GenerateCommandCenterInput,
  GetCommandCenterInput,
  ListCommandCentersInput,
  ValidateCommandCenterInput,
  ArchiveCommandCenterInput,
  AcknowledgeFocusItemInput,
  StartFocusItemInput,
  ResolveFocusItemInput,
  DismissFocusItemInput,
  GetOperationalFocusInput,
  GetCommandCenterLineageInput,
} from "./types";
import { OPERATIONAL_COMMAND_STATUSES } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): CommandCenterResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitCCEvent(
  workspaceId: string,
  commandCenterId: string,
  projectId: string,
  eventType: CommandCenterEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    projectId,
    actorId,
    actorType: "system",
    eventType,
    eventCategory: "system",
    source: "system",
    correlationId: commandCenterId,
    rawReferenceTable: "operational_command_centers",
    rawReferenceId: commandCenterId,
    learningEligible: false,
    eventPayload: { commandCenterId, projectId, ...extraPayload },
  });
}

async function emitFocusEvent(
  workspaceId: string,
  commandCenterId: string,
  projectId: string,
  focusItemId: string,
  eventType: CommandCenterEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    projectId,
    actorId,
    actorType: "system",
    eventType,
    eventCategory: "system",
    source: "system",
    correlationId: commandCenterId,
    rawReferenceTable: "operational_focus_items",
    rawReferenceId: focusItemId,
    learningEligible: false,
    eventPayload: { commandCenterId, focusItemId, ...extraPayload },
  });
}

// ─── generateOperationalCommandCenter ────────────────────────────────────────

export async function generateOperationalCommandCenter(
  input: GenerateCommandCenterInput
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.projectId))   return validation("projectId must be a UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  // Load attention items from the snapshot
  const attentionResult = await dbListProjectOSAttentionItems(
    input.snapshotId,
    input.workspaceId
  );
  if (!attentionResult.ok) return attentionResult;

  const attentionItems = attentionResult.data;

  // Load snapshot to get operating health score
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data: snapshot } = await supabase
    .from("project_os_snapshots")
    .select("operating_health_score")
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single();

  const operatingHealthScore = (snapshot?.operating_health_score as number) ?? 100;

  // Generate focus items from attention items
  const generatedItems = generateFocusItemsFromAttention({
    attentionItems,
    operatingHealthScore,
  });

  // Calculate overall priority and focus score
  const scores = generatedItems.map((i) => i.focusScore);
  const overallPriority = calculateOverallPriority(scores);
  const focusScore = calculateCommandCenterFocusScore(scores);

  // Persist command center
  const ccResult = await dbCreateCommandCenter({
    workspaceId: input.workspaceId,
    projectId:   input.projectId,
    snapshotId:  input.snapshotId,
    overallPriority,
    focusScore,
  });
  if (!ccResult.ok) return ccResult;
  const commandCenter = ccResult.data;

  // Persist focus items and emit events
  for (const item of generatedItems) {
    const itemResult = await dbCreateFocusItem({
      workspaceId:      input.workspaceId,
      commandCenterId:  commandCenter.id,
      item,
    });
    if (itemResult.ok) {
      // Create traceability link to source attention item
      if (item.attentionItemId) {
        await dbCreateFocusLink({
          workspaceId:      input.workspaceId,
          focusItemId:      itemResult.data.id,
          entityType:       "project_os_attention_items",
          entityId:         item.attentionItemId,
          relationshipType: "source_attention_item",
        });
      }

      await emitFocusEvent(
        input.workspaceId,
        commandCenter.id,
        input.projectId,
        itemResult.data.id,
        "OPERATIONAL_FOCUS_ITEM_CREATED",
        input.actorId,
        { focusType: item.focusType, priority: item.priority, focusScore: item.focusScore }
      );
    }
  }

  await emitCCEvent(
    input.workspaceId,
    commandCenter.id,
    input.projectId,
    "OPERATIONAL_COMMAND_CENTER_GENERATED",
    input.actorId,
    { overallPriority, focusScore, focusItemCount: generatedItems.length }
  );

  await emitCCEvent(
    input.workspaceId,
    commandCenter.id,
    input.projectId,
    "OPERATIONAL_FOCUS_SCORE_CALCULATED",
    input.actorId,
    { focusScore }
  );

  await emitCCEvent(
    input.workspaceId,
    commandCenter.id,
    input.projectId,
    "OPERATIONAL_PRIORITY_CALCULATED",
    input.actorId,
    { overallPriority }
  );

  return { ok: true, data: commandCenter };
}

// ─── getOperationalCommandCenter ──────────────────────────────────────────────

export async function getOperationalCommandCenter(
  input: GetCommandCenterInput
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");
  return dbFindCommandCenterById(input.commandCenterId, input.workspaceId);
}

// ─── listOperationalCommandCenters ────────────────────────────────────────────

export async function listOperationalCommandCenters(
  input: ListCommandCentersInput
): Promise<CommandCenterResult<OperationalCommandCenterRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.projectId && !validUuid(input.projectId)) {
    return validation("projectId must be a UUID.");
  }
  if (input.snapshotId && !validUuid(input.snapshotId)) {
    return validation("snapshotId must be a UUID.");
  }
  if (input.status && !OPERATIONAL_COMMAND_STATUSES.includes(input.status)) {
    return validation(`status must be one of: ${OPERATIONAL_COMMAND_STATUSES.join(", ")}.`);
  }
  return dbListCommandCenters(input);
}

// ─── validateOperationalCommandCenter ────────────────────────────────────────

export async function validateOperationalCommandCenter(
  input: ValidateCommandCenterInput
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");
  if (!validUuid(input.actorId))         return validation("actorId must be a UUID.");

  const current = await dbFindCommandCenterById(input.commandCenterId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.command_status !== "generated") {
    return validation(
      `Command center can only be validated from 'generated' status (current: ${current.data.command_status}).`
    );
  }

  const result = await dbUpdateCommandCenterStatus(input.commandCenterId, input.workspaceId, "validated");
  if (!result.ok) return result;

  await emitCCEvent(
    input.workspaceId,
    input.commandCenterId,
    result.data.project_id,
    "OPERATIONAL_COMMAND_CENTER_VALIDATED",
    input.actorId
  );

  return result;
}

// ─── archiveOperationalCommandCenter ─────────────────────────────────────────

export async function archiveOperationalCommandCenter(
  input: ArchiveCommandCenterInput
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");
  if (!validUuid(input.actorId))         return validation("actorId must be a UUID.");

  const current = await dbFindCommandCenterById(input.commandCenterId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.command_status === "archived") {
    return validation("Command center is already archived.");
  }

  const result = await dbUpdateCommandCenterStatus(input.commandCenterId, input.workspaceId, "archived");
  if (!result.ok) return result;

  await emitCCEvent(
    input.workspaceId,
    input.commandCenterId,
    result.data.project_id,
    "OPERATIONAL_COMMAND_CENTER_ARCHIVED",
    input.actorId
  );

  return result;
}

// ─── acknowledgeFocusItem ─────────────────────────────────────────────────────

export async function acknowledgeFocusItem(
  input: AcknowledgeFocusItemInput
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.focusItemId))  return validation("focusItemId must be a UUID.");
  if (!validUuid(input.actorId))      return validation("actorId must be a UUID.");

  const current = await dbFindFocusItemById(input.focusItemId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "open") {
    return validation(`Focus item can only be acknowledged from 'open' status (current: ${current.data.status}).`);
  }

  const result = await dbUpdateFocusItemStatus(input.focusItemId, input.workspaceId, "acknowledged");
  if (!result.ok) return result;

  await emitFocusEvent(
    input.workspaceId,
    current.data.command_center_id,
    "",
    input.focusItemId,
    "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED",
    input.actorId
  );

  return result;
}

// ─── startFocusItem ───────────────────────────────────────────────────────────

export async function startFocusItem(
  input: StartFocusItemInput
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.focusItemId))  return validation("focusItemId must be a UUID.");
  if (!validUuid(input.actorId))      return validation("actorId must be a UUID.");

  const current = await dbFindFocusItemById(input.focusItemId, input.workspaceId);
  if (!current.ok) return current;

  if (!["open", "acknowledged"].includes(current.data.status)) {
    return validation(`Focus item can only be started from 'open' or 'acknowledged' status (current: ${current.data.status}).`);
  }

  const result = await dbUpdateFocusItemStatus(input.focusItemId, input.workspaceId, "in_progress");
  if (!result.ok) return result;

  await emitFocusEvent(
    input.workspaceId,
    current.data.command_center_id,
    "",
    input.focusItemId,
    "OPERATIONAL_FOCUS_ITEM_STARTED",
    input.actorId
  );

  return result;
}

// ─── resolveFocusItem ─────────────────────────────────────────────────────────

export async function resolveFocusItem(
  input: ResolveFocusItemInput
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.focusItemId))  return validation("focusItemId must be a UUID.");
  if (!validUuid(input.actorId))      return validation("actorId must be a UUID.");

  const current = await dbFindFocusItemById(input.focusItemId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status === "resolved") {
    return validation("Focus item is already resolved.");
  }
  if (current.data.status === "dismissed") {
    return validation("Cannot resolve a dismissed focus item.");
  }

  const resolvedAt = new Date().toISOString();
  const result = await dbUpdateFocusItemStatus(
    input.focusItemId,
    input.workspaceId,
    "resolved",
    { resolved_at: resolvedAt }
  );
  if (!result.ok) return result;

  await emitFocusEvent(
    input.workspaceId,
    current.data.command_center_id,
    "",
    input.focusItemId,
    "OPERATIONAL_FOCUS_ITEM_RESOLVED",
    input.actorId,
    { resolvedAt }
  );

  return result;
}

// ─── dismissFocusItem ─────────────────────────────────────────────────────────

export async function dismissFocusItem(
  input: DismissFocusItemInput
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.focusItemId))  return validation("focusItemId must be a UUID.");
  if (!validUuid(input.actorId))      return validation("actorId must be a UUID.");

  const current = await dbFindFocusItemById(input.focusItemId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status === "dismissed") {
    return validation("Focus item is already dismissed.");
  }
  if (current.data.status === "resolved") {
    return validation("Cannot dismiss a resolved focus item.");
  }

  const dismissedAt = new Date().toISOString();
  const result = await dbUpdateFocusItemStatus(
    input.focusItemId,
    input.workspaceId,
    "dismissed",
    { dismissed_at: dismissedAt }
  );
  if (!result.ok) return result;

  await emitFocusEvent(
    input.workspaceId,
    current.data.command_center_id,
    "",
    input.focusItemId,
    "OPERATIONAL_FOCUS_ITEM_DISMISSED",
    input.actorId,
    { dismissedAt }
  );

  return result;
}

// ─── getOperationalFocus ──────────────────────────────────────────────────────

export async function getOperationalFocus(
  input: GetOperationalFocusInput
): Promise<CommandCenterResult<OperationalFocus>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");

  const ccResult = await dbFindCommandCenterById(input.commandCenterId, input.workspaceId);
  if (!ccResult.ok) return ccResult;

  const itemsResult = await dbListFocusItemsByCommandCenter(input.commandCenterId, input.workspaceId);
  if (!itemsResult.ok) return itemsResult;

  const items = itemsResult.data;
  const activeItems = items.filter((i) => i.status !== "dismissed");

  const topFocusItems = [...activeItems]
    .sort((a, b) => b.focus_score - a.focus_score)
    .slice(0, 5);

  const criticalBlockers = activeItems.filter(
    (i) => i.priority === "critical" && ["authority", "ratification", "governance"].includes(i.focus_type)
  );

  const now = new Date();
  const overdueItems = activeItems.filter(
    (i) =>
      i.recommended_due_date != null &&
      new Date(i.recommended_due_date) < now &&
      i.status !== "resolved"
  );

  const recommendedInterventions = activeItems
    .filter((i) => i.recommended_action_type != null)
    .slice(0, 10)
    .map((i) => ({
      focusItemId:             i.id,
      title:                   i.title,
      recommendedActionType:   i.recommended_action_type,
      recommendedOwnerType:    i.recommended_owner_type,
      recommendedDueDate:      i.recommended_due_date,
      priority:                i.priority,
    }));

  return {
    ok: true,
    data: {
      commandCenterId: input.commandCenterId,
      projectId:       ccResult.data.project_id,
      workspaceId:     input.workspaceId,
      topFocusItems,
      criticalBlockers,
      overdueItems,
      recommendedInterventions,
    },
  };
}

// ─── getCommandCenterHealth ───────────────────────────────────────────────────

export async function getCommandCenterHealth(input: {
  workspaceId: string;
  commandCenterId: string;
}): Promise<CommandCenterResult<CommandCenterHealth>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");

  const itemsResult = await dbListFocusItemsByCommandCenter(input.commandCenterId, input.workspaceId);
  if (!itemsResult.ok) return itemsResult;

  return { ok: true, data: calculateCommandCenterHealth(itemsResult.data) };
}

// ─── getOperationalFocusLineageForCommandCenter ───────────────────────────────

export async function getOperationalFocusLineageForCommandCenter(
  input: GetCommandCenterLineageInput
): Promise<CommandCenterResult<CommandCenterLineage>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.commandCenterId)) return validation("commandCenterId must be a UUID.");
  if (!validUuid(input.actorId))         return validation("actorId must be a UUID.");

  const result = await getOperationalFocusLineage({
    workspaceId:     input.workspaceId,
    commandCenterId: input.commandCenterId,
  });

  if (result.ok) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         result.data.projectId,
      actorId:           input.actorId,
      actorType:         "system",
      eventType:         "OPERATIONAL_FOCUS_LINEAGE_GENERATED",
      eventCategory:     "system",
      source:            "system",
      correlationId:     input.commandCenterId,
      rawReferenceTable: "operational_command_centers",
      rawReferenceId:    input.commandCenterId,
      learningEligible:  false,
      eventPayload: {
        commandCenterId: input.commandCenterId,
        layerCount:      result.data.chain.length,
      },
    });
  }

  return result;
}
