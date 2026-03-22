# Mobile-Friendly Split + Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace atomic card splitting with mobile-friendly optimization that supports split, compact, and skip operations.

**Architecture:** Single LLM call decides between 3 operations (split/compact/skip) via a discriminated union response schema. Core layer provides validation and text analysis; server routes branch on operation type; web UI renders operation-specific preview views.

**Tech Stack:** TypeScript, Zod, Bun test runner, Hono (server), React 19 + TanStack Query (web), SQLite (history)

**Spec:** `docs/superpowers/specs/2026-03-22-mobile-friendly-split-design.md`

---

## File Structure

### New Files
| Path | Responsibility |
|------|---------------|
| `packages/core/src/parser/text-length.ts` | HTML/Cloze/Callout 제거 후 순수 텍스트 길이 계산 |
| `packages/core/src/__tests__/text-length.test.ts` | text-length 유닛 테스트 |
| `packages/core/src/__tests__/validator-operation.test.ts` | discriminated union + 레거시 폴백 테스트 |
| `packages/core/src/__tests__/optimization-analysis.test.ts` | analyzeForOptimization 테스트 |
| `packages/core/src/__tests__/optimization-prompt.test.ts` | buildOptimizationPrompt + OPTIMIZATION_RESPONSE_FORMAT 테스트 |
| `packages/web/src/components/card/AuditReportPanel.tsx` | Compact 감사 보고서 UI 컴포넌트 |
| `packages/web/src/components/card/CompactDiffView.tsx` | Compact 2-pane diff 뷰 |

### Modified Files
| Path | Changes |
|------|---------|
| `packages/core/src/parser/index.ts` | `text-length.ts` re-export 추가 |
| `packages/core/src/gemini/validator.ts` | discriminated union 스키마, 레거시 폴백, `validateOperationResponse` |
| `packages/core/src/splitter/atomic-converter.ts` | `analyzeForOptimization`, `MAX_TEXT_LENGTH`, `OptimizationAnalysis` |
| `packages/core/src/gemini/prompts.ts` | `SYSTEM_PROMPT` 전면 개편, `buildOptimizationPrompt`, `OPTIMIZATION_RESPONSE_FORMAT` |
| `packages/core/src/gemini/client.ts` | `requestCardOptimization`, `estimateOptimizationCost` |
| `packages/core/src/prompt-version/types.ts` | `REJECTION_REASONS` 업데이트, `PromptConfig` deprecated 필드 |
| `packages/core/src/index.ts` | 이름 변경된 함수/타입 re-export |
| `packages/server/src/history/types.ts` | `operation` 필드, `CompactPayload`, `SplitGeneratedPayload.splitCards` optional |
| `packages/server/src/history/store.ts` | `operation` 컬럼, `markGenerated` compact 분기 |
| `packages/server/src/routes/cards.ts` | `needsOptimization`, `reasons`, `textLength` |
| `packages/server/src/routes/split.ts` | operation 분기 (preview/apply) |
| `packages/web/src/lib/api.ts` | `OptimizationPreviewResult` discriminated union |
| `packages/web/src/hooks/useSplit.ts` | apply 요청에 `operation` 필드 |
| `packages/web/src/pages/SplitWorkspace.tsx` | operation별 뷰, `REJECTION_REASONS`, `SplitCandidate` 타입 |
| `packages/web/src/pages/CardBrowser.tsx` | `canSplit` → `needsOptimization` 참조 변경 |
| `packages/web/src/pages/SplitHistory.tsx` | operation 배지, compact 상세 뷰 |
| `packages/web/src/components/card/DiffViewer.tsx` | compact 렌더링 분기 |

---

## Task 1: Text Length Utility

