/**
 * 카드 분할 클라이언트 (멀티 LLM 지원)
 */

import { createLLMClient, getDefaultModelId } from "../llm/factory.js";
import { estimateCost, getModelPricing } from "../llm/pricing.js";
import type { ActualCost, CostEstimate, LLMModelId, TokenUsage } from "../llm/types.js";
import { buildSplitPrompt, buildSplitPromptFromTemplate, SYSTEM_PROMPT } from "./prompts.js";
import { type SplitResponse, validateSplitResponse } from "./validator.js";

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
 * 분할 비용 사전 추정
 */
export async function estimateSplitCost(
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
    ? buildSplitPromptFromTemplate(prompts.splitPromptTemplate, card.noteId, card.text, card.tags)
    : buildSplitPrompt(card.noteId, card.text);
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
 * 단일 카드 분할 요청
 * @param card - 분할할 카드 정보
 * @param prompts - resolve된 프롬프트 (버전별 A/B 테스트용). 없으면 기본 프롬프트 사용.
 * @param modelId - 사용할 LLM 모델. 없으면 기본 모델 사용.
 */
export async function requestCardSplit(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
  modelId?: LLMModelId,
): Promise<SplitResponse & SplitRequestMetadata> {
  const resolvedModelId = modelId ?? getDefaultModelId();
  const client = createLLMClient(resolvedModelId.provider);

  const systemPrompt = prompts?.systemPrompt ?? SYSTEM_PROMPT;
  const userPrompt = prompts
    ? buildSplitPromptFromTemplate(prompts.splitPromptTemplate, card.noteId, card.text, card.tags)
    : buildSplitPrompt(card.noteId, card.text);

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
  const validated = validateSplitResponse(parsed);

  return {
    ...validated,
    tokenUsage: llmResult.tokenUsage,
    modelName: resolvedModelId.model,
    provider: resolvedModelId.provider,
    actualCost: llmResult.actualCost,
  };
}

/**
 * 배치 카드 분할 요청 (10~20개 단위)
 */
export async function requestBatchCardSplit(
  cards: CardForSplit[],
  onProgress?: (completed: number, total: number) => void,
  modelId?: LLMModelId,
): Promise<Map<number, SplitResponse>> {
  const results = new Map<number, SplitResponse>();
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000; // Rate limit 대응

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    // 배치 내 병렬 처리
    const batchResults = await Promise.allSettled(
      batch.map((card) => requestCardSplit(card, undefined, modelId)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.set(batch[j].noteId, result.value);
      } else {
        console.error(`카드 ${batch[j].noteId} 분할 실패:`, result.reason);
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

/**
 * 카드가 분할이 필요한지 분석 요청
 */
export async function analyzeCardForSplit(
  card: CardForSplit,
  modelId?: LLMModelId,
): Promise<{
  needsSplit: boolean;
  reason: string;
  suggestedSplitCount: number;
}> {
  const resolvedModelId = modelId ?? getDefaultModelId();
  const client = createLLMClient(resolvedModelId.provider);

  const analysisPrompt = `
다음 Anki 카드가 분할이 필요한지 분석해주세요.

## 분할이 필요한 경우
1. 하나의 카드에 여러 독립적인 개념이 포함된 경우
2. #### 헤더나 --- 구분선으로 명확히 섹션이 나뉘는 경우
3. 동일한 Cloze 번호에 서로 다른 개념이 묶여 있는 경우
4. 카드 내용이 너무 길어 암기 효율이 떨어지는 경우

## 분할이 불필요한 경우
1. 하나의 개념을 여러 측면에서 설명하는 경우
2. 비교/대조 형식으로 한 번에 봐야 의미 있는 경우
3. ::: toggle todo 블록 (미완성 상태)

## 카드 내용:
${card.text}

## 응답 형식 (JSON):
{
  "needsSplit": true/false,
  "reason": "분석 이유",
  "suggestedSplitCount": 숫자
}
`;

  const llmResult = await client.generateContent(analysisPrompt, {
    responseMimeType: "application/json",
    model: resolvedModelId.model,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(llmResult.text);
  } catch {
    throw new Error(
      `LLM이 유효하지 않은 JSON을 반환했습니다 (${resolvedModelId.provider}/${resolvedModelId.model})`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed == null ||
    typeof (parsed as Record<string, unknown>).needsSplit !== "boolean" ||
    typeof (parsed as Record<string, unknown>).reason !== "string" ||
    typeof (parsed as Record<string, unknown>).suggestedSplitCount !== "number"
  ) {
    throw new Error(
      `LLM analysis 응답 스키마가 올바르지 않습니다 (${resolvedModelId.provider}/${resolvedModelId.model})`,
    );
  }

  return parsed as {
    needsSplit: boolean;
    reason: string;
    suggestedSplitCount: number;
  };
}
