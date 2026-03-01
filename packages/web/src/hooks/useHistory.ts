import { useQuery } from "@tanstack/react-query";

import { api, type SplitHistoryStatus } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export interface HistoryListOptions {
  page?: number;
  limit?: number;
  deckName?: string;
  status?: SplitHistoryStatus;
  startDate?: string;
  endDate?: string;
}

export function useHistoryList(opts?: HistoryListOptions) {
  return useQuery({
    queryKey: queryKeys.history.list(opts),
    queryFn: () => api.history.list(opts),
  });
}

export function useHistoryDetail(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.history.detail(sessionId || ""),
    queryFn: () => api.history.detail(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useHistorySyncHealth() {
  return useQuery({
    queryKey: queryKeys.history.syncHealth,
    queryFn: () => api.history.syncHealth(),
  });
}
