# Soft Split 상세

## 트리거 조건

- Hard Split 불가 (`canHardSplit: false`)
- Cloze 개수 > 3개
- 구분자 없이 정보 밀도 높은 카드

## 처리 흐름

1. SplitWorkspace에서 "Gemini 분석 요청" 버튼 클릭
2. `POST /api/split/preview` 호출 (`useGemini: true`)
3. Gemini 3 Flash Preview에 분할 제안 요청
4. 결과를 미리보기로 표시
5. 사용자 확인 후 `POST /api/split/apply`로 적용

## 제한사항

- 현재 **5개 후보만 분석** (API 비용 고려)
- 전체 후보 분석은 미구현 (tracking-todo 참조)

## 자동 호출 방지

- **설계 결정**: Soft Split은 자동 호출하지 않음
- **이유**: Gemini API 호출 비용이 발생하므로 사용자 명시적 요청 필요
- **구현**: `useSplit.ts`에서 `useGemini` 파라미터를 반드시 `boolean`으로 전달

```typescript
// ❌ 문제: non-empty string은 truthy
useSplit({ noteId, useGemini: splitType });  // 항상 true

// ✅ 해결: 명시적 boolean
useSplit({ noteId, useGemini: false });
```

## 프롬프트 버전 선택

- SplitWorkspace 헤더에서 프롬프트 버전 선택 가능
- 선택된 버전의 시스템 프롬프트로 Gemini 분석 요청
- `managing-prompts` 스킬 참조
