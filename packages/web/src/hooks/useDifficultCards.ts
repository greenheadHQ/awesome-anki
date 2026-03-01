import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function useDifficultCards(
  deckName: string | null,
  opts?: { page?: number; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.cards.difficult(deckName || "", opts),
    queryFn: () => api.cards.getDifficult(deckName as string, opts),
    enabled: !!deckName,
    staleTime: 60_000,
  });
}