**Files:**
- Create: `packages/core/src/parser/text-length.ts`
- Create: `packages/core/src/__tests__/text-length.test.ts`
- Modify: `packages/core/src/parser/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/__tests__/text-length.test.ts
import { describe, expect, test } from "bun:test";
import { computeTextLength } from "../parser/text-length.js";

describe("computeTextLength", () => {
  test("returns length of plain text", () => {
    expect(computeTextLength("hello world")).toBe(11);
  });

  test("strips HTML tags", () => {
    expect(computeTextLength('<span style="color:red">빨간 텍스트</span>')).toBe(6);
  });

  test("strips nested HTML", () => {
    expect(computeTextLength("<b><u>중첩</u></b> 태그")).toBe(5);
  });

  test("normalizes cloze markers to answer only", () => {
    // {{c1::답::힌트}} → 답
    expect(computeTextLength("DNS는 {{c1::Domain Name System::약자}} 이다")).toBe(
      "DNS는 Domain Name System 이다".length,
    );
  });

  test("handles cloze without hint", () => {
    expect(computeTextLength("값은 {{c1::42}}이다")).toBe("값은 42이다".length);
  });

  test("strips callout markers", () => {
    expect(computeTextLength("::: tip\n중요한 내용\n:::")).toBe(5);
  });

  test("strips toggle markers", () => {
    expect(computeTextLength("::: toggle todo 할일\n내용\n:::")).toBe(5);
  });

  test("normalizes whitespace", () => {
    expect(computeTextLength("a   b\n\n\nc")).toBe(5); // "a b c"
  });

  test("handles table HTML", () => {
    const html = "<table><tr><td>셀1</td><td>셀2</td></tr></table>";
    expect(computeTextLength(html)).toBe(4); // "셀1셀2" → 공백 제거 후
  });

  test("returns 0 for empty string", () => {
    expect(computeTextLength("")).toBe(0);
  });

  test("handles complex real-world card", () => {
    const card =
      '[DNS > Record] A 레코드는 도메인을 {{c1::IPv4::IPv4 | IPv6}} 주소로 매핑한다. <span style="color:blue">중요</span>';
    const result = computeTextLength(card);
    // "[DNS > Record] A 레코드는 도메인을 IPv4 주소로 매핑한다. 중요"
    expect(result).toBe("[DNS > Record] A 레코드는 도메인을 IPv4 주소로 매핑한다. 중요".length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && bun test src/__tests__/text-length.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeTextLength`**

```typescript
// packages/core/src/parser/text-length.ts
/**
 * HTML/Cloze/Callout을 제거한 순수 텍스트 길이 계산.
 * 모바일 1스크린 트리거 판정용.
 */

/** Cloze 마커에서 답만 추출: {{c1::답::힌트}} → 답 */
const CLOZE_RE = /\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g;

/** ::: type [title]\n...\n::: 블록의 여닫이 마커 */
const CALLOUT_MARKER_RE = /^:::\s*(?:tip|warning|error|note|link|toggle)\b[^\n]*/gm;
const CALLOUT_CLOSE_RE = /^:::$/gm;

/** HTML 태그 전체 */
const HTML_TAG_RE = /<[^>]+>/g;

/** 연속 공백/줄바꿈 → 단일 공백 */
const MULTI_WS_RE = /\s+/g;

export function computeTextLength(html: string): number {
  let text = html;
  // 1. Cloze → 답만
  text = text.replace(CLOZE_RE, "$1");
  // 2. Callout 마커 제거
  text = text.replace(CALLOUT_MARKER_RE, "");
  text = text.replace(CALLOUT_CLOSE_RE, "");
  // 3. HTML 태그 제거
  text = text.replace(HTML_TAG_RE, "");
  // 4. 공백 정규화
  text = text.replace(MULTI_WS_RE, " ").trim();
  return text.length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bun test src/__tests__/text-length.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Add export to parser/index.ts**

`packages/core/src/parser/index.ts`에 `export { computeTextLength } from "./text-length.js";` 추가.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parser/text-length.ts packages/core/src/__tests__/text-length.test.ts packages/core/src/parser/index.ts
git commit -m "feat(core): add computeTextLength utility for mobile screen trigger"
```

---

## Task 2: Zod Validator — Discriminated Union + Legacy Fallback

**Files:**
- Modify: `packages/core/src/gemini/validator.ts`
- Create: `packages/core/src/__tests__/validator-operation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/__tests__/validator-operation.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && bun test src/__tests__/validator-operation.test.ts`
Expected: FAIL — `validateOperationResponse` not found

- [ ] **Step 3: Implement new validator**

`packages/core/src/gemini/validator.ts`를 전면 교체:
- `SplitCardSchema`에서 `charCount` 제거
- `QualityChecksSchema`에서 `allCardsUnder80Chars`/`noEnumerations` 제거
- `OperationResponseSchema` discriminated union (SplitSchema, CompactSchema, SkipSchema)
- `convertLegacyResponse()` 내부 함수: `shouldSplit` 감지 시 새 스키마로 변환
- `validateOperationResponse()`: 레거시 감지 → 변환 → 새 스키마 검증
- split일 때 `mainCardIndex < splitCards.length` 추가 검증
- 기존 `validateSplitResponse`는 `validateOperationResponse`를 호출하는 deprecated wrapper로 유지 (컴파일 에러 방지)
- `validateClozePresence`, `validateAllCardsHaveCloze`, `validateStylePreservation`은 그대로 유지

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bun test src/__tests__/validator-operation.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run existing tests to check no regression**

