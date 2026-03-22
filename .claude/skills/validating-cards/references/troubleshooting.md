# 검증 트러블슈팅

## useValidationCache 상태 공유 문제

- **문제**: `useValidateCard` 훅에서 검증 성공 후 CardBrowser 상태 미갱신
- **원인**: 각 컴포넌트에서 별도 React 상태 생성
- **해결**: `useSyncExternalStore`로 전역 상태 공유 (caching.md 참조)

## 임베딩 유사도 → Jaccard 폴백

- **상황**: `useEmbedding: true`로 유사성 검사를 요청했지만 임베딩 생성 실패
- **원인**: OPENAI_API_KEY 미설정, rate limit, 네트워크 장애 등
- **동작**: `similarity-checker.ts`에서 `getEmbedding()` 실패 시 자동으로 `checkSimilarityWithJaccard()`로 폴백. 콘솔에 `임베딩 생성 실패, Jaccard로 폴백` 경고 출력.
- **참고**: 개별 카드 임베딩 실패 시에는 해당 카드만 스킵하고 나머지는 임베딩으로 비교 계속

## validate/all에서 유사성이 항상 Jaccard인 이유

- **상황**: `/api/clinic/all` 응답의 `similarity.details.method`가 항상 `"jaccard"`
- **원인**: 서버 라우트(`clinic.ts`)에서 `checkSimilarity({ noteId, text }, allCards)`를 옵션 없이 호출하므로 `useEmbedding` 기본값 `false`가 적용됨
- **의도된 동작**: 전체 검증은 속도 우선이므로 Jaccard만 사용. 임베딩 유사도가 필요하면 `/api/clinic/similarity`를 `useEmbedding: true`로 개별 호출해야 한다.

## 분할 미리보기 렌더링 문제

- **문제**: SplitWorkspace 분할 미리보기에서 Raw HTML로만 표시, KaTeX/Markdown 렌더링 안 됨
- **해결**: `SplitPreviewCard` 컴포넌트에 `ContentRenderer` 적용 + Raw/Rendered 토글 추가
