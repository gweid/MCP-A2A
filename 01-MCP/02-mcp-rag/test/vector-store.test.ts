import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryVectorStore } from "../src/vector-store.js";

test("按 L2 距离从近到远返回文档", () => {
  const store = new InMemoryVectorStore(2);
  store.add(
    ["原点", "近点", "远点"],
    [
      [0, 0],
      [1, 1],
      [4, 4],
    ],
  );

  const results = store.search([0.5, 0.5], 2);

  assert.deepEqual(
    results.map((result) => result.document),
    ["原点", "近点"],
  );
  assert.deepEqual(
    results.map((result) => result.distance),
    [0.5, 0.5],
  );
});

test("topK 超过文档数时不重复最后一篇文档", () => {
  const store = new InMemoryVectorStore(2);
  store.add(
    ["文档一", "文档二"],
    [
      [0, 0],
      [1, 1],
    ],
  );

  const results = store.search([0, 0], 5);

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.index),
    [0, 1],
  );
});

test("空索引返回空结果", () => {
  const store = new InMemoryVectorStore(2);

  assert.deepEqual(store.search([0, 0], 3), []);
});

test("拒绝维度错误和非有限数值", () => {
  const store = new InMemoryVectorStore(2);

  assert.throws(() => store.add(["文档"], [[1]]), /维度错误/);
  assert.throws(() => store.add(["文档"], [[1, Number.NaN]]), /非有限数值/);
  assert.throws(() => store.search([1], 1), /维度错误/);
});
