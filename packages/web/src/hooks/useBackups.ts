import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function useBackups() {
  return useQuery({
    queryKey: queryKeys.backups.all,
    queryFn: () => api.backup.list(),
    staleTime: 30 * 1000, // 30초
  });
}

export function useRollback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => api.backup.rollback(backupId),
    onSuccess: () => {
      // 백업 목록 및 카드 목록 갱신
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
}
