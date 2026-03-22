/**
 * 카드 최적화 클라이언트 (멀티 LLM 지원)
 *
 * split / compact / skip 판별을 지원하는 OperationResponse 기반.
 * Legacy requestCardSplit / estimateSplitCost wrapper도 하위 호환용으로 유지.
 */

import { createLLMClient, getDefaultModelId } from "../llm/factory.js";
import { estimateCost, getModelPricing } from "../llm/pricing.js";
import type { ActualCost, CostEstimate, LLMModelId, TokenUsage } from "../llm/types.js";
import {
  buildOptimizationPrompt,
  buildOptimizationPromptFromTemplate,
  SYSTEM_PROMPT,
} from "./prompts.js";
import { type OperationResponse, validateOperationResponse } from "./validator.js";

export type { TokenUsage };

/**
 * Split 출력 토큰 상한 — 추정 및 생성에 동일 적용
 * 일반적인 카드 분할은 200~500 토큰이므로 8192는 충분한 여유
 */
export const SPLIT_MAX_OUTPUT_TOKENS = 8192;

export interface SplitRequestMetadata {
  tokenUsage?: TokenUsage;
  modelName: string;
  provider?: string;
  actualCost?: ActualCost;
  estimatedCost?: CostEstimate;
}

export interface CardForSplit {
  noteId: number;
  text: string;
  tags: string[];
}

/**
 * 최적화 비용 사전 추정
 */
export async function estimateOptimizationCost(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
  modelId?: LLMModelId,
): Promise<{
  estimatedCost: CostEstimate;
  worstCaseCostUsd: number;
  inputTokens: number;
  outputTokens: number;
} | null> {
  const resolvedModelId = modelId ?? getDefaultModelId();
  const pricing = getModelPricing(resolvedModelId.provider, resolvedModelId.model);
  if (!pricing) return null;

  const client = createLLMClient(resolvedModelId.provider);
  // 실제 프롬프트와 동일한 구조로 입력 토큰 추정
  const systemPromptText = prompts?.systemPrompt ?? SYSTEM_PROMPT;
  const userPrompt = prompts
    ? buildOptimizationPromptFromTemplate(
        prompts.splitPromptTemplate,
        card.noteId,
        card.text,
        card.tags,
      )
    : buildOptimizationPrompt(card.noteId, card.text);
  const fullInput = `${systemPromptText}\n\n${userPrompt}`;
  const inputTokens = await client.countTokens(fullInput, resolvedModelId.model);
  // 출력 토큰은 입력의 70% 수준으로 추정 (일반적인 카드 분할 패턴)
  const ESTIMATED_OUTPUT_INPUT_RATIO = 0.7;
  const outputTokens = Math.min(
    Math.ceil(inputTokens * ESTIMATED_OUTPUT_INPUT_RATIO),
    SPLIT_MAX_OUTPUT_TOKENS,
  );

  // worst-case: 출력이 maxOutputTokens까지 나오는 경우의 비용 (예산 검사용)
  const worstCase = estimateCost(inputTokens, SPLIT_MAX_OUTPUT_TOKENS, pricing);

  return {
    estimatedCost: estimateCost(inputTokens, outputTokens, pricing),
    worstCaseCostUsd: worstCase.estimatedTotalCostUsd,
    inputTokens,
    outputTokens,
  };
}

/**
 * @deprecated estimateOptimizationCost 사용 권장
 */
export async function estimateSplitCost(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
  modelId?: LLMModelId,
) {
  return estimateOptimizationCost(card, prompts, modelId);
}

/**
 * 단일 카드 최적화 요청 (split / compact / skip)
 * @param card - 최적화할 카드 정보
 * @param prompts - resolve된 프롬프트 (버전별 A/B 테스트용). 없으면 기본 프롬프트 사용.
 * @param modelId - 사용할 LLM 모델. 없으면 기본 모델 사용.
 */
export async function requestCardOptimization(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
  modelId?: LLMModelId,
): Promise<OperationResponse & SplitRequestMetadata> {
  const resolvedModelId = modelId ?? getDefaultModelId();
  const client = createLLMClient(resolvedModelId.provider);

  const systemPrompt = prompts?.systemPrompt ?? SYSTEM_PROMPT;
  const userPrompt = prompts
    ? buildOptimizationPromptFromTemplate(
        prompts.splitPromptTemplate,
        card.noteId,
        card.text,
        card.tags,
      )
    : buildOptimizationPrompt(card.noteId, card.text);

  const llmResult = await client.generateContent(userPrompt, {
    systemPrompt,
    responseMimeType: "application/json",
    model: resolvedModelId.model,
    maxOutputTokens: SPLIT_MAX_OUTPUT_TOKENS,
  });

  // JSON 파싱 및 검증
  let parsed: unknown;
  try {
    parsed = JSON.parse(llmResult.text);
  } catch {
    throw new Error(
      `LLM이 유효하지 않은 JSON을 반환했습니다 (${resolvedModelId.provider}/${resolvedModelId.model})`,
    );
  }
  const validated = validateOperationResponse(parsed);

  return {
    ...validated,
    tokenUsage: llmResult.tokenUsage,
    modelName: resolvedModelId.model,
    provider: resolvedModelId.provider,
    actualCost: llmResult.actualCost,
  };
}

/**
 * @deprecated requestCardOptimization 사용 권장
 */
export async function requestCardSplit(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
  modelId?: LLMModelId,
) {
  return requestCardOptimization(card, prompts, modelId);
}

/**
 * 배치 카드 최적화 요청 (10~20개 단위)
 */
export async function requestBatchCardSplit(
  cards: CardForSplit[],
  onProgress?: (completed: number, total: number) => void,
  modelId?: LLMModelId,
): Promise<Map<number, OperationResponse>> {
  const results = new Map<number, OperationResponse>();
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000; // Rate limit 대응

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    // 배치 내 병렬 처리
    const batchResults = await Promise.allSettled(
      batch.map((card) => requestCardOptimization(card, undefined, modelId)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.set(batch[j].noteId, result.value);
      } else {
        console.error(`카드 ${batch[j].noteId} 최적화 실패:`, result.reason);
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, cards.length), cards.length);
    }

    // 다음 배치 전 딜레이
    if (i + BATCH_SIZE < cards.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
}
