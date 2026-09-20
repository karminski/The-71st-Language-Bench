import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJson, readJsonl } from "../src/lib/jsonl.js";
import {
  categoryRows,
  formatPct,
  gatewayGap,
  intensityGap,
  joinOutcomes,
  languageMetrics,
  pairCounts,
  type LanguageMetrics,
  type PairCounts,
  type Rate,
} from "../src/lib/metrics.js";
import { PROMPTS, REPORTS_DIR } from "../src/lib/paths.js";
import { runPaths } from "../src/lib/run.js";
import type {
  BenchMeta,
  CompletionRecord,
  JudgmentRecord,
  Language,
  PromptRecord,
} from "../src/lib/schema.js";
import { LANGUAGES } from "../src/lib/schema.js";

type RunSpec = {
  runId: string;
  short: string;
  display: string;
};

const LEFT: RunSpec = {
  runId: "20260920-001207_anthropic-claude-fable-5.1",
  short: "Fable 5.1",
  display: "Claude Fable 5.1",
};

const RIGHT: RunSpec = {
  runId: "20260919-235045_deepseek-flash",
  short: "DS V4.1 Flash",
  display: "DeepSeek V4.1 Flash",
};

const LANG: Record<Language, { zh: string; en: string }> = {
  en: { zh: "英语", en: "English" },
  zh: { zh: "中文", en: "Chinese" },
  he: { zh: "希伯来语", en: "Hebrew" },
};

function loadRun(spec: RunSpec) {
  const files = runPaths(spec.runId);
  const prompts = readJsonl<PromptRecord>(PROMPTS);
  const judgments = readJsonl<JudgmentRecord>(files.judgments);
  const completions = readJsonl<CompletionRecord>(files.completions);
  const meta = readJson<BenchMeta>(files.meta, {});
  const rows = joinOutcomes(prompts, judgments, completions);
  const byLang = Object.fromEntries(
    LANGUAGES.map((language) => [language, languageMetrics(rows, language)]),
  ) as Record<Language, LanguageMetrics>;
  return {
    spec,
    meta,
    rows,
    byLang,
    pairs: pairCounts(rows),
    categories: categoryRows(rows),
    scored: rows.length,
    gateway: rows.filter((row) => row.outcome === "gateway_refuse").length,
    judgeFallbacks: judgments.filter((row) => !row.parseOk).length,
    judgments: judgments.length,
  };
}

function cell(rate: Rate): string {
  return `${formatPct(rate.rate)} (${rate.count}/${rate.n})`;
}

function pp(rate: Rate): string {
  return formatPct(rate.rate);
}

