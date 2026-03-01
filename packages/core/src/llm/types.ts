/**
 * LLM 추상화 계층 - 공유 타입
 */

export type LLMProviderName = "gemini" | "openai";

export interface LLMModelId {
  provider: LLMProviderName;
  model: string;
}

/**
 * 토큰 사용량 (통합 타입)
 * 기존 gemini/client.ts:18-22 + history/types.ts:12-16 의 중복 정의를 통합
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CostEstimate {
  estimatedInputCostUsd: number;
  estimatedOutputCostUsd: number;
  estimatedTotalCostUsd: number;
}

export interface ActualCost {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface LLMGenerationResult {
  text: string;
  tokenUsage: TokenUsage;
  modelId: LLMModelId;
  actualCost?: ActualCost;
}

export interface LLMGenerationOptions {
  systemPrompt?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  model?: string;
}

/**
 * LLM Provider 인터페이스
 * 각 provider 어댑터가 구현
 */
export interface LLMProvider {
  readonly name: LLMProviderName;

  generateContent(
    prompt: string,
    options: LLMGenerationOptions,
  ): Promise<LLMGenerationResult>;

  countTokens(text: string, model?: string): Promise<number>;
}
