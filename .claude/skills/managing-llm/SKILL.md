---
description: |
  This skill should be used when users request LLM provider management.
  Triggers: "LLM 모델 변경", "프로바이더 추가", "비용 추정", "예산 가드",
  "pricing table", "모델 비교", "LLM 비용", "토큰 사용량",
  "모델 추가", "LLM 설정".
  Covers LLM abstraction layer, provider adapters, pricing, and budget guard.
---

# LLM 프로바이더 관리

## 모듈 구조

`packages/core/src/llm/` 디렉토리 (6 파일):

| 파일 | 역할 |
|------|------|
| `types.ts` | 공유 타입 정의 (`LLMProvider`, `LLMModelId`, `TokenUsage`, `CostEstimate`, `ActualCost`) |
| `factory.ts` | 팩토리 함수 (`createLLMClient`), 기본 모델 결정, 가용 프로바이더 탐색 |
| `gemini.ts` | Gemini 어댑터 (`GeminiAdapter`) - `@google/genai` SDK 사용 |
| `openai.ts` | OpenAI 어댑터 (`OpenAIAdapter`) - Responses API + JSON 안정성 보호 |
| `pricing.ts` | 가격표 (`MODEL_PRICING_TABLE`), 비용 계산, 예산 가드레일 |
| `index.ts` | Barrel export |

## LLMProvider 인터페이스

`types.ts`에서 정의. 모든 어댑터가 구현하는 공통 인터페이스:

```typescript
interface LLMProvider {
  readonly name: LLMProviderName;  // "gemini" | "openai"
  generateContent(prompt: string, options: LLMGenerationOptions): Promise<LLMGenerationResult>;
  countTokens(text: string, model?: string): Promise<number>;
}
```

- `LLMGenerationOptions`: `systemPrompt`, `responseMimeType`, `maxOutputTokens`, `model`
- `LLMGenerationResult`: `text`, `tokenUsage`, `modelId`, `actualCost?`
- `LLMModelId`: `{ provider: LLMProviderName, model: string }`

## Factory 패턴

`factory.ts`의 `createLLMClient(provider)`:
- `adapterCache` (Map)로 어댑터 싱글톤 캐싱
- `"gemini"` -> `GeminiAdapter`, `"openai"` -> `OpenAIAdapter`
- 지원하지 않는 provider -> `Error` throw

기본 모델 결정 (`getDefaultModelId()`):
1. `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER` 환경변수 확인
2. 해당 provider가 미가용이면 가용 provider로 graceful fallback
3. `ANKI_SPLITTER_DEFAULT_LLM_MODEL` 환경변수 또는 provider별 기본 모델

가용 프로바이더 확인 (`getAvailableProviders()`):
- `GEMINI_API_KEY` 설정 여부 -> gemini
- `OPENAI_API_KEY` 설정 여부 -> openai

## Adapter 패턴

### GeminiAdapter (`gemini.ts`)

- SDK: `@google/genai` (`GoogleGenAI`)
- 클라이언트: lazy 싱글톤 (`genAI` 변수)
- 기본 모델: `gemini-3-flash-preview`
- `countTokens`: SDK 네이티브 `client.models.countTokens()` 사용
- 토큰 사용량: `response.usageMetadata`에서 추출

### OpenAIAdapter (`openai.ts`)

- SDK: `openai` (dynamic import)
- API: Responses API (`client.responses.create()`)
- 기본 모델: `gpt-5-mini`
- JSON 모드: `text.format.type = "json_object"` + markdown code fence 제거
- JSON 파싱 실패 시 temperature 0.1로 1회 재시도 (토큰 누적 합산)
- refusal 체크: `content.type === "refusal"` 감지 시 에러 throw
- `countTokens`: 휴리스틱 추정 (한국어 보정 x1.5, safety x1.3)

## 가격 시스템 (`pricing.ts`)

### MODEL_PRICING_TABLE

정적 가격표 (공식 문서 기반, 수동 업데이트):

| provider | model | displayName | input $/1M tokens | output $/1M tokens | verifiedAt |
|----------|-------|-------------|-------|--------|------------|
| gemini | gemini-3-flash-preview | Gemini 3 Flash Preview | $0.15 | $0.60 | 2025-05-01 |
| openai | gpt-5-mini | GPT-5 Mini | $0.25 | $2.00 | 2026-03-01 |

### 비용 계산

- `estimateCost(inputTokens, outputTokens, pricing)` -> `CostEstimate` (사전 추정)
- `computeCost(tokenUsage, pricing)` -> `ActualCost` (실제 사용량 기반)
- 내부 공통: `calculateCost()` - `(tokens / 1_000_000) * pricePerMillionTokens`

### 예산 가드

`checkBudget(estimatedCostUsd, clientBudgetCapUsd?)`:
- 서버 캡: `ANKI_SPLITTER_BUDGET_CAP_USD` 환경변수 (기본 $1.0)
- 클라이언트 캡이 있으면 `Math.min(clientCap, serverCap)` 적용
- 반환: `{ allowed: boolean, estimatedCostUsd, budgetCapUsd }`

## API 엔드포인트

### `GET /api/llm/models` (`packages/server/src/routes/llm.ts`)

응답:
```json
{
  "models": [{ "provider", "model", "displayName", "inputPricePerMillionTokens", "outputPricePerMillionTokens" }],
  "defaultModelId": { "provider", "model" },
  "budgetCapUsd": 1.0,
  "availableProviders": ["gemini", "openai"]
}
```

- API 키가 설정된 provider의 모델만 반환
- 기본 모델이 가용 목록에 없으면 첫 번째 가용 모델로 대체

## 프론트엔드 컴포넌트

### ModelBadge (`packages/web/src/components/ui/model-badge.tsx`)

- provider별 스타일: gemini(파란색, "G"), openai(에메랴드, "O"), fallback("?")
- props: `provider`, `model?`, `className?`
- 사용처: `SplitWorkspace.tsx`, `SplitHistory.tsx`

### formatCostUsd (`model-badge.tsx`에서 export)

- `< $0.001` -> 소수점 6자리
- `< $0.01` -> 소수점 4자리
- 그 외 -> 소수점 2자리

## 환경변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `GEMINI_API_KEY` | Gemini API 인증 | (필수) |
| `OPENAI_API_KEY` | OpenAI API 인증 | (선택) |
| `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER` | 기본 프로바이더 | `gemini` |
| `ANKI_SPLITTER_DEFAULT_LLM_MODEL` | 기본 모델 | provider별 기본값 |
| `ANKI_SPLITTER_BUDGET_CAP_USD` | 서버 예산 상한 | `1.0` |

## 상세 참조

- `references/architecture.md` -- LLM 모듈 아키텍처 상세, 새 프로바이더 추가 가이드
- `references/pricing.md` -- MODEL_PRICING_TABLE 전체, 비용 계산/예산 가드 로직
- `references/troubleshooting.md` -- API 키 미설정, 예산 초과, 지원되지 않는 모델 시 동작
