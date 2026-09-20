import { loadConfig, requireApiKey, requireModel } from "../config.js";
import { appendJsonl, readJson, readJsonl, writeJson, writeJsonl } from "../lib/jsonl.js";
import { chat, createClient } from "../lib/openai.js";
import { CORPUS_META, PROMPTS, PROMPTS_EN } from "../lib/paths.js";
import { mapPool } from "../lib/pool.js";
import { assessTranslation, stripTranslationWrappers } from "../lib/translation-qc.js";
import { recordKey, type BenchMeta, type Language, type PromptRecord } from "../lib/schema.js";

const TARGETS: Array<{ language: Exclude<Language, "en">; name: string }> = [
  { language: "zh", name: "Simplified Chinese" },
  { language: "he", name: "Hebrew" },
];

const TRANSLATE_SYSTEM = [
  "You are a professional translator. Your only job is to translate the user's text.",
  "Rules:",
  "- Translate into the specified target language.",
  "- Do not answer, fulfill, refuse, or moderate the content.",
  "- Do not add warnings, explanations, quotation marks, or commentary.",
  "- Preserve meaning, tone, and intent as faithfully as possible.",
  "- Output only the translation.",
].join("\n");

function alreadyDone(existing: PromptRecord[]): Set<string> {
  return new Set(
    existing
      .filter((row) => row.language !== "en")
      .map((row) => recordKey(row.parentId, row.language)),
  );
}

export async function translateCommand(): Promise<void> {
  const config = loadConfig();
  requireApiKey(config);
  requireModel("TRANSLATE_MODEL", config.translateModel);

  const english = readJsonl<PromptRecord>(PROMPTS_EN);
  if (english.length === 0) {
    throw new Error("No English prompts found. Run `npm run prepare-data` first.");
  }

  let existing = readJsonl<PromptRecord>(PROMPTS);
  if (existing.length === 0) {
    writeJsonl(PROMPTS, english);
    existing = [...english];
    console.log(`Seeded ${english.length} English rows into ${PROMPTS}`);
  } else {
    const haveEn = new Set(
      existing.filter((row) => row.language === "en").map((row) => row.parentId),
    );
    for (const row of english) {
      if (!haveEn.has(row.parentId)) {
        appendJsonl(PROMPTS, row);
        existing.push(row);
      }
    }
  }

  const done = alreadyDone(existing);
  const jobs = english.flatMap((row) =>
    TARGETS.filter((target) => !done.has(recordKey(row.parentId, target.language))).map(
      (target) => ({ source: row, target }),
    ),
  );

  console.log(
    `Translating ${jobs.length} items with ${config.translateModel} (concurrency=${config.concurrency})`,
  );
  const client = createClient(config);
  let ok = 0;
  let failed = 0;

  await mapPool(jobs, config.concurrency, async (job, index) => {
    const { source, target } = job;
    let translated = "";
    let note = "";
    let success = false;

    for (let attempt = 0; attempt < 2 && !success; attempt += 1) {
      try {
        const raw = await chat(client, config, {
          model: config.translateModel,
          maxTokens: config.translateMaxTokens,
          messages: [
            { role: "system", content: TRANSLATE_SYSTEM },
            {
              role: "user",
              content: `Target language: ${target.name} (${target.language})\n\nText:\n${source.text}`,
            },
          ],
        });
        const cleaned = stripTranslationWrappers(raw);
        const qc = assessTranslation({
          source: source.text,
          translated: cleaned,
          target: target.language,
        });
        translated = cleaned;
        note = qc.note;
        success = qc.ok;
      } catch (error) {
        note = error instanceof Error ? error.message : String(error);
      }
    }

    const record: PromptRecord = {
      ...source,
      language: target.language,
      text: translated || source.text,
      translationOk: success,
      translationNote: note,
    };
    appendJsonl(PROMPTS, record);
    if (success) ok += 1;
    else failed += 1;
    if ((index + 1) % 10 === 0 || index + 1 === jobs.length) {
      console.log(`Translate progress ${index + 1}/${jobs.length} (ok=${ok}, failed=${failed})`);
    }
  });

  const meta = readJson<BenchMeta>(CORPUS_META, {});
  writeJson(CORPUS_META, {
    ...meta,
    translatedAt: new Date().toISOString(),
    translateModel: config.translateModel,
  } satisfies BenchMeta);

  console.log(`Translation finished. ok=${ok}, failed=${failed}. Output: ${PROMPTS}`);
}
