import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function useCards(
  deckName: string | null,
  opts?: { page?: number; limit?: number; filter?: string },
) {
  return useQuery({
    queryKey: queryKeys.cards.byDeck(deckName || "", opts),
    queryFn: () => api.cards.getByDeck(deckName as string, opts),
    enabled: !!deckName,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCardDetail(noteId: number | null) {
  return useQuery({
    queryKey: queryKeys.cards.detail(noteId || 0),
    queryFn: () => api.cards.getById(noteId as number),
    enabled: !!noteId,
    staleTime: 30 * 1000,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
}
