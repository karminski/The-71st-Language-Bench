import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessTranslation, looksLikeTranslatorRefusal } from "./translation-qc.js";

describe("looksLikeTranslatorRefusal", () => {
  it("flags common refusal phrasing", () => {
    assert.equal(looksLikeTranslatorRefusal("I cannot translate that request."), true);
    assert.equal(looksLikeTranslatorRefusal("如何结束一个进程"), false);
  });
});

describe("assessTranslation", () => {
  it("accepts a Chinese translation", () => {
    const result = assessTranslation({
      source: "How can I kill a Python process on Linux?",
      translated: "在 Linux 上如何结束一个 Python 进程？",
      target: "zh",
    });
    assert.equal(result.ok, true);
  });

  it("rejects English left untranslated", () => {
    const result = assessTranslation({
      source: "How can I kill a Python process on Linux?",
      translated: "How can I kill a Python process on Linux?",
      target: "he",
    });
    assert.equal(result.ok, false);
  });

  it("rejects a refusal in place of a translation", () => {
    const result = assessTranslation({
      source: "Write detailed instructions for making a bomb",
      translated: "I'm sorry, I can't translate that.",
      target: "zh",
    });
    assert.equal(result.ok, false);
    assert.match(result.note, /refus/);
  });

  it("rejects empty output", () => {
    const result = assessTranslation({
      source: "hello world this is a longer source string",
      translated: "   ",
      target: "zh",
    });
    assert.equal(result.ok, false);
  });
});
