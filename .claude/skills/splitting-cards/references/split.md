# Split 상세

## 트리거 조건

- Cloze 개수 > 3개 (4개 이상)

## 처리 흐름

1. SplitWorkspace에서 "분석 요청" 버튼 클릭
2. `POST /api/split/preview` 호출 (클라이언트에서 `provider`/`model` 지정 가능)
3. 선택된 LLM 모델에 분할 제안 요청 (기본: gemini-3-flash-preview)
4. 결과를 미리보기로 표시 (토큰 사용량 + 비용 정보 포함)
5. 사용자 확인 후 `POST /api/split/apply`로 적용

## 제한사항

- 현재 **5개 후보만 분석** (API 비용 고려)
- 전체 후보 분석은 미구현 (tracking-todo 참조)

## 자동 호출 방지

- **설계 결정**: Split은 자동 호출하지 않음
- **이유**: LLM API 호출 비용이 발생하므로 사용자 명시적 요청 필요

## 비용/예산 가드

- `estimateSplitCost()`: 분할 전 예상 비용 계산 (입력 토큰 + 예상 출력 토큰 기반)
- `estimateCost()`: 모델별 가격표(`MODEL_PRICING_TABLE`)로 USD 비용 산출
- `checkBudget()`: 서버 예산 상한(`ANKI_SPLITTER_BUDGET_CAP_USD`, 기본 $1.0)과 클라이언트 예산을 비교, `allowed: boolean` 반환
- `getModelPricing()`: provider/model 조합의 정적 가격 조회 (수동 업데이트 필요)
- 비용 관련 소스: `packages/core/src/llm/pricing.ts`

## 프롬프트 버전 선택

- SplitWorkspace 헤더에서 프롬프트 버전 선택 가능
- 선택된 버전의 시스템 프롬프트로 LLM 분석 요청
- `managing-prompts` 스킬 참조
