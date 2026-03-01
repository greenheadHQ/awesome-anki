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
      versionId,
      deckName,
    }: {
      noteId: number;
      versionId?: string;
      deckName?: string;
    }) => api.split.preview(noteId, versionId, deckName),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.split.preview(variables.noteId, variables.versionId),
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
  versionId?: string,
): SplitPreviewResult | undefined {
  return queryClient.getQueryData(queryKeys.split.preview(noteId, versionId));
}

export function useSplitApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      noteId: number;
      deckName: string;
      splitCards: Array<{
        title: string;
        content: string;
        inheritImages?: string[];
        inheritTags?: string[];
        preservedLinks?: string[];
        backLinks?: string[];
      }>;
      mainCardIndex: number;
    }) => api.split.apply(data),
    onSuccess: () => {
      // 카드 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      // 백업 목록도 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

export function useSplitReject() {
  return useMutation({
    mutationFn: (data: { sessionId: string; rejectionReason: string }) =>
      api.split.reject(data),
  });
}

export type { SplitPreviewResult, SplitApplyResult };
