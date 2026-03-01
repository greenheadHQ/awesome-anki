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
    list: (opts?: {
      page?: number; limit?: number; deckName?: string;
      status?: string; startDate?: string; endDate?: string;
    }) => ["history", "list", opts] as const,
    detail: (sessionId: string) => ["history", "detail", sessionId] as const,
    syncHealth: ["history", "sync-health"] as const,
  },

  health: ["health"] as const,
};
```

## 훅 패턴

### useQuery (데이터 조회)

```typescript
export function useCards(deckName: string, options: CardOptions) {
  return useQuery({
    queryKey: queryKeys.cards.byDeck(deckName, options),
    queryFn: () => api.cards.list(deckName, options),
    enabled: !!deckName,
  });
}

export function useCardDetail(noteId: number | null) {
  return useQuery({
    queryKey: queryKeys.cards.detail(noteId!),
    queryFn: () => api.cards.detail(noteId!),
    enabled: noteId !== null,
  });
}
```

### useMutation (데이터 변경)

```typescript
export function useSplitPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, versionId, deckName, provider, model, budgetUsdCap }: {
      noteId: number; versionId?: string; deckName?: string;
      provider?: string; model?: string; budgetUsdCap?: number;
    }) => api.split.preview(noteId, { versionId, deckName, provider, model, budgetUsdCap }),
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

### 캐시된 데이터 조회

```typescript
function getCachedSplitPreview(
  queryClient: QueryClient,
  noteId: number,
  versionId?: string,
  provider?: string,
  model?: string,
) {
  return queryClient.getQueryData(
    queryKeys.split.preview(noteId, versionId, provider, model)
  );
}
```

## useMutation + useEffect 안티패턴

`useMutation()` 반환값은 매 렌더마다 새 참조를 생성하므로 `useEffect` 의존성 배열에 넣으면 무한 루프 발생:

```typescript
// ❌ 금지: splitPreview가 매 렌더마다 바뀌어 effect 무한 실행
useEffect(() => { splitPreview.reset(); }, [splitPreview]);

// ✅ 이벤트 핸들러에서 직접 호출
const handleSelect = () => { splitPreview.reset(); splitPreview.mutate(...); };
```

## 캐시 무효화

분할 적용 후 관련 캐시 무효화 필수:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
