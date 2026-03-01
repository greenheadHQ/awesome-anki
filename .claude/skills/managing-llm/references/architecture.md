# LLM 모듈 아키텍처

## 파일별 역할 및 의존 관계

```
index.ts (barrel export)
  ├── types.ts          (의존 없음 — 순수 타입)
  ├── pricing.ts        (depends on: types.ts)
  ├── gemini.ts         (depends on: types.ts, pricing.ts, @google/genai)
  ├── openai.ts         (depends on: types.ts, pricing.ts, openai)
  └── factory.ts        (depends on: types.ts, gemini.ts, openai.ts)
```

### types.ts

순수 타입 정의. 외부 의존성 없음.

- `LLMProviderName` — `"gemini" | "openai"` union 타입
- `LLMModelId` — `{ provider, model }` 조합
- `TokenUsage` — `{ promptTokens?, completionTokens?, totalTokens? }`
- `CostEstimate` — 사전 추정 비용 (`estimatedInputCostUsd`, `estimatedOutputCostUsd`, `estimatedTotalCostUsd`)
- `ActualCost` — 실제 비용 (`inputCostUsd`, `outputCostUsd`, `totalCostUsd`)
- `LLMGenerationResult` — `{ text, tokenUsage, modelId, actualCost? }`
- `LLMGenerationOptions` — `{ systemPrompt?, responseMimeType?, maxOutputTokens?, model? }`
- `LLMProvider` — 어댑터 공통 인터페이스 (`name`, `generateContent`, `countTokens`)

### pricing.ts

가격표 + 비용 계산 + 예산 가드. `types.ts`만 의존.

- `MODEL_PRICING_TABLE` — 정적 배열, 수동 업데이트 필요
- `getModelPricing()` — provider + model로 가격 조회
- `estimateCost()` / `computeCost()` — 비용 계산 (사전/사후)
- `checkBudget()` — 서버 캡 + 클라이언트 캡 이중 가드

### gemini.ts

Gemini 어댑터. `@google/genai` SDK 사용.

- `GeminiAdapter` — `LLMProvider` 구현
- `getClient()` — lazy 싱글톤 (모듈 스코프 `genAI` 변수)
- `isGeminiAvailable()` — `GEMINI_API_KEY` 존재 여부 체크
- `DEFAULT_GEMINI_MODEL` — `"gemini-3-flash-preview"`

### openai.ts

OpenAI 어댑터. `openai` SDK dynamic import.

- `OpenAIAdapter` — `LLMProvider` 구현
- `getClient()` — async lazy 싱글톤 (dynamic import로 번들 최적화)
- `normalizeResponseText()` — markdown code fence 제거 + refusal 체크
- JSON 모드 재시도 로직: 파싱 실패 시 temperature=0.1로 1회 재시도, 토큰 누적
- `countTokens()` — 휴리스틱 (한국어 보정 x1.5, safety x1.3)
- `isOpenAIAvailable()` — `OPENAI_API_KEY` 존재 여부 체크
- `DEFAULT_OPENAI_MODEL` — `"gpt-5-mini"`

### factory.ts

팩토리 + 기본 모델 결정.

- `createLLMClient(provider)` — 어댑터 생성 + `adapterCache`로 싱글톤 캐싱
- `isValidProvider(s)` — 타입 가드
- `getDefaultModelId()` — 환경변수 기반 기본 모델 결정 + graceful fallback
- `getDefaultModelForProvider(provider)` — provider별 기본 모델 반환
- `getAvailableProviders()` — API 키가 설정된 provider 목록

## 새 프로바이더 추가 가이드

1. **타입 확장** (`types.ts`):
   - `LLMProviderName`에 새 리터럴 추가 (e.g., `"anthropic"`)

2. **어댑터 작성** (e.g., `anthropic.ts`):
   - `LLMProvider` 인터페이스 구현 (`name`, `generateContent`, `countTokens`)
   - `DEFAULT_*_MODEL` 상수 export
   - `is*Available()` 함수 export (API 키 존재 체크)
   - lazy 싱글톤 패턴으로 클라이언트 초기화

3. **가격표 등록** (`pricing.ts`):
   - `MODEL_PRICING_TABLE`에 새 모델 항목 추가
   - `verifiedAt` 날짜 기록

4. **팩토리 등록** (`factory.ts`):
   - `createLLMClient()` switch에 case 추가
   - `isValidProvider()` 조건 추가
   - `getDefaultModelForProvider()` case 추가
   - `getAvailableProviders()`에 가용성 체크 추가

5. **barrel export** (`index.ts`):
   - 새 어댑터 export 추가

6. **프론트엔드** (`packages/web/src/components/ui/model-badge.tsx`):
   - `PROVIDER_STYLES`에 새 provider 스타일 추가 (label, bg, text, ring)
