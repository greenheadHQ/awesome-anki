/**
 * LLM 모델 선택 훅
 *
 * SplitWorkspace와 ClinicWorkspace에서 공통으로 사용하는
 * 모델 키 파싱 + 선택 상태 관리 로직.
 */

import { useState } from "react";

import { useLLMModels } from "./useSplit";

export function useModelSelection() {
  const { data: llmModelsData } = useLLMModels();
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);

  const defaultModelKey = llmModelsData
    ? `${llmModelsData.defaultModelId.provider}/${llmModelsData.defaultModelId.model}`
    : null;

  const activeModelKey = selectedModelKey ?? defaultModelKey;
  const activeProvider = activeModelKey?.split("/")[0];
  const activeModel = activeModelKey?.split("/").slice(1).join("/");

  const modelOptions = llmModelsData
    ? llmModelsData.models.map((m) => ({
        value: `${m.provider}/${m.model}`,
        label: `${m.displayName || m.model} (${m.provider})`,
      }))
    : [];

  return {
    activeProvider,
    activeModel,
    activeModelKey,
    defaultModelKey,
    modelOptions,
    selectedModelKey,
    setSelectedModelKey,
    llmModelsData,
  };
}
