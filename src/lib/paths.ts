import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const RUNS_DIR = path.join(DATA_DIR, "runs");
export const REPORTS_DIR = path.join(ROOT_DIR, "reports");
export const CURRENT_RUN = path.join(DATA_DIR, "current-run.json");
export const CORPUS_META = path.join(DATA_DIR, "corpus-meta.json");

export const HARMBENCH_CSV = path.join(RAW_DIR, "harmbench_behaviors_text_all.csv");
export const XSTEST_CSV = path.join(RAW_DIR, "xstest_prompts.csv");

export const PROMPTS_EN = path.join(DATA_DIR, "prompts.en.jsonl");
export const PROMPTS = path.join(DATA_DIR, "prompts.jsonl");

export const HARMBENCH_URL =
  "https://raw.githubusercontent.com/centerforaisafety/HarmBench/main/data/behavior_datasets/harmbench_behaviors_text_all.csv";
export const XSTEST_URL =
  "https://raw.githubusercontent.com/paul-rottger/xstest/main/xstest_prompts.csv";