function delta(left: Rate, right: Rate): string {
  if (left.rate === null || right.rate === null) return "n/a";
  const value = left.rate - right.rate;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

type Bundle = ReturnType<typeof loadRun>;

function renderZh(left: Bundle, right: Bundle): string {
  const L = left.byLang;
  const R = right.byLang;
  const lines: string[] = [
    "# Claude Fable 5.1 vs DeepSeek V4.1 Flash",
    "",
    "对照同一套英语源题（HarmBench standard + XSTest），平行译成中文和希伯来语后，分别打两个被测模型。空回复计为网关拒绝。",
    "",
    "## 快照",
    "",
    `| 项 | ${left.spec.display} | ${right.spec.display} |`,
    "| --- | --- | --- |",
    `| 评测编号 | \`${left.spec.runId}\` | \`${right.spec.runId}\` |`,
    `| 记录的模型 ID | \`${left.meta.targetModel ?? "unknown"}\` | \`${right.meta.targetModel ?? "unknown"}\` |`,
    `| 翻译 / 判定 | ${left.meta.translateModel} / ${left.meta.judgeModel} | ${right.meta.translateModel} / ${right.meta.judgeModel} |`,
    `| 计入题数 | ${left.scored} | ${right.scored} |`,
    `| 网关拒绝 | ${left.gateway}/${left.scored} (${formatPct(left.gateway / left.scored)}) | ${right.gateway}/${right.scored} (${formatPct(right.gateway / right.scored)}) |`,
    `| 判定解析回退 | ${left.judgeFallbacks}/${left.judgments} | ${right.judgeFallbacks}/${right.judgments} |`,
    "",
    "DeepSeek 这一轮在日志里记为 `deepseek-flash`，按产品名写作 DeepSeek V4.1 Flash。",
    "",
    "## 结论",
    "",
    "两者都不是「希伯来语明显漏审」。差别在**怎么拦**和**无害题拦不拦错**。",
    "",
    `- **${left.spec.display}**：三种语言有害拦截都在 95% 左右，跨语言差几乎为 0。无害过度拒绝只有 6–9%，更像校准过的审核。漏的是虚假信息、歧视对照这类边缘题，不是化生/违法。`,
    `- **${right.spec.display}**：有害拦截接近 100%，但一半回复是空的（网关）。无害题网关误伤极高（英 58%、中 73%、希 75%），希伯来语有害网关也比英语高 22.6 个百分点。这是过严，而且语言不均。`,
    "- **若目标是跨语言公平**：Fable 更整齐。**若目标是有害尽量零放行**：DeepSeek 更硬，但无害可用性差很多。",
    "",
    "## 有害强度（拦截率）",
    "",
    `| 语言 | ${left.spec.short} | ${right.spec.short} | Fable − DeepSeek |`,
    "| --- | ---: | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) =>
        `| ${LANG[lang].zh} | ${cell(L[lang].intensity)} | ${cell(R[lang].intensity)} | ${delta(L[lang].intensity, R[lang].intensity)} |`,
    ),
    "",
    `| 跨语言差 | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    `| en − zh | ${formatPct(intensityGap(L.en, L.zh))} | ${formatPct(intensityGap(R.en, R.zh))} |`,
    `| en − he | ${formatPct(intensityGap(L.en, L.he))} | ${formatPct(intensityGap(R.en, R.he))} |`,
    "",
    "## 无害过度拒绝",
    "",
    `| 语言 | ${left.spec.short} | ${right.spec.short} | Fable − DeepSeek |`,
    "| --- | ---: | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) =>
        `| ${LANG[lang].zh} | ${cell(L[lang].overRefusal)} | ${cell(R[lang].overRefusal)} | ${delta(L[lang].overRefusal, R[lang].overRefusal)} |`,
    ),
    "",
    `| 语言 | ${left.spec.short} 无害准确度 | ${right.spec.short} 无害准确度 |`,
    "| --- | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) => `| ${LANG[lang].zh} | ${cell(L[lang].benignAccuracy)} | ${cell(R[lang].benignAccuracy)} |`,
    ),
    "",
    "## 网关拒绝 vs 模型拒绝",
    "",
    `| 语言 | 集合 | ${left.spec.short} 网关 | ${right.spec.short} 网关 | ${left.spec.short} 模型拒 | ${right.spec.short} 模型拒 |`,
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...LANGUAGES.flatMap((lang) => [
      `| ${LANG[lang].zh} | 有害 | ${cell(L[lang].gatewayHarmful)} | ${cell(R[lang].gatewayHarmful)} | ${cell(L[lang].modelRefuseHarmful)} | ${cell(R[lang].modelRefuseHarmful)} |`,
      `| ${LANG[lang].zh} | 无害 | ${cell(L[lang].gatewayBenign)} | ${cell(R[lang].gatewayBenign)} | ${cell(L[lang].modelRefuseBenign)} | ${cell(R[lang].modelRefuseBenign)} |`,
    ]),
    "",
    `| 有害网关跨语言差 | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    `| en − zh | ${formatPct(gatewayGap(L.en, L.zh))} | ${formatPct(gatewayGap(R.en, R.zh))} |`,
    `| en − he | ${formatPct(gatewayGap(L.en, L.he))} | ${formatPct(gatewayGap(R.en, R.he))} |`,
    "",
    "## 成对有害结果",
    "",
    `| 模式 | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    ...pairRows(left.pairs, right.pairs),
    "",
    "## 关键类别",
    "",
    "只列出两模型差异大、或和跨语言假设相关的类别。拦截率含网关。",
    "",
    "| 类别 | 语言 | 集合 | Fable 拦截 | DeepSeek 拦截 | Fable 网关 | DeepSeek 网关 |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...categoryCompare(left, right),
    "",
    "## 读法",
    "",
    "- 强度只回答「有害请求有没有被拦住」，不回答「拦得对不对」。",
    "- DeepSeek 的高无害拦截几乎全是空回复，更像下游网关，而不是模型正文拒绝（三种语言模型拒无害都约 5%）。",
    "- Fable 的有害网关也偏高（约 32–36%），但三种语言差不多，且无害网关只有约 3%。",
    "- 两轮共用同一套 `prompts.jsonl` 和同一判定模型 `deepseek-v4-pro`。",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function renderEn(left: Bundle, right: Bundle): string {
  const L = left.byLang;
  const R = right.byLang;
  const lines: string[] = [
    "# Claude Fable 5.1 vs DeepSeek V4.1 Flash",
    "",
    "Same English source prompts (HarmBench standard + XSTest), translated into Chinese and Hebrew, then sent to each target model. Empty API bodies count as gateway refusals.",
    "",
    "## Snapshot",
    "",
    `| Item | ${left.spec.display} | ${right.spec.display} |`,
    "| --- | --- | --- |",
    `| Run id | \`${left.spec.runId}\` | \`${right.spec.runId}\` |`,
    `| Recorded model id | \`${left.meta.targetModel ?? "unknown"}\` | \`${right.meta.targetModel ?? "unknown"}\` |`,
    `| Translate / judge | ${left.meta.translateModel} / ${left.meta.judgeModel} | ${right.meta.translateModel} / ${right.meta.judgeModel} |`,
    `| Prompts scored | ${left.scored} | ${right.scored} |`,
    `| Gateway refusals | ${left.gateway}/${left.scored} (${formatPct(left.gateway / left.scored)}) | ${right.gateway}/${right.scored} (${formatPct(right.gateway / right.scored)}) |`,
    `| Judge parse fallbacks | ${left.judgeFallbacks}/${left.judgments} | ${right.judgeFallbacks}/${right.judgments} |`,
    "",
    "The DeepSeek run is stored as `deepseek-flash`; this report uses the product name DeepSeek V4.1 Flash.",
    "",
    "## Takeaways",
    "",
    "Neither model shows a large Hebrew under-refusal gap. They differ in **how** they block and **how often they over-block benign prompts**.",
    "",
    `- **${left.spec.display}**: harmful block rate is ~95% in all three languages. Benign over-refusal is only 6–9%. Leaks are mostly misinformation and discrimination-contrast items, not chemical/illegal asks.`,
    `- **${right.spec.display}**: harmful block rate is ~100%, but about half of all replies are empty (gateway). Benign gateway over-refusal is extreme (EN 58%, ZH 73%, HE 75%), and Hebrew harmful gateway is 22.6 pp above English. That is over-strictness, not a jailbreak gap.`,
    "- **If you want cross-lingual fairness**, Fable is more even. **If you want almost no harmful comply**, DeepSeek is harder, at a steep cost to benign usefulness.",
    "",
    "## Harmful intensity",
    "",
    `| Language | ${left.spec.short} | ${right.spec.short} | Fable − DeepSeek |`,
    "| --- | ---: | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) =>
        `| ${LANG[lang].en} | ${cell(L[lang].intensity)} | ${cell(R[lang].intensity)} | ${delta(L[lang].intensity, R[lang].intensity)} |`,
    ),
    "",
    `| Cross-lingual gap | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    `| en − zh | ${formatPct(intensityGap(L.en, L.zh))} | ${formatPct(intensityGap(R.en, R.zh))} |`,
    `| en − he | ${formatPct(intensityGap(L.en, L.he))} | ${formatPct(intensityGap(R.en, R.he))} |`,
    "",
    "## Benign over-refusal",
    "",
    `| Language | ${left.spec.short} | ${right.spec.short} | Fable − DeepSeek |`,
    "| --- | ---: | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) =>
        `| ${LANG[lang].en} | ${cell(L[lang].overRefusal)} | ${cell(R[lang].overRefusal)} | ${delta(L[lang].overRefusal, R[lang].overRefusal)} |`,
    ),
    "",
    `| Language | ${left.spec.short} benign accuracy | ${right.spec.short} benign accuracy |`,
    "| --- | ---: | ---: |",
    ...LANGUAGES.map(
      (lang) => `| ${LANG[lang].en} | ${cell(L[lang].benignAccuracy)} | ${cell(R[lang].benignAccuracy)} |`,
    ),
    "",
    "## Gateway vs model refusal",
    "",
    `| Language | Split | ${left.spec.short} gateway | ${right.spec.short} gateway | ${left.spec.short} model | ${right.spec.short} model |`,
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...LANGUAGES.flatMap((lang) => [
      `| ${LANG[lang].en} | harmful | ${cell(L[lang].gatewayHarmful)} | ${cell(R[lang].gatewayHarmful)} | ${cell(L[lang].modelRefuseHarmful)} | ${cell(R[lang].modelRefuseHarmful)} |`,
      `| ${LANG[lang].en} | benign | ${cell(L[lang].gatewayBenign)} | ${cell(R[lang].gatewayBenign)} | ${cell(L[lang].modelRefuseBenign)} | ${cell(R[lang].modelRefuseBenign)} |`,
    ]),
    "",
    `| Harmful gateway gap | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    `| en − zh | ${formatPct(gatewayGap(L.en, L.zh))} | ${formatPct(gatewayGap(R.en, R.zh))} |`,
    `| en − he | ${formatPct(gatewayGap(L.en, L.he))} | ${formatPct(gatewayGap(R.en, R.he))} |`,
    "",
    "## Paired harmful outcomes",
    "",
    `| Pattern | ${left.spec.short} | ${right.spec.short} |`,
    "| --- | ---: | ---: |",
    ...pairRows(left.pairs, right.pairs, "en"),
    "",
    "## Key categories",
    "",
    "Categories with a large model gap or that matter for the language hypothesis. Block rate includes gateway refusals.",
    "",
    "| Category | Language | Split | Fable block | DeepSeek block | Fable gateway | DeepSeek gateway |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...categoryCompare(left, right, "en"),
    "",
    "## Notes",
    "",
    "- Intensity answers whether a harmful request was blocked, not whether the block was well calibrated.",
    "- DeepSeek's benign over-refusal is almost entirely empty responses. Explicit model refusals on benign items stay near 5% in all three languages.",
    "- Fable also has a sizable harmful gateway rate (~32–36%), but it is even across languages and benign gateway stays near 3%.",
    "- Both runs share the same `prompts.jsonl` and the same judge model `deepseek-v4-pro`.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function pairRows(left: PairCounts, right: PairCounts, locale: "zh" | "en" = "zh"): string[] {
  const labels =
    locale === "zh"
      ? [
          ["可对比三元组", left.comparable, right.comparable],
          ["三者都拒绝", left.allRefuse, right.allRefuse],
          ["三者都顺从", left.allComply, right.allComply],
          ["英拒 / 中放", left.enRefuseZhComply, right.enRefuseZhComply],
          ["英拒 / 希放", left.enRefuseHeComply, right.enRefuseHeComply],
          ["英放 / 中拒", left.enComplyZhRefuse, right.enComplyZhRefuse],
          ["英放 / 希拒", left.enComplyHeRefuse, right.enComplyHeRefuse],
        ]
      : [
          ["Comparable triples", left.comparable, right.comparable],
          ["All refuse", left.allRefuse, right.allRefuse],
          ["All comply", left.allComply, right.allComply],
          ["EN refuse / ZH comply", left.enRefuseZhComply, right.enRefuseZhComply],
          ["EN refuse / HE comply", left.enRefuseHeComply, right.enRefuseHeComply],
          ["EN comply / ZH refuse", left.enComplyZhRefuse, right.enComplyZhRefuse],
          ["EN comply / HE refuse", left.enComplyHeRefuse, right.enComplyHeRefuse],
        ];
  return labels.map(([name, a, b]) => {
    const leftShare = name === labels[0]![0] ? "100%" : formatPct(left.comparable ? Number(a) / left.comparable : null);
    const rightShare =
      name === labels[0]![0] ? "100%" : formatPct(right.comparable ? Number(b) / right.comparable : null);
    return `| ${name} | ${a} (${leftShare}) | ${b} (${rightShare}) |`;
  });
}

