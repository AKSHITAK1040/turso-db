import type {
  BlockReason,
  ConflictResult,
  FinalSyncState,
  GateName,
  GateResult,
  LocalWrite,
  PrivacySafeSyncTrace,
  RemoteMetadata,
  RemoteRow,
  RemoteState,
  SuggestedFix,
  SyncDiagnosticsSummary,
  SyncTrace,
} from "./types.js";
import { GATE_SEQUENCE } from "./types.js";

const FINAL_STATE_BY_REASON: Record<BlockReason, FinalSyncState> = {
  NONE: "synced",
  NETWORK_OFFLINE: "pending_offline",
  AUTH_EXPIRED: "auth_blocked",
  SCHEMA_VERSION_MISMATCH: "schema_blocked",
  REMOTE_ROW_CONFLICT: "conflict_blocked",
  PULL_REQUIRED_BEFORE_PUSH: "pull_required",
  STALE_EMBEDDING_VERSION: "stale_vector_memory",
  REMOTE_APPLY_FAILED: "remote_apply_failed",
};

function countGateStatuses(gateResults: GateResult[]) {
  let passed = 0;
  let warnings = 0;
  let failures = 0;

  for (const gate of gateResults) {
    if (gate.status === "pass") {
      passed += 1;
    } else if (gate.status === "warning") {
      warnings += 1;
    } else if (gate.status === "fail") {
      failures += 1;
    }
  }

  return { passed, warnings, failures };
}

function findRemoteRow(remoteState: RemoteState, write: LocalWrite): RemoteRow | undefined {
  return remoteState.rows.find(
    (row) => row.table === write.table && row.primaryKey === write.primaryKey && row.databaseId === write.databaseId,
  );
}

function gatePass(gateName: GateName, reason: string, details: string): GateResult {
  return { gateName, status: "pass", reason, details };
}

function gateWarning(gateName: GateName, reason: string, details: string): GateResult {
  return { gateName, status: "warning", reason, details };
}

function gateFail(gateName: GateName, reason: string, details: string): GateResult {
  return { gateName, status: "fail", reason, details };
}

function gateSkipped(gateName: GateName, reason: string): GateResult {
  return { gateName, status: "skipped", reason, details: "Evaluation stopped earlier in the sync pipeline." };
}

function makeTerminalTrace(
  write: LocalWrite,
  gateResults: GateResult[],
  finalState: FinalSyncState,
  blockReason: BlockReason,
  failedGate: GateName | "NONE",
  suggestedResolution: ConflictResult["suggestedResolution"] | "safe_to_apply",
  debugSummary: string,
): SyncTrace {
  const { passed, warnings } = countGateStatuses(gateResults);
  const evaluatedGateCount = gateResults.filter((gate) => gate.status !== "skipped").length;

  return {
    traceId: `trace_${write.writeId}`,
    writeId: write.writeId,
    databaseId: write.databaseId,
    tenantId: write.tenantId,
    actorId: write.actorId,
    table: write.table,
    operation: write.operation,
    timestamp: write.timestamp,
    gateResults,
    evaluatedGateCount,
    passedGateCount: passed,
    warningGateCount: warnings,
    failedGate,
    finalState,
    blockReason,
    suggestedResolution,
    debugSummary,
  };
}

