import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function useDecks() {
  return useQuery({
    queryKey: queryKeys.decks,
    queryFn: () => api.decks.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDeckStats(deckName: string | null) {
  return useQuery({
    queryKey: queryKeys.deckStats(deckName || ""),
    queryFn: () => api.decks.stats(deckName as string),
    enabled: !!deckName,
    staleTime: 60 * 1000, // 1 minute
  });
}
