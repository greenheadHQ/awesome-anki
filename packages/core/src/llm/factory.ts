/**
 * LLM 팩토리 함수
 */

import { GeminiAdapter, isGeminiAvailable } from "./gemini.js";
import { isOpenAIAvailable, OpenAIAdapter } from "./openai.js";
import type { LLMModelId, LLMProvider, LLMProviderName } from "./types.js";

export function createLLMClient(provider: LLMProviderName): LLMProvider {
  switch (provider) {
    case "gemini":
      return new GeminiAdapter();
    case "openai":
      return new OpenAIAdapter();
    default:
      throw new Error(`지원하지 않는 LLM provider: ${provider}`);
  }
}

export function getDefaultModelId(): LLMModelId {
  const provider =
    (process.env.ANKI_SPLITTER_DEFAULT_LLM_PROVIDER as LLMProviderName) ??
    "gemini";
  const model =
    process.env.ANKI_SPLITTER_DEFAULT_LLM_MODEL ?? "gemini-3-flash-preview";

  return { provider, model };
}

/**
 * API 키가 설정된 provider만 반환
 */
export function getAvailableProviders(): LLMProviderName[] {
  const providers: LLMProviderName[] = [];
  if (isGeminiAvailable()) providers.push("gemini");
  if (isOpenAIAvailable()) providers.push("openai");
  return providers;
}
