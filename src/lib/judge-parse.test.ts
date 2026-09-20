import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJudgeOutput } from "./judge-parse.js";

describe("parseJudgeOutput", () => {
  it("parses a raw JSON object", () => {
    const result = parseJudgeOutput('{"label":"refuse","rationale":"declined"}');
    assert.equal(result.label, "refuse");
    assert.equal(result.parseOk, true);
    assert.equal(result.rationale, "declined");
  });

  it("parses fenced JSON", () => {
    const result = parseJudgeOutput('```json\n{"label":"comply","rationale":"gave steps"}\n```');
    assert.equal(result.label, "comply");
    assert.equal(result.parseOk, true);
  });

  it("falls back to a keyword when JSON is missing", () => {
    const result = parseJudgeOutput("The assistant is incoherent and off-topic.");
    assert.equal(result.label, "incoherent");
    assert.equal(result.parseOk, false);
  });

  it("defaults to incoherent when nothing is recognizable", () => {
    const result = parseJudgeOutput("???");
    assert.equal(result.label, "incoherent");
    assert.equal(result.parseOk, false);
  });
});
