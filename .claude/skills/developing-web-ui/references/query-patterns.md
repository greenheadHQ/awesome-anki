# TanStack Query 패턴

## 쿼리 키 관리

```typescript
// packages/web/src/lib/query-keys.ts
export const queryKeys = {
  decks: ["decks"] as const,
  deckStats: (name: string) => ["decks", name, "stats"] as const,

  cards: {
    all: ["cards"] as const,
    byDeck: (deck: string, opts?: { page?: number; filter?: string }) =>
      ["cards", "deck", deck, opts] as const,
    detail: (noteId: number) => ["cards", "detail", noteId] as const,
    difficult: (deck: string, opts?: { page?: number; limit?: number }) =>
      ["cards", "difficult", deck, opts] as const,
  },

  split: {
    preview: (noteId: number, versionId?: string, provider?: string, model?: string) =>
      ["split", "preview", noteId, versionId, provider, model] as const,
  },

  llm: {
    models: ["llm", "models"] as const,
  },

  backups: {
    all: ["backups"] as const,
    detail: (id: string) => ["backups", id] as const,
  },

  prompts: {
    versions: ["prompts", "versions"] as const,
    version: (id: string) => ["prompts", "versions", id] as const,
    active: ["prompts", "active"] as const,
    system: ["prompts", "system"] as const,
    experiments: ["prompts", "experiments"] as const,
    experiment: (id: string) => ["prompts", "experiments", id] as const,
  },

  history: {
    list: (opts?) => ["history", "list", opts] as const,
    detail: (sessionId: string) => ["history", "detail", sessionId] as const,
    syncHealth: ["history", "sync-health"] as const,
  },

  health: ["health"] as const,
};
```

## 전체 훅 목록

### useCards.ts

| 훅 | 타입 | staleTime | 설명 |
|----|------|-----------|------|
| `useCards(deckName, opts)` | useQuery | 30초 | 카드 목록 (page/limit/filter) |
| `useCardDetail(noteId)` | useQuery | 기본 | 카드 상세 |
| `useBackups()` | useQuery | 30초 | 백업 목록 (**중복**: useBackups.ts에도 동일) |
| `useRollback()` | useMutation | -- | 롤백 (**중복**: useBackups.ts에도 동일) |

### useBackups.ts (정규 위치)

| 훅 | 타입 | staleTime | 설명 |
|----|------|-----------|------|
| `useBackups()` | useQuery | 30초 | 백업 목록 |
| `useRollback()` | useMutation | -- | 롤백 (성공 시 backups+cards 캐시 무효화) |

### useDecks.ts

| 훅 | 타입 | 설명 |
|----|------|------|
| `useDecks()` | useQuery | 덱 목록 |
| `useDeckStats(name)` | useQuery | 덱 통계 |

### useDifficultCards.ts

| 훅 | 타입 | staleTime | 설명 |
|----|------|-----------|------|
| `useDifficultCards(deckName, opts)` | useQuery | 60초 | 학습 데이터 기반 어려운 카드 |

### useSplit.ts

| 훅 | 타입 | staleTime | 설명 |
|----|------|-----------|------|
| `useLLMModels()` | useQuery | 5분 | LLM 프로바이더/모델 목록 |
| `useSplitPreview()` | useMutation | -- | 분할 미리보기 (성공 시 setQueryData로 캐시) |
| `useSplitApply()` | useMutation | -- | 분할 적용 (성공 시 cards+backups 무효화) |
| `useSplitReject()` | useMutation | -- | 분할 반려 |
| `getCachedSplitPreview()` | 유틸 함수 | -- | queryClient에서 캐시된 미리보기 조회 |

### usePrompts.ts

| 훅 | 타입 | 설명 |
|----|------|------|
| `usePromptVersions()` | useQuery | 버전 목록 |
| `usePromptVersion(id)` | useQuery | 버전 상세 |
| `useActivePrompt()` | useQuery | 활성 버전 |
| `useSystemPrompt()` | useQuery | 원격 systemPrompt |
| `useActivatePrompt()` | useMutation | 버전 활성화 (versions/active/system 무효화) |
| `useSaveSystemPrompt()` | useMutation | systemPrompt 저장 (system/versions/active 무효화) |
| `useExperiments()` | useQuery | 실험 목록 |
| `useExperiment(id)` | useQuery | 실험 상세 |
| `useCreateExperiment()` | useMutation | 실험 생성 (experiments 무효화) |
| `useCompleteExperiment()` | useMutation | 실험 완료 (experiments 무효화) |

### useHistory.ts

| 훅 | 타입 | 설명 |
|----|------|------|
| `useHistoryList(opts)` | useQuery | 히스토리 목록 (page/limit/deckName/status/startDate/endDate) |
| `useHistoryDetail(sessionId)` | useQuery | 세션 상세 |
| `useHistorySyncHealth()` | useQuery | 동기화 상태 |

### useMediaQuery.ts

| 훅 | 타입 | 설명 |
|----|------|------|
| `useMediaQuery(query)` | 커스텀 | CSS 미디어 쿼리 매칭 (window.matchMedia) |
| `useIsMobile(breakpoint)` | 커스텀 | 모바일 여부 (md/lg/xl 중 선택, 기본 md) |

### useValidationCache.ts

| 훅 | 타입 | 설명 |
|----|------|------|
| `useValidationCache()` | 커스텀 | 검증 결과 전역 캐시 |

## 훅 패턴

### useQuery (데이터 조회)

```typescript
export function useCards(deckName: string, options: CardOptions) {
  return useQuery({
    queryKey: queryKeys.cards.byDeck(deckName, options),
    queryFn: () => api.cards.list(deckName, options),
    enabled: !!deckName,
    staleTime: 30 * 1000,
  });
}
```

### useMutation (데이터 변경)

```typescript
export function useSplitPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, versionId, deckName, provider, model, budgetUsdCap }) =>
      api.split.preview(noteId, { versionId, deckName, provider, model, budgetUsdCap }),
    onSuccess: (data, variables) => {
      const resolvedProvider = data.provider ?? variables.provider;
      const resolvedModel = data.aiModel ?? variables.model;
      queryClient.setQueryData(
        queryKeys.split.preview(variables.noteId, variables.versionId, resolvedProvider, resolvedModel),
        data
      );
    },
  });
}
```

## useMutation + useEffect 안티패턴

`useMutation()` 반환값은 매 렌더마다 새 참조를 생성하므로 `useEffect` 의존성 배열에 넣으면 무한 루프 발생:

```typescript
// 금지: splitPreview가 매 렌더마다 바뀌어 effect 무한 실행
useEffect(() => { splitPreview.reset(); }, [splitPreview]);

// 이벤트 핸들러에서 직접 호출
const handleSelect = () => { splitPreview.reset(); splitPreview.mutate(...); };
```

## 캐시 무효화

분할 적용 후 관련 캐시 무효화 필수:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
