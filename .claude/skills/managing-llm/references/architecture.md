# LLM 모듈 아키텍처

> 파일별 역할과 어댑터 세부 사항은 SKILL.md 참조. 이 문서는 의존 관계 그래프와 새 프로바이더 추가 가이드만 다룹니다.

## 의존 관계 그래프

```
index.ts (barrel export)
  ├── types.ts          (의존 없음 — 순수 타입)
  ├── pricing.ts        (depends on: types.ts)
  ├── gemini.ts         (depends on: types.ts, pricing.ts, @google/genai)
  ├── openai.ts         (depends on: types.ts, pricing.ts, openai)
  └── factory.ts        (depends on: types.ts, gemini.ts, openai.ts)
```

핵심 원칙:
- `types.ts`는 외부 의존성 없음 (순수 타입)
- 각 어댑터는 `types.ts` + `pricing.ts`만 의존
- `factory.ts`가 모든 어댑터를 조합 (유일한 cross-adapter 의존)
- `index.ts`는 barrel export만 수행

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
