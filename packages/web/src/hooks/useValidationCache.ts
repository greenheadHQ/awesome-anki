/**
 * 검증 결과 캐싱 훅
 * localStorage를 사용하여 검증 결과를 캐시
 */

import { useMutation } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import {
  type AllValidationResult,
  api,
  type ValidationStatus,
} from "../lib/api";

const CACHE_KEY = "anki-validation-cache";
const CACHE_VERSION = 1;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

interface CachedValidation {
  noteId: number;
  status: ValidationStatus;
  validatedAt: string;
  results?: AllValidationResult["results"];
}

interface ValidationCache {
  version: number;
  entries: Record<number, CachedValidation>;
}

// 전역 캐시 상태 (모든 컴포넌트에서 공유)
let globalCache: ValidationCache = loadCacheFromStorage();
const listeners = new Set<() => void>();

function loadCacheFromStorage(): ValidationCache {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ValidationCache;
      if (parsed.version === CACHE_VERSION) {
        // 만료된 항목 제거
        const now = Date.now();
        const entries: Record<number, CachedValidation> = {};
        for (const [key, value] of Object.entries(parsed.entries)) {
          const validatedAt = new Date(value.validatedAt).getTime();
          if (now - validatedAt < CACHE_TTL) {
            entries[Number(key)] = value;
          }
        }
        return { version: CACHE_VERSION, entries };
      }
    }
  } catch (e) {
    console.error("캐시 로드 실패:", e);
  }
  return { version: CACHE_VERSION, entries: {} };
}

function saveCacheToStorage(cache: ValidationCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("캐시 저장 실패:", e);
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return globalCache;
}

function updateGlobalCache(
  updater: (prev: ValidationCache) => ValidationCache,
) {
  globalCache = updater(globalCache);
  saveCacheToStorage(globalCache);
  for (const listener of listeners) {
    listener();
  }
}

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);

  // 검증 결과 가져오기
  const getValidation = useCallback(
    (noteId: number): CachedValidation | null => {
      return cache.entries[noteId] || null;
    },
    [cache],
  );

  // 검증 결과 저장
  const setValidation = useCallback(
    (noteId: number, result: AllValidationResult) => {
      updateGlobalCache((prev) => ({
        ...prev,
        entries: {
          ...prev.entries,
          [noteId]: {
            noteId,
            status: result.overallStatus,
            validatedAt: result.validatedAt,
            results: result.results,
          },
        },
      }));
    },
    [],
  );

  // 검증 결과 삭제
  const clearValidation = useCallback((noteId: number) => {
    updateGlobalCache((prev) => {
      const { [noteId]: _, ...rest } = prev.entries;
      return { ...prev, entries: rest };
    });
  }, []);

  // 전체 캐시 삭제
  const clearAllValidations = useCallback(() => {
    updateGlobalCache(() => ({ version: CACHE_VERSION, entries: {} }));
  }, []);

  // 여러 카드의 검증 상태 가져오기
  const getValidationStatuses = useCallback(
    (noteIds: number[]): Map<number, ValidationStatus | null> => {
      const result = new Map<number, ValidationStatus | null>();
      for (const noteId of noteIds) {
        const cached = cache.entries[noteId];
        result.set(noteId, cached?.status || null);
      }
      return result;
    },
    [cache],
  );

  // 검증되지 않은 카드 수
  const uncachedCount = useCallback(
    (noteIds: number[]): number => {
      return noteIds.filter((id) => !cache.entries[id]).length;
    },
    [cache],
  );

  return {
    getValidation,
    setValidation,
    clearValidation,
    clearAllValidations,
    getValidationStatuses,
    uncachedCount,
    cacheSize: Object.keys(cache.entries).length,
  };
}

/**
 * 단일 카드 검증 mutation 훅
 */
export function useValidateCard(deckName: string | null) {
  const { setValidation } = useValidationCache();

  return useMutation({
    mutationFn: async (noteId: number) => {
      if (!deckName) throw new Error("덱이 선택되지 않았습니다.");
      return api.validate.all(noteId, deckName);
    },
    onSuccess: (data) => {
      setValidation(data.noteId, data);
    },
  });
}

/**
 * 여러 카드 일괄 검증 mutation 훅
 */
export function useBatchValidate(deckName: string | null) {
  const { setValidation } = useValidationCache();

  return useMutation({
    mutationFn: async (noteIds: number[]) => {
      if (!deckName) throw new Error("덱이 선택되지 않았습니다.");

      // 순차적으로 검증 (API 부하 방지)
      const results: AllValidationResult[] = [];
      for (const noteId of noteIds) {
        const result = await api.validate.all(noteId, deckName);
        results.push(result);
        setValidation(noteId, result);
      }
      return results;
    },
  });
}
