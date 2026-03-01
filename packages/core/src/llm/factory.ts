/**
 * LLM 팩토리 함수
 */

import {
  DEFAULT_GEMINI_MODEL,
  GeminiAdapter,
  isGeminiAvailable,
} from "./gemini.js";
import {
  DEFAULT_OPENAI_MODEL,
  isOpenAIAvailable,
  OpenAIAdapter,
} from "./openai.js";
import type { LLMModelId, LLMProvider, LLMProviderName } from "./types.js";

const adapterCache = new Map<LLMProviderName, LLMProvider>();

export function createLLMClient(provider: LLMProviderName): LLMProvider {
  const cached = adapterCache.get(provider);
  if (cached) return cached;

  let adapter: LLMProvider;
  switch (provider) {
    case "gemini":
      adapter = new GeminiAdapter();
      break;
    case "openai":
      adapter = new OpenAIAdapter();
      break;
    default:
      throw new Error(`지원하지 않는 LLM provider: ${provider}`);
  }
  adapterCache.set(provider, adapter);
  return adapter;
}

/**
 * 문자열이 유효한 LLMProviderName인지 확인하는 타입 가드
 */
export function isValidProvider(s: string): s is LLMProviderName {
  return s === "gemini" || s === "openai";
}

export function getDefaultModelId(): LLMModelId {
  const rawProvider = process.env.ANKI_SPLITTER_DEFAULT_LLM_PROVIDER;
  if (rawProvider && !isValidProvider(rawProvider)) {
    throw new Error(
      `유효하지 않은 LLM provider: ${rawProvider} (지원: gemini, openai)`,
    );
  }
  let provider: LLMProviderName = (rawProvider as LLMProviderName) ?? "gemini";

  // 설정된 provider가 미가용이면 가용 provider로 graceful fallback
  const available = getAvailableProviders();
  if (available.length > 0 && !available.includes(provider)) {
    provider = available[0];
    // provider가 바뀌면 env 기본 모델은 무효 → 해당 provider 기본 모델 사용
    return { provider, model: getDefaultModelForProvider(provider) };
  }

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
      return DEFAULT_GEMINI_MODEL;
    case "openai":
      return DEFAULT_OPENAI_MODEL;
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
