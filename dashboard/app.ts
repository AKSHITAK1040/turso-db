console.log("SET dashboard loaded");

type GateStatus = "pass" | "fail" | "warning" | "skipped";
type FinalSyncState =
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
type BlockReason =
  | "NONE"
  | "NETWORK_OFFLINE"
  | "AUTH_EXPIRED"
  | "SCHEMA_VERSION_MISMATCH"
  | "REMOTE_ROW_CONFLICT"
  | "PULL_REQUIRED_BEFORE_PUSH"
  | "STALE_EMBEDDING_VERSION"
  | "REMOTE_APPLY_FAILED";

interface GateResult {
  gateName: string;
  status: GateStatus;
  reason: string;
  details: string;
}

interface PrivacySafeSyncTrace {
  traceId: string;
  writeId: string;
  databaseId: string;
  tenantId: string;
  actorId: string;
  table: string;
  operation: string;
  finalState: FinalSyncState;
  blockReason: BlockReason;
  gateResults: GateResult[];
  evaluatedGateCount: number;
  passedGateCount: number;
  warningGateCount: number;
  failedGate: string;
  suggestedResolution: string;
  debugSummary: string;
}

interface SuggestedFix {
  issueTitle: string;
  explanation: string;
  suggestedAction: string;
  blockReason?: BlockReason;
}

interface SyncDiagnosticsSummary {
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
  dropCountByGate: Record<string, number>;
  suggestedFixes: SuggestedFix[];
}

interface GeneratedSyncTraceFile {
  generatedAt: string;
  project: "SET Engine";
  traces: PrivacySafeSyncTrace[];
  summary: SyncDiagnosticsSummary;
}

