import type { ArtifactType, MemoryLinkEntityType, MemoryType, StorageProvider } from "./types";

// ─── Explain Constitutional Memory ───────────────────────────────────────────

export type ConstitutionalMemoryExplanation = {
  concept: string;
  principles: string[];
  artifact: {
    description: string;
    supportedTypes: ArtifactType[];
    storageProviders: StorageProvider[];
    sovereigntyModel: string;
  };
  memoryRecord: {
    description: string;
    supportedTypes: MemoryType[];
    traceabilityRule: string;
  };
  canonicalRepresentation: {
    description: string;
    outputStructure: string[];
    digestCandidateNote: string;
  };
  storageReference: {
    description: string;
    vaultRole: string;
    clientRole: string;
  };
  sovereigntyModel: {
    vaultOwns: string[];
    clientOwns: string[];
    separationPrinciple: string;
  };
  linkableEntities: MemoryLinkEntityType[];
  auditEvents: string[];
};

export function explainConstitutionalMemory(): ConstitutionalMemoryExplanation {
  return {
    concept:
      "Constitutional Memory is the structured representation of institutional knowledge derived from external artifacts. " +
      "It separates physical file storage (client-controlled) from constitutional knowledge (PMFreak-controlled), " +
      "enabling full traceability from governance decisions back to their evidentiary sources.",

    principles: [
      "The Vault is not a file system — it stores constitutional representations, not files.",
      "The client maintains ownership and control of their data files.",
      "PMFreak maintains the constitutional memory derived from those files.",
      "Every piece of knowledge must be traceable to a registered artifact.",
      "Every memory record must be transformable into a Digest (anonymizable canonical form).",
      "Workspace isolation is mandatory — no cross-workspace data access.",
      "Every artifact must have a checksum for integrity verification.",
    ],

    artifact: {
      description:
        "An Artifact represents an external element (PDF, email, transcript, etc.) that contains evidence " +
        "relevant to constitutional governance. The Vault registers a reference to where the artifact lives, " +
        "not the artifact itself.",
      supportedTypes: [
        "document",
        "email",
        "meeting",
        "transcript",
        "spreadsheet",
        "image",
        "video",
        "link",
        "chat",
        "other",
      ],
      storageProviders: [
        "local",
        "supabase",
        "s3",
        "azure_blob",
        "google_drive",
        "sharepoint",
        "dropbox",
        "custom",
      ],
      sovereigntyModel:
        "The client controls where artifacts are stored. PMFreak stores only a storage_reference " +
        "(opaque ID in the external system), storage_path, storage_provider identifier, and checksum. " +
        "The actual file never leaves the client's storage.",
    },

    memoryRecord: {
      description:
        "A Memory Record is a structured constitutional knowledge unit derived from an artifact. " +
        "It contains a canonical_text (the authoritative knowledge representation) and a summary. " +
        "Every memory record must be linked to exactly one artifact — traceability is mandatory.",
      supportedTypes: [
        "decision",
        "objective",
        "constraint",
        "risk",
        "issue",
        "amendment",
        "ratification",
        "authority",
        "evidence",
        "other",
      ],
      traceabilityRule:
        "artifact_id is required and non-nullable. A memory record cannot exist without an artifact. " +
        "The composite foreign key (artifact_id, workspace_id) enforces workspace isolation at the database level.",
    },

    canonicalRepresentation: {
      description:
        "The Canonical Representation transforms a set of memory records into a structured YAML-compatible " +
        "knowledge object. It aggregates memory records by type into typed buckets: decisions, risks, " +
        "objectives, and constraints.",
      outputStructure: [
        "summary: string — derived from memory records or artifact description",
        "decisions: string[] — from memory records of type decision, amendment, ratification",
        "risks: string[] — from memory records of type risk, issue",
        "objectives: string[] — from memory records of type objective",
        "constraints: string[] — from memory records of type constraint",
        "metadata: { storageProvider, storageReference, checksum }",
      ],
      digestCandidateNote:
        "Every Canonical Representation is a Digest Candidate — it can be anonymized by replacing " +
        "storage_reference with a hash, removing PII from canonical_text, and redacting checksum details.",
    },

    storageReference: {
      description:
        "A Storage Reference is an opaque identifier pointing to where a file lives in an external system. " +
        "It may be an S3 key, Google Drive file ID, SharePoint document URL, or any system-specific identifier.",
      vaultRole:
        "PMFreak stores: storage_provider, storage_reference, storage_path, checksum. " +
        "This is sufficient to locate and verify the artifact without hosting it.",
      clientRole:
        "The client is responsible for maintaining access to the storage system, managing file lifecycle, " +
        "and controlling who can access the physical files. PMFreak has no direct access to client storage.",
    },

    sovereigntyModel: {
      vaultOwns: [
        "constitutional_artifacts (references only)",
        "constitutional_memory_records (structured knowledge)",
        "constitutional_memory_links (lineage graph)",
        "Canonical representations and Digests",
        "Audit trail of all memory operations",
      ],
      clientOwns: [
        "Physical files (PDFs, emails, spreadsheets, etc.)",
        "Storage infrastructure (S3, Google Drive, SharePoint, etc.)",
        "Access credentials to storage systems",
        "File lifecycle management (deletion, versioning, retention)",
      ],
      separationPrinciple:
        "The constitutional memory system can function entirely without direct file access. " +
        "Knowledge is extracted once into canonical form; the original file remains under client control. " +
        "Archiving an artifact in the Vault (soft delete) does not delete the client's file.",
    },

    linkableEntities: [
      "constitution",
      "decision",
      "amendment",
      "ratification",
      "authority",
      "violation",
      "escalation",
    ],

    auditEvents: [
      "CONSTITUTIONAL_ARTIFACT_REGISTERED — artifact reference created",
      "CONSTITUTIONAL_ARTIFACT_UPDATED — artifact metadata changed",
      "CONSTITUTIONAL_ARTIFACT_ARCHIVED — artifact soft-deleted",
      "CONSTITUTIONAL_MEMORY_CREATED — new memory record derived from artifact",
      "CONSTITUTIONAL_MEMORY_UPDATED — memory record content updated",
      "CONSTITUTIONAL_MEMORY_LINKED — memory record linked to governance entity",
      "CONSTITUTIONAL_LINEAGE_GENERATED — lineage chain reconstructed for audit",
    ],
  };
}