function categoryCompare(left: Bundle, right: Bundle, locale: "zh" | "en" = "zh"): string[] {
  const interesting = new Set([
    "chemical_biological",
    "cybercrime_intrusion",
    "illegal",
    "misinformation_disinformation",
    "contrast_discr",
    "privacy_fictional",
    "real_group_nons_discr",
    "definitions",
    "homonyms",
  ]);
  const rightMap = new Map(
    right.categories.map((row) => [`${row.category}::${row.language}::${row.split}`, row]),
  );
  const lines: string[] = [];
  for (const row of left.categories) {
    if (!interesting.has(row.category)) continue;
    const other = rightMap.get(`${row.category}::${row.language}::${row.split}`);
    if (!other) continue;
    const split = locale === "zh" ? (row.split === "harmful" ? "有害" : "无害") : row.split;
    const lang = LANG[row.language][locale];
    lines.push(
      `| ${row.category} | ${lang} | ${split} | ${pp(row.intensityOrOverRefusal)} | ${pp(other.intensityOrOverRefusal)} | ${pp(row.gateway)} | ${pp(other.gateway)} |`,
    );
  }
  return lines;
}

const left = loadRun(LEFT);
const right = loadRun(RIGHT);
const base = "compare_fable-5.1_vs_deepseek-v4.1-flash";
mkdirSync(REPORTS_DIR, { recursive: true });
const zhPath = path.join(REPORTS_DIR, `${base}.zh.md`);
const enPath = path.join(REPORTS_DIR, `${base}.md`);
writeFileSync(zhPath, renderZh(left, right), "utf8");
writeFileSync(enPath, renderEn(left, right), "utf8");
console.log(`Wrote ${zhPath}`);
console.log(`Wrote ${enPath}`);
