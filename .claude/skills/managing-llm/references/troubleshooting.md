# LLM 트러블슈팅

## API 키 미설정

### GEMINI_API_KEY 미설정

- **에러**: `"GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요."`
- **발생 시점**: `GeminiAdapter.generateContent()` 또는 `countTokens()` 호출 시 (lazy init)
- **영향**: `isGeminiAvailable()` = `false` -> `getAvailableProviders()`에서 gemini 제외
- **해결**: agenix로 `secrets/*.age` 복호화 확인, `direnv allow` 재실행

### OPENAI_API_KEY 미설정

- **에러**: `"OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요."`
- **발생 시점**: `OpenAIAdapter.generateContent()` 또는 `countTokens()` 호출 시 (lazy init)
- **영향**: `isOpenAIAvailable()` = `false` -> `getAvailableProviders()`에서 openai 제외
- **해결**: `OPENAI_API_KEY`는 선택 사항. 미설정 시 Gemini만 사용

### 양쪽 다 미설정

- `getAvailableProviders()` -> 빈 배열
- `GET /api/llm/models` -> `models: []`, `availableProviders: []`
- 프론트엔드에서 모델 선택 불가

## 예산 초과

### checkBudget에서 거부

- `checkBudget()` 반환: `{ allowed: false, estimatedCostUsd, budgetCapUsd }`
- 호출부에서 거부 처리 필요 (Split 실행 전 사전 체크)
- 서버 캡 확인: `ANKI_SPLITTER_BUDGET_CAP_USD` 환경변수 (기본 $1.0)
- 클라이언트 캡이 서버 캡보다 크면 서버 캡으로 제한됨

### 예산 캡 조정

- 서버 캡 올리기: `ANKI_SPLITTER_BUDGET_CAP_USD=5.0` 등 환경변수 변경
- 유효성: `Number.isFinite(parsed) && parsed > 0` — 음수, NaN, Infinity 모두 기본값 $1.0으로 폴백

## 지원되지 않는 모델

### 프로바이더 레벨

- **에러**: `"지원하지 않는 LLM provider: ${provider}"` (factory.ts)
- **발생 시점**: `createLLMClient()`에 `"gemini"`, `"openai"` 외의 값 전달
- **유사**: `"유효하지 않은 LLM provider: ${rawProvider} (지원: gemini, openai)"` (`getDefaultModelId()`)

### 모델 레벨 (가격 미등록)

- `getModelPricing()` -> `undefined`
- 비용 계산 불가: `actualCost`가 `undefined`로 반환
- LLM 호출 자체는 정상 수행 (가격표에 없어도 API 호출은 가능)
- 프론트엔드에서 비용 표시: `"--"` (null 체크)

## OpenAI JSON 모드 파싱 실패

- 첫 응답의 JSON 파싱 실패 시 temperature 0.1로 1회 재시도
- 재시도 성공: 토큰 사용량은 두 호출 합산
- 재시도 실패: `JSON.parse` 에러가 호출부로 전파
- 원인: markdown code fence 감싸기 -> `normalizeResponseText()`에서 제거 시도

## OpenAI 모델 거부 (refusal)

- **에러**: `"모델 거부: ${content.refusal}"`
- **발생 시점**: `normalizeResponseText()`에서 `content.type === "refusal"` 감지
- **원인**: 모델이 콘텐츠 정책 위반으로 판단한 프롬프트
- **해결**: 프롬프트 내용 검토, 필요 시 `managing-prompts` 스킬 참조

## Graceful Fallback

`getDefaultModelId()` 동작:

1. `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER`가 유효하지 않은 provider -> Error throw
2. 설정된 provider의 API 키가 없으면 -> 다른 가용 provider로 fallback
3. fallback 시 해당 provider의 기본 모델 사용 (env 모델 설정 무시)
