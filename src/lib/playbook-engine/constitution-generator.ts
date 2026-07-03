import type { ConstitutionStatus } from "@/lib/project-constitution";
import type { DeliveryPlaybook, PlaybookEngineResult, PlaybookFactKey, ProjectContextFacts } from "./types";

/**
 * How a draft field's value was populated. The generator never invents content — every
 * field that isn't backed by real data (project context or explicit source facts) is
 * marked with one of the non-"provided"/"derived_from_playbook" statuses instead of a guess.
 */
export type ProjectConstitutionDraftFieldStatus =
  | "provided"
  | "derived_from_playbook"
  | "pending_definition"
  | "requires_validation"
  | "not_available";

export type ProjectConstitutionDraftField<T> = {
  value: T;
  status: ProjectConstitutionDraftFieldStatus;
  note: string;
};

/**
 * Real content the caller already has on hand (e.g. captured elsewhere in the product) and
 * wants reflected in the draft verbatim. `ProjectContextFacts` (Sprint 1) only carries
 * evidence flags/counts, never free-text content, so this is the only channel through which
 * the generator can populate content fields without inventing them.
 */
export type ProjectConstitutionSourceFacts = {
  objective?: string | null;
  scopeIn?: string[] | null;
  scopeOut?: string[] | null;
  deliverables?: string[] | null;
  acceptanceCriteria?: string[] | null;
  stakeholders?: string[] | null;
  constraints?: string[] | null;
  initialRisks?: string[] | null;
  initialDependencies?: string[] | null;
  communicationRules?: string[] | null;
  changeRules?: string[] | null;
  closureRules?: string[] | null;
  billingRules?: string[] | null;
};

export type ProjectConstitutionDraft = {
  projectId: string;
  status: ConstitutionStatus;
  objective: ProjectConstitutionDraftField<string | null>;
  scopeIn: ProjectConstitutionDraftField<string[]>;
  scopeOut: ProjectConstitutionDraftField<string[]>;
  deliverables: ProjectConstitutionDraftField<string[]>;
  acceptanceCriteria: ProjectConstitutionDraftField<string[]>;
  stakeholders: ProjectConstitutionDraftField<string[]>;
  constraints: ProjectConstitutionDraftField<string[]>;
  initialRisks: ProjectConstitutionDraftField<string[]>;
  initialDependencies: ProjectConstitutionDraftField<string[]>;
  communicationRules: ProjectConstitutionDraftField<string[]>;
  changeRules: ProjectConstitutionDraftField<string[]>;
  closureRules: ProjectConstitutionDraftField<string[]>;
  billingRules: ProjectConstitutionDraftField<string[]>;
  evidenceRequirements: ProjectConstitutionDraftField<string[]>;
  playbookId: string;
  playbookVersion: number;
  generatedAt: string;
};

function providedString(value: string | null | undefined, note: string): ProjectConstitutionDraftField<string | null> {
  const trimmed = value?.trim();
  if (trimmed) return { value: trimmed, status: "provided", note };
  return { value: null, status: "pending_definition", note };
}

