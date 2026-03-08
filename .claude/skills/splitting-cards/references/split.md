# Split 상세

소스: `packages/core/src/gemini/client.ts`, `packages/core/src/gemini/prompts.ts`

## 트리거 조건

- Cloze 개수 > 3개 (4개 이상) -- `MAX_CLOZES_PER_CARD = 3` (`atomic-converter.ts`)

## 처리 흐름

1. SplitWorkspace에서 "분석 요청" 버튼 클릭
2. `POST /api/split/preview` 호출 (클라이언트에서 `provider`/`model` 지정 가능)
3. 비용 가드레일: `estimateSplitCost()` -> `checkBudget()` 순서로 예산 초과 확인
4. 선택된 LLM 모델에 분할 제안 요청 (`requestCardSplit()`)
5. 결과를 미리보기로 표시 (토큰 사용량 + 비용 정보 포함)
6. 사용자 확인 후 `POST /api/split/apply`로 적용

## 비용 추정 상세 (`estimateSplitCost()`)

```typescript
// 입력 토큰: 실제 프롬프트 구조와 동일하게 countTokens 호출
const fullInput = `${systemPrompt}\n\n${userPrompt}`;
const inputTokens = await client.countTokens(fullInput, model);

// 출력 토큰: 입력의 70% 수준 추정 (일반적인 카드 분할 패턴)
const ESTIMATED_OUTPUT_INPUT_RATIO = 0.7;
const outputTokens = Math.min(
  Math.ceil(inputTokens * ESTIMATED_OUTPUT_INPUT_RATIO),
  SPLIT_MAX_OUTPUT_TOKENS  // 8192
);

// worst-case: maxOutputTokens(8192) 기준 비용 (예산 검사에 사용)
```

반환:
```typescript
{
  estimatedCost: CostEstimate;       // 예상 비용 (70% 기준)
  worstCaseCostUsd: number;          // 최악 비용 (8192 토큰 기준)
  inputTokens: number;
  outputTokens: number;
}
```

## 프롬프트 빌더 함수

### `buildSplitPrompt(noteId, text)`

기본 분할 프롬프트 생성. SuperMemo Twenty Rules 기반, 카드 길이 기준, 이진 패턴 힌트, 좋은/나쁜 예시 포함. JSON 응답 형식 명세 내장.

### `buildSplitPromptFromTemplate(template, noteId, text, tags)`

프롬프트 버전의 `splitPromptTemplate`에서 변수 치환:
- `{{noteId}}` / `${noteId}` -> noteId
- `{{text}}` / `${cardText}` -> text
- `{{tags}}` / `${tags}` -> tags (쉼표 구분)
- 템플릿에 JSON 응답 형식이 없으면 자동 추가 (`SPLIT_RESPONSE_FORMAT`)

### `buildAnalysisPrompt(noteId, text)`

분할 필요성 분석 전용 프롬프트. `analyzeCardForSplit()`에서 사용. 글자 수, 정보 밀도, Yes/No 패턴, 맥락 태그, 열거, 구조적 분리를 분석하여 JSON 응답 반환.

## 배치 분할 (`requestBatchCardSplit()`)

```typescript
async function requestBatchCardSplit(
  cards: CardForSplit[],
  onProgress?: (completed: number, total: number) => void,
  modelId?: LLMModelId,
): Promise<Map<number, SplitResponse>>
```

- **BATCH_SIZE = 10**: 10개씩 병렬 처리 (`Promise.allSettled`)
- **DELAY_MS = 1000**: 배치 간 1초 딜레이 (rate limit 대응)
- 개별 카드 실패 시 `console.error`만 출력하고 계속 진행
- `onProgress` 콜백으로 진행률 보고

## 제한사항

- 현재 **5개 후보만 분석** (API 비용 고려)
- 전체 후보 분석은 미구현 (tracking-todo 참조)

## 자동 호출 방지

- **설계 결정**: Split은 자동 호출하지 않음
- **이유**: LLM API 호출 비용이 발생하므로 사용자 명시적 요청 필요

## 비용/예산 가드 (`packages/core/src/llm/pricing.ts`)

- `estimateCost()`: 모델별 가격표(`MODEL_PRICING_TABLE`)로 USD 비용 산출
- `checkBudget()`: 서버 예산 상한(`ANKI_SPLITTER_BUDGET_CAP_USD`, 기본 $1.0)과 클라이언트 예산을 비교, `allowed: boolean` 반환
- `getModelPricing()`: provider/model 조합의 정적 가격 조회 (수동 업데이트 필요)
- 미등록 모델 + `budgetUsdCap` 지정 시 400 에러 반환 (예산 가드레일 우회 방지)

## 응답 검증 (`packages/core/src/gemini/validator.ts`)

zod 스키마 기반:
- `SplitResponseSchema`: originalNoteId (string|number), shouldSplit, mainCardIndex, splitCards[], splitReason, qualityChecks
- `SplitCardSchema`: title, content, cardType?, charCount?, contextTag?, inheritImages[], inheritTags[], preservedLinks[], backLinks[]
- 추가 검증: shouldSplit=true이면 splitCards 비어있으면 안 됨, mainCardIndex 범위 체크

## 프롬프트 버전 선택

- SplitWorkspace 헤더에서 프롬프트 버전 선택 가능
- 선택된 버전의 시스템 프롬프트로 LLM 분석 요청
- `managing-prompts` 스킬 참조
