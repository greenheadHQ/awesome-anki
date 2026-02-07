# TanStack Query 패턴

## 쿼리 키 관리

```typescript
// packages/web/src/lib/query-keys.ts
export const queryKeys = {
  decks: {
    all: ['decks'],
    stats: (name: string) => ['decks', name, 'stats'],
  },
  cards: {
    all: ['cards'],
    list: (deck: string, opts: any) => ['cards', deck, opts],
    detail: (noteId: number) => ['cards', noteId],
  },
  split: {
    preview: (noteId: number, useGemini: boolean) =>
      ['split', 'preview', noteId, useGemini],
  },
  backups: {
    all: ['backups'],
  },
  prompts: {
    versions: ['prompts', 'versions'],
    active: ['prompts', 'active'],
    history: ['prompts', 'history'],
    experiments: ['prompts', 'experiments'],
  },
};
```

## 훅 패턴

### useQuery (데이터 조회)

```typescript
export function useCards(deckName: string, options: CardOptions) {
  return useQuery({
    queryKey: queryKeys.cards.list(deckName, options),
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
    mutationFn: ({ noteId, useGemini = false }) =>
      api.split.preview(noteId, useGemini),
    onSuccess: (data, variables) => {
      // 캐시에 결과 저장 (카드별 독립 캐시)
      queryClient.setQueryData(
        queryKeys.split.preview(variables.noteId, variables.useGemini),
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
  useGemini: boolean
) {
  return queryClient.getQueryData(
    queryKeys.split.preview(noteId, useGemini)
  );
}
```

## 캐시 무효화

분할 적용 후 관련 캐시 무효화 필수:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
