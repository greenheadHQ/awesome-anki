// packages/core/src/__tests__/optimization-analysis.test.ts
import { describe, expect, test } from "bun:test";
import {
  analyzeForOptimization,
  MAX_CLOZES_PER_CARD,
  MAX_TEXT_LENGTH,
} from "../splitter/atomic-converter.js";

describe("analyzeForOptimization", () => {
  test("short card with 1 cloze → needsOptimization: false", () => {
    const result = analyzeForOptimization("짧은 {{c1::카드}}");
    expect(result.needsOptimization).toBe(false);
    expect(result.reasons.clozeOverflow).toBe(false);
    expect(result.reasons.textOverflow).toBe(false);
  });

  test("card with 4+ clozes → clozeOverflow", () => {
    const card = "{{c1::a}} {{c2::b}} {{c3::c}} {{c4::d}}";
    const result = analyzeForOptimization(card);
    expect(result.needsOptimization).toBe(true);
    expect(result.reasons.clozeOverflow).toBe(true);
    expect(result.clozeCount).toBe(4);
  });

  test("long text under cloze limit → textOverflow", () => {
    const longText = "가".repeat(MAX_TEXT_LENGTH + 1);
    const result = analyzeForOptimization(longText);
    expect(result.needsOptimization).toBe(true);
    expect(result.reasons.textOverflow).toBe(true);
    expect(result.reasons.clozeOverflow).toBe(false);
  });

  test("both triggers → both reasons true", () => {
    const card = "가".repeat(MAX_TEXT_LENGTH + 1) + " {{c1::a}} {{c2::b}} {{c3::c}} {{c4::d}}";
    const result = analyzeForOptimization(card);
    expect(result.needsOptimization).toBe(true);
    expect(result.reasons.clozeOverflow).toBe(true);
    expect(result.reasons.textOverflow).toBe(true);
  });

  test("detects todo block", () => {
    const card = "::: toggle todo 할일\n내용\n:::\n{{c1::a}}";
    const result = analyzeForOptimization(card);
    expect(result.hasTodoBlock).toBe(true);
  });

  test("textLength excludes HTML tags", () => {
    const card = '<span style="color:red">짧은</span> 텍스트';
    const result = analyzeForOptimization(card);
    expect(result.textLength).toBe("짧은 텍스트".length);
  });

  test("MAX_CLOZES_PER_CARD is 3", () => {
    expect(MAX_CLOZES_PER_CARD).toBe(3);
  });

  test("MAX_TEXT_LENGTH is 500", () => {
    expect(MAX_TEXT_LENGTH).toBe(500);
  });
});
