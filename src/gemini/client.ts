/**
 * Gemini API 클라이언트
 */

import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildSplitPrompt } from './prompts.js';
import { validateSplitResponse, type SplitResponse } from './validator.js';

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const MODEL_NAME = 'gemini-3-flash-preview';

export interface CardForSplit {
  noteId: number;
  text: string;
  tags: string[];
}

/**
 * 단일 카드 분할 요청
 */
export async function requestCardSplit(card: CardForSplit): Promise<SplitResponse> {
  const client = getClient();
  const prompt = buildSplitPrompt(card.noteId, card.text);

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini 응답이 비어있습니다.');
  }

  // JSON 파싱 및 검증
  const parsed = JSON.parse(text);
  return validateSplitResponse(parsed);
}

/**
 * 배치 카드 분할 요청 (10~20개 단위)
 */
export async function requestBatchCardSplit(
  cards: CardForSplit[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, SplitResponse>> {
  const results = new Map<number, SplitResponse>();
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000; // Rate limit 대응

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    // 배치 내 병렬 처리
    const batchResults = await Promise.allSettled(
      batch.map((card) => requestCardSplit(card))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
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
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini 응답이 비어있습니다.');
  }

  return JSON.parse(text);
}
