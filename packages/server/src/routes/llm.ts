/**
 * LLM API Routes - 모델 정보 제공
 */

import {
  getAvailableProviders,
  getDefaultModelId,
  getServerBudgetCapUsd,
  MODEL_PRICING_TABLE,
} from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /api/llm/models
 * 사용 가능한 프로바이더/모델 목록 + 가격 정보 + 기본 모델 + 서버 예산 캡
 */
app.get("/models", (c) => {
  const availableProviders = getAvailableProviders();
  const configuredDefault = getDefaultModelId();
  const budgetCapUsd = getServerBudgetCapUsd();

  // API 키가 설정된 provider의 모델만 반환
  const models = MODEL_PRICING_TABLE.filter((m) =>
    availableProviders.includes(m.provider),
  ).map((m) => ({
    provider: m.provider,
    model: m.model,
    displayName: m.displayName,
    inputPricePerMillionTokens: m.inputPricePerMillionTokens,
    outputPricePerMillionTokens: m.outputPricePerMillionTokens,
  }));

  // 기본 모델이 가격표에 등록된 모델 목록에 없으면 첫 번째 가용 모델로 대체
  const isDefaultInModels = models.some(
    (m) =>
      m.provider === configuredDefault.provider &&
      m.model === configuredDefault.model,
  );
  const defaultModelId =
    isDefaultInModels && models.length > 0
      ? configuredDefault
      : models.length > 0
        ? { provider: models[0].provider, model: models[0].model }
        : configuredDefault;

  return c.json({
    models,
    defaultModelId,
    budgetCapUsd,
    availableProviders,
  });
});

export default app;
