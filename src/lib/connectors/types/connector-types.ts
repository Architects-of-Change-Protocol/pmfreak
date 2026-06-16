export type ConnectorSystem =
  | "jira" | "linear" | "asana" | "monday" | "trello" | "slack" | "teams" | "gmail" | "outlook"
  | "google_calendar" | "github" | "gitlab" | "confluence" | "notion" | "sharepoint" | "servicenow"
  | "zendesk" | "procurement" | "erp" | "vendor_ticketing" | "pmo_spreadsheet" | "meeting_transcript" | "support";

export interface ConnectorGovernanceBoundary { tenantId: string; workspaceId: string; allowedDomains: string[]; visibility: "workspace"|"executive"; }
export interface SourceProvenanceRecord { sourceSystem: ConnectorSystem; sourceEventId: string; sourceReference: string; normalizedBy: string; federationRuleIds: string[]; lineageRationale: string; }
export type SourceLineageRecord = SourceProvenanceRecord;
export interface ConnectorSignal { id: string; connector: ConnectorSystem; type: string; severity: "low"|"medium"|"high"|"critical"; occurredAt: string; actorHints: string[]; payload: Record<string, unknown>; governance: ConnectorGovernanceBoundary; }
export interface FederatedOperationalSignal extends ConnectorSignal { operationalMeaning: string; confidence: number; uncertainty: string[]; temporalReferences: string[]; lineage: SourceLineageRecord[]; }
export interface SignalNormalizationResult { signal: FederatedOperationalSignal; confidence: number; uncertainty: string[]; rationale: string; }
export interface SignalFederationResult { signals: FederatedOperationalSignal[]; confidence: number; uncertainty: string[]; rationale: string; }
export interface OperationalIdentity { canonicalId: string; displayName: string; aliases: string[]; systems: ConnectorSystem[]; confidence: number; }
export interface OperationalIdentityCorrelation { identities: OperationalIdentity[]; rationale: string; confidence: number; uncertainty: string[]; }
export interface FederatedTimelineEvent { id: string; at: string; signalIds: string[]; description: string; confidence: number; lineage: SourceLineageRecord[]; }
export interface ConnectorHeartbeat { connector: ConnectorSystem; status: "healthy"|"degraded"|"offline"; freshnessSeconds: number; ingestionLatencyMs: number; replayIntegrity: "ok"|"warning"|"failed"; federationDrift: number; checkedAt: string; }
export interface ConnectorReplay { from: string; to: string; connector: ConnectorSystem; eventsReplayed: number; integrity: "verified"|"partial"; }
export interface ConnectorSynchronizationState { connector: ConnectorSystem; lastSyncAt: string | null; nextSyncAt: string | null; intervalSeconds: number; driftSeconds: number; inFlight: boolean; }
export interface ConnectorDiagnostic { id: string; connector: ConnectorSystem; level: "info"|"warn"|"error"; message: string; reason: string; confidence: number; uncertainty: string[]; createdAt: string; }
export interface ConnectorNarrative { id: string; statement: string; evidenceSignalIds: string[]; confidence: number; uncertainty: string[]; lineage: SourceLineageRecord[]; }
export interface ConnectorAdapter { connector: ConnectorSystem; ingest(): Promise<ConnectorSignal[]>; replay(from: string, to: string): Promise<ConnectorReplay>; sync(): Promise<ConnectorSynchronizationState>; diagnostics(): Promise<ConnectorDiagnostic[]>; }
export interface ConnectorRuntime { ingestAll(): Promise<ConnectorSignal[]>; normalize(signals: ConnectorSignal[]): SignalNormalizationResult[]; federate(signals: FederatedOperationalSignal[]): SignalFederationResult; }
