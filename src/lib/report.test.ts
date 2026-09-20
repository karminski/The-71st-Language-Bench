import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderReport } from "../commands/report.js";
import type { JudgmentRecord, PromptRecord } from "./schema.js";

describe("renderReport", () => {
  it("includes the main sections and language rows", () => {
    const prompts: PromptRecord[] = [
      {
        parentId: "p1",
        source: "harmbench",
        split: "harmful",
        shouldRefuse: true,
        category: "illegal",
        language: "en",
        text: "x",
        translationOk: true,
      },
      {
        parentId: "p1",
        source: "harmbench",
        split: "harmful",
        shouldRefuse: true,
        category: "illegal",
        language: "zh",
        text: "x",
        translationOk: true,
      },
      {
        parentId: "p1",
        source: "harmbench",
        split: "harmful",
        shouldRefuse: true,
        category: "illegal",
        language: "he",
        text: "x",
        translationOk: true,
      },
    ];
    const judgments: JudgmentRecord[] = [
      {
        parentId: "p1",
        language: "en",
        label: "refuse",
        rationale: "",
        parseOk: true,
        judgeModel: "j",
      },
      {
        parentId: "p1",
        language: "zh",
        label: "comply",
        rationale: "",
        parseOk: true,
        judgeModel: "j",
      },
      {
        parentId: "p1",
        language: "he",
        label: "comply",
        rationale: "",
        parseOk: true,
        judgeModel: "j",
      },
    ];
    const md = renderReport({
      prompts,
      judgments,
      meta: { targetModel: "target-x", judgeModel: "judge-y", seed: 42 },
    });
    assert.match(md, /The 71st Language Bench Report/);
    assert.match(md, /target-x/);
    assert.match(md, /en − he/);
    assert.match(md, /EN refuse \/ HE comply/);
    assert.match(md, /\| en \|/);
    assert.match(md, /gateway refusal/i);
  });

  it("renders a Chinese report", () => {
    const md = renderReport({
      prompts: [
        {
          parentId: "p1",
          source: "harmbench",
          split: "harmful",
          shouldRefuse: true,
          category: "illegal",
          language: "he",
          text: "x",
          translationOk: true,
        },
      ],
      judgments: [
        {
          parentId: "p1",
          language: "he",
          label: "comply",
          rationale: "",
          parseOk: true,
          judgeModel: "j",
        },
      ],
      meta: { targetModel: "target-x" },
      locale: "zh",
    });
    assert.match(md, /第 71 种语言评测报告/);
    assert.match(md, /被测模型/);
    assert.match(md, /希伯来语/);
    assert.match(md, /英拒 \/ 希放/);
    assert.match(md, /网关拒绝/);
  });
});
