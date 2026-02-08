/**
 * Gemini API 클라이언트
 */

import { GoogleGenAI } from "@google/genai";
import {
  buildSplitPrompt,
  buildSplitPromptFromTemplate,
  SYSTEM_PROMPT,
} from "./prompts.js";
import { type SplitResponse, validateSplitResponse } from "./validator.js";

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

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

const MODEL_NAME = "gemini-3-flash-preview";

export interface CardForSplit {
  noteId: number;
  text: string;
  tags: string[];
}

/**
 * 단일 카드 분할 요청
 * @param card - 분할할 카드 정보
 * @param prompts - resolve된 프롬프트 (버전별 A/B 테스트용). 없으면 기본 프롬프트 사용.
 */
export async function requestCardSplit(
  card: CardForSplit,
  prompts?: { systemPrompt: string; splitPromptTemplate: string },
): Promise<SplitResponse & { tokenUsage?: TokenUsage }> {
  const client = getClient();

  const systemPrompt = prompts?.systemPrompt ?? SYSTEM_PROMPT;
  const userPrompt = prompts
    ? buildSplitPromptFromTemplate(
        prompts.splitPromptTemplate,
        card.noteId,
        card.text,
        card.tags,
      )
    : buildSplitPrompt(card.noteId, card.text);

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어있습니다.");
  }

  // usageMetadata에서 토큰 사용량 추출
  const usage = response.usageMetadata;
  const tokenUsage: TokenUsage | undefined = usage
    ? {
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
      }
    : undefined;

  // JSON 파싱 및 검증
  const parsed = JSON.parse(text);
  const validated = validateSplitResponse(parsed);
  return { ...validated, tokenUsage };
}

/**
 * 배치 카드 분할 요청 (10~20개 단위)
 */
export async function requestBatchCardSplit(
  cards: CardForSplit[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<number, SplitResponse>> {
  const results = new Map<number, SplitResponse>();
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000; // Rate limit 대응

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    // 배치 내 병렬 처리
    const batchResults = await Promise.allSettled(
      batch.map((card) => requestCardSplit(card)),
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
export async function analyzeCardForSplit(card: CardForSplit): Promise<{
  needsSplit: boolean;
  reason: string;
  suggestedSplitCount: number;
}> {
  const client = getClient();

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

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: analysisPrompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어있습니다.");
  }

  return JSON.parse(text);
}
