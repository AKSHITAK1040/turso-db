import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mockLocalWrites, mockRemoteContextByWriteId } from "./mockData.js";
import {
  buildDebugSummary,
  buildPrivacySafeSyncTrace,
  evaluateSync,
  summarizeSyncTraces,
} from "./engine.js";
import type { GeneratedSyncTraceFile, PrivacySafeSyncTrace, SyncTrace } from "./types.js";

const useColor = Boolean(process.stdout.isTTY);
const paint = (code: string, text: string) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = (text: string) => paint("1", text);
const dim = (text: string) => paint("2", text);
const blue = (text: string) => paint("34", text);
const cyan = (text: string) => paint("36", text);
const green = (text: string) => paint("32", text);
const yellow = (text: string) => paint("33", text);
const red = (text: string) => paint("31", text);

function padRight(value: string, width: number) {
  return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function formatBar(count: number, max: number) {
  if (max === 0) {
    return "";
  }

  const width = 28;
  const filled = Math.max(1, Math.round((count / max) * width));
  return `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
}

function formatGateStatus(status: SyncTrace["gateResults"][number]["status"]) {
  switch (status) {
    case "pass":
      return green("PASS");
    case "warning":
      return yellow("WARN");
    case "fail":
      return red("FAIL");
    case "skipped":
      return dim("SKIP");
  }
}

function printSection(title: string) {
  console.log("");
  console.log(bold(blue(`=== ${title} ===`)));
}

function printKeyValue(label: string, value: string) {
  console.log(`${bold(padRight(label, 26))}${value}`);
}

function printTrace(trace: SyncTrace) {
  console.log("");
  console.log(bold(`${trace.writeId}  ${trace.table}.${trace.operation}`));
  console.log(
    `${dim("final")}: ${trace.finalState}  ${dim("block")}: ${trace.blockReason}  ${dim("gates")}: ${trace.passedGateCount} pass / ${trace.warningGateCount} warn / ${trace.evaluatedGateCount} evaluated`,
  );
  console.log(`${dim("summary")}: ${trace.debugSummary}`);
  console.log(`${dim("resolution")}: ${trace.suggestedResolution}`);
  for (const gate of trace.gateResults) {
    console.log(
      `  ${formatGateStatus(gate.status)} ${padRight(gate.gateName, 28)} ${gate.reason} - ${gate.details}`,
    );
  }
}

async function saveTraceFile(file: GeneratedSyncTraceFile) {
  const rootPath = path.resolve(process.cwd(), "sample_sync_traces.json");
  const dashboardPath = path.resolve(process.cwd(), "dashboard", "sample_sync_traces.json");
  const json = `${JSON.stringify(file, null, 2)}\n`;

  await mkdir(path.dirname(dashboardPath), { recursive: true });
  await Promise.all([writeFile(rootPath, json, "utf8"), writeFile(dashboardPath, json, "utf8")]);

  return { rootPath, dashboardPath };
}

async function run() {
  const evaluatedTraces = mockLocalWrites.map((write) => {
    const context = mockRemoteContextByWriteId[write.writeId]!;
    const trace = evaluateSync(write, context.remoteState, context.remoteMetadata);
    trace.debugSummary = buildDebugSummary(trace);
    return trace;
  });

  const privacySafeTraces: PrivacySafeSyncTrace[] = evaluatedTraces.map(buildPrivacySafeSyncTrace);
  const summary = summarizeSyncTraces(privacySafeTraces);
  const file: GeneratedSyncTraceFile = {
    generatedAt: new Date().toISOString(),
    project: "SET Engine",
    traces: privacySafeTraces,
    summary,
  };

  const paths = await saveTraceFile(file);

  console.log(bold(cyan("SET Engine")));
  console.log(dim("Sync Explainability Trace"));
  console.log(dim("Local-first diagnostics PoC for sync decision tracing"));

  printSection("Mock Local Write Events");
  for (const write of mockLocalWrites) {
    console.log(
      `${write.writeId} | ${write.table}.${write.operation} | db=${write.databaseId} | tenant=${write.tenantId} | base=${write.baseRemoteVersion} -> local=${write.localVersion} | network=${write.networkState}`,
    );
  }

  printSection("Mock Remote State");
  for (const write of mockLocalWrites) {
    const context = mockRemoteContextByWriteId[write.writeId]!;
    const remoteRows = context.remoteState.rows;
    const metadata = context.remoteMetadata;
    console.log(
      `${write.writeId} | remoteAvailable=${metadata.remoteAvailable} authValid=${metadata.authValid} schema=${metadata.currentSchemaVersion} lastPull=${metadata.lastPullVersion} applyHealthy=${metadata.remoteApplyHealthy}`,
    );
    if (remoteRows.length === 0) {
      console.log(`  ${dim("no remote row")}`);
    } else {
      for (const row of remoteRows) {
        console.log(
          `  ${row.table}.${row.primaryKey} v${row.remoteVersion} schema=${row.schemaVersion} payload=${row.payloadHash} updated=${row.lastUpdatedAt}`,
        );
      }
    }
  }

  printSection("Sync Evaluation Traces");
  for (const trace of evaluatedTraces) {
    printTrace(trace);
  }

  printSection("Final Sync State Per Write");
  for (const trace of privacySafeTraces) {
    console.log(
      `${trace.writeId} -> ${trace.finalState} (${trace.blockReason}) ${dim(`via ${trace.failedGate}`)}`,
    );
  }

  printSection("Block Reason Summary");
  const blockReasonEntries = Object.entries(summary.blockReasonCounts).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of blockReasonEntries) {
    const bar = formatBar(count, mockLocalWrites.length);
    console.log(`${padRight(reason, 28)} ${padRight(String(count), 4)} ${bar}`);
  }
  console.log(
    `${bold("Most common")}: ${summary.mostCommonBlockReason} (${summary.mostCommonBlockReasonCount})`,
  );

  printSection("Suggested Fixes");
  if (summary.suggestedFixes.length === 0) {
    console.log("No blocking conditions were observed.");
  } else {
    for (const fix of summary.suggestedFixes) {
      console.log(`${bold(fix.issueTitle)}${fix.blockReason ? ` [${fix.blockReason}]` : ""}`);
      console.log(`  ${fix.explanation}`);
      console.log(`  ${green("Action")}: ${fix.suggestedAction}`);
    }
  }

  printSection("Summary");
  printKeyValue("Total writes evaluated", String(summary.totalWritesEvaluated));
  printKeyValue("Writes synced", String(summary.writesSynced));
  printKeyValue("Writes pending", String(summary.writesPending));
  printKeyValue("Writes retried", String(summary.writesRetried));
  printKeyValue("Writes conflicted", String(summary.writesConflicted));
  printKeyValue("Writes blocked by schema", String(summary.writesBlockedBySchema));
  printKeyValue("Writes blocked by auth", String(summary.writesBlockedByAuth));
  printKeyValue("Stale vector memories", String(summary.staleVectorMemories));
  printKeyValue("Remote apply failures", String(summary.remoteApplyFailures));

  console.log("");
  console.log(green(`JSON saved to ${paths.rootPath}`));
  console.log(green(`Dashboard mirror saved to ${paths.dashboardPath}`));
  console.log(dim("Privacy-safe trace metadata only; no raw payload values were written."));
}

run().catch((error) => {
  console.error(red("SET Engine failed"));
  console.error(error);
  process.exitCode = 1;
});