const FALLBACK_FILE: GeneratedSyncTraceFile = {
  generatedAt: "2026-07-06T00:00:00.000Z",
  project: "SET Engine",
  traces: [
    {
      traceId: "trace_fallback_001",
      writeId: "write_fb_001",
      databaseId: "db_agent_001",
      tenantId: "tenant_hash_001",
      actorId: "actor_hash_001",
      table: "documents",
      operation: "update",
      finalState: "synced",
      blockReason: "NONE",
      gateResults: [
        { gateName: "Local write accepted", status: "pass", reason: "accepted", details: "Write accepted locally." },
        { gateName: "WAL entry created", status: "pass", reason: "durable", details: "WAL marker written." },
        { gateName: "Sync queue admitted", status: "pass", reason: "queued", details: "Queued for sync." },
        { gateName: "Network available check", status: "pass", reason: "online", details: "Network is available." },
        { gateName: "Auth check", status: "pass", reason: "valid", details: "Auth token is valid." },
        { gateName: "Schema version check", status: "pass", reason: "matched", details: "Schema matches." },
        { gateName: "Pull freshness check", status: "pass", reason: "fresh", details: "Pull is fresh enough." },
        { gateName: "Vector memory freshness check", status: "pass", reason: "fresh", details: "Not a vector write." },
        { gateName: "Conflict check", status: "pass", reason: "clear", details: "No conflict." },
        { gateName: "Remote apply check", status: "pass", reason: "healthy", details: "Remote apply healthy." },
        { gateName: "Pull update check", status: "pass", reason: "completed", details: "Pull update completed." },
      ],
      evaluatedGateCount: 11,
      passedGateCount: 11,
      warningGateCount: 0,
      failedGate: "NONE",
      suggestedResolution: "safe_to_apply",
      debugSummary: "Fallback synced trace.",
    },
    {
      traceId: "trace_fallback_002",
      writeId: "write_fb_002",
      databaseId: "db_agent_001",
      tenantId: "tenant_hash_001",
      actorId: "actor_hash_002",
      table: "documents",
      operation: "update",
      finalState: "pending_offline",
      blockReason: "NETWORK_OFFLINE",
      gateResults: [
        { gateName: "Local write accepted", status: "pass", reason: "accepted", details: "Write accepted locally." },
        { gateName: "WAL entry created", status: "pass", reason: "durable", details: "WAL marker written." },
        { gateName: "Sync queue admitted", status: "pass", reason: "queued", details: "Queued for sync." },
        { gateName: "Network available check", status: "fail", reason: "offline", details: "Network is offline." },
        { gateName: "Auth check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Schema version check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Pull freshness check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Vector memory freshness check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Conflict check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Remote apply check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
        { gateName: "Pull update check", status: "skipped", reason: "stopped", details: "Skipped after offline block." },
      ],
      evaluatedGateCount: 4,
      passedGateCount: 3,
      warningGateCount: 0,
      failedGate: "Network available check",
      suggestedResolution: "retry_when_online",
      debugSummary: "Fallback offline trace.",
    },
    {
      traceId: "trace_fallback_003",
      writeId: "write_fb_003",
      databaseId: "db_agent_001",
      tenantId: "tenant_hash_002",
      actorId: "actor_hash_003",
      table: "projects",
      operation: "update",
      finalState: "conflict_blocked",
      blockReason: "REMOTE_ROW_CONFLICT",
      gateResults: [
        { gateName: "Local write accepted", status: "pass", reason: "accepted", details: "Write accepted locally." },
        { gateName: "WAL entry created", status: "pass", reason: "durable", details: "WAL marker written." },
        { gateName: "Sync queue admitted", status: "pass", reason: "queued", details: "Queued for sync." },
        { gateName: "Network available check", status: "pass", reason: "online", details: "Network is available." },
        { gateName: "Auth check", status: "pass", reason: "valid", details: "Auth token is valid." },
        { gateName: "Schema version check", status: "pass", reason: "matched", details: "Schema matches." },
        { gateName: "Pull freshness check", status: "pass", reason: "fresh", details: "Pull is fresh enough." },
        { gateName: "Vector memory freshness check", status: "pass", reason: "fresh", details: "Not a vector write." },
        { gateName: "Conflict check", status: "fail", reason: "conflict", details: "Remote row version is newer." },
        { gateName: "Remote apply check", status: "skipped", reason: "stopped", details: "Skipped after conflict block." },
        { gateName: "Pull update check", status: "skipped", reason: "stopped", details: "Skipped after conflict block." },
      ],
      evaluatedGateCount: 9,
      passedGateCount: 8,
      warningGateCount: 0,
      failedGate: "Conflict check",
      suggestedResolution: "pull_remote_then_replay_local_write",
      debugSummary: "Fallback conflict trace.",
    },
    {
      traceId: "trace_fallback_004",
      writeId: "write_fb_004",
      databaseId: "db_agent_001",
      tenantId: "tenant_hash_003",
      actorId: "actor_hash_004",
      table: "vector_memory",
      operation: "vector_memory_upsert",
      finalState: "schema_blocked",
      blockReason: "SCHEMA_VERSION_MISMATCH",
      gateResults: [
        { gateName: "Local write accepted", status: "pass", reason: "accepted", details: "Write accepted locally." },
        { gateName: "WAL entry created", status: "pass", reason: "durable", details: "WAL marker written." },
        { gateName: "Sync queue admitted", status: "pass", reason: "queued", details: "Queued for sync." },
        { gateName: "Network available check", status: "pass", reason: "online", details: "Network is available." },
        { gateName: "Auth check", status: "pass", reason: "valid", details: "Auth token is valid." },
        { gateName: "Schema version check", status: "fail", reason: "mismatch", details: "Local schema is behind." },
        { gateName: "Pull freshness check", status: "skipped", reason: "stopped", details: "Skipped after schema block." },
        { gateName: "Vector memory freshness check", status: "skipped", reason: "stopped", details: "Skipped after schema block." },
        { gateName: "Conflict check", status: "skipped", reason: "stopped", details: "Skipped after schema block." },
        { gateName: "Remote apply check", status: "skipped", reason: "stopped", details: "Skipped after schema block." },
        { gateName: "Pull update check", status: "skipped", reason: "stopped", details: "Skipped after schema block." },
      ],
      evaluatedGateCount: 6,
      passedGateCount: 5,
      warningGateCount: 0,
      failedGate: "Schema version check",
      suggestedResolution: "upgrade_local_schema",
      debugSummary: "Fallback schema trace.",
    },
    {
      traceId: "trace_fallback_005",
      writeId: "write_fb_005",
      databaseId: "db_agent_001",
      tenantId: "tenant_hash_004",
      actorId: "actor_hash_005",
      table: "memory_index",
      operation: "vector_memory_upsert",
      finalState: "stale_vector_memory",
      blockReason: "STALE_EMBEDDING_VERSION",
      gateResults: [
        { gateName: "Local write accepted", status: "pass", reason: "accepted", details: "Write accepted locally." },
        { gateName: "WAL entry created", status: "pass", reason: "durable", details: "WAL marker written." },
        { gateName: "Sync queue admitted", status: "pass", reason: "queued", details: "Queued for sync." },
        { gateName: "Network available check", status: "pass", reason: "online", details: "Network is available." },
        { gateName: "Auth check", status: "pass", reason: "valid", details: "Auth token is valid." },
        { gateName: "Schema version check", status: "pass", reason: "matched", details: "Schema matches." },
        { gateName: "Pull freshness check", status: "pass", reason: "fresh", details: "Pull is fresh enough." },
        { gateName: "Vector memory freshness check", status: "warning", reason: "stale_embedding", details: "Embedding metadata is stale." },
        { gateName: "Conflict check", status: "skipped", reason: "stopped", details: "Skipped after stale embedding." },
        { gateName: "Remote apply check", status: "skipped", reason: "stopped", details: "Skipped after stale embedding." },
        { gateName: "Pull update check", status: "skipped", reason: "stopped", details: "Skipped after stale embedding." },
      ],
      evaluatedGateCount: 8,
      passedGateCount: 7,
      warningGateCount: 1,
      failedGate: "Vector memory freshness check",
      suggestedResolution: "recompute_embedding",
      debugSummary: "Fallback stale embedding trace.",
    },
  ],
  summary: {
    totalWritesEvaluated: 5,
    writesSynced: 1,
    writesPending: 1,
    writesRetried: 0,
    writesConflicted: 1,
    writesBlockedBySchema: 1,
    writesBlockedByAuth: 0,
    staleVectorMemories: 1,
    remoteApplyFailures: 0,
    mostCommonBlockReason: "NONE",
    mostCommonBlockReasonCount: 1,
    finalStateCounts: {
      synced: 1,
      pending_offline: 1,
      retry_scheduled: 0,
      conflict_blocked: 1,
      schema_blocked: 1,
      auth_blocked: 0,
      pull_required: 0,
      stale_vector_memory: 1,
      remote_apply_failed: 0,
      delete_synced: 0,
    },
    blockReasonCounts: {
      NONE: 1,
      NETWORK_OFFLINE: 1,
      AUTH_EXPIRED: 0,
      SCHEMA_VERSION_MISMATCH: 1,
      REMOTE_ROW_CONFLICT: 1,
      PULL_REQUIRED_BEFORE_PUSH: 0,
      STALE_EMBEDDING_VERSION: 1,
      REMOTE_APPLY_FAILED: 0,
    },
    dropCountByGate: {
      "Network available check": 1,
      "Conflict check": 1,
      "Schema version check": 1,
      "Vector memory freshness check": 1,
    },
    suggestedFixes: [
      {
        blockReason: "SCHEMA_VERSION_MISMATCH",
        issueTitle: "Schema migration drift",
        explanation: "The local schema is behind the remote schema contract.",
        suggestedAction: "Run the migration before replaying tenant writes.",
      },
      {
        blockReason: "NETWORK_OFFLINE",
        issueTitle: "Connectivity is unavailable",
        explanation: "Writes are safe locally but waiting for connectivity.",
        suggestedAction: "Queue writes locally and retry once the device reconnects.",
      },
      {
        blockReason: "REMOTE_ROW_CONFLICT",
        issueTitle: "Remote row conflict",
        explanation: "A newer remote row version was found during sync evaluation.",
        suggestedAction: "Pull remote changes and replay the local write with a merge-aware flow.",
      },
      {
        blockReason: "STALE_EMBEDDING_VERSION",
        issueTitle: "Embedding metadata is stale",
        explanation: "Vector memory rows need a freshness check before sync can continue.",
        suggestedAction: "Recompute embeddings and refresh the index metadata.",
      },
    ],
  },
};

const state: {
  file: GeneratedSyncTraceFile;
  sourceLabel: string;
  selectedTraceId: string;
} = {
  file: FALLBACK_FILE,
  sourceLabel: "Dashboard loaded from embedded fallback data",
  selectedTraceId: FALLBACK_FILE.traces[0]?.traceId ?? "",
};

const toneByFinalState: Record<FinalSyncState, string> = {
  synced: "success",
  delete_synced: "success",
  pending_offline: "warning",
  retry_scheduled: "warning",
  conflict_blocked: "failure",
  schema_blocked: "failure",
  auth_blocked: "failure",
  pull_required: "warning",
  stale_vector_memory: "warning",
  remote_apply_failed: "failure",
};

const toneByReason: Record<BlockReason, string> = {
  NONE: "success",
  NETWORK_OFFLINE: "warning",
  AUTH_EXPIRED: "failure",
  SCHEMA_VERSION_MISMATCH: "failure",
  REMOTE_ROW_CONFLICT: "failure",
  PULL_REQUIRED_BEFORE_PUSH: "warning",
  STALE_EMBEDDING_VERSION: "warning",
  REMOTE_APPLY_FAILED: "failure",
};

const app = document.createElement("div");
app.id = "app";
document.body.appendChild(app);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function badge(label: string, tone: "success" | "warning" | "failure" | "accent" | "muted" = "muted") {
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function formatCountBar(count: number, max: number) {
  const pct = max === 0 ? 0 : Math.max(6, (count / max) * 100);
  return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>`;
}

function loadEmbeddedFile(): GeneratedSyncTraceFile {
  return FALLBACK_FILE;
}

function isTraceFile(value: unknown): value is GeneratedSyncTraceFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "generatedAt" in value &&
      "project" in value &&
      "traces" in value &&
      "summary" in value &&
      Array.isArray((value as GeneratedSyncTraceFile).traces),
  );
}

async function loadTraceFile(): Promise<{ file: GeneratedSyncTraceFile; sourceLabel: string }> {
  try {
    const response = await fetch("./sample_sync_traces.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!isTraceFile(data)) {
      throw new Error("Invalid trace file shape");
    }

    return { file: data, sourceLabel: "Dashboard loaded from sample_sync_traces.json" };
  } catch {
    return { file: loadEmbeddedFile(), sourceLabel: "Dashboard loaded from embedded fallback data" };
  }
}

function getSelectedTrace() {
  return state.file.traces.find((trace) => trace.traceId === state.selectedTraceId) ?? state.file.traces[0];
}

function renderMetricCard(label: string, value: string, hint: string) {
  return `
    <article class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-hint">${escapeHtml(hint)}</div>
    </article>
  `;
}

function renderTraceCard(trace: PrivacySafeSyncTrace, index: number) {
  const selected = trace.traceId === state.selectedTraceId ? "selected" : "";
  return `
    <button class="trace-card ${selected}" data-trace-id="${escapeHtml(trace.traceId)}">
      <div class="trace-card-top">
        <div class="trace-index">Trace ${index + 1}</div>
        ${badge(trace.finalState, toneByFinalState[trace.finalState] === "success" ? "success" : toneByFinalState[trace.finalState] === "warning" ? "warning" : "failure")}
      </div>
      <div class="trace-card-title">${escapeHtml(trace.writeId)}</div>
      <div class="trace-card-sub">${escapeHtml(`${trace.table} - ${trace.operation}`)}</div>
      <div class="trace-card-summary">${escapeHtml(trace.debugSummary)}</div>
      <div class="trace-card-meta">
        <span>${trace.passedGateCount} gates passed</span>
        ${badge(trace.blockReason, toneByReason[trace.blockReason] === "success" ? "success" : toneByReason[trace.blockReason] === "warning" ? "warning" : trace.blockReason === "NONE" ? "muted" : "failure")}
      </div>
    </button>
  `;
}

function renderGateStepper(trace: PrivacySafeSyncTrace) {
  return `
    <div class="gate-stepper">
      ${trace.gateResults
        .map((gate) => {
          const tone =
            gate.status === "pass" ? "success" : gate.status === "warning" ? "warning" : gate.status === "fail" ? "failure" : "muted";
          return `
            <div class="gate-row gate-${gate.status}">
              <div class="gate-marker"></div>
              <div class="gate-content">
                <div class="gate-heading">
                  <strong>${escapeHtml(gate.gateName)}</strong>
                  ${badge(gate.status, tone)}
                </div>
                <div class="gate-reason">${escapeHtml(gate.reason)}</div>
                <div class="gate-details">${escapeHtml(gate.details)}</div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderBarSection(title: string, entries: Array<[string, number]>, total: number) {
  const rows = entries
    .filter(([, count]) => count > 0)
    .map(([label, count]) => {
      const width = total === 0 ? 0 : Math.max(8, (count / total) * 100);
      return `
        <div class="bar-row">
          <div class="bar-row-head">
            <span>${escapeHtml(label)}</span>
            <span>${count}</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        </div>
      `;
    })
    .join("");

  return `
    <article class="panel">
      <div class="panel-title">${escapeHtml(title)}</div>
      <div class="bar-list">${rows || `<div class="empty-state">No data available.</div>`}</div>
    </article>
  `;
}

function renderArchitectureFlow() {
  const nodes = [
    "Local write",
    "WAL entry",
    "Sync queue",
    "Network/Auth/Schema gates",
    "Conflict check",
    "Remote apply",
    "Pull update",
    "Final consistency state",
    "Privacy-safe trace",
  ];

  return `
    <div class="flow">
      ${nodes
        .map(
          (node, index) => `
            <div class="flow-node">${escapeHtml(node)}</div>
            ${index < nodes.length - 1 ? `<div class="flow-arrow">→</div>` : ""}
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDetail(trace: PrivacySafeSyncTrace) {
  return `
    <article class="panel detail-panel">
      <div class="detail-head">
        <div>
          <div class="panel-title">Selected Trace Detail</div>
          <div class="detail-subtitle">${escapeHtml(trace.traceId)}</div>
        </div>
        <div class="detail-badges">
          ${badge(trace.finalState, toneByFinalState[trace.finalState] === "success" ? "success" : toneByFinalState[trace.finalState] === "warning" ? "warning" : "failure")}
          ${badge(trace.blockReason, toneByReason[trace.blockReason] === "success" ? "success" : toneByReason[trace.blockReason] === "warning" ? "warning" : trace.blockReason === "NONE" ? "muted" : "failure")}
        </div>
      </div>

      <div class="detail-grid">
        <div><span>writeId</span><strong>${escapeHtml(trace.writeId)}</strong></div>
        <div><span>databaseId</span><strong>${escapeHtml(trace.databaseId)}</strong></div>
        <div><span>tenantId</span><strong>${escapeHtml(trace.tenantId)}</strong></div>
        <div><span>actorId</span><strong>${escapeHtml(trace.actorId)}</strong></div>
        <div><span>table</span><strong>${escapeHtml(trace.table)}</strong></div>
        <div><span>operation</span><strong>${escapeHtml(trace.operation)}</strong></div>
        <div><span>evaluated gates</span><strong>${trace.evaluatedGateCount}</strong></div>
        <div><span>passed gates</span><strong>${trace.passedGateCount}</strong></div>
      </div>

      <div class="detail-block">
        <div class="detail-label">Suggested resolution</div>
        <div class="detail-value">${escapeHtml(trace.suggestedResolution)}</div>
      </div>

      <div class="detail-block">
        <div class="detail-label">Debug summary</div>
        <div class="detail-value">${escapeHtml(trace.debugSummary)}</div>
      </div>

      <div class="panel-subtitle">Sync gate stepper</div>
      ${renderGateStepper(trace)}
    </article>
  `;
}

function renderSuggestedFixCards(fixes: SuggestedFix[]) {
  if (fixes.length === 0) {
    return `<div class="empty-state">No fixes needed.</div>`;
  }

  return fixes
    .map(
      (fix) => `
        <article class="fix-card">
          <div class="fix-title">${escapeHtml(fix.issueTitle)}</div>
          <div class="fix-explanation">${escapeHtml(fix.explanation)}</div>
          <div class="fix-action">${escapeHtml(fix.suggestedAction)}</div>
        </article>
      `,
    )
    .join("");
}

function renderApp() {
  const selectedTrace = getSelectedTrace();
  const summary = state.file.summary;
  const finalStateEntries = Object.entries(summary.finalStateCounts);
  const blockReasonEntries = Object.entries(summary.blockReasonCounts);
  const gateDropEntries = Object.entries(summary.dropCountByGate);

  app.innerHTML = `
    <div class="backdrop"></div>
    <main class="shell">
      <nav class="nav">
        <div class="brand">
          <div class="brand-mark">SET</div>
          <div>
            <div class="brand-title">SET Engine</div>
            <div class="brand-subtitle">Local-first diagnostics PoC</div>
          </div>
        </div>
        <div class="nav-badges">
          ${badge("Privacy-safe", "success")}
          ${badge("No raw payloads", "muted")}
          ${badge("Offline-first", "accent")}
          ${badge(state.sourceLabel, "muted")}
        </div>
      </nav>

      <section class="hero panel">
        <div>
          <div class="eyebrow">WAL-inspired trace - Local simulation - No external APIs - Agent memory aware</div>
          <h1>Sync Explainability Trace</h1>
          <p>Explain why a local-first database write synced, retried, stayed pending, or became blocked.</p>
          <div class="hero-note">
            Built for the moment when a sync looks fine in logs, but the app still feels wrong. The dashboard keeps the decision path visible without exposing raw payloads.
          </div>
        </div>
        <div class="hero-meta">
          <div class="hero-metric">
            <span>Total traces</span>
            <strong>${summary.totalWritesEvaluated}</strong>
          </div>
          <div class="hero-metric">
            <span>Most common block</span>
            <strong>${escapeHtml(summary.mostCommonBlockReason)}</strong>
          </div>
          <div class="hero-metric">
            <span>Generated</span>
            <strong>${escapeHtml(new Date(state.file.generatedAt).toLocaleString())}</strong>
          </div>
        </div>
      </section>

      <section class="metrics-grid">
        ${renderMetricCard("Total writes evaluated", String(summary.totalWritesEvaluated), "Every local write gets a privacy-safe sync trace.")}
        ${renderMetricCard("Writes synced", String(summary.writesSynced), "Succeeded through the full explainable pipeline.")}
        ${renderMetricCard("Writes pending", String(summary.writesPending), "Safe locally but waiting on connectivity or freshness.")}
        ${renderMetricCard("Writes conflicted", String(summary.writesConflicted), "Remote row versions outran the local base version.")}
        ${renderMetricCard("Schema blocked", String(summary.writesBlockedBySchema), "Tenant migration drift stopped the push.")}
        ${renderMetricCard("Auth blocked", String(summary.writesBlockedByAuth), "Token validity prevented remote access.")}
        ${renderMetricCard("Stale vector memories", String(summary.staleVectorMemories), "Embedding metadata was older than the remote index.")}
        ${renderMetricCard("Most common block", summary.mostCommonBlockReason, "The repeated reason to investigate first.")}
      </section>

      <section class="main-grid">
        <article class="panel trace-list-panel">
          <div class="panel-title">Write Trace List</div>
          <div class="panel-subtitle">Pick a trace and read the same story a teammate would ask for in a bug review.</div>
          <div class="trace-list">
            ${state.file.traces.map((trace, index) => renderTraceCard(trace, index)).join("")}
          </div>
        </article>
        ${renderDetail(selectedTrace)}
      </section>

      <section class="failure-grid">
        ${renderBarSection("Final State Counts", finalStateEntries, summary.totalWritesEvaluated)}
        ${renderBarSection("Block Reason Counts", blockReasonEntries, summary.totalWritesEvaluated)}
        ${renderBarSection("Failure Count by Gate", gateDropEntries, summary.totalWritesEvaluated)}
      </section>

      <section class="panel">
        <div class="panel-title">Suggested Fixes</div>
        <div class="panel-subtitle">A short list of the next things I would actually try.</div>
        <div class="fix-grid">
          ${renderSuggestedFixCards(summary.suggestedFixes)}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">Architecture Flow</div>
        <div class="panel-subtitle">The same pipeline, written out as a straightforward path instead of a diagram nobody remembers.</div>
        ${renderArchitectureFlow()}
      </section>

      <footer class="footer">
        This is an independent local simulation. It is not the real Turso Sync engine. It does not parse real WAL files, collect raw payloads, or call external APIs.
      </footer>
    </main>
  `;

  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-trace-id]"))) {
    button.addEventListener("click", () => {
      state.selectedTraceId = button.dataset.traceId ?? state.selectedTraceId;
      renderApp();
    });
  }
}

async function bootstrap() {
  const loaded = await loadTraceFile();
  state.file = loaded.file;
  state.sourceLabel = loaded.sourceLabel;
  state.selectedTraceId = loaded.file.traces[0]?.traceId ?? "";
  renderApp();
}

bootstrap().catch(() => {
  state.file = FALLBACK_FILE;
  state.sourceLabel = "Dashboard loaded from embedded fallback data";
  state.selectedTraceId = FALLBACK_FILE.traces[0]?.traceId ?? "";
  renderApp();
});
