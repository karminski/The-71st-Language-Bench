import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRunId, formatRunStamp, sanitizeModelName } from "./run.js";

describe("run naming", () => {
  it("sanitizes model slashes and spaces", () => {
    assert.equal(sanitizeModelName("openai/gpt-4o-mini"), "openai-gpt-4o-mini");
    assert.equal(sanitizeModelName("deepseek-flash"), "deepseek-flash");
  });

  it("formats a filesystem-safe stamp and run id", () => {
    const date = new Date("2026-09-19T23:50:45.837Z");
    assert.equal(formatRunStamp(date), "20260919-235045");
    assert.equal(formatRunId(date, "deepseek-flash"), "20260919-235045_deepseek-flash");
  });
});
