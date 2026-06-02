import type { SupabaseClient } from "@supabase/supabase-js";
import { persistRaidItems as persistRaidItemsInSupabase } from "@/lib/raid";
import type { RaidItem, RaidPersistenceResult } from "@/lib/raid";
import type { VaultDocument, VaultDocumentIngestionStatus, VaultOperationalSignal } from "./types";

export type VaultIntakeStore = {
  persistDocument(document: VaultDocument): Promise<{ ok: true } | { ok: false; error: string }>;
  persistSignals(signals: VaultOperationalSignal[]): Promise<{ ok: true } | { ok: false; error: string }>;
  persistRaidItems?(items: RaidItem[]): Promise<RaidPersistenceResult>;
  updateDocumentStatus(documentId: string, status: VaultDocumentIngestionStatus): Promise<{ ok: true } | { ok: false; error: string }>;
  triggerExecutiveSynthesisUpdate(input: { workspaceId: string; companyId?: string | null; projectId: string | null; documentId: string; signals: VaultOperationalSignal[]; raidItems?: RaidItem[] }): Promise<{ ok: true } | { ok: false; error: string }>;
};

export function createSupabaseVaultIntakeStore(supabase: SupabaseClient): VaultIntakeStore {
  return {
    async persistDocument(document) {
      const { error } = await supabase.from("vault_documents").insert({
        id: document.id,
        workspace_id: document.workspaceId,
        project_id: document.projectId,
        title: document.title,
        source_type: document.sourceType,
        classification: document.classification,
        raw_content: document.rawContent,
        normalized_content: document.normalizedContent,
        ingestion_status: document.ingestionStatus,
        created_at: document.createdAt,
        created_by: document.createdBy,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    async persistSignals(signals) {
      if (!signals.length) return { ok: true };
      const { error } = await supabase.from("vault_operational_signals").insert(signals.map((signal) => ({
        id: signal.id,
        document_id: signal.documentId,
        workspace_id: signal.workspaceId,
        project_id: signal.projectId,
        signal_type: signal.signalType,
        signal_text: signal.signalText,
        confidence_score: signal.confidenceScore,
        created_at: signal.createdAt,
      })));
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    async persistRaidItems(items) {
      return persistRaidItemsInSupabase({ items, supabase });
    },
    async updateDocumentStatus(documentId, status) {
      const { error } = await supabase.from("vault_documents").update({ ingestion_status: status }).eq("id", documentId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    async triggerExecutiveSynthesisUpdate(input) {
      if (input.companyId && (input.signals.length || input.raidItems?.length)) {
        const recordType = (signal: VaultOperationalSignal) => {
          if (signal.signalType === "action") return "commitment";
          if (signal.signalType === "issue") return "blocker";
          return signal.signalType;
        };
        const signalRows = input.signals.map((signal) => ({
          company_id: input.companyId,
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          record_type: recordType(signal),
          summary: signal.signalText,
          detail: `Vault intake signal from document ${input.documentId}`,
          confidence: signal.confidenceScore,
          ingestion_source: "manual_note",
          source_ref: `vault_document:${input.documentId}`,
          nutrient_ids: [signal.id],
        }));
        const raidRows = (input.raidItems ?? []).map((item) => ({
          company_id: input.companyId,
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          record_type: item.category === "issue" ? "blocker" : item.category,
          summary: `[RAID:${item.category}] ${item.title}`,
          detail: `Auto-generated RAID item ${item.id} from vault document ${input.documentId}`,
          confidence: item.confidenceScore / 100,
          ingestion_source: "manual_note",
          source_ref: `raid_item:${item.id}`,
          nutrient_ids: [item.sourceSignalId ?? item.sourceDocumentId],
        }));
        const { error: memoryError } = await supabase.from("operational_memory_records").insert([...signalRows, ...raidRows]);
        if (memoryError) return { ok: false, error: memoryError.message };
      }
      const { error } = await supabase.from("vault_documents").update({ ingestion_status: "completed" }).eq("id", input.documentId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}
