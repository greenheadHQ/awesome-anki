---
name: validating-cards
description: |
  This skill should be used when the user asks about "팩트 체크 결과가",
  "유사한 카드 찾아줘", "문맥 검증", "검증 캐시", "최신성 검사",
  "중복 카드", "검증 상태 아이콘".
  Covers the 4 validation types: fact-check, freshness, similarity, context.
---

# 카드 검증

## 검증 4종 개요

| 검증 | 파일 | API | 방식 |
|------|------|-----|------|
| 팩트 체크 | `fact-checker.ts` | POST /api/validate/fact-check | Gemini 기반 |
| 최신성 | `freshness-checker.ts` | POST /api/validate/freshness | Gemini 기반 |
| 유사성 | `similarity-checker.ts` | POST /api/validate/similarity | Jaccard 또는 임베딩 |
| 문맥 일관성 | `context-checker.ts` | POST /api/validate/context | Gemini 기반 (nid 링크 그룹) |

**전체 검증**: POST /api/validate/all — 4종 병렬 실행

## 유사성 검사: Jaccard vs 임베딩

| 비교 | Jaccard | 임베딩 |
|------|---------|--------|
| 방식 | 단어 집합 + 2-gram | Gemini 의미 벡터 |
| 속도 | 빠름 (로컬) | 느림 (API) |
| 정확도 | 표면적 유사도 | 의미적 유사도 |
| 기본 threshold | 70% | 85% |

`useEmbedding: true` 옵션으로 임베딩 모드 활성화 — `managing-embeddings` 스킬 참조

## 문맥 일관성 검사

- nid 링크로 연결된 카드 그룹 분석
- 역방향 링크 검색 (다른 카드가 이 카드를 참조하는 경우)
- Gemini 기반 논리적 연결 확인

## 검증 캐싱

- **저장소**: localStorage + `useSyncExternalStore`
- **TTL**: 24시간
- **전역 상태 공유**: 각 컴포넌트에서 별도 React 상태 생성하면 동기화 안 됨 → `useSyncExternalStore` 필수

```typescript
// 전역 캐시 상태
let globalCache: ValidationCache = loadCacheFromStorage();
const listeners = new Set<() => void>();

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);
  // ...
}
```

## CardBrowser 검증 상태

- 검증 결과 아이콘: ✅ (통과) / ⚠️ (경고) / ❌ (실패) / ❓ (미검증)
- 필터 옵션: 전체, 분할 가능, 미검증, 검토 필요

## 자주 발생하는 문제

- **캐시 미동기화**: `useValidationCache`를 `useSyncExternalStore`로 구현해야 컴포넌트 간 공유 가능
- **검증 결과 미반영**: 검증 성공 후 CardBrowser 상태가 안 바뀌면 전역 캐시 확인

## 상세 참조

- `references/validators.md` — 4종 검증기 상세 (요청/응답 형식)
- `references/caching.md` — localStorage + useSyncExternalStore 패턴
- `references/troubleshooting.md` — Phase 5-6 검증 이슈
