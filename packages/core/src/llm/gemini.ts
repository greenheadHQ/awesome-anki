/**
 * Gemini LLM 어댑터
 * 기존 gemini/client.ts의 getClient() 싱글톤 패턴 재사용
 */

import { GoogleGenAI } from "@google/genai";
import { computeCost, getModelPricing } from "./pricing.js";
import type {
  LLMGenerationOptions,
  LLMGenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.",
      );
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export class GeminiAdapter implements LLMProvider {
  readonly name = "gemini" as const;

  async generateContent(
    prompt: string,
    options: LLMGenerationOptions,
  ): Promise<LLMGenerationResult> {
    const client = getClient();
    const model = options.model ?? DEFAULT_GEMINI_MODEL;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        ...(options.systemPrompt && {
          systemInstruction: options.systemPrompt,
        }),
        ...(options.responseMimeType && {
          responseMimeType: options.responseMimeType,
        }),
        ...(options.maxOutputTokens && {
          maxOutputTokens: options.maxOutputTokens,
        }),
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        `LLM 응답이 비어있습니다 (provider: gemini, model: ${model})`,
      );
    }

    const usage = response.usageMetadata;
    const tokenUsage: TokenUsage = {
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
    };

    const modelId = { provider: this.name, model };
    const pricing = getModelPricing("gemini", model);
    const actualCost = pricing ? computeCost(tokenUsage, pricing) : undefined;

    return { text, tokenUsage, modelId, actualCost };
  }

  async countTokens(text: string, model?: string): Promise<number> {
    const client = getClient();
    const targetModel = model ?? DEFAULT_GEMINI_MODEL;

    const result = await client.models.countTokens({
      model: targetModel,
      contents: text,
    });

    return result.totalTokens ?? 0;
  }
}

export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
