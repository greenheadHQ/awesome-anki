---
name: validating-cards
description: |
  USE THIS SKILL for card content validation — fact-checking, freshness, similarity,
  context consistency, or anything about duplicate detection and card quality.
  Triggers: "팩트 체크 결과가", "유사한 카드 찾아줘", "문맥 검증",
  "검증 캐시", "최신성 검사", "중복 카드", "검증 상태 아이콘",
  "validate/all", "Jaccard", "임베딩 유사도", "중복 판정",
  "useValidateCard", "useBatchValidate", "검증 4종", "일괄 검증",
  "context-checker", "fact-checker", "freshness-checker", "similarity-checker",
  "findSimilarGroups", "analyzeCardGroup", "검증 폴백".
  Covers the 4 validation types: fact-check, freshness, similarity, context.
---

# 카드 검증

## 검증 4종 개요

| 검증 | 파일 | API | 방식 |
|------|------|-----|------|
| 팩트 체크 | `fact-checker.ts` | POST /api/clinic/fact-check | LLM 기반 (Gemini/OpenAI) |
| 최신성 | `freshness-checker.ts` | POST /api/clinic/freshness | LLM 기반 (Gemini/OpenAI) |
| 유사성 | `similarity-checker.ts` | POST /api/clinic/similarity | Jaccard 또는 임베딩 |
| 문맥 일관성 | `context-checker.ts` | POST /api/clinic/context | LLM 기반 (Gemini/OpenAI, nid 링크 그룹) |

**전체 검증**: POST /api/clinic/all — 4종 병렬 실행

**모델 선택 (LLM 기반 검증만 해당)**: 팩트 체크, 최신성, 문맥 일관성 API에 `provider`/`model` 파라미터 지정 가능 (미지정 시 서버 기본값, `resolveModelId()` 참조). 유사성 검사는 LLM을 사용하지 않으므로 `provider`/`model` 파라미터가 없다.

## 유사성 검사: Jaccard vs 임베딩

| 비교 | Jaccard | 임베딩 |
|------|---------|--------|
| 방식 | 단어 집합 + 2-gram | OpenAI 의미 벡터 (text-embedding-3-large, 3072차원) |
| 속도 | 빠름 (로컬) | 느림 (API 호출) |
| 정확도 | 표면적 유사도 | 의미적 유사도 |
| 기본 threshold | 70% | 85% |
| 중복 판정 임계값 | 90% 이상 | 95% 이상 |

- `useEmbedding: true` 옵션으로 임베딩 모드 활성화 — `managing-embeddings` 스킬 참조
- 임베딩 실패 시 자동으로 Jaccard 폴백 (에러 로그 출력 후 Jaccard로 재시도)
- **validate/all은 항상 Jaccard만 사용** (기본값 `useEmbedding: false`로 호출)
- 임베딩 모드는 `/api/clinic/similarity`에서 명시적으로 `useEmbedding: true` 요청할 때만 활성화

### 덱 전체 유사 카드 그룹 탐지

```typescript
// Jaccard 기반 그룹 탐지 (임베딩 미사용)
const groups = await findSimilarGroups(cards, { threshold: 70 });
// Map<number, number[]> — noteId → 유사한 noteId 배열
```

## 문맥 일관성 검사

- nid 링크로 연결된 카드 그룹 분석
- 역방향 링크 검색 (다른 카드가 이 카드를 참조하는 경우)
- LLM 기반 논리적 연결 확인 (Gemini/OpenAI)
- `analyzeCardGroup(cards, options)` — 카드 그룹 전체의 일관성 분석 (각 카드별 checkContext 순차 실행, 전체 일관성 점수 합산)

## 프론트엔드 훅 (packages/web/src/hooks/useValidationCache.ts)

```typescript
// 단일 카드 검증 (TanStack Query mutation)
const { mutate } = useValidateCard(deckName);
mutate(noteId);  // → api.validate.all(noteId, deckName) 호출

// 여러 카드 일괄 검증 (순차 실행, API 부하 방지)
const { mutate: batchMutate } = useBatchValidate(deckName);
batchMutate(noteIds);

// 검증 캐시 직접 접근
const { getValidation, setValidation, clearValidation, clearAllValidations,
        getValidationStatuses, uncachedCount, cacheSize } = useValidationCache();
```

## 검증 캐싱

- **저장소**: localStorage + `useSyncExternalStore`
- **TTL**: 24시간
- **전역 상태 공유**: 각 컴포넌트에서 별도 React 상태 생성하면 동기화 안 됨 → `useSyncExternalStore` 필수

```typescript
// 전역 캐시 상태 (React 외부)
let globalCache: ValidationCache = loadCacheFromStorage();
const listeners = new Set<() => void>();

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);
  // ...
}
```

## CardBrowser 검증 상태

- 검증 결과 아이콘: (통과) / (경고) / (실패) / (미검증)
- 필터 옵션: 전체, 분할 가능, 미검증, 검토 필요

## 자주 발생하는 문제

- **캐시 미동기화**: `useValidationCache`를 `useSyncExternalStore`로 구현해야 컴포넌트 간 공유 가능
- **검증 결과 미반영**: 검증 성공 후 CardBrowser 상태가 안 바뀌면 전역 캐시 확인
- **임베딩 폴백**: OPENAI_API_KEY 미설정이나 API 장애 시 임베딩 모드가 Jaccard로 자동 폴백
- **validate/all은 Jaccard 전용**: validate/all에서 유사성 검사 시 `useEmbedding` 옵션을 전달하지 않으므로 항상 Jaccard 사용

## 상세 참조

- `references/validators.md` — 4종 검증기 상세 (요청/응답 형식)
- `references/caching.md` — localStorage + useSyncExternalStore 패턴
- `references/troubleshooting.md` — 검증 관련 이슈
