# LLM 가격 및 예산 시스템

## MODEL_PRICING_TABLE

`packages/core/src/llm/pricing.ts`에 정적 배열로 정의. 공식 문서 기반, 수동 업데이트.

```typescript
interface ModelPricing {
  provider: LLMProviderName;
  model: string;
  displayName: string;
  inputPricePerMillionTokens: number;   // $ per 1M input tokens
  outputPricePerMillionTokens: number;  // $ per 1M output tokens
  verifiedAt: string;                   // 가격 확인 날짜
}
```

### 현재 등록 모델 (2026-03-02 기준)

| provider | model | displayName | input $/1M | output $/1M | verifiedAt |
|----------|-------|-------------|------------|-------------|------------|
| gemini | `gemini-3-flash-preview` | Gemini 3 Flash Preview | $0.15 | $0.60 | 2025-05-01 |
| openai | `gpt-5-mini` | GPT-5 Mini | $0.25 | $2.00 | 2026-03-01 |

## 비용 계산 로직

### 내부 공통 함수

```text
calculateCost(inputTokens, outputTokens, pricing):
  inputCostUsd  = (inputTokens / 1,000,000) * pricing.inputPricePerMillionTokens
  outputCostUsd = (outputTokens / 1,000,000) * pricing.outputPricePerMillionTokens
  totalCostUsd  = inputCostUsd + outputCostUsd
```

### estimateCost (사전 추정)

- 입력: `inputTokens`, `outputTokens`, `pricing`
- 출력: `CostEstimate { estimatedInputCostUsd, estimatedOutputCostUsd, estimatedTotalCostUsd }`
- 용도: Split 실행 전 비용 예측, 예산 가드 입력값

### computeCost (실제 비용)

- 입력: `TokenUsage { promptTokens?, completionTokens? }`, `pricing`
- 출력: `ActualCost { inputCostUsd, outputCostUsd, totalCostUsd }`
- 용도: LLM 응답 후 실제 비용 계산, 결과에 첨부

### getModelPricing

- `MODEL_PRICING_TABLE.find(p => p.provider === provider && p.model === model)`
- 미등록 모델: `undefined` 반환 -> 비용 계산 생략 (actualCost 없음)

## 예산 가드 로직

### 서버 사이드 예산 캡

```text
getServerBudgetCapUsd():
  1. ANKI_SPLITTER_BUDGET_CAP_USD 환경변수 파싱
  2. 유효하지 않으면 (NaN, <= 0) 기본값 $1.0
```

### 이중 가드 (checkBudget)

```text
checkBudget(estimatedCostUsd, clientBudgetCapUsd?):
  serverCap = getServerBudgetCapUsd()
  effectiveCap = clientBudgetCapUsd가 유효하면 min(clientCap, serverCap), 아니면 serverCap
  allowed = estimatedCostUsd <= effectiveCap
  return { allowed, estimatedCostUsd, budgetCapUsd: effectiveCap }
```

- 서버 캡이 항상 상한 (클라이언트가 서버 캡보다 높게 설정 불가)
- 클라이언트 캡은 서버 캡 이하에서만 유효

## 프론트엔드 비용 표시

`formatCostUsd(usd)` (`packages/web/src/components/ui/model-badge.tsx`):

| 조건 | 포맷 | 예시 |
|------|------|------|
| `< $0.001` | 소수점 6자리 | `$0.000123` |
| `< $0.01` | 소수점 4자리 | `$0.0023` |
| 그 외 | 소수점 2자리 | `$0.15` |
