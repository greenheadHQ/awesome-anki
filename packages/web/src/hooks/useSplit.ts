import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type SplitApplyResult,
  type SplitPreviewResult,
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function useSplitPreview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      useGemini = false,
    }: {
      noteId: number;
      useGemini?: boolean;
    }) => api.split.preview(noteId, useGemini),
    onSuccess: (data, variables) => {
      // 결과를 React Query 캐시에 저장 (카드별 독립 캐시)
      queryClient.setQueryData(
        queryKeys.split.preview(variables.noteId, variables.useGemini),
        data,
      );
    },
  });
}

/**
 * 캐시된 분할 미리보기 결과 조회
 * SplitWorkspace에서 카드 선택 시 캐시 확인용
 */
export function getCachedSplitPreview(
  queryClient: ReturnType<typeof useQueryClient>,
  noteId: number,
  useGemini: boolean,
): SplitPreviewResult | undefined {
  return queryClient.getQueryData(queryKeys.split.preview(noteId, useGemini));
}

export function useSplitApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      splitType,
      deckName,
    }: {
      noteId: number;
      splitType: "hard" | "soft";
      deckName: string;
    }) => api.split.apply(noteId, splitType, deckName),
    onSuccess: (_, _variables) => {
      // 카드 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      // 백업 목록도 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

export type { SplitPreviewResult, SplitApplyResult };
