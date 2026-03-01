/**
 * OpenAI LLM 어댑터
 * Responses API + JSON 안정성 보호
 */

import { computeCost, getModelPricing } from "./pricing.js";
import type {
  LLMGenerationOptions,
  LLMGenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types.js";

const DEFAULT_MODEL = "gpt-5-mini";

let openaiClient: import("openai").default | null = null;

async function getClient(): Promise<import("openai").default> {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.",
      );
    }
    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * 응답 정규화: markdown code fence 제거 + refusal 체크
 */
function normalizeResponseText(response: {
  output_text: string;
  // biome-ignore lint/suspicious/noExplicitAny: OpenAI response type
  output: any[];
}): string {
  // refusal 체크
  for (const item of response.output) {
    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "refusal" && content.refusal) {
          throw new Error(`모델 거부: ${content.refusal}`);
        }
      }
    }
  }

  const text = response.output_text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export class OpenAIAdapter implements LLMProvider {
  readonly name = "openai" as const;

  async generateContent(
    prompt: string,
    options: LLMGenerationOptions,
  ): Promise<LLMGenerationResult> {
    const client = await getClient();
    const model = options.model ?? DEFAULT_MODEL;

    const isJsonMode = options.responseMimeType === "application/json";

    const input: Array<{
      role: "user" | "assistant" | "system" | "developer";
      content: string;
    }> = [];

    if (options.systemPrompt) {
      input.push({ role: "developer", content: options.systemPrompt });
    }

    input.push({ role: "user", content: prompt });

    let text: string;
    let tokenUsage: TokenUsage;

    const makeRequest = async (temperature?: number) => {
      const response = await client.responses.create({
        model,
        input,
        ...(isJsonMode && {
          text: { format: { type: "json_object" as const } },
        }),
        ...(options.maxOutputTokens && {
          max_output_tokens: options.maxOutputTokens,
        }),
        ...(temperature != null && { temperature }),
      });

      return {
        text: normalizeResponseText(response),
        usage: response.usage,
      };
    };

    const extractUsage = (
      usage:
        | {
            input_tokens?: number;
            output_tokens?: number;
          }
        | null
        | undefined,
    ): TokenUsage => ({
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    });

    const result = await makeRequest();
    text = result.text;
    tokenUsage = extractUsage(result.usage);

    // DA Fix: JSON 모드에서 파싱 검증 + 실패 시 1회 재시도 (토큰 누적 합산)
    if (isJsonMode) {
      try {
        JSON.parse(text);
      } catch {
        const firstUsage = tokenUsage;
        const retryResult = await makeRequest(0.1);
        text = retryResult.text;
        const retryUsage = extractUsage(retryResult.usage);
        tokenUsage = {
          promptTokens:
            (firstUsage.promptTokens ?? 0) + (retryUsage.promptTokens ?? 0),
          completionTokens:
            (firstUsage.completionTokens ?? 0) +
            (retryUsage.completionTokens ?? 0),
          totalTokens:
            (firstUsage.totalTokens ?? 0) + (retryUsage.totalTokens ?? 0),
        };
        JSON.parse(text); // 재시도 후에도 실패하면 호출부로 전파
      }
    }

    const modelId = { provider: this.name, model };
    const pricing = getModelPricing("openai", model);
    const actualCost = pricing ? computeCost(tokenUsage, pricing) : undefined;

    return { text, tokenUsage, modelId, actualCost };
  }

  /**
   * 토큰 수 추정 (휴리스틱)
   * 한국어 보정 계수(x1.5) + safety multiplier(x1.3)
   */
  async countTokens(text: string): Promise<number> {
    const baseEstimate = Math.ceil(text.length / 4);
    const koreanRatio = text.match(/[\uAC00-\uD7A3]/g)?.length ?? 0;
    const totalChars = text.length || 1;
    const koreanFraction = koreanRatio / totalChars;

    // 한국어 비율에 따른 보정: 순수 영어 x1.0, 순수 한국어 x1.5
    const koreanMultiplier = 1.0 + koreanFraction * 0.5;
    const safetyMultiplier = 1.3;

    return Math.ceil(baseEstimate * koreanMultiplier * safetyMultiplier);
  }
}

export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
