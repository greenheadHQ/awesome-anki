import { describe, expect, test } from "bun:test";

import {
  computeDifficultyScore,
  DEFAULT_THRESHOLDS,
  getDifficultyReasons,
} from "../anki/difficulty";

describe("computeDifficultyScore", () => {
  test("새 카드는 0점", () => {
    const score = computeDifficultyScore(0, 2500, 0, 0);
    expect(score).toBe(0);
  });

  test("완벽한 카드 (0 lapses, 높은 ease, 긴 interval)는 낮은 점수", () => {
    const score = computeDifficultyScore(0, 2500, 365, 50);
    expect(score).toBeLessThanOrEqual(5);
  });

  test("어려운 카드 (많은 lapses, 낮은 ease, 짧은 interval)는 높은 점수", () => {
    const score = computeDifficultyScore(10, 1300, 1, 20);
    expect(score).toBeGreaterThan(80);
  });

  test("중간 수준 카드", () => {
    const score = computeDifficultyScore(3, 2100, 30, 10);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(60);
  });

  test("lapses가 10 이상이면 lapsesScore가 50으로 캡됨", () => {
    const score10 = computeDifficultyScore(10, 2500, 365, 10);
    const score20 = computeDifficultyScore(20, 2500, 365, 10);
    expect(score10).toBe(score20);
  });

  test("점수는 0-100 범위", () => {
    const scores = [
      computeDifficultyScore(0, 2500, 365, 100),
      computeDifficultyScore(100, 1300, 0, 100),
      computeDifficultyScore(5, 1800, 10, 20),
    ];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("getDifficultyReasons", () => {
  test("임계값 이상일 때 lapses 이유 포함", () => {
    const reasons = getDifficultyReasons(5, 2500, 10, DEFAULT_THRESHOLDS);
    expect(reasons).toContainEqual(expect.stringContaining("실패 5회"));
  });

  test("임계값 이하일 때 ease 이유 포함", () => {
    const reasons = getDifficultyReasons(0, 1800, 10, DEFAULT_THRESHOLDS);
    expect(reasons).toContainEqual(expect.stringContaining("Ease 180%"));
  });

  test("lapses > 0이고 reps >= minReps일 때 실패율 포함", () => {
    const reasons = getDifficultyReasons(3, 2500, 10, DEFAULT_THRESHOLDS);
    expect(reasons).toContainEqual(expect.stringContaining("실패율"));
  });

  test("모든 조건 충족 시 여러 이유 반환", () => {
    const reasons = getDifficultyReasons(5, 1800, 10, DEFAULT_THRESHOLDS);
    expect(reasons.length).toBeGreaterThanOrEqual(2);
  });

  test("조건 미충족 시 빈 배열", () => {
    const reasons = getDifficultyReasons(0, 2500, 0, DEFAULT_THRESHOLDS);
    expect(reasons).toEqual([]);
  });
});