// Local-first sync is hard to debug because the write path spans local durability,
// queue admission, network health, auth, schema drift, conflict checks, and remote apply.
// The engine keeps those decisions visible instead of collapsing them into one opaque failure.
export function detectConflict(write: LocalWrite, remoteRow?: RemoteRow, metadata?: RemoteMetadata): ConflictResult {
  if (write.operation === "vector_memory_upsert") {
    const localEmbeddingVersion = write.embeddingModelVersion ?? 0;
    const remoteEmbeddingVersion = metadata?.embeddingModelVersion ?? localEmbeddingVersion;

    if (localEmbeddingVersion < remoteEmbeddingVersion) {
      return {
        hasConflict: true,
        conflictType: "STALE_EMBEDDING_VERSION",
        remoteVersion: remoteRow?.remoteVersion ?? null,
        localBaseVersion: write.baseRemoteVersion,
        suggestedResolution: "recompute_embedding",
        explanation:
          "The local embedding model is older than the remote metadata, so the vector memory row should be refreshed before replay.",
      };
    }
  }

  if (!remoteRow) {
    return {
      hasConflict: false,
      conflictType: "NO_REMOTE_ROW",
      remoteVersion: null,
      localBaseVersion: write.baseRemoteVersion,
      suggestedResolution: "safe_to_apply",
      explanation: "No remote row exists for this write target, so the write can proceed without a row-level conflict.",
    };
  }

  if (remoteRow.payloadHash === write.payloadHash) {
    return {
      hasConflict: false,
      conflictType: "SAFE_TO_APPLY",
      remoteVersion: remoteRow.remoteVersion,
      localBaseVersion: write.baseRemoteVersion,
      suggestedResolution: "safe_to_apply",
      explanation:
        "The local payload hash matches the remote row hash, so the write is not a destructive conflict even if versions differ.",
    };
  }

  if (write.operation === "insert" && !remoteRow) {
    return {
      hasConflict: false,
      conflictType: "NO_REMOTE_ROW",
      remoteVersion: null,
      localBaseVersion: write.baseRemoteVersion,
      suggestedResolution: "safe_to_apply",
      explanation: "Insert targets without an existing remote row are safe to apply.",
    };
  }

  if (write.baseRemoteVersion < remoteRow.remoteVersion) {
    return {
      hasConflict: true,
      conflictType: "REMOTE_ROW_CONFLICT",
      remoteVersion: remoteRow.remoteVersion,
      localBaseVersion: write.baseRemoteVersion,
      suggestedResolution: "pull_remote_then_replay_local_write",
      explanation:
        "The local write was based on an older remote version than the current row version, so the sync engine should pull first and replay the write.",
    };
  }

  if (write.operation === "delete" && remoteRow.remoteVersion > write.baseRemoteVersion) {
    return {
      hasConflict: true,
      conflictType: "REMOTE_ROW_CONFLICT",
      remoteVersion: remoteRow.remoteVersion,
      localBaseVersion: write.baseRemoteVersion,
      suggestedResolution: "manual_merge_required",
      explanation:
        "The remote row changed after the local delete base version, so the delete needs a conflict-aware resolution path.",
    };
  }

  return {
    hasConflict: false,
    conflictType: "SAFE_TO_APPLY",
    remoteVersion: remoteRow.remoteVersion,
    localBaseVersion: write.baseRemoteVersion,
    suggestedResolution: "safe_to_apply",
    explanation: "The row is aligned with the local base version and can be applied safely.",
  };
}

