# Mobile-Friendly Split + Compact 디자인

> **Issue**: [#102](https://github.com/greenheadHQ/awesome-anki/issues/102) — split을 atomic하게 하지 말고, mobile-friendly하게만 스플릿
> **Date**: 2026-03-22
> **Status**: Draft

## 문제 정의

현재 Split 시스템은 SuperMemo "Minimum Information Principle"을 엄격하게 적용하여 카드를 극도로 잘게 분할한다 (예: CSS 명시도 카드 1매 → 11매). 이력 목록의 대부분이 "rejected" 상태이며, 과도한 분할이 오히려 학습 효과를 저하시킨다.

## 핵심 결정 사항

| 항목 | 기존 | 변경 |
|------|------|------|
| Split 철학 | "카드당 정확히 한 가지 사실" | "서로 무관한 2개 주제가 한 카드에 공존하지 않도록" |
| 수치 기준 | Cloze 40~60자(max 80), 카드당 1 Cloze | 하드 리밋 없음, LLM 판단 ("모바일 1스크린") |
| 완화 규칙 | 전부 MUST | Cloze 글자수/열거금지/Context-Free 완화 |
| 유지 규칙 | — | Binary Hints, No Yes/No, No Example Trap, 형식 보존 |
| Operation | split / skip 이분법 | **split / compact / skip** 삼자택일 |
| Split 트리거 | Cloze 4개 이상만 | Cloze 수 OR 텍스트 길이 초과 |
| Compact 감사 | — | LLM 자기 검증 보고서 + 사용자 diff 뷰 |

---

## 1. Operation 모델

| Operation | 의미 | Anki 결과 |
|-----------|------|-----------|
| `split` | 카드를 2개 이상으로 분할 | 원본 업데이트 + 새 카드 생성 |
| `compact` | 같은 카드를 압축/재구성 | 원본 카드 content만 업데이트 (새 카드 없음) |
| `skip` | 변경 불필요 | 아무 변경 없음 |

LLM이 판정한다: "서로 무관한 주제가 공존하면 split, 모바일 1스크린 초과이지만 쪼개면 학습 효과가 떨어지면 compact, 이미 적절하면 skip".

### Compact 정의

A+B+C 하이브리드:
- **(A) 내용 압축**: 같은 정보를 더 간결한 표현으로 재작성
- **(B) 정보 선별**: 핵심 학습 포인트만 남기고 부가 설명 제거
- **(C) 구조 재편**: 모바일 읽기 좋은 형태로 재구성 (표, 불릿 등)

극단적 정보 손실 방지를 위해 **감사 시스템**(auditReport)이 필수.

---

## 2. 프롬프트 전략

### SYSTEM_PROMPT 변경

**제거/완화:**
- "Atomic Card 생성 전문가" → "모바일 친화적 카드 최적화 전문가"
- 카드 길이 기준표 (Cloze 40~60자, max 80자) → 삭제. "모바일 1스크린에 스크롤 없이 표시" 기준
- "카드당 정확히 한 가지 사실" → "서로 큰 관련이 없는 2개 이상 주제가 한 카드에 공존하지 않도록"
- "카드당 1개 Cloze" → 제한 없음. 같은 주제 내 관련 Cloze 여러 개 허용
- "No Enumerations" → 삭제. 같은 주제의 목록은 한 카드에 허용
- "Context-Free" → 완화. 같은 주제 내 맥락 의존 허용
- Self-Correction 루프 (80자 초과 시 재작성) → 삭제

**유지:**
- Binary Pattern Hints (이진 패턴 힌트 필수)
- No Yes/No Answers
- No Example Trap (역방향 질문)
- 형식 유지 규칙 (HTML 스타일, Callout, Toggle, 이미지, nid 링크 보존)
- 부정형 질문 방지
- 카드 타입 선택 가이드 (Cloze vs Basic)
- 권장 원칙 (Why > What, Two-way, Connections)

**추가:**
- **Operation 판정 가이드**: split / compact / skip 선택 기준과 예시
- **Compact 지침**: 압축 + 선별 + 구조 재편 방법
- **Compact 감사 보고서 작성 지침**: preserved / removed / transformed 목록

### buildSplitPrompt 변경

- 함수명: `buildSplitPrompt` → `buildOptimizationPrompt`
- "원자적 단위로 분할해주세요" → "모바일에 최적화해주세요 (split 또는 compact)"
- 분할 목표의 글자수/Cloze수 제한 삭제
- 예시를 mobile-friendly 버전으로 교체
- JSON 응답 형식을 새 스키마로 교체

---

## 3. 응답 스키마

`shouldSplit: boolean` → `operation: "split" | "compact" | "skip"` discriminated union.

### Split 응답

```json
{
  "originalNoteId": "12345",
  "operation": "split",
  "mainCardIndex": 0,
  "splitCards": [
    {
      "title": "카드 제목",
      "content": "내용 (HTML)",
      "cardType": "cloze",
      "contextTag": "[주제 > 하위]",
      "inheritImages": [],
      "inheritTags": [],
      "preservedLinks": [],
      "backLinks": []
    }
  ],
  "operationReason": "DNS 개요와 레코드 타입이 서로 독립된 주제라 분리",
  "qualityChecks": {
    "allClozeHaveHints": true,
    "allContextTagsPresent": true
  }
}
```

### Compact 응답

```json
{
  "originalNoteId": "12345",
  "operation": "compact",
  "compactedContent": "압축된 카드 내용 (HTML)",
  "operationReason": "CSS 명시도는 단일 주제이므로 분할하면 학습 효과 저하. 표 구조로 압축",
  "auditReport": {
    "preserved": ["명시도 계산 규칙", "선택자별 가중치", "!important 우선순위"],
    "removed": ["중복된 예시 설명"],
    "transformed": ["장황한 문장 → 2열 비교표로 구조화"]
  },
  "qualityChecks": {
    "allClozeHaveHints": true,
    "allContextTagsPresent": true
  }
}
```

### Skip 응답

```json
{
  "originalNoteId": "12345",
  "operation": "skip",
  "operationReason": "이미 모바일 1스크린 내 단일 주제. 변경 불필요"
}
```

### 스키마 변경 요약

- `shouldSplit` → `operation`
- `splitReason` → `operationReason` (공통)
- Compact 전용: `compactedContent` + `auditReport`
- `qualityChecks`: `allCardsUnder80Chars`/`noEnumerations` 제거
- `SplitCardSchema`: `charCount` 제거

---

## 4. Split 트리거 조건

### `analyzeForSplit` → `analyzeForOptimization`

```typescript
export const MAX_CLOZES_PER_CARD = 3;
export const MAX_TEXT_LENGTH = 500; // 한글 기준, 모바일 1스크린

export interface OptimizationAnalysis {
  needsOptimization: boolean;
  reasons: {
    clozeOverflow: boolean;   // clozeCount > MAX_CLOZES_PER_CARD
    textOverflow: boolean;    // textLength > MAX_TEXT_LENGTH
  };
  hasTodoBlock: boolean;
  clozeCount: number;
  textLength: number;         // HTML 태그 제외 순수 텍스트 길이
}
```

트리거: `clozeOverflow OR textOverflow`. 이 필터는 LLM 호출 후보를 걸러내는 것이며, 최종 판정(split/compact/skip)은 LLM이 한다.

`estimatedCards` 필드 제거. UI에서는 "최적화 필요" 배지 + 트리거 이유(Cloze N개, M자)만 표시.

---

## 5. Zod 검증 (validator.ts)

```typescript
const BaseSchema = z.object({
  originalNoteId: z.union([z.string(), z.number()]).transform(String),
  operationReason: z.string(),
});

const SplitSchema = BaseSchema.extend({
  operation: z.literal("split"),
  mainCardIndex: z.number().int().min(0),
  splitCards: z.array(SplitCardSchema).min(2),
  qualityChecks: QualityChecksSchema,
});

const CompactSchema = BaseSchema.extend({
  operation: z.literal("compact"),
  compactedContent: z.string().min(1),
  auditReport: z.object({
    preserved: z.array(z.string()),
    removed: z.array(z.string()),
    transformed: z.array(z.string()),
  }),
  qualityChecks: QualityChecksSchema,
});

const SkipSchema = BaseSchema.extend({
  operation: z.literal("skip"),
});

const OperationResponseSchema = z.discriminatedUnion("operation", [
  SplitSchema, CompactSchema, SkipSchema,
]);
```

- `SplitCardSchema`: `charCount` 제거
- `QualityChecksSchema`: `allCardsUnder80Chars`/`noEnumerations` 제거
- `validateSplitResponse` → `validateOperationResponse`
- split일 때 `mainCardIndex < splitCards.length` 검증 유지

---

## 6. 서버 API (split.ts)

### POST /api/split/preview

응답 분기를 operation별로 처리:

- `operation === "split"` → 기존과 동일 (splitCards 반환). 이력: `markGenerated`
- `operation === "compact"` → `compactedContent` + `auditReport` 반환. 이력: `markGenerated` (compact 데이터 포함)
- `operation === "skip"` → reason만 반환. 이력: `markNotSplit`

### POST /api/split/apply

요청에 `operation: "split" | "compact"` 필드 추가:

- `operation === "split"`: 기존 로직 그대로 (백업 → `applySplitResult` → 새 카드 생성 → sync → scheduling clone)
- `operation === "compact"`: 백업 → `updateNoteFields`로 원본 content 교체 → sync. 새 카드 없음, scheduling clone 불필요.

### POST /api/split/reject

변경 없음. compact 결과도 동일하게 reject 가능.

---

## 7. 이력 DB 변경

### 스키마

- `operation` 컬럼 추가: `TEXT NOT NULL DEFAULT 'split'`
- 기존 레코드는 `'split'` 기본값으로 마이그레이션
- compact 세션: `splitCards` 대신 `compactedContent` + `auditReport`를 `aiResponse` JSON에 저장

### 타입 변경

```typescript
// SplitSessionListItem에 추가
operation: "split" | "compact" | "skip";

// SplitCardPayload에서 제거
// charCount 필드 삭제

// 신규: CompactPayload
interface CompactPayload {
  compactedContent: string;
  auditReport: {
    preserved: string[];
    removed: string[];
    transformed: string[];
  };
}
```

---

## 8. 웹 UI 변경

### SplitWorkspace 프리뷰 영역

operation에 따라 다른 뷰 렌더링:

- **Split**: 기존과 동일. splitCards 목록 + mainCard 표시.
- **Compact**: 2-pane diff 뷰 (좌: 원본 / 우: compact 결과). 모바일은 탭 전환. 감사 보고서 패널에 preserved(초록)/removed(빨강)/transformed(노랑) 컬러 태그 표시.
- **Skip**: "변경 불필요" 메시지 + 사유 표시.

### Apply/Reject

- Compact 시 Apply 버튼 레이블: "압축 적용"
- Reject 사유 목록에 compact 항목 추가: `"over-compressed"` (과도한 압축), `"info-lost"` (핵심 정보 누락)

### 후보 목록

- `canSplit` 배지 → `needsOptimization` 배지
- `estimatedCards` 대신 트리거 이유 표시 (예: "Cloze 5개", "580자")

### 이력 페이지

- operation 타입 배지 추가 (Split / Compact)
- compact 이력 상세 보기 시 diff + 감사 보고서 표시

---

## 영향 범위 요약

| 패키지 | 파일 | 변경 내용 |
|--------|------|-----------|
| `core` | `splitter/atomic-converter.ts` | `analyzeForSplit` → `analyzeForOptimization`, 텍스트 길이 트리거 추가 |
| `core` | `gemini/prompts.ts` | `SYSTEM_PROMPT` 전면 개편, `buildSplitPrompt` → `buildOptimizationPrompt` |
| `core` | `gemini/validator.ts` | discriminated union 스키마, `validateOperationResponse` |
| `core` | `gemini/client.ts` | `requestCardSplit` → `requestCardOptimization`, 반환 타입 변경 |
| `core` | export 진입점 | 이름 변경된 함수/타입 re-export |
| `server` | `routes/split.ts` | preview/apply 라우트에 operation 분기 추가 |
| `server` | `history/types.ts` | `operation` 필드 추가, `CompactPayload` 타입 |
| `server` | `history/store.ts` | compact 데이터 저장 로직 |
| `server` | DB 마이그레이션 | `operation` 컬럼 추가 |
| `web` | `pages/SplitWorkspace.tsx` | operation별 프리뷰 뷰 분기, compact diff 뷰 |
| `web` | `hooks/useSplit.ts` | apply 요청에 operation 필드 |
| `web` | `lib/api.ts` | `SplitPreviewResult` 타입 확장 |
| `web` | `components/card/DiffViewer` | compact diff 뷰 + 감사 보고서 패널 |
| `web` | 이력 페이지 | operation 배지, compact 상세 뷰 |
