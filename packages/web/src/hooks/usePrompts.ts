/**
 * usePrompts - 프롬프트 버전 관리 훅
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

/**
 * 프롬프트 버전 목록 조회
 */
export function usePromptVersions() {
  return useQuery({
    queryKey: queryKeys.prompts.versions,
    queryFn: () => api.prompts.versions(),
  });
}

/**
 * 특정 프롬프트 버전 상세 조회
 */
export function usePromptVersion(versionId: string | null) {
  return useQuery({
    queryKey: queryKeys.prompts.version(versionId || ''),
    queryFn: () => api.prompts.version(versionId!),
    enabled: !!versionId,
  });
}

/**
 * 현재 활성 프롬프트 버전 조회
 */
export function useActivePrompt() {
  return useQuery({
    queryKey: queryKeys.prompts.active,
    queryFn: () => api.prompts.active(),
  });
}

/**
 * 프롬프트 버전 활성화
 */
export function useActivatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => api.prompts.activate(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.active });
    },
  });
}

/**
 * 분할 히스토리 조회
 */
export function usePromptHistory(opts?: { page?: number; limit?: number; versionId?: string }) {
  return useQuery({
    queryKey: queryKeys.prompts.history(opts),
    queryFn: () => api.prompts.history(opts),
  });
}

/**
 * 분할 히스토리 추가
 */
export function useAddPromptHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.prompts.addHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions });
    },
  });
}

/**
 * 실험 목록 조회
 */
export function useExperiments() {
  return useQuery({
    queryKey: queryKeys.prompts.experiments,
    queryFn: () => api.prompts.experiments(),
  });
}

/**
 * 특정 실험 상세 조회
 */
export function useExperiment(experimentId: string | null) {
  return useQuery({
    queryKey: queryKeys.prompts.experiment(experimentId || ''),
    queryFn: () => api.prompts.experiment(experimentId!),
    enabled: !!experimentId,
  });
}

/**
 * 실험 생성
 */
export function useCreateExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.prompts.createExperiment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.experiments });
    },
  });
}

/**
 * 실험 완료
 */
export function useCompleteExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { conclusion: string; winnerVersionId?: string } }) =>
      api.prompts.completeExperiment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.experiments });
    },
  });
}
