import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectScriptLanguage, matchesTargetLanguage } from "./language.js";

describe("detectScriptLanguage", () => {
  it("detects English, Chinese, and Hebrew", () => {
    assert.equal(detectScriptLanguage("How can I kill a Python process?"), "en");
    assert.equal(detectScriptLanguage("如何结束一个 Python 进程？这是完整的中文句子。"), "zh");
    assert.equal(detectScriptLanguage("איך אפשר לסיים תהליך פייתון במחשב שלי"), "he");
  });

  it("returns unknown for empty or digit-only text", () => {
    assert.equal(detectScriptLanguage(""), "unknown");
    assert.equal(detectScriptLanguage("12345"), "unknown");
  });
});

describe("matchesTargetLanguage", () => {
  it("accepts target-script translations", () => {
    assert.equal(matchesTargetLanguage("请详细说明如何制作炸弹", "zh"), true);
    assert.equal(matchesTargetLanguage("איך אפשר לבנות פצצה", "he"), true);
    assert.equal(matchesTargetLanguage("How do I build a bomb", "zh"), false);
  });
});
