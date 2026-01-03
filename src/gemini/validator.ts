/**
 * Gemini 응답 검증 (zod 스키마)
 */

import { z } from 'zod';

// 분할 카드 스키마
const SplitCardSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  inheritImages: z.array(z.string()).default([]),
  inheritTags: z.array(z.string()).default([]),
  preservedLinks: z.array(z.string()).default([]),
  backLinks: z.array(z.string()).default([]),
});

// 분할 응답 스키마
const SplitResponseSchema = z.object({
  originalNoteId: z.union([z.string(), z.number()]).transform(String),
  shouldSplit: z.boolean(),
  mainCardIndex: z.number().int().min(0),
  splitCards: z.array(SplitCardSchema),
  splitReason: z.string(),
  splitType: z.enum(['hard', 'soft', 'none']),
});

// 분석 응답 스키마
const AnalysisResponseSchema = z.object({
  needsSplit: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string(),
  suggestedSplitCount: z.number().int().min(0),
  splitPoints: z.array(z.string()).optional(),
});

export type SplitCard = z.infer<typeof SplitCardSchema>;
export type SplitResponse = z.infer<typeof SplitResponseSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

/**
 * 분할 응답 검증
 */
export function validateSplitResponse(data: unknown): SplitResponse {
  const result = SplitResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`분할 응답 검증 실패: ${errors}`);
  }

  // 추가 검증: 분할이 필요한 경우 splitCards가 있어야 함
  if (result.data.shouldSplit && result.data.splitCards.length === 0) {
    throw new Error('분할이 필요하다고 했지만 splitCards가 비어있습니다.');
  }

  // 추가 검증: mainCardIndex가 범위 내인지
  if (result.data.shouldSplit && result.data.mainCardIndex >= result.data.splitCards.length) {
    throw new Error(
      `mainCardIndex(${result.data.mainCardIndex})가 splitCards 범위를 벗어났습니다.`
    );
  }

  return result.data;
}

/**
 * 분석 응답 검증
 */
export function validateAnalysisResponse(data: unknown): AnalysisResponse {
  const result = AnalysisResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`분석 응답 검증 실패: ${errors}`);
  }

  return result.data;
}

/**
 * Cloze 존재 여부 검증
 */
export function validateClozePresence(content: string): boolean {
  const clozePattern = /\{\{c\d+::[^}]+\}\}/;
  return clozePattern.test(content);
}

/**
 * 분할 카드들의 Cloze 검증
 */
export function validateAllCardsHaveCloze(cards: SplitCard[]): {
  valid: boolean;
  invalidIndices: number[];
} {
  const invalidIndices: number[] = [];

  cards.forEach((card, index) => {
    if (!validateClozePresence(card.content)) {
      invalidIndices.push(index);
    }
  });

  return {
    valid: invalidIndices.length === 0,
    invalidIndices,
  };
}

/**
 * HTML 스타일 보존 검증
 */
export function validateStylePreservation(
  original: string,
  processed: string
): {
  preserved: boolean;
  missingStyles: string[];
} {
  // 원본에서 스타일 태그 추출
  const stylePatterns = [
    /<span\s+style="[^"]*color[^"]*">/gi,
    /<font\s+color="[^"]*">/gi,
    /<b>/gi,
    /<u>/gi,
    /<sup>/gi,
  ];

  const missingStyles: string[] = [];

  for (const pattern of stylePatterns) {
    const originalMatches = original.match(pattern) || [];
    const processedMatches = processed.match(pattern) || [];

    if (originalMatches.length > processedMatches.length) {
      missingStyles.push(pattern.source);
    }
  }

  return {
    preserved: missingStyles.length === 0,
    missingStyles,
  };
}
