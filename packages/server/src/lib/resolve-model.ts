/**
 * provider/model 유효성 검증 + resolve 공유 유틸리티
 * split.ts와 validate.ts에서 동일 로직 사용
 */

import {
  getAvailableProviders,
  getDefaultModelForProvider,
  getModelPricing,
  isValidProvider,
  type LLMModelId,
  type LLMProviderName,
  ValidationError,
} from "@anki-splitter/core";

/**
 * 요청 파라미터의 provider/model을 검증하고 LLMModelId로 resolve
 *
 * @throws {ValidationError} provider/model이 유효하지 않을 때
 * @returns resolve된 LLMModelId, 또는 provider 미지정 시 undefined
 *
 * Note: provider API 키 미설정은 ValidationError를 throw하며,
 * 호출 측에서 적절한 HTTP 상태 코드(400/503)로 매핑해야 합니다.
 */
export function resolveModelId(
  provider?: string,
  model?: string,
): LLMModelId | undefined {
  if (model && !provider) {
    throw new ValidationError(
      "model을 지정할 때 provider도 함께 지정해야 합니다.",
    );
  }

  if (!provider) return undefined;

  if (!isValidProvider(provider)) {
    throw new ValidationError(`지원하지 않는 provider입니다: ${provider}`);
  }

  const available = getAvailableProviders();
  if (!available.includes(provider as LLMProviderName)) {
    throw new ValidationError(`${provider} API 키가 설정되지 않았습니다`);
  }

  const resolvedModel =
    model ?? getDefaultModelForProvider(provider as LLMProviderName);
  const pricing = getModelPricing(provider as LLMProviderName, resolvedModel);
  if (!pricing) {
    throw new ValidationError(
      `지원하지 않는 provider/model 조합입니다: ${provider}/${resolvedModel}`,
    );
  }

  return { provider: provider as LLMProviderName, model: resolvedModel };
}
