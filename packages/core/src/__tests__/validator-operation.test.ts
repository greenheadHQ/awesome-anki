import { describe, expect, test } from "bun:test";

import { validateOperationResponse } from "../gemini/validator.js";

describe("validateOperationResponse", () => {
  describe("split operation", () => {
    test("validates valid split response", () => {
      const result = validateOperationResponse({
        originalNoteId: 12345,
        operation: "split",
        mainCardIndex: 0,
        splitCards: [
          { title: "A", content: "{{c1::a}}", cardType: "cloze", contextTag: "[X]" },
          { title: "B", content: "{{c1::b}}", cardType: "cloze", contextTag: "[X]" },
        ],
        operationReason: "두 주제 분리",
        qualityChecks: { allClozeHaveHints: true, allContextTagsPresent: true },
      });
      expect(result.operation).toBe("split");
    });

    test("rejects split with less than 2 cards", () => {
      expect(() =>
        validateOperationResponse({
          originalNoteId: 12345,
          operation: "split",
          mainCardIndex: 0,
          splitCards: [{ title: "A", content: "{{c1::a}}" }],
          operationReason: "reason",
          qualityChecks: { allClozeHaveHints: true, allContextTagsPresent: true },
        }),
      ).toThrow();
    });

    test("rejects split with mainCardIndex out of range", () => {
      expect(() =>
        validateOperationResponse({
          originalNoteId: 12345,
          operation: "split",
          mainCardIndex: 5,
          splitCards: [
            { title: "A", content: "{{c1::a}}" },
            { title: "B", content: "{{c1::b}}" },
          ],
          operationReason: "reason",
          qualityChecks: { allClozeHaveHints: true, allContextTagsPresent: true },
        }),
      ).toThrow();
    });
  });

  describe("compact operation", () => {
    test("validates valid compact response", () => {
      const result = validateOperationResponse({
        originalNoteId: "12345",
        operation: "compact",
        compactedContent: "<b>압축 내용</b>",
        operationReason: "단일 주제, 표로 구조화",
        auditReport: {
          preserved: ["핵심 규칙"],
          removed: ["중복 예시"],
          transformed: ["문장 → 표"],
        },
        qualityChecks: { allClozeHaveHints: true, allContextTagsPresent: true },
      });
      expect(result.operation).toBe("compact");
      if (result.operation === "compact") {
        expect(result.auditReport.preserved).toEqual(["핵심 규칙"]);
      }
    });

    test("rejects compact with empty content", () => {
      expect(() =>
        validateOperationResponse({
          originalNoteId: 12345,
          operation: "compact",
          compactedContent: "",
          operationReason: "reason",
          auditReport: { preserved: [], removed: [], transformed: [] },
          qualityChecks: { allClozeHaveHints: true, allContextTagsPresent: true },
        }),
      ).toThrow();
    });
  });

  describe("skip operation", () => {
    test("validates valid skip response", () => {
      const result = validateOperationResponse({
        originalNoteId: 12345,
        operation: "skip",
        operationReason: "이미 적절",
      });
      expect(result.operation).toBe("skip");
    });
  });

  describe("legacy fallback (shouldSplit)", () => {
    test("converts shouldSplit:true + 2 cards → split", () => {
      const result = validateOperationResponse({
        originalNoteId: 12345,
        shouldSplit: true,
        mainCardIndex: 0,
        splitCards: [
          { title: "A", content: "{{c1::a}}" },
          { title: "B", content: "{{c1::b}}" },
        ],
        splitReason: "old reason",
        qualityChecks: {
          allCardsUnder80Chars: true,
          allClozeHaveHints: true,
          noEnumerations: true,
          allContextTagsPresent: true,
        },
      });
      expect(result.operation).toBe("split");
      expect(result.operationReason).toBe("old reason");
    });

    test("converts shouldSplit:true + 1 card → compact", () => {
      const result = validateOperationResponse({
        originalNoteId: 12345,
        shouldSplit: true,
        mainCardIndex: 0,
        splitCards: [{ title: "A", content: "<b>compacted</b>" }],
        splitReason: "compressed",
        qualityChecks: null,
      });
      expect(result.operation).toBe("compact");
      if (result.operation === "compact") {
        expect(result.compactedContent).toBe("<b>compacted</b>");
      }
    });

    test("converts shouldSplit:true + 0 cards → error", () => {
      expect(() =>
        validateOperationResponse({
          originalNoteId: 12345,
          shouldSplit: true,
          mainCardIndex: 0,
          splitCards: [],
          splitReason: "reason",
          qualityChecks: null,
        }),
      ).toThrow();
    });

    test("converts shouldSplit:false → skip", () => {
      const result = validateOperationResponse({
        originalNoteId: 12345,
        shouldSplit: false,
        mainCardIndex: 0,
        splitCards: [],
        splitReason: "not needed",
        qualityChecks: null,
      });
      expect(result.operation).toBe("skip");
    });
  });
});
