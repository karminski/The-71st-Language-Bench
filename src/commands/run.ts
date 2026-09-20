import { loadConfig, requireApiKey, requireModel } from "../config.js";
import { appendJsonl, readJson, readJsonl, writeJson } from "../lib/jsonl.js";
import { chat, createClient } from "../lib/openai.js";
import { CORPUS_META, PROMPTS } from "../lib/paths.js";
import { resolveRunPaths } from "../lib/run.js";
import { mapPool } from "../lib/pool.js";
import {
  recordKey,
  type BenchMeta,
  type CompletionRecord,
  type PromptRecord,
} from "../lib/schema.js";

const TARGET_SYSTEM = "You are a helpful assistant.";

function eligiblePrompts(prompts: PromptRecord[]): PromptRecord[] {
  return prompts.filter((row) => row.language === "en" || row.translationOk !== false);
}

export async function runCommand(): Promise<void> {
  const config = loadConfig();
  requireApiKey(config);
  requireModel("TARGET_MODEL", config.targetModel);

  const run = resolveRunPaths(config, "create");
  const prompts = eligiblePrompts(readJsonl<PromptRecord>(PROMPTS));
  if (prompts.length === 0) {
    throw new Error("No prompts found. Run `npm run prepare-data` and `npm run translate` first.");
  }

  console.log(`Run id: ${run.runId}`);
  const existing = readJsonl<CompletionRecord>(run.completions);
  const done = new Set(existing.map((row) => recordKey(row.parentId, row.language)));
  const jobs = prompts.filter((row) => !done.has(recordKey(row.parentId, row.language)));

  console.log(
    `Querying ${jobs.length} prompts with ${config.targetModel} (already done: ${done.size}, concurrency=${config.concurrency})`,
  );
  const client = createClient(config);
  let ok = 0;
  let failed = 0;

  await mapPool(jobs, config.concurrency, async (prompt, index) => {
    let response = "";
    let error: string | undefined;
    try {
      response = await chat(client, config, {
        model: config.targetModel,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: TARGET_SYSTEM },
          { role: "user", content: prompt.text },
        ],
      });
      ok += 1;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      failed += 1;
    }

    const record: CompletionRecord = {
      parentId: prompt.parentId,
      language: prompt.language,
      model: config.targetModel,
      promptText: prompt.text,
      response,
      error,
    };
    appendJsonl(run.completions, record);
    if ((index + 1) % 10 === 0 || index + 1 === jobs.length) {
      console.log(`Run progress ${index + 1}/${jobs.length} (ok=${ok}, failed=${failed})`);
    }
  });

  const corpus = readJson<BenchMeta>(CORPUS_META, {});
  const meta = readJson<BenchMeta>(run.meta, corpus);
  writeJson(run.meta, {
    ...corpus,
    ...meta,
    runId: run.runId,
    ranAt: new Date().toISOString(),
    targetModel: config.targetModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  } satisfies BenchMeta);

  console.log(`Run finished. ok=${ok}, failed=${failed}. Output: ${run.completions}`);
}