function providedList(
  value: string[] | null | undefined,
  note: string,
  fallbackStatus: ProjectConstitutionDraftFieldStatus = "pending_definition",
): ProjectConstitutionDraftField<string[]> {
  const cleaned = (value ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
  if (cleaned.length > 0) return { value: cleaned, status: "provided", note };
  return { value: [], status: fallbackStatus, note };
}

/**
 * Evidence-backed content is known to exist elsewhere (a related fact is `true`) but its
 * text was not supplied, so the field cannot be filled — it must be imported/reviewed by a
 * human rather than pending from scratch.
 */
function evidenceAwareFallback(evidenceFact: boolean | null | undefined): ProjectConstitutionDraftFieldStatus {
  return evidenceFact === true ? "requires_validation" : "pending_definition";
}

function evidenceRequirementsFromPlaybook(playbook: DeliveryPlaybook, phase: ProjectContextFacts["phase"]): string[] {
  const matchedPhase = phase ? playbook.phases.find((p) => p.key === phase) : undefined;

  const factKeys: PlaybookFactKey[] = matchedPhase
    ? Array.from(new Set([...matchedPhase.entryEvidence, ...matchedPhase.exitEvidence]))
    : Array.from(new Set(playbook.phases.flatMap((p) => [...p.entryEvidence, ...p.exitEvidence])));

  const phaseLabel = matchedPhase ? `la fase '${matchedPhase.name}'` : "el ciclo de vida completo (fase del proyecto desconocida)";

  return factKeys.map(
    (fact) => `${fact}: evidencia requerida por ${phaseLabel} del playbook '${playbook.name}' (v${playbook.version}).`,
  );
}

/**
 * Derives a draft Project Constitution from the playbook and whatever project context is
 * known. Reuses the `ConstitutionStatus` lifecycle already defined by `project-constitution`
 * (the draft always starts in "draft" — activation/approval go through that module's existing
 * state machine, never through this generator). This function is pure: no persistence, no
 * event emission, no auto-approval. Content fields the project context cannot supply are
 * explicitly marked pending/requires-validation/not-available rather than invented.
 */
export function generateProjectConstitutionDraftFromPlaybook(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
  sourceFacts?: ProjectConstitutionSourceFacts,
): PlaybookEngineResult<ProjectConstitutionDraft> {
  if (!context.projectId || context.projectId.trim().length === 0) {
    return { ok: false, error: "context.projectId is required to generate a Project Constitution draft.", failureClass: "validation_failed" };
  }
  if (!playbook.phases || playbook.phases.length === 0) {
    return { ok: false, error: "playbook must declare at least one phase.", failureClass: "validation_failed" };
  }

  const facts = sourceFacts ?? {};
  const contextNote = "Tomado del contexto del proyecto suministrado a la generación del draft.";
  const pendingNote = "No disponible en el contexto del proyecto; requiere ser definido por el equipo.";
  const validationNote = "El playbook reporta evidencia de que este artefacto existe; debe importarse y validarse manualmente.";
  const notAvailableNote = "El Playbook Engine (Sprint 1) no rastrea evidencia para este campo; no puede derivarse automáticamente.";

  const stakeholdersFallback = evidenceAwareFallback(context.hasStakeholderMap);
  const initialRisksFallback = evidenceAwareFallback(context.hasRiskRegister);
  const communicationRulesFallback = evidenceAwareFallback(context.hasCommunicationsPlan);
  const closureRulesFallback = evidenceAwareFallback(context.hasClosureChecklistStarted);

  const draft: ProjectConstitutionDraft = {
    projectId: context.projectId,
    status: "draft",
    objective: providedString(facts.objective, facts.objective ? contextNote : pendingNote),
    scopeIn: providedList(facts.scopeIn, facts.scopeIn?.length ? contextNote : pendingNote),
    scopeOut: providedList(facts.scopeOut, facts.scopeOut?.length ? contextNote : pendingNote),
    deliverables: providedList(facts.deliverables, facts.deliverables?.length ? contextNote : pendingNote),
    acceptanceCriteria: providedList(facts.acceptanceCriteria, facts.acceptanceCriteria?.length ? contextNote : pendingNote),
    stakeholders: providedList(
      facts.stakeholders,
      facts.stakeholders?.length ? contextNote : stakeholdersFallback === "requires_validation" ? validationNote : pendingNote,
      stakeholdersFallback,
    ),
    constraints: providedList(facts.constraints, facts.constraints?.length ? contextNote : pendingNote),
    initialRisks: providedList(
      facts.initialRisks,
      facts.initialRisks?.length ? contextNote : initialRisksFallback === "requires_validation" ? validationNote : pendingNote,
      initialRisksFallback,
    ),
    initialDependencies: providedList(
      facts.initialDependencies,
      facts.initialDependencies?.length ? contextNote : notAvailableNote,
      "not_available",
    ),
    communicationRules: providedList(
      facts.communicationRules,
      facts.communicationRules?.length ? contextNote : communicationRulesFallback === "requires_validation" ? validationNote : pendingNote,
      communicationRulesFallback,
    ),
    changeRules: providedList(facts.changeRules, facts.changeRules?.length ? contextNote : notAvailableNote, "not_available"),
    closureRules: providedList(
      facts.closureRules,
      facts.closureRules?.length ? contextNote : closureRulesFallback === "requires_validation" ? validationNote : pendingNote,
      closureRulesFallback,
    ),
    billingRules: providedList(
      facts.billingRules,
      facts.billingRules?.length
        ? contextNote
        : "Los datos de facturación siempre requieren validación humana antes de gobernar el proyecto, incluso cuando el playbook no reporta evidencia.",
      "requires_validation",
    ),
    evidenceRequirements: {
      value: evidenceRequirementsFromPlaybook(playbook, context.phase),
      status: "derived_from_playbook",
      note: `Derivado de las fases y evidencias declaradas en el playbook '${playbook.name}'.`,
    },
    playbookId: playbook.id,
    playbookVersion: playbook.version,
    generatedAt: new Date().toISOString(),
  };

  return { ok: true, data: draft };
}

export type ProjectConstitutionDraftGenerationExplanation = {
  draftStatus: ConstitutionStatus;
  fieldsUsedFromContext: string[];
  fieldsDerivedFromPlaybook: string[];
  fieldsPendingDefinition: string[];
  fieldsRequiringValidation: string[];
  fieldsNotAvailable: string[];
  requiresHumanReview: boolean;
  approvalNote: string;
};

/**
 * Explains a specific draft generation result: what data was used, what is missing, which
 * fields need human review, and that the draft is never auto-approved.
 */
export function explainProjectConstitutionDraftGeneration(
  draft: ProjectConstitutionDraft,
): ProjectConstitutionDraftGenerationExplanation {
  const entries: [string, ProjectConstitutionDraftField<unknown>][] = [
    ["objective", draft.objective],
    ["scopeIn", draft.scopeIn],
    ["scopeOut", draft.scopeOut],
    ["deliverables", draft.deliverables],
    ["acceptanceCriteria", draft.acceptanceCriteria],
    ["stakeholders", draft.stakeholders],
    ["constraints", draft.constraints],
    ["initialRisks", draft.initialRisks],
    ["initialDependencies", draft.initialDependencies],
    ["communicationRules", draft.communicationRules],
    ["changeRules", draft.changeRules],
    ["closureRules", draft.closureRules],
    ["billingRules", draft.billingRules],
    ["evidenceRequirements", draft.evidenceRequirements],
  ];

  const byStatus = (status: ProjectConstitutionDraftFieldStatus) => entries.filter(([, field]) => field.status === status).map(([name]) => name);

  const fieldsPendingDefinition = byStatus("pending_definition");
  const fieldsRequiringValidation = byStatus("requires_validation");
  const fieldsNotAvailable = byStatus("not_available");

  return {
    draftStatus: draft.status,
    fieldsUsedFromContext: byStatus("provided"),
    fieldsDerivedFromPlaybook: byStatus("derived_from_playbook"),
    fieldsPendingDefinition,
    fieldsRequiringValidation,
    fieldsNotAvailable,
    requiresHumanReview: fieldsPendingDefinition.length + fieldsRequiringValidation.length + fieldsNotAvailable.length > 0,
    approvalNote:
      "Este draft se genera en estado 'draft' únicamente. No se aprueba, activa ni persiste automáticamente: " +
      "cualquier transición de estado requiere una acción humana explícita a través del módulo project-constitution.",
  };
}
