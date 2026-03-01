/**
 * LLM 모델 가격표 + 비용 계산 + 예산 가드레일
 */

import type {
  ActualCost,
  CostEstimate,
  LLMProviderName,
  TokenUsage,
} from "./types.js";

export interface ModelPricing {
  provider: LLMProviderName;
  model: string;
  displayName: string;
  inputPricePerMillionTokens: number;
  outputPricePerMillionTokens: number;
  verifiedAt: string;
}

/**
 * 정적 가격표 (공식 문서 기반, 수동 업데이트)
 */
export const MODEL_PRICING_TABLE: ModelPricing[] = [
  // Gemini
  {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    inputPricePerMillionTokens: 0.15,
    outputPricePerMillionTokens: 0.6,
    verifiedAt: "2025-05-01",
  },
  // OpenAI
  {
    provider: "openai",
    model: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    inputPricePerMillionTokens: 0.25,
    outputPricePerMillionTokens: 2.0,
    verifiedAt: "2026-03-01",
  },
];

const DEFAULT_SERVER_BUDGET_CAP_USD = 1.0;

export function getModelPricing(
  provider: LLMProviderName,
  model: string,
): ModelPricing | undefined {
  return MODEL_PRICING_TABLE.find(
    (p) => p.provider === provider && p.model === model,
  );
}

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): { inputCostUsd: number; outputCostUsd: number; totalCostUsd: number } {
  const inputCostUsd =
    (inputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
  const outputCostUsd =
    (outputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function computeCost(
  tokenUsage: TokenUsage,
  pricing: ModelPricing,
): ActualCost {
  return calculateCost(
    tokenUsage.promptTokens ?? 0,
    tokenUsage.completionTokens ?? 0,
    pricing,
  );
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): CostEstimate {
  const { inputCostUsd, outputCostUsd, totalCostUsd } = calculateCost(
    inputTokens,
    outputTokens,
    pricing,
  );
  return {
    estimatedInputCostUsd: inputCostUsd,
    estimatedOutputCostUsd: outputCostUsd,
    estimatedTotalCostUsd: totalCostUsd,
  };
}

export function getServerBudgetCapUsd(): number {
  const envCap = process.env.ANKI_SPLITTER_BUDGET_CAP_USD;
  if (envCap) {
    const parsed = Number.parseFloat(envCap);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_SERVER_BUDGET_CAP_USD;
}

export function checkBudget(
  estimatedCostUsd: number,
  clientBudgetCapUsd?: number,
): { allowed: boolean; estimatedCostUsd: number; budgetCapUsd: number } {
  const serverCap = getServerBudgetCapUsd();

  const effectiveCap =
    clientBudgetCapUsd != null &&
    Number.isFinite(clientBudgetCapUsd) &&
    clientBudgetCapUsd > 0
      ? Math.min(clientBudgetCapUsd, serverCap)
      : serverCap;

  return {
    allowed: estimatedCostUsd <= effectiveCap,
    estimatedCostUsd,
    budgetCapUsd: effectiveCap,
  };
}