// WAL/change-log visibility matters because it lets developers see where the write became durable,
// where it waited, and which gate caused it to stop without exposing row contents.
export function evaluateSync(write: LocalWrite, remoteState: RemoteState, metadata: RemoteMetadata): SyncTrace {
  const remoteRow = findRemoteRow(remoteState, write);
  const gates: GateResult[] = [];
  let finalState: FinalSyncState = "synced";
  let blockReason: BlockReason = "NONE";
  let failedGate: GateName | "NONE" = "NONE";
  let suggestedResolution: ConflictResult["suggestedResolution"] | "safe_to_apply" = "safe_to_apply";
  let debugSummary = `${write.writeId} passed all sync gates.`;

  gates.push(
    gatePass(
      "Local write accepted",
      "accepted",
      `Accepted write ${write.writeId} for table ${write.table} at local version ${write.localVersion}.`,
    ),
  );
  gates.push(
    gatePass(
      "WAL entry created",
      "durable",
      `Created a WAL-inspired durability marker for ${write.writeId} before sync evaluation continued.`,
    ),
  );
  gates.push(
    gatePass(
      "Sync queue admitted",
      "queued",
      `Write ${write.writeId} entered the local sync queue for tenant ${write.tenantId}.`,
    ),
  );

  if (!metadata.remoteAvailable || write.networkState === "offline") {
    finalState = "pending_offline";
    blockReason = "NETWORK_OFFLINE";
    failedGate = "Network available check";
    suggestedResolution = "retry_when_online";
    debugSummary = `${write.writeId} is safely pending locally because the network is offline.`;

    gates.push(
      gateFail(
        "Network available check",
        "offline",
        metadata.remoteAvailable
          ? `Local network state is offline for ${write.writeId}, so the write remains queued locally.`
          : `Remote connectivity is unavailable, so ${write.writeId} stays pending offline.`,
      ),
    );
  } else if (write.networkState === "transient_failure") {
    finalState = "retry_scheduled";
    blockReason = "NETWORK_OFFLINE";
    failedGate = "Network available check";
    suggestedResolution = "retry_when_online";
    debugSummary = `${write.writeId} encountered a temporary network failure and will retry.`;

    gates.push(
      gateWarning(
        "Network available check",
        "transient",
        `Network was reachable but unstable for ${write.writeId}; the engine scheduled a retry instead of pushing immediately.`,
      ),
    );
  } else {
    gates.push(
      gatePass(
        "Network available check",
        "online",
        `Network and remote availability look healthy for ${write.writeId}.`,
      ),
    );
  }

  if (finalState !== "synced") {
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  if (!metadata.authValid) {
    finalState = "auth_blocked";
    blockReason = "AUTH_EXPIRED";
    failedGate = "Auth check";
    suggestedResolution = "refresh_auth_token";
    debugSummary = `${write.writeId} was blocked because auth is expired.`;
    gates.push(gateFail("Auth check", "expired", `Authentication is invalid for tenant ${write.tenantId}; refresh the token before retrying.`));
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Auth check",
      "valid",
      `Auth token is valid for tenant ${write.tenantId} and actor ${write.actorId}.`,
    ),
  );

  if (write.schemaVersion !== metadata.currentSchemaVersion) {
    finalState = "schema_blocked";
    blockReason = "SCHEMA_VERSION_MISMATCH";
    failedGate = "Schema version check";
    suggestedResolution = "upgrade_local_schema";
    debugSummary = `${write.writeId} is blocked by a schema version mismatch.`;
    gates.push(
      gateFail(
        "Schema version check",
        "mismatch",
        `Local schema version ${write.schemaVersion} does not match remote schema version ${metadata.currentSchemaVersion}.`,
      ),
    );
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Schema version check",
      "matched",
      `Local schema version ${write.schemaVersion} matches remote schema version ${metadata.currentSchemaVersion}.`,
    ),
  );

  if (metadata.lastPullVersion < write.baseRemoteVersion) {
    finalState = "pull_required";
    blockReason = "PULL_REQUIRED_BEFORE_PUSH";
    failedGate = "Pull freshness check";
    suggestedResolution = "pull_remote_then_replay_local_write";
    debugSummary = `${write.writeId} needs a fresh pull before it can safely push.`;
    gates.push(
      gateFail(
        "Pull freshness check",
        "stale",
        `Local base version ${write.baseRemoteVersion} is ahead of the last pulled remote version ${metadata.lastPullVersion}.`,
      ),
    );
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Pull freshness check",
      "fresh",
      `Remote snapshot at version ${metadata.lastPullVersion} is fresh enough for local base version ${write.baseRemoteVersion}.`,
    ),
  );

  const conflict = detectConflict(write, remoteRow, metadata);
  if (conflict.hasConflict && conflict.conflictType === "STALE_EMBEDDING_VERSION") {
    finalState = "stale_vector_memory";
    blockReason = "STALE_EMBEDDING_VERSION";
    failedGate = "Vector memory freshness check";
    suggestedResolution = conflict.suggestedResolution;
    debugSummary = `${write.writeId} needs a fresh embedding pass before sync can continue.`;
    // Agent memory databases often need stale embedding checks because the index can drift
    // even when the row schema is otherwise healthy.
    gates.push(
      gateWarning(
        "Vector memory freshness check",
        "stale_embedding",
        conflict.explanation,
      ),
    );
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Vector memory freshness check",
      "fresh",
      write.operation === "vector_memory_upsert"
        ? `Embedding metadata is current enough for version ${write.embeddingModelVersion ?? 0}.`
        : `No vector-memory freshness check was needed for ${write.table}.`,
    ),
  );

  if (conflict.hasConflict) {
    finalState = "conflict_blocked";
    blockReason = "REMOTE_ROW_CONFLICT";
    failedGate = "Conflict check";
    suggestedResolution = conflict.suggestedResolution;
    debugSummary = `${write.writeId} was blocked by a remote row conflict.`;
    // Explainable conflict reasons matter because developers need to know whether a replay,
    // merge, or pull-first strategy will preserve the local user's intent.
    gates.push(gateFail("Conflict check", "conflict", conflict.explanation));
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Conflict check",
      "clear",
      conflict.explanation,
    ),
  );

  if (!metadata.remoteApplyHealthy) {
    finalState = "remote_apply_failed";
    blockReason = "REMOTE_APPLY_FAILED";
    failedGate = "Remote apply check";
    suggestedResolution = "wait_for_remote_apply";
    debugSummary = `${write.writeId} reached the remote apply stage but the remote side is unhealthy.`;
    gates.push(
      gateFail(
        "Remote apply check",
        "unhealthy",
        `Remote apply is currently unhealthy for database ${write.databaseId}; retry after availability recovers.`,
      ),
    );
    for (const gateName of GATE_SEQUENCE.slice(gates.length as number)) {
      gates.push(gateSkipped(gateName, `Stopped after ${failedGate}.`));
    }
    return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
  }

  gates.push(
    gatePass(
      "Remote apply check",
      "healthy",
      `Remote apply is healthy for database ${write.databaseId}.`,
    ),
  );

  gates.push(
    gatePass(
      "Pull update check",
      "completed",
      write.operation === "delete"
        ? "Delete tombstone and post-apply pull update completed successfully."
        : "Remote changes were refreshed after the write applied successfully.",
    ),
  );

  finalState = write.operation === "delete" ? "delete_synced" : "synced";
  blockReason = "NONE";
  failedGate = "NONE";
  suggestedResolution = "safe_to_apply";
  debugSummary =
    write.operation === "delete"
      ? `${write.writeId} deleted the target row and completed a consistent post-apply pull.`
      : `${write.writeId} synced successfully after a full explainable pipeline pass.`;

  return makeTerminalTrace(write, gates, finalState, blockReason, failedGate, suggestedResolution, debugSummary);
}

