import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sources = [
  path.join(root, "sample_sync_traces.json"),
  path.join(root, "dashboard", "sample_sync_traces.json"),
];
const dest = path.join(root, "dashboard", "dist", "sample_sync_traces.json");

const fallback = {
  generatedAt: "2026-07-06T00:00:00.000Z",
  project: "SET Engine",
  traces: [],
  summary: {},
};

await mkdir(path.dirname(dest), { recursive: true });

let copied = false;
for (const source of sources) {
  try {
    await copyFile(source, dest);
    copied = true;
    break;
  } catch {
    // Try the next source.
  }
}

if (!copied) {
  await writeFile(dest, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
}

