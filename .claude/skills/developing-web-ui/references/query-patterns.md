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
    preview: (noteId: number, versionId?: string) =>
      ['split', 'preview', noteId, versionId],
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
  history: {
    list: (opts?: { page?: number; limit?: number; deckName?: string;
      status?: string; startDate?: string; endDate?: string }) =>
      ['history', 'list', opts],
    detail: (sessionId: string) => ['history', 'detail', sessionId],
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
    mutationFn: ({ noteId, versionId }: { noteId: number; versionId?: string }) =>
      api.split.preview(noteId, versionId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.split.preview(variables.noteId, variables.versionId),
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
  versionId?: string
) {
  return queryClient.getQueryData(
    queryKeys.split.preview(noteId, versionId)
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
