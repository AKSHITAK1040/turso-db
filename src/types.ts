export type WriteOperation = "insert" | "update" | "delete" | "vector_memory_upsert";

export type NetworkState = "online" | "offline" | "transient_failure";

export type GateStatus = "pass" | "fail" | "warning" | "skipped";

export const GATE_SEQUENCE = [
  "Local write accepted",
  "WAL entry created",
  "Sync queue admitted",
  "Network available check",
  "Auth check",
  "Schema version check",
  "Pull freshness check",
  "Vector memory freshness check",
  "Conflict check",
  "Remote apply check",
  "Pull update check",
] as const;

export type GateName = (typeof GATE_SEQUENCE)[number];

export type FinalSyncState =
  | "synced"
  | "pending_offline"
  | "retry_scheduled"
  | "conflict_blocked"
  | "schema_blocked"
  | "auth_blocked"
  | "pull_required"
  | "stale_vector_memory"
  | "remote_apply_failed"
  | "delete_synced";

export type BlockReason =
  | "NONE"
  | "NETWORK_OFFLINE"
  | "AUTH_EXPIRED"
  | "SCHEMA_VERSION_MISMATCH"
  | "REMOTE_ROW_CONFLICT"
  | "PULL_REQUIRED_BEFORE_PUSH"
  | "STALE_EMBEDDING_VERSION"
  | "REMOTE_APPLY_FAILED";

export interface LocalWrite {
  writeId: string;
  databaseId: string;
  tenantId: string;
  actorId: string;
  table: string;
  primaryKey: string;
  operation: WriteOperation;
  localVersion: number;
  baseRemoteVersion: number;
  payloadHash: string;
  timestamp: string;
  networkState: NetworkState;
  schemaVersion: number;
  embeddingModelVersion?: number;
}

export interface RemoteRow {
  databaseId: string;
  table: string;
  primaryKey: string;
  remoteVersion: number;
  lastUpdatedAt: string;
  schemaVersion: number;
  payloadHash: string;
}

export interface RemoteState {
  rows: RemoteRow[];
}

export interface RemoteMetadata {
  remoteAvailable: boolean;
  authValid: boolean;
  currentSchemaVersion: number;
  lastPullVersion: number;
  embeddingModelVersion: number;
  remoteApplyHealthy: boolean;
}

export interface GateResult {
  gateName: GateName;
  status: GateStatus;
  reason: string;
  details: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictType:
    | "NONE"
    | "REMOTE_ROW_CONFLICT"
    | "STALE_EMBEDDING_VERSION"
    | "SAFE_TO_APPLY"
    | "NO_REMOTE_ROW";
  remoteVersion: number | null;
  localBaseVersion: number;
  suggestedResolution:
    | "pull_remote_then_replay_local_write"
    | "manual_merge_required"
    | "upgrade_local_schema"
    | "recompute_embedding"
    | "refresh_auth_token"
    | "retry_when_online"
    | "wait_for_remote_apply"
    | "safe_to_apply";
  explanation: string;
}

export interface SyncTrace {
  traceId: string;
  writeId: string;
  databaseId: string;
  tenantId: string;
  actorId: string;
  table: string;
  operation: WriteOperation;
  timestamp: string;
  gateResults: GateResult[];
  evaluatedGateCount: number;
  passedGateCount: number;
  warningGateCount: number;
  failedGate: GateName | "NONE";
  finalState: FinalSyncState;
  blockReason: BlockReason;
  suggestedResolution: ConflictResult["suggestedResolution"] | "safe_to_apply";
  debugSummary: string;
}

export interface PrivacySafeSyncTrace {
  traceId: string;
  writeId: string;
  databaseId: string;
  tenantId: string;
  actorId: string;
  table: string;
  operation: WriteOperation;
  finalState: FinalSyncState;
  blockReason: BlockReason;
  gateResults: GateResult[];
  evaluatedGateCount: number;
  passedGateCount: number;
  warningGateCount: number;
  failedGate: GateName | "NONE";
  suggestedResolution: ConflictResult["suggestedResolution"] | "safe_to_apply";
  debugSummary: string;
}

export interface SuggestedFix {
  issueTitle: string;
  explanation: string;
  suggestedAction: string;
  blockReason?: BlockReason;
}

export interface SyncDiagnosticsSummary {
  totalWritesEvaluated: number;
  writesSynced: number;
  writesPending: number;
  writesRetried: number;
  writesConflicted: number;
  writesBlockedBySchema: number;
  writesBlockedByAuth: number;
  staleVectorMemories: number;
  remoteApplyFailures: number;
  mostCommonBlockReason: BlockReason | "NONE";
  mostCommonBlockReasonCount: number;
  finalStateCounts: Record<FinalSyncState, number>;
  blockReasonCounts: Record<BlockReason, number>;
  dropCountByGate: Partial<Record<GateName, number>>;
  suggestedFixes: SuggestedFix[];
}

export interface GeneratedSyncTraceFile {
  generatedAt: string;
  project: "SET Engine";
  traces: PrivacySafeSyncTrace[];
  summary: SyncDiagnosticsSummary;
}
