export type DetectedLanguage = "en" | "zh" | "he" | "unknown";

function isHebrewCodePoint(code: number): boolean {
  return code >= 0x0590 && code <= 0x05ff;
}

function isCjkCodePoint(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df)
  );
}

function isLatinCodePoint(code: number): boolean {
  return (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a)
  );
}

export function letterCodePoints(text: string): number[] {
  return [...text]
    .map((ch) => ch.codePointAt(0) ?? 0)
    .filter((code) => {
      const ch = String.fromCodePoint(code);
      return /\p{L}/u.test(ch);
    });
}

export function scriptRatio(
  text: string,
  test: (code: number) => boolean,
): number {
  const letters = letterCodePoints(text);
  if (letters.length === 0) return 0;
  return letters.filter(test).length / letters.length;
}

export function detectScriptLanguage(text: string): DetectedLanguage {
  const hebrew = scriptRatio(text, isHebrewCodePoint);
  const cjk = scriptRatio(text, isCjkCodePoint);
  const latin = scriptRatio(text, isLatinCodePoint);
  const scores: Array<{ lang: DetectedLanguage; score: number }> = [
    { lang: "he", score: hebrew },
    { lang: "zh", score: cjk },
    { lang: "en", score: latin },
  ];
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0]!;
  if (top.score < 0.35) return "unknown";
  if (scores[1] && top.score - scores[1].score < 0.08) return "unknown";
  return top.lang;
}

export function matchesTargetLanguage(text: string, target: "zh" | "he"): boolean {
  const detected = detectScriptLanguage(text);
  if (detected === target) return true;
  const ratio =
    target === "zh"
      ? scriptRatio(text, isCjkCodePoint)
      : scriptRatio(text, isHebrewCodePoint);
  return ratio >= 0.45;
}
