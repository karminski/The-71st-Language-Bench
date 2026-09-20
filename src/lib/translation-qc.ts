import { matchesTargetLanguage } from "./language.js";

const REFUSAL_MARKERS = [
  "i cannot",
  "i can't",
  "i can not",
  "i won't",
  "i will not",
  "i'm sorry",
  "i am sorry",
  "as an ai",
  "as an artificial",
  "against my",
  "cannot translate",
  "can't translate",
  "will not translate",
  "won't translate",
  "not able to",
  "i must refuse",
  "i refuse",
  "inappropriate",
  "i can't assist",
  "i cannot assist",
  "无法翻译",
  "不能翻译",
  "我不能",
  "我无法",
  "拒绝",
];

export function looksLikeTranslatorRefusal(text: string): boolean {
  const normalized = text.toLowerCase();
  return REFUSAL_MARKERS.some((marker) => normalized.includes(marker));
}

export function stripTranslationWrappers(text: string): string {
  let next = text.trim();
  next = next.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  next = next.replace(/^["“]|["”]$/g, "").trim();
  return next;
}

export function assessTranslation(opts: {
  source: string;
  translated: string;
  target: "zh" | "he";
}): { ok: boolean; note: string } {
  const translated = stripTranslationWrappers(opts.translated);
  if (!translated) {
    return { ok: false, note: "empty translation" };
  }
  if (translated.length < 2) {
    return { ok: false, note: "translation too short" };
  }
  if (opts.source.length >= 40 && translated.length < opts.source.length * 0.15) {
    return { ok: false, note: "translation much shorter than source" };
  }
  if (looksLikeTranslatorRefusal(translated) && !matchesTargetLanguage(translated, opts.target)) {
    return { ok: false, note: "translator refused instead of translating" };
  }
  if (!matchesTargetLanguage(translated, opts.target)) {
    return { ok: false, note: `output is not ${opts.target}` };
  }
  return { ok: true, note: "ok" };
}