Run: `cd packages/core && bun test`
Expected: ALL PASS (기존 `validateSplitResponse` wrapper 덕분)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gemini/validator.ts packages/core/src/__tests__/validator-operation.test.ts
git commit -m "feat(core): discriminated union validator with legacy shouldSplit fallback"
```

---

## Task 3: Optimization Analysis (Trigger Condition)

**Files:**
- Modify: `packages/core/src/splitter/atomic-converter.ts`
- Create: `packages/core/src/__tests__/optimization-analysis.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && bun test src/__tests__/optimization-analysis.test.ts`
Expected: FAIL — `analyzeForOptimization` not found

- [ ] **Step 3: Implement `analyzeForOptimization`**

`packages/core/src/splitter/atomic-converter.ts`를 수정:
- `MAX_TEXT_LENGTH = 500` 상수 추가
- `OptimizationAnalysis` 인터페이스 추가 (needsOptimization, reasons, hasTodoBlock, clozeCount, textLength)
- `analyzeForOptimization(htmlContent: string): OptimizationAnalysis` 함수 추가 — `computeTextLength` 사용
- 기존 `analyzeForSplit`은 deprecated wrapper로 유지 (하위 호환)
- 기존 `SplitAnalysis` 타입은 유지, `estimatedCards` 필드는 deprecated

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && bun test src/__tests__/optimization-analysis.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/splitter/atomic-converter.ts packages/core/src/__tests__/optimization-analysis.test.ts
git commit -m "feat(core): analyzeForOptimization with cloze + text length triggers"
```

---

## Task 4: System Prompt + Optimization Prompt

**Files:**
- Modify: `packages/core/src/gemini/prompts.ts`

- [ ] **Step 1: Replace `SYSTEM_PROMPT`**

새 `SYSTEM_PROMPT`를 작성한다. 핵심 변경:
- "모바일 친화적 카드 최적화 전문가"로 역할 변경
- 카드 길이 하드 리밋 제거 → "모바일 AnkiDroid에서 스크롤 없이 표시되는 분량"
- "서로 큰 관련이 없는 2개 이상 주제가 한 카드에 공존하지 않도록" 원칙
- Cloze 수 제한 제거 (같은 주제 내 여러 Cloze 허용)
- 열거 금지/Context-Free 규칙 제거
- Binary Hints, No Yes/No, No Example Trap, 형식 보존 규칙 유지
- **Operation 판정 가이드**: split/compact/skip 선택 기준 + 예시 추가
- **Compact 지침**: 압축/선별/구조재편 방법 + auditReport 작성 지침

- [ ] **Step 2: Replace `buildSplitPrompt` → `buildOptimizationPrompt`**

- 함수명 변경
- 목표를 "모바일 최적화 (split 또는 compact)"로
- 글자수/Cloze수 제한 제거
- 새 JSON 응답 스키마 (operation discriminated union)
- mobile-friendly 예시로 교체

- [ ] **Step 3: Replace `SPLIT_RESPONSE_FORMAT` → `OPTIMIZATION_RESPONSE_FORMAT`**

`buildSplitPromptFromTemplate` → `buildOptimizationPromptFromTemplate`으로 이름 변경.
내부의 `SPLIT_RESPONSE_FORMAT` → `OPTIMIZATION_RESPONSE_FORMAT`으로 교체. 새 discriminated union JSON 스키마 포함.

- [ ] **Step 4: Update `buildAnalysisPrompt`**

mobile-friendly 기준으로 분석 기준 변경:
- 80자 체크 → 모바일 1스크린 초과 여부
- 열거 감지 → 서로 무관한 주제 공존 여부
- 기존 "Atomic Card 원칙" → "Mobile-Friendly 원칙"

- [ ] **Step 5: Deprecated wrappers**

기존 `buildSplitPrompt`, `buildSplitPromptFromTemplate`을 `buildOptimizationPrompt`, `buildOptimizationPromptFromTemplate`을 호출하는 deprecated wrapper로 유지.

- [ ] **Step 6: Write tests for new prompt functions**

