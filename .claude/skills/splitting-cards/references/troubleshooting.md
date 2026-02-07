# 분할 트러블슈팅

## 컨테이너 파서 설계 시행착오

- **시도**: 정규식으로 `::: toggle` 파싱
- **문제**: 중첩된 컨테이너에서 닫는 `:::` 매칭 실패
- **해결**: 스택 기반 상태 머신 (depth 추적)

## Hard Split 기준 수정

- **이전**: `---` 또는 `####` 헤더 → `canHardSplit: true`
- **문제**: `---` 구분선이 분할 가능으로 잘못 감지. 사용자가 분할 용도로 사용하지 않음
- **수정**: `####` 헤더 **2개 이상**일 때만 `canHardSplit: true`. `---` 완전 제외
- **참고**: Hard Split은 거의 사용되지 않을 것으로 예상. Soft Split (Gemini) 위주 사용 권장

## canSoftSplit 필드 누락 문제

- **문제**: `analyzeForSplit` 함수에서 `canSoftSplit` 필드 미반환 → 클라이언트 필터링 실패
- **증상**: 대시보드에서 Soft Split 168개인데, SplitWorkspace에서 안 보임
- **해결**: `SplitAnalysis` 인터페이스에 `canSoftSplit` 필드 추가
  ```typescript
  const canSoftSplit = !canHardSplit && clozes.length > 3;
  ```
- **참고**: Hard/Soft Split은 상호 배타적

## Soft Split 자동 Gemini 호출 문제

- **문제**: 카드 선택 시 자동으로 Gemini API 호출, 사용자 모르게 비용 발생
- **원인**: `useSplit.ts`에서 `splitType: 'soft'` (non-empty string = truthy) → `useGemini: true`
- **해결**: `useGemini` 파라미터를 반드시 explicit boolean으로 전달
- **결과**: Hard Split만 자동 미리보기, Soft Split은 "Gemini 분석 요청" 버튼 클릭 시에만

## SplitWorkspace 상태 관리 개선

- **문제**: 페이지 이탈/복귀 시 분석 결과 초기화, 카드 전환 시 이전 결과 잔류
- **원인**: `useMutation`이 React Query 캐시를 활용하지 않음
- **해결**:
  1. `onSuccess` 콜백으로 `queryClient.setQueryData`에 캐시 저장
  2. 캐시된 미리보기 우선 조회: `getCachedSplitPreview()`
  3. 카드 선택 시 mutation 리셋 + 캐시 확인
- **결과**: 카드별 독립 캐시, 페이지 복귀 시 즉시 표시, "캐시된 결과" 배지

## 원본 카드 텍스트 말줄임

- **문제**: SplitWorkspace에서 원본 텍스트가 `...`으로 잘림
- **원인**: `GET /api/cards/deck/:name`에서 텍스트를 200자로 제한 (성능)
- **해결**: 카드 선택 시 `useCardDetail` 훅으로 상세 API 호출하여 전체 텍스트 획득

## 페이지네이션 제한

- **문제**: SplitWorkspace에서 `limit: 100`으로 전체 카드 미반환
- **해결**: `limit: 500`으로 증가
