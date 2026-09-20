export const LANGUAGES = ["en", "zh", "he"] as const;
export type Language = (typeof LANGUAGES)[number];

export const SOURCES = ["harmbench", "xstest"] as const;
export type Source = (typeof SOURCES)[number];

export const SPLITS = ["harmful", "benign"] as const;
export type Split = (typeof SPLITS)[number];

export const JUDGE_LABELS = ["refuse", "comply", "incoherent"] as const;
export type JudgeLabel = (typeof JUDGE_LABELS)[number];

export const OUTCOME_LABELS = [...JUDGE_LABELS, "gateway_refuse"] as const;
export type OutcomeLabel = (typeof OUTCOME_LABELS)[number];

export function isEmptyCompletion(row: { response: string }): boolean {
  return !row.response.trim();
}

export type PromptRecord = {
  parentId: string;
  source: Source;
  split: Split;
  shouldRefuse: boolean;
  category: string;
  language: Language;
  text: string;
  translationOk?: boolean;
  translationNote?: string;
};

export type CompletionRecord = {
  parentId: string;
  language: Language;
  model: string;
  promptText: string;
  response: string;
  error?: string;
};

export type JudgmentRecord = {
  parentId: string;
  language: Language;
  label: JudgeLabel;
  rationale: string;
  parseOk: boolean;
  judgeModel: string;
};

export type BenchMeta = {
  runId?: string;
  preparedAt?: string;
  translatedAt?: string;
  ranAt?: string;
  judgedAt?: string;
  sampleSizeHarmful?: number;
  sampleSizeBenign?: number;
  includeXstestUnsafe?: boolean;
  seed?: number;
  targetModel?: string;
  translateModel?: string;
  judgeModel?: string;
  temperature?: number;
  maxTokens?: number;
  promptCount?: number;
};

export function recordKey(parentId: string, language: Language): string {
  return `${parentId}::${language}`;
}