```typescript
// packages/core/src/__tests__/optimization-prompt.test.ts
import { describe, expect, test } from "bun:test";
import {
  SYSTEM_PROMPT,
  buildOptimizationPrompt,
  buildOptimizationPromptFromTemplate,
} from "../gemini/prompts.js";

describe("SYSTEM_PROMPT", () => {
  test("contains mobile-friendly guidance, not atomic", () => {
    expect(SYSTEM_PROMPT).toContain("모바일");
    expect(SYSTEM_PROMPT).not.toContain("원자적 단위");
    expect(SYSTEM_PROMPT).not.toContain("40~60자");
  });

  test("contains operation guide (split/compact/skip)", () => {
    expect(SYSTEM_PROMPT).toContain("split");
    expect(SYSTEM_PROMPT).toContain("compact");
    expect(SYSTEM_PROMPT).toContain("skip");
  });

  test("preserves binary pattern hints", () => {
    expect(SYSTEM_PROMPT).toContain("있다 | 없다");
  });
});

describe("buildOptimizationPrompt", () => {
  test("includes noteId and card text", () => {
    const prompt = buildOptimizationPrompt(12345, "테스트 카드");
    expect(prompt).toContain("12345");
    expect(prompt).toContain("테스트 카드");
  });

  test("contains operation discriminated union schema", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).toContain('"operation"');
    expect(prompt).toContain("compact");
    expect(prompt).toContain("auditReport");
  });

  test("does not contain old shouldSplit schema", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).not.toContain("shouldSplit");
  });
});

describe("buildOptimizationPromptFromTemplate", () => {
  test("substitutes template variables", () => {
    const result = buildOptimizationPromptFromTemplate(
      "noteId={{noteId}} text={{text}} tags={{tags}}",
      12345,
      "card text",
      ["tag1", "tag2"],
    );
    expect(result).toContain("noteId=12345");
    expect(result).toContain("text=card text");
    expect(result).toContain("tags=tag1, tag2");
  });

  test("appends OPTIMIZATION_RESPONSE_FORMAT when template lacks JSON schema", () => {
    const result = buildOptimizationPromptFromTemplate("plain template", 1, "t");
    expect(result).toContain('"operation"');
    expect(result).toContain("auditReport");
  });
});
```

- [ ] **Step 7: Run prompt tests**

Run: `cd packages/core && bun test src/__tests__/optimization-prompt.test.ts`
Expected: ALL PASS

- [ ] **Step 8: Update existing prompts.test.ts if needed**

기존 `prompts.test.ts`가 `buildSplitPrompt` 테스트를 포함하면, deprecated wrapper가 동작하도록 유지하거나 새 함수 테스트로 교체.

Run: `cd packages/core && bun test src/__tests__/prompts.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/gemini/prompts.ts packages/core/src/__tests__/optimization-prompt.test.ts
git commit -m "feat(core): mobile-friendly SYSTEM_PROMPT and buildOptimizationPrompt"
```

---

## Task 5: LLM Client — requestCardOptimization

**Files:**
- Modify: `packages/core/src/gemini/client.ts`

- [ ] **Step 1: Rename + update `requestCardSplit` → `requestCardOptimization`**

- 반환 타입: `SplitResponse & SplitRequestMetadata` → `OperationResponse & SplitRequestMetadata`
- `validateSplitResponse` → `validateOperationResponse` 호출
- `buildSplitPrompt`/`buildSplitPromptFromTemplate` → 새 함수 호출
- 기존 `requestCardSplit`은 deprecated wrapper로 유지

- [ ] **Step 2: Rename `estimateSplitCost` → `estimateOptimizationCost`**

- `buildOptimizationPrompt` 기반 토큰 추정
- 로직 동일, 함수명/import만 변경
- 기존 `estimateSplitCost`는 deprecated wrapper로 유지

- [ ] **Step 3: Update `analyzeCardForSplit`**

인라인 프롬프트를 mobile-friendly 기준으로 변경:
- "여러 독립적인 개념" → "서로 무관한 주제 공존"
- "카드 내용이 너무 길어" → "모바일 1스크린 초과"
- 80자 기준 제거

- [ ] **Step 4: Update `requestBatchCardSplit`**

내부에서 `requestCardOptimization` 호출하도록 변경.

- [ ] **Step 5: Verify type compatibility**

`requestCardOptimization`의 반환 타입이 `OperationResponse & SplitRequestMetadata`인지 확인.
기존 `SplitResponse`를 사용하던 곳에서 `OperationResponse`로 좁히기(narrowing) 가능한지 확인:
- `result.operation === "split"` → `result.splitCards` 접근 가능
- `result.operation === "compact"` → `result.compactedContent` 접근 가능
- `result.operation === "skip"` → `result.operationReason`만 접근

