import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "../config.js";
import { parseHarmBench, parseXsTest } from "../lib/datasets.js";
import { readJson, writeJson, writeJsonl } from "../lib/jsonl.js";
import {
  HARMBENCH_CSV,
  HARMBENCH_URL,
  CORPUS_META,
  PROMPTS_EN,
  RAW_DIR,
  XSTEST_CSV,
  XSTEST_URL,
} from "../lib/paths.js";
import { stratifiedSample } from "../lib/sample.js";
import type { BenchMeta } from "../lib/schema.js";

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    console.log(`Using cached ${dest}`);
    return;
  }
  console.log(`Downloading ${url}`);
  const response = await fetch(url, {
    headers: { "User-Agent": "the-71st-language-bench" },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(dest, await response.text(), "utf8");
}

export async function prepareCommand(): Promise<void> {
  const config = loadConfig();
  await download(HARMBENCH_URL, HARMBENCH_CSV);
  await download(XSTEST_URL, XSTEST_CSV);

  const harmbench = parseHarmBench(readFileSync(HARMBENCH_CSV, "utf8"));
  const xstest = parseXsTest(readFileSync(XSTEST_CSV, "utf8"), config.includeXstestUnsafe);

  const harmfulAll = [...harmbench, ...xstest.filter((row) => row.split === "harmful")];
  const benignAll = xstest.filter((row) => row.split === "benign");

  const harmful = stratifiedSample(
    harmfulAll,
    config.sampleSizeHarmful,
    (row) => `${row.source}:${row.category}`,
    config.seed,
  );
  const benign = stratifiedSample(
    benignAll,
    config.sampleSizeBenign,
    (row) => `${row.source}:${row.category}`,
    config.seed + 1,
  );

  const prompts = [...harmful, ...benign].sort((a, b) => a.parentId.localeCompare(b.parentId));
  writeJsonl(PROMPTS_EN, prompts);

  const meta = readJson<BenchMeta>(CORPUS_META, {});
  writeJson(CORPUS_META, {
    ...meta,
    preparedAt: new Date().toISOString(),
    sampleSizeHarmful: config.sampleSizeHarmful,
    sampleSizeBenign: config.sampleSizeBenign,
    includeXstestUnsafe: config.includeXstestUnsafe,
    seed: config.seed,
    promptCount: prompts.length,
  } satisfies BenchMeta);

  console.log(
    `Wrote ${prompts.length} English prompts to ${PROMPTS_EN} ` +
      `(harmful=${harmful.length}, benign=${benign.length}; ` +
      `pool harmful=${harmfulAll.length}, benign=${benignAll.length})`,
  );
}
