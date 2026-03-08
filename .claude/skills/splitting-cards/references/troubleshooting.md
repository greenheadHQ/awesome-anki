# 분할 트러블슈팅

## 컨테이너 파서 설계 시행착오

- **시도**: 정규식으로 `::: toggle` 파싱
- **문제**: 중첩된 컨테이너에서 닫는 `:::` 매칭 실패
- **해결**: 스택 기반 상태 머신 (depth 추적)

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