- [ ] **Step 6: Run all core tests**

Run: `cd packages/core && bun test`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/gemini/client.ts
git commit -m "feat(core): requestCardOptimization with operation response handling"
```

---

## Task 6: Core Types + Exports

**Files:**
- Modify: `packages/core/src/prompt-version/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update `REJECTION_REASONS`**

```typescript
export const REJECTION_REASONS = [
  { id: "too-granular", label: "분할이 너무 세분화" },
  { id: "context-missing", label: "맥락 태그 부적절" },
  { id: "cloze-inappropriate", label: "Cloze 위치/내용 부적절" },
  { id: "quality-low", label: "전반적 품질 미달" },
  { id: "over-compressed", label: "과도한 압축" },
  { id: "info-lost", label: "핵심 정보 누락" },
  { id: "other", label: "기타" },
] as const;
```

`char-exceeded` 제거, `over-compressed`/`info-lost` 추가.

- [ ] **Step 2: Deprecate `PromptConfig` char limit fields**

모든 char limit 필드에 JSDoc `@deprecated` 추가: `maxClozeChars`, `targetClozeChars`, `maxClozePerCard`, `maxBasicFrontChars`, `targetBasicFrontChars`, `maxBasicBackChars`, `targetBasicBackChars`.

- [ ] **Step 3: Update `packages/core/src/index.ts` exports**

새 함수/타입 export 추가:
- `analyzeForOptimization`, `OptimizationAnalysis`, `MAX_TEXT_LENGTH`
- `validateOperationResponse`, `OperationResponse` (+ 개별 타입들)
- `requestCardOptimization`, `estimateOptimizationCost`
- `buildOptimizationPrompt`, `buildOptimizationPromptFromTemplate`
- `computeTextLength`

기존 이름들은 deprecated wrapper를 통해 계속 export (하위 호환).

- [ ] **Step 4: Verify build**

Run: `cd packages/core && bun run build` (또는 `bun typecheck`)
Expected: 컴파일 성공, deprecation 경고만 있을 수 있음

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/prompt-version/types.ts packages/core/src/index.ts
git commit -m "feat(core): update REJECTION_REASONS, deprecate PromptConfig char limits, re-export new APIs"
```

---

## Task 7: History Types + Store

**Files:**
- Modify: `packages/server/src/history/types.ts`
- Modify: `packages/server/src/history/store.ts`

- [ ] **Step 1: Update `types.ts`**

- `SplitSessionListItem`에 `operation: "split" | "compact" | "skip"` 추가
- `SplitCardPayload`에서 `charCount` 제거
- `SplitGeneratedPayload.splitCards`를 optional로 변경
- `SplitGeneratedPayload`에 `operation`, `compactedContent`, `auditReport` 추가
- `CompactPayload` 인터페이스 추가
- `SplitSessionDetail`에 `operation` 추가

- [ ] **Step 2: Update `store.ts` — DB 마이그레이션**

`split_sessions` 테이블에 `operation TEXT NOT NULL DEFAULT 'split'` 컬럼 추가.
기존 `ensureSchema()` 또는 마이그레이션 로직에 `ALTER TABLE` 추가 (SQLite: `ALTER TABLE split_sessions ADD COLUMN operation TEXT NOT NULL DEFAULT 'split'`).

- [ ] **Step 3: Update `store.ts` — `markGenerated` compact 분기**

핵심 변경: `splitCards` optional guard + compact 데이터 저장.

```typescript
// markGenerated 내부 — SQL 파라미터
const splitCardsJson = JSON.stringify(payload.splitCards ?? []);
const cardCount = payload.splitCards?.length ?? 0;

// markGenerated 내부 — 이벤트 페이로드
const eventPayload = {
  cardCount,
  operation: payload.operation ?? "split",
  ...(payload.compactedContent && { compactedContent: payload.compactedContent }),
  ...(payload.auditReport && { auditReport: payload.auditReport }),
};
```

compact 세션의 경우 `split_cards_json`은 `'[]'`, `cardCount`는 `0`. `compactedContent`와 `auditReport`는 `ai_response_json`에 함께 저장.

- [ ] **Step 4: Update `store.ts` — `markApplied` compact 분기**

`SplitAppliedPayload`에 optional 필드 추가:
```typescript
export interface SplitAppliedPayload {
  splitCards?: SplitCardPayload[];     // split용 (기존 필수 → optional)
  operation?: "split" | "compact";     // 신규
  compactedContent?: string;           // compact용
}
```

`markApplied` 내부에서 `payload.splitCards ?? []`로 guard.

- [ ] **Step 5: Update `store.ts` — `createSession`, `markNotSplit` 등에 operation 전달**

- `createSession`에서 `operation` 파라미터 받아 저장
- `getSessionMetadata`, `getSessionDetail` 쿼리에서 `operation` 컬럼 포함
- 리스트 쿼리에서 `operation` 반환

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/history/types.ts packages/server/src/history/store.ts
git commit -m "feat(server): history store with operation column and compact support"
```

