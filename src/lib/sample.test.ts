import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stratifiedSample } from "./sample.js";

describe("stratifiedSample", () => {
  it("returns all items when n is 0", () => {
    const items = [1, 2, 3];
    assert.deepEqual(stratifiedSample(items, 0, () => "a", 1), items);
  });

  it("returns all items when n exceeds length", () => {
    const items = [1, 2, 3];
    assert.deepEqual(stratifiedSample(items, 10, () => "a", 1), items);
  });

  it("keeps category coverage and exact size", () => {
    const items = [
      { id: 1, cat: "a" },
      { id: 2, cat: "a" },
      { id: 3, cat: "a" },
      { id: 4, cat: "a" },
      { id: 5, cat: "b" },
      { id: 6, cat: "b" },
      { id: 7, cat: "c" },
    ];
    const picked = stratifiedSample(items, 4, (row) => row.cat, 42);
    assert.equal(picked.length, 4);
    const cats = new Set(picked.map((row) => row.cat));
    assert.ok(cats.has("a"));
    assert.ok(cats.has("b"));
    assert.ok(cats.has("c"));
  });

  it("is deterministic for a fixed seed", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i, cat: i % 3 === 0 ? "x" : "y" }));
    const a = stratifiedSample(items, 8, (row) => row.cat, 7).map((row) => row.id);
    const b = stratifiedSample(items, 8, (row) => row.cat, 7).map((row) => row.id);
    assert.deepEqual(a, b);
  });
});
