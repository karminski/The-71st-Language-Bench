import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intensityGap, joinOutcomes, languageMetrics, pairCounts } from "./metrics.js";
import type { CompletionRecord, JudgmentRecord, PromptRecord } from "./schema.js";

function prompt(
  parentId: string,
  language: PromptRecord["language"],
  split: PromptRecord["split"],
  translationOk = true,
): PromptRecord {
  return {
    parentId,
    source: "xstest",
    split,
    shouldRefuse: split === "harmful",
    category: "homonyms",
    language,
    text: "prompt",
    translationOk,
  };
}

function judgment(
  parentId: string,
  language: JudgmentRecord["language"],
  label: JudgmentRecord["label"],
): JudgmentRecord {
  return {
    parentId,
    language,
    label,
    rationale: "",
    parseOk: true,
    judgeModel: "judge",
  };
}

function completion(
  parentId: string,
  language: CompletionRecord["language"],
  response: string,
): CompletionRecord {
  return {
    parentId,
    language,
    model: "target",
    promptText: "prompt",
    response,
  };
}

describe("metrics", () => {
  const prompts: PromptRecord[] = [
    prompt("p1", "en", "harmful"),
    prompt("p1", "zh", "harmful"),
    prompt("p1", "he", "harmful"),
    prompt("p2", "en", "benign"),
    prompt("p2", "zh", "benign"),
    prompt("p2", "he", "benign", false),
    prompt("p3", "en", "harmful"),
    prompt("p3", "zh", "harmful"),
    prompt("p3", "he", "harmful"),
  ];
  const judgments: JudgmentRecord[] = [
    judgment("p1", "en", "refuse"),
    judgment("p1", "zh", "comply"),
    judgment("p1", "he", "comply"),
    judgment("p2", "en", "comply"),
    judgment("p2", "zh", "refuse"),
    judgment("p2", "he", "comply"),
    judgment("p3", "en", "refuse"),
    judgment("p3", "zh", "refuse"),
    judgment("p3", "he", "incoherent"),
  ];

  it("drops failed translations from the join", () => {
    const joined = joinOutcomes(prompts, judgments);
    assert.equal(
      joined.some((row) => row.parentId === "p2" && row.language === "he"),
      false,
    );
  });

  it("computes intensity and over-refusal", () => {
    const joined = joinOutcomes(prompts, judgments);
    const en = languageMetrics(joined, "en");
    const zh = languageMetrics(joined, "zh");
    assert.equal(en.intensity.rate, 1);
    assert.equal(zh.intensity.rate, 0.5);
    assert.equal(zh.overRefusal.rate, 1);
    assert.equal(en.benignAccuracy.rate, 1);
    assert.equal(intensityGap(en, zh), 0.5);
  });

  it("counts paired harmful gaps only when all three languages are scored", () => {
    const joined = joinOutcomes(prompts, judgments);
    const pairs = pairCounts(joined);
    assert.equal(pairs.comparable, 1);
    assert.equal(pairs.enRefuseZhComply, 1);
    assert.equal(pairs.enRefuseHeComply, 1);
    assert.equal(pairs.allRefuse, 0);
  });

  it("treats empty completions as gateway refusals", () => {
    const joined = joinOutcomes(
      [prompt("g1", "he", "harmful"), prompt("g2", "zh", "benign")],
      [judgment("g2", "zh", "comply")],
      [completion("g1", "he", ""), completion("g2", "zh", "sure")],
    );
    assert.equal(joined[0]?.outcome, "gateway_refuse");
    assert.equal(joined[0]?.sourceKind, "gateway");
    const he = languageMetrics(joined, "he");
    const zh = languageMetrics(joined, "zh");
    assert.equal(he.intensity.rate, 1);
    assert.equal(he.gatewayHarmful.rate, 1);
    assert.equal(zh.overRefusal.rate, 0);
    assert.equal(zh.gatewayBenign.rate, 0);
  });

  it("counts a gateway block as refuse in paired outcomes", () => {
    const joined = joinOutcomes(
      [prompt("p1", "en", "harmful"), prompt("p1", "zh", "harmful"), prompt("p1", "he", "harmful")],
      [judgment("p1", "en", "refuse"), judgment("p1", "zh", "refuse")],
      [
        completion("p1", "en", "no"),
        completion("p1", "zh", "no"),
        completion("p1", "he", ""),
      ],
    );
    const pairs = pairCounts(joined);
    assert.equal(pairs.comparable, 1);
    assert.equal(pairs.allRefuse, 1);
  });
});
