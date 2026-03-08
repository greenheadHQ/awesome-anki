# 검증 캐싱 전략

## 저장소

- **위치**: 브라우저 localStorage
- **TTL**: 24시간

## 전역 상태 공유 패턴

### 문제

`useValidationCache()` 훅이 각 컴포넌트에서 별도의 React 상태를 생성하면 동기화 안 됨.
→ ValidationPanel에서 검증 성공해도 CardBrowser의 상태 미갱신.

### 해결: useSyncExternalStore

```typescript
// packages/web/src/hooks/useValidationCache.ts

// 전역 캐시 (React 외부)
let globalCache: ValidationCache = loadCacheFromStorage();
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return globalCache;
}

function updateGlobalCache(updater: (prev: ValidationCache) => ValidationCache) {
  globalCache = updater(globalCache);
  saveCacheToStorage(globalCache);
  for (const listener of listeners) { listener(); }
}

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);
  return {
    getValidation,          // (noteId) => CachedValidation | null
    setValidation,          // (noteId, AllValidationResult) => void
    clearValidation,        // (noteId) => void
    clearAllValidations,    // () => void
    getValidationStatuses,  // (noteIds) => Map<number, ValidationStatus | null>
    uncachedCount,          // (noteIds) => number
    cacheSize,              // number
  };
}

// 단일 카드 검증 mutation (TanStack Query)
export function useValidateCard(deckName: string | null) { ... }

// 일괄 검증 mutation (순차 실행, API 부하 방지)
export function useBatchValidate(deckName: string | null) { ... }
```

### 핵심 포인트

- `useSyncExternalStore`는 React 외부 상태를 구독하여 모든 컴포넌트에서 동일한 상태 공유
- localStorage 저장/로드로 페이지 새로고침 시에도 캐시 유지
- `listeners` Set으로 상태 변경 시 모든 구독 컴포넌트 리렌더링
- `useValidateCard`와 `useBatchValidate`는 TanStack Query `useMutation` 기반 — 검증 성공 시 자동으로 캐시 업데이트