---

## Task 8: SystemPrompt Migration + Prompt Version Archival

**Files:**
- Modify: `packages/server/src/routes/prompts.ts` (또는 서버 startup 로직)
- Modify: `packages/core/src/prompt-version/storage.ts`

- [ ] **Step 1: systemPrompt 해시 기반 마이그레이션**

서버 시작 시 remote systemPrompt의 해시를 비교. 구버전(atomic 프롬프트)이면 새 mobile-friendly 버전으로 자동 갱신. 사용자가 커스터마이즈한 경우는 덮어쓰지 않고 경고 로그만 출력.

구현: `seedSystemPrompt()` 함수를 서버 startup에 추가. 하드코딩 `SYSTEM_PROMPT`의 해시와 remote의 해시를 비교.

- [ ] **Step 2: 기존 프롬프트 버전 archived 마킹**

`prompt-version/storage.ts`에서 기존 active 버전을 `archived` 상태로 변경하는 마이그레이션 로직 추가.

- [ ] **Step 3: 새 기본 프롬프트 버전 생성**

새 mobile-friendly 스키마를 포함한 기본 프롬프트 버전을 seed. `splitPromptTemplate`에 새 operation discriminated union 스키마 포함.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/prompts.ts packages/core/src/prompt-version/storage.ts
git commit -m "feat(server): systemPrompt migration and prompt version archival"
```

---

## Task 9: Server Routes — Cards + Split

**Files:**
- Modify: `packages/server/src/routes/cards.ts`
- Modify: `packages/server/src/routes/split.ts`

- [ ] **Step 1: Update `routes/cards.ts`**

- `analyzeForSplit` → `analyzeForOptimization` import 변경
- 응답의 `isSplitable: analysis.canSplit` → `needsOptimization: analysis.needsOptimization`
- `estimatedCards` 제거
- `reasons: analysis.reasons`, `textLength: analysis.textLength` 추가
- `filter === "splitable"` 쿼리 파라미터: `"optimizable"`로 변경하되, `"splitable"`도 alias로 유지 (하위 호환)

- [ ] **Step 2: Update `routes/split.ts` — imports**

- `requestCardSplit` → `requestCardOptimization`
- `estimateSplitCost` → `estimateOptimizationCost`
- (deprecated wrapper 말고 새 이름으로 import하여 deprecated 사용 방지)

- [ ] **Step 3: Update `routes/split.ts` — preview**

응답 분기 + **`splitReason` → `operationReason` 필드명 변경**:
```typescript
if (aiResult.operation === "split") {
  // 기존 splitCards 로직, 응답 필드명: operationReason (not splitReason)
  return c.json({
    sessionId, noteId, operation: "split",
    originalText: text, splitCards, mainCardIndex: aiResult.mainCardIndex,
    operationReason: aiResult.operationReason, // renamed from splitReason
    ...commonFields,
  });
} else if (aiResult.operation === "compact") {
  return c.json({
    sessionId, noteId, operation: "compact",
    originalText: text, compactedContent: aiResult.compactedContent,
    auditReport: aiResult.auditReport,
    operationReason: aiResult.operationReason,
    ...commonFields,
  });
} else {
  // skip — 응답 필드: operationReason (not reason)
  return c.json({
    sessionId, noteId, operation: "skip",
    operationReason: aiResult.operationReason,
    ...commonFields,
  });
}
```

> **DB 매핑**: history store의 `split_reason` 컬럼명은 유지하되, 어플리케이션 레이어에서 `operationReason` ↔ `split_reason`으로 매핑. 컬럼 rename은 불필요 (비용 대비 효과 낮음).

- [ ] **Step 4: Update `routes/split.ts` — apply**

요청 바디에 `operation` 필드 추가:
```typescript
const { sessionId, noteId, deckName, operation, ...rest } = await c.req.json();

