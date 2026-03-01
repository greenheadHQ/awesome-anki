/**
 * usePrompts - 프롬프트 버전 관리 훅
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

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
    queryKey: queryKeys.prompts.version(versionId || ""),
    queryFn: () => api.prompts.version(versionId as string),
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
 * 원격 systemPrompt 조회
 */
export function useSystemPrompt() {
  return useQuery({
    queryKey: queryKeys.prompts.system,
    queryFn: () => api.prompts.system(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.system });
    },
  });
}

/**
 * 원격 systemPrompt 저장
 */
export function useSaveSystemPrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { expectedRevision: number; systemPrompt: string; reason: string }) =>
      api.prompts.saveSystemPrompt(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.system });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.active });
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
    queryKey: queryKeys.prompts.experiment(experimentId || ""),
    queryFn: () => api.prompts.experiment(experimentId as string),
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.prompts.experiments,
      });
    },
  });
}

/**
 * 실험 완료
 */
export function useCompleteExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { conclusion: string; winnerVersionId: string };
    }) => api.prompts.completeExperiment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prompts.experiments,
      });
    },
  });
}
