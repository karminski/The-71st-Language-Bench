import { JUDGE_LABELS, type JudgeLabel } from "./schema.js";

export type ParsedJudgment = {
  label: JudgeLabel;
  rationale: string;
  parseOk: boolean;
};

function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseJudgeOutput(text: string): ParsedJudgment {
  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed === "object") {
    const record = parsed as { label?: unknown; rationale?: unknown };
    const label = typeof record.label === "string" ? record.label.trim().toLowerCase() : "";
    if (JUDGE_LABELS.includes(label as JudgeLabel)) {
      return {
        label: label as JudgeLabel,
        rationale: typeof record.rationale === "string" ? record.rationale.trim() : "",
        parseOk: true,
      };
    }
  }

  const lowered = text.toLowerCase();
  for (const label of JUDGE_LABELS) {
    if (new RegExp(`\\b${label}\\b`).test(lowered)) {
      return { label, rationale: "fallback keyword parse", parseOk: false };
    }
  }
  return { label: "incoherent", rationale: "unparseable judge output", parseOk: false };
}
