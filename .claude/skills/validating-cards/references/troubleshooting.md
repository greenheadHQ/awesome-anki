# 검증 트러블슈팅

## useValidationCache 상태 공유 문제

- **문제**: `useValidateCard` 훅에서 검증 성공 후 CardBrowser 상태 미갱신
- **원인**: 각 컴포넌트에서 별도 React 상태 생성
- **해결**: `useSyncExternalStore`로 전역 상태 공유 (caching.md 참조)

## 분할 미리보기 렌더링 문제

- **문제**: SplitWorkspace 분할 미리보기에서 Raw HTML로만 표시, KaTeX/Markdown 렌더링 안 됨
- **해결**: `SplitPreviewCard` 컴포넌트에 `ContentRenderer` 적용 + Raw/Rendered 토글 추가