// Privacy-safe metadata matters because the trace should explain sync behavior without
// exposing row contents, prompts, document text, or any user-specific payload material.
export function buildPrivacySafeSyncTrace(trace: SyncTrace): PrivacySafeSyncTrace {
  return {
    traceId: trace.traceId,
    writeId: trace.writeId,
    databaseId: trace.databaseId,
    tenantId: trace.tenantId,
    actorId: trace.actorId,
    table: trace.table,
    operation: trace.operation,
    finalState: trace.finalState,
    blockReason: trace.blockReason,
    gateResults: trace.gateResults,
    evaluatedGateCount: trace.evaluatedGateCount,
    passedGateCount: trace.passedGateCount,
    warningGateCount: trace.warningGateCount,
    failedGate: trace.failedGate,
    suggestedResolution: trace.suggestedResolution,
    debugSummary: trace.debugSummary,
  };
}

function createSuggestedFix(blockReason: BlockReason, count: number): SuggestedFix {
  switch (blockReason) {
    case "NETWORK_OFFLINE":
      return {
        blockReason,
        issueTitle: "Connectivity is unavailable",
        explanation: "Writes are safe locally but waiting for connectivity.",
        suggestedAction: "Queue writes locally and retry once the device reconnects.",
      };
    case "SCHEMA_VERSION_MISMATCH":
      return {
        blockReason,
        issueTitle: "Schema migration drift",
        explanation: "The local schema is behind the remote schema contract.",
        suggestedAction: "Run the migration before replaying tenant writes.",
      };
    case "REMOTE_ROW_CONFLICT":
      return {
        blockReason,
        issueTitle: "Remote row conflict",
        explanation: "A newer remote row version was found during sync evaluation.",
        suggestedAction: "Pull remote changes and replay the local write with a merge-aware flow.",
      };
    case "STALE_EMBEDDING_VERSION":
      return {
        blockReason,
        issueTitle: "Embedding metadata is stale",
        explanation: "Vector memory rows need a freshness check before sync can continue.",
        suggestedAction: "Recompute embeddings and refresh the index metadata.",
      };
    case "AUTH_EXPIRED":
      return {
        blockReason,
        issueTitle: "Authentication expired",
        explanation: "The remote sync gate could not authorize the write.",
        suggestedAction: "Refresh the auth token and replay the queue item.",
      };
    case "REMOTE_APPLY_FAILED":
      return {
        blockReason,
        issueTitle: "Remote apply instability",
        explanation: "The remote side was healthy enough to reach the gate, but apply failed.",
        suggestedAction: "Retry sync after remote availability recovers.",
      };
    case "PULL_REQUIRED_BEFORE_PUSH":
      return {
        blockReason,
        issueTitle: "Remote pull required first",
        explanation: "The local base version is behind the last pulled remote version.",
        suggestedAction: "Pull the latest remote state before replaying the write.",
      };
    case "NONE":
    default:
      return {
        blockReason: "NONE",
        issueTitle: "Healthy sync path",
        explanation: "The write reached a fully synced state.",
        suggestedAction: "No action needed.",
      };
  }
}

function emptyFinalStateCounts(): Record<FinalSyncState, number> {
  return {
    synced: 0,
    pending_offline: 0,
    retry_scheduled: 0,
    conflict_blocked: 0,
    schema_blocked: 0,
    auth_blocked: 0,
    pull_required: 0,
    stale_vector_memory: 0,
    remote_apply_failed: 0,
    delete_synced: 0,
  };
}

