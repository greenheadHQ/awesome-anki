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

const VALID_PROVIDERS = new Set<string>(["gemini", "openai"]);

export function getDefaultModelId(): LLMModelId {
  const rawProvider = process.env.ANKI_SPLITTER_DEFAULT_LLM_PROVIDER;
  if (rawProvider && !VALID_PROVIDERS.has(rawProvider)) {
    throw new Error(
      `유효하지 않은 LLM provider: ${rawProvider} (지원: gemini, openai)`,
    );
  }
  const provider: LLMProviderName =
    (rawProvider as LLMProviderName) ?? "gemini";
  const model =
    process.env.ANKI_SPLITTER_DEFAULT_LLM_MODEL ??
    getDefaultModelForProvider(provider);

  return { provider, model };
}

/**
 * provider에 맞는 기본 모델 반환
 */
export function getDefaultModelForProvider(provider: LLMProviderName): string {
  switch (provider) {
    case "gemini":
      return "gemini-3-flash-preview";
    case "openai":
      return "gpt-5-mini";
  }
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