if (operation === "compact") {
  const { compactedContent } = rest;
  // 백업 → updateNoteFields(noteId, { Text: compactedContent }) → sync
  // newNoteIds: [], mainNoteId: noteId
} else {
  // 기존 split apply 로직
}
```

- [ ] **Step 5: Verify server compiles**

Run: `cd packages/server && bun typecheck` (또는 `bun run dev`로 시작 확인)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/cards.ts packages/server/src/routes/split.ts
git commit -m "feat(server): operation branching in cards and split routes"
```

---

## Task 10: Web API Types + Hooks

> Tasks renumbered: 이전 Task 9 → Task 10, Task 10 → Task 11, Task 11 → Task 12, Task 12 → Task 13, Task 13 → Task 14

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/hooks/useSplit.ts`

- [ ] **Step 1: Update `api.ts` — `OptimizationPreviewResult`**

기존 `SplitPreviewResult`를 discriminated union으로 교체:
```typescript
interface PreviewResultBase {
  sessionId?: string;
  noteId: number;
  operation: "split" | "compact" | "skip";
  operationReason: string;
  executionTimeMs?: number;
  tokenUsage?: TokenUsage;
  aiModel?: string;
  provider?: string;
  estimatedCost?: CostEstimate;
  actualCost?: ActualCost;
  historyWarning?: string;
}

interface SplitPreviewResult extends PreviewResultBase {
  operation: "split";
  originalText: string;
  splitCards: SplitCardPayload[];
  mainCardIndex: number;
}

interface CompactPreviewResult extends PreviewResultBase {
  operation: "compact";
  originalText: string;
  compactedContent: string;
  auditReport: { preserved: string[]; removed: string[]; transformed: string[] };
}

interface SkipPreviewResult extends PreviewResultBase {
  operation: "skip";
}

type OptimizationPreviewResult = SplitPreviewResult | CompactPreviewResult | SkipPreviewResult;
```

- `CardSummary.analysis` 변경: `canSplit` → `needsOptimization`, `estimatedCards` 제거, `reasons`/`textLength` 추가

- [ ] **Step 2: Update `api.ts` — fetch 함수**

`api.split.preview()` 반환 타입을 `OptimizationPreviewResult`로 변경.
`api.split.apply()` 요청에 `operation` 필드 추가.

- [ ] **Step 3: Update `hooks/useSplit.ts`**

- `useSplitPreview` 반환 타입 → `OptimizationPreviewResult`
- `useSplitApply` mutation 인자에 `operation: "split" | "compact"` 추가
- compact apply: `compactedContent` 전송, `splitCards`/`mainCardIndex` 없음
- `getCachedSplitPreview` → `getCachedOptimizationPreview`

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/hooks/useSplit.ts
git commit -m "feat(web): OptimizationPreviewResult types and hook updates"
```

---

## Task 11: Compact UI Components

**Files:**
- Create: `packages/web/src/components/card/AuditReportPanel.tsx`
- Create: `packages/web/src/components/card/CompactDiffView.tsx`

- [ ] **Step 1: Create `AuditReportPanel`**

Compact 감사 보고서를 시각화하는 컴포넌트:
```typescript
interface AuditReportPanelProps {
  auditReport: {
    preserved: string[];
    removed: string[];
    transformed: string[];
  };
}
```
- `preserved` → 초록 배지 (Check 아이콘)
- `removed` → 빨강 배지 (X 아이콘)
- `transformed` → 노랑 배지 (Sparkles 아이콘)

- [ ] **Step 2: Create `CompactDiffView`**

