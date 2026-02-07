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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return globalCache;
}

function updateCache(noteId: number, result: ValidationResult) {
  globalCache = { ...globalCache, [noteId]: { result, timestamp: Date.now() } };
  saveCacheToStorage(globalCache);
  listeners.forEach(l => l()); // 모든 구독자에게 알림
}

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);
  return { cache, updateCache };
}
```

### 핵심 포인트

- `useSyncExternalStore`는 React 외부 상태를 구독하여 모든 컴포넌트에서 동일한 상태 공유
- localStorage 저장/로드로 페이지 새로고침 시에도 캐시 유지
- `listeners` Set으로 상태 변경 시 모든 구독 컴포넌트 리렌더링
