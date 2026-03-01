import { describe, expect, test } from "bun:test";

import { cosineSimilarity, fastCosineSimilarity, normalizeVector } from "../embedding/cosine.js";

describe("cosineSimilarity", () => {
  test("동일한 벡터는 100% 유사도", () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBe(100);
  });

  test("정반대 벡터는 0% 유사도", () => {
    const vec1 = [1, 0, 0];
    const vec2 = [-1, 0, 0];
    expect(cosineSimilarity(vec1, vec2)).toBe(0);
  });

  test("직교 벡터는 50% 유사도 (중립)", () => {
    const vec1 = [1, 0, 0];
    const vec2 = [0, 1, 0];
    expect(cosineSimilarity(vec1, vec2)).toBe(50);
  });

  test("빈 벡터는 0% 유사도", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  test("다른 차원의 벡터는 에러", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  test("영 벡터는 0% 유사도", () => {
    const zero = [0, 0, 0];
    const vec = [1, 2, 3];
    expect(cosineSimilarity(zero, vec)).toBe(0);
  });
});

describe("normalizeVector", () => {
  test("단위 벡터로 정규화", () => {
    const vec = [3, 4];
    const normalized = normalizeVector(vec);

    // 크기가 1인지 확인
    const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  test("이미 정규화된 벡터는 변하지 않음", () => {
    const vec = [1, 0, 0];
    const normalized = normalizeVector(vec);
    expect(normalized).toEqual([1, 0, 0]);
  });

  test("영 벡터는 그대로 유지", () => {
    const zero = [0, 0, 0];
    const normalized = normalizeVector(zero);
    expect(normalized).toEqual([0, 0, 0]);
  });
});

describe("fastCosineSimilarity", () => {
  test("정규화된 벡터에서 동일한 결과", () => {
    const vec1 = normalizeVector([1, 2, 3]);
    const vec2 = normalizeVector([4, 5, 6]);

    const slow = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    const fast = fastCosineSimilarity(vec1, vec2);

    // 결과가 비슷해야 함 (반올림 차이 허용)
    expect(Math.abs(slow - fast)).toBeLessThanOrEqual(1);
  });
});