function emptyBlockReasonCounts(): Record<BlockReason, number> {
  return {
    NONE: 0,
    NETWORK_OFFLINE: 0,
    AUTH_EXPIRED: 0,
    SCHEMA_VERSION_MISMATCH: 0,
    REMOTE_ROW_CONFLICT: 0,
    PULL_REQUIRED_BEFORE_PUSH: 0,
    STALE_EMBEDDING_VERSION: 0,
    REMOTE_APPLY_FAILED: 0,
  };
}

function blockReasonFromFinalState(finalState: FinalSyncState): BlockReason {
  switch (finalState) {
    case "synced":
    case "delete_synced":
      return "NONE";
    case "pending_offline":
    case "retry_scheduled":
      return "NETWORK_OFFLINE";
    case "conflict_blocked":
      return "REMOTE_ROW_CONFLICT";
    case "schema_blocked":
      return "SCHEMA_VERSION_MISMATCH";
    case "auth_blocked":
      return "AUTH_EXPIRED";
    case "pull_required":
      return "PULL_REQUIRED_BEFORE_PUSH";
    case "stale_vector_memory":
      return "STALE_EMBEDDING_VERSION";
    case "remote_apply_failed":
      return "REMOTE_APPLY_FAILED";
  }
}

export function summarizeSyncTraces(traces: PrivacySafeSyncTrace[]): SyncDiagnosticsSummary {
  const finalStateCounts = emptyFinalStateCounts();
  const blockReasonCounts = emptyBlockReasonCounts();
  const dropCountByGate: Partial<Record<GateName, number>> = {};

  for (const trace of traces) {
    finalStateCounts[trace.finalState] += 1;
    const reason = trace.blockReason;
    blockReasonCounts[reason] += 1;

    if (trace.failedGate !== "NONE") {
      dropCountByGate[trace.failedGate] = (dropCountByGate[trace.failedGate] ?? 0) + 1;
    }
  }

  const writesSynced = finalStateCounts.synced + finalStateCounts.delete_synced;
  const writesPending = finalStateCounts.pending_offline + finalStateCounts.pull_required;
  const writesRetried = finalStateCounts.retry_scheduled;
  const writesConflicted = finalStateCounts.conflict_blocked;
  const writesBlockedBySchema = finalStateCounts.schema_blocked;
  const writesBlockedByAuth = finalStateCounts.auth_blocked;
  const staleVectorMemories = finalStateCounts.stale_vector_memory;
  const remoteApplyFailures = finalStateCounts.remote_apply_failed;

  const nonNoneReasons = Object.entries(blockReasonCounts).filter(([reason, count]) => reason !== "NONE" && count > 0);
  const sortedReasons = nonNoneReasons.sort((a, b) => b[1] - a[1]);
  const mostCommonEntry: readonly [string, number] =
    sortedReasons[0] ?? (["NONE", blockReasonCounts.NONE] as const);
  const mostCommonBlockReason = mostCommonEntry[0] as BlockReason | "NONE";
  const mostCommonBlockReasonCount = mostCommonEntry[1];

  const suggestedReasonCounts = Object.entries(blockReasonCounts)
    .filter(([reason, count]) => reason !== "NONE" && count > 0)
    .sort((a, b) => b[1] - a[1]);

  const suggestedFixes = suggestedReasonCounts.map(([reason, count]) => createSuggestedFix(reason as BlockReason, count));

  return {
    totalWritesEvaluated: traces.length,
    writesSynced,
    writesPending,
    writesRetried,
    writesConflicted,
    writesBlockedBySchema,
    writesBlockedByAuth,
    staleVectorMemories,
    remoteApplyFailures,
    mostCommonBlockReason,
    mostCommonBlockReasonCount,
    finalStateCounts,
    blockReasonCounts,
    dropCountByGate,
    suggestedFixes,
  };
}

export function buildDebugSummary(trace: SyncTrace): string {
  const stopGate = trace.failedGate === "NONE" ? "final consistency" : trace.failedGate;
  const reason = trace.blockReason === "NONE" ? "no block reason" : trace.blockReason;
  return `${trace.writeId} reached ${stopGate} with ${reason}; ${trace.passedGateCount} gates passed and ${trace.warningGateCount} warnings.`;
}

export function deriveBlockReasonFromTrace(trace: SyncTrace): BlockReason {
  return trace.blockReason === "NONE" ? blockReasonFromFinalState(trace.finalState) : trace.blockReason;
}
