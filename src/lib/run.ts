import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config.js";
import { readJson, writeJson } from "./jsonl.js";
import { CURRENT_RUN, DATA_DIR, REPORTS_DIR, RUNS_DIR } from "./paths.js";

export type RunPointer = {
  runId: string;
  targetModel: string;
  createdAt: string;
};

export type RunPaths = {
  runId: string;
  dir: string;
  completions: string;
  judgments: string;
  meta: string;
  reportEn: string;
  reportZh: string;
};

export function sanitizeModelName(model: string): string {
  const cleaned = model
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "model";
}

export function formatRunStamp(date: Date): string {
  return date
    .toISOString()
    .slice(0, 19)
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "-");
}

export function formatRunId(date: Date, model: string): string {
  return `${formatRunStamp(date)}_${sanitizeModelName(model)}`;
}

export function runPaths(runId: string): RunPaths {
  const dir = path.join(RUNS_DIR, runId);
  return {
    runId,
    dir,
    completions: path.join(dir, "completions.jsonl"),
    judgments: path.join(dir, "judgments.jsonl"),
    meta: path.join(dir, "meta.json"),
    reportEn: path.join(REPORTS_DIR, `${runId}.md`),
    reportZh: path.join(REPORTS_DIR, `${runId}.zh.md`),
  };
}

export function writeCurrentRun(pointer: RunPointer): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeJson(CURRENT_RUN, pointer);
}

export function readCurrentRun(): RunPointer | null {
  if (!existsSync(CURRENT_RUN)) return null;
  return readJson<RunPointer>(CURRENT_RUN, null as unknown as RunPointer);
}

export function resolveRunPaths(config: AppConfig, mode: "create" | "existing"): RunPaths {
  const override = config.runId.trim();
  const forceNew = config.newRun;
  const current = readCurrentRun();

  let runId = override;
  if (!runId && mode === "create") {
    if (!forceNew && current && current.targetModel === config.targetModel) {
      runId = current.runId;
    } else {
      runId = formatRunId(new Date(), config.targetModel);
    }
  } else if (!runId) {
    if (!current) {
      throw new Error(
        "No active run. Run `npm run run` first, or set RUN_ID to an existing data/runs/<id>.",
      );
    }
    runId = current.runId;
  }

  const paths = runPaths(runId);
  mkdirSync(paths.dir, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeCurrentRun({
    runId,
    targetModel: config.targetModel || current?.targetModel || "unknown",
    createdAt: current?.runId === runId ? current.createdAt : new Date().toISOString(),
  });
  return paths;
}
