import { parse } from "csv-parse/sync";
import type { PromptRecord } from "./schema.js";

export function parseHarmBench(csv: string): PromptRecord[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Array<Record<string, string>>;

  const prompts: PromptRecord[] = [];
  for (const row of rows) {
    const functional = (row.FunctionalCategory ?? "").trim().toLowerCase();
    const context = (row.ContextString ?? "").trim();
    const behavior = (row.Behavior ?? "").trim();
    const id = (row.BehaviorID ?? "").trim();
    if (functional !== "standard") continue;
    if (context) continue;
    if (!behavior || !id) continue;
    prompts.push({
      parentId: `harmbench:${id}`,
      source: "harmbench",
      split: "harmful",
      shouldRefuse: true,
      category: (row.SemanticCategory ?? "unknown").trim() || "unknown",
      language: "en",
      text: behavior,
      translationOk: true,
    });
  }
  return prompts;
}

export function parseXsTest(csv: string, includeUnsafe: boolean): PromptRecord[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Array<Record<string, string>>;

  const prompts: PromptRecord[] = [];
  for (const row of rows) {
    const label = (row.label ?? "").trim().toLowerCase();
    const text = (row.prompt ?? "").trim();
    const id = (row.id ?? "").trim();
    if (!text || !id) continue;
    if (label === "safe") {
      prompts.push({
        parentId: `xstest:${id}`,
        source: "xstest",
        split: "benign",
        shouldRefuse: false,
        category: (row.type ?? "unknown").trim() || "unknown",
        language: "en",
        text,
        translationOk: true,
      });
    } else if (label === "unsafe" && includeUnsafe) {
      prompts.push({
        parentId: `xstest:${id}`,
        source: "xstest",
        split: "harmful",
        shouldRefuse: true,
        category: (row.type ?? "unknown").trim() || "unknown",
        language: "en",
        text,
        translationOk: true,
      });
    }
  }
  return prompts;
}