원본 vs compact 결과를 나란히 보여주는 컴포넌트:
```typescript
interface CompactDiffViewProps {
  originalText: string;
  compactedContent: string;
  auditReport: { preserved: string[]; removed: string[]; transformed: string[] };
}
```
- 데스크톱: 좌/우 2-pane (기존 `ContentRenderer` 활용)
- 모바일: 탭 전환 (원본/압축)
- 하단에 `AuditReportPanel` 표시

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/card/AuditReportPanel.tsx packages/web/src/components/card/CompactDiffView.tsx
git commit -m "feat(web): AuditReportPanel and CompactDiffView components"
```

---

## Task 12: SplitWorkspace + CardBrowser UI Integration

**Files:**
- Modify: `packages/web/src/pages/SplitWorkspace.tsx`
- Modify: `packages/web/src/pages/CardBrowser.tsx`
- Modify: `packages/web/src/components/card/DiffViewer.tsx` (if needed)

- [ ] **Step 1: Update `REJECTION_REASONS`**

```typescript
const REJECTION_REASONS = [
  { id: "too-granular", label: "분할이 너무 세분화" },
  { id: "context-missing", label: "맥락 태그 부적절" },
  { id: "cloze-inappropriate", label: "Cloze 위치/내용 부적절" },
  { id: "quality-low", label: "전반적 품질 미달" },
  { id: "over-compressed", label: "과도한 압축" },
  { id: "info-lost", label: "핵심 정보 누락" },
  { id: "other", label: "기타" },
] as const;
```

- [ ] **Step 2: Update `SplitCandidate` interface**

```typescript
interface SplitCandidate {
  noteId: number;
  text: string;
  analysis: {
    needsOptimization: boolean;  // was: canSplit
    clozeCount: number;
    textLength: number;          // new
    reasons: {                   // new
      clozeOverflow: boolean;
      textOverflow: boolean;
    };
  };
  // ...
}
```

후보 목록 배지: `canSplit` → `needsOptimization`, `estimatedCards` 대신 트리거 이유 표시.

- [ ] **Step 3: Preview 영역 operation 분기**

```tsx
{preview.operation === "split" && (
  // 기존 SplitPreviewCard 목록
)}
{preview.operation === "compact" && (
  <CompactDiffView
    originalText={preview.originalText}
    compactedContent={preview.compactedContent}
    auditReport={preview.auditReport}
  />
)}
{preview.operation === "skip" && (
  <div>변경 불필요: {preview.operationReason}</div>
)}
```

- [ ] **Step 4: Apply 버튼 분기**

- `operation === "split"`: 기존 "분할 적용" 버튼
- `operation === "compact"`: "압축 적용" 버튼, `useSplitApply`에 `operation: "compact"` + `compactedContent` 전달

- [ ] **Step 5: Update `CardBrowser.tsx`**

`packages/web/src/pages/CardBrowser.tsx`에서 `analysis.canSplit` 참조를 `analysis.needsOptimization`으로 변경. 관련 배지/필터 UI도 업데이트.

- [ ] **Step 6: Manual UI test**

Run: `bun run dev`
- 후보 카드 선택 → 프리뷰 요청 → operation에 따라 올바른 뷰 렌더링 확인
- compact 결과 apply/reject 동작 확인

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/pages/SplitWorkspace.tsx packages/web/src/pages/CardBrowser.tsx packages/web/src/components/card/DiffViewer.tsx
git commit -m "feat(web): SplitWorkspace + CardBrowser operation branching with compact support"
```

---

## Task 13: History Page Updates

**Files:**
- Modify: `packages/web/src/pages/SplitHistory.tsx`

- [ ] **Step 1: Operation 배지 추가**

이력 목록에 operation 타입 배지 표시:
- `split` → 가위 아이콘 + "Split"
- `compact` → 압축 아이콘 + "Compact"

- [ ] **Step 2: Compact 상세 뷰**

이력 상세 보기에서 operation === "compact"일 때:
- `CompactDiffView` 렌더링 (원본 vs compact)
- `AuditReportPanel` 표시

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/SplitHistory.tsx
git commit -m "feat(web): history page operation badges and compact detail view"
```

---

## Task 14: Integration Test + Final Cleanup

- [ ] **Step 1: End-to-end 수동 테스트**

`bun run dev`로 전체 앱 실행:
1. 덱 선택 → 카드 목록에서 `needsOptimization` 배지 확인
2. 카드 선택 → 프리뷰 요청 → LLM이 split/compact/skip 중 하나 반환하는지 확인
3. split 결과 → 기존과 동일하게 splitCards 프리뷰 표시
4. compact 결과 → CompactDiffView + AuditReportPanel 표시
5. skip 결과 → "변경 불필요" 메시지 표시
6. apply/reject 동작 확인
7. 이력 페이지에서 operation 배지 + compact 상세 뷰 확인

- [ ] **Step 2: Deprecated wrapper 정리**

모든 deprecated wrapper에 JSDoc `@deprecated` + `Use XXX instead` 메시지 추가:
- `analyzeForSplit` → `analyzeForOptimization`
- `validateSplitResponse` → `validateOperationResponse`
- `requestCardSplit` → `requestCardOptimization`
- `estimateSplitCost` → `estimateOptimizationCost`
- `buildSplitPrompt` → `buildOptimizationPrompt`
- `buildSplitPromptFromTemplate` → `buildOptimizationPromptFromTemplate`

- [ ] **Step 3: Update skill docs**

`@splitting-cards` 스킬 문서를 mobile-friendly 전략에 맞게 업데이트.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: deprecation markers, skill docs update, integration cleanup"
```
