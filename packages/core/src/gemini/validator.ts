/**
 * Gemini 응답 검증 (zod 스키마)
 *
 * OperationResponseSchema: split | compact | skip 판별 유니온
 * Legacy fallback: shouldSplit 기반 응답을 자동 변환
 */

import { z } from "zod";

// ── 분할 카드 스키마 ──────────────────────────────────────────
const SplitCardSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  cardType: z.enum(["cloze", "basic"]).optional().default("cloze"),
  contextTag: z.string().optional(),
  inheritImages: z.array(z.string()).default([]),
  inheritTags: z.array(z.string()).default([]),
  preservedLinks: z.array(z.string()).default([]),
  backLinks: z.array(z.string()).default([]),
});

// ── 품질 체크 스키마 ──────────────────────────────────────────
const QualityChecksSchema = z.object({
  allClozeHaveHints: z.boolean(),
  allContextTagsPresent: z.boolean(),
});

// ── Legacy 품질 체크 스키마 (shouldSplit 변환 시 사용) ─────────
const LegacyQualityChecksSchema = z
  .object({
    allCardsUnder80Chars: z.boolean().optional(),
    allClozeHaveHints: z.boolean().optional(),
    noEnumerations: z.boolean().optional(),
    allContextTagsPresent: z.boolean().optional(),
  })
  .optional()
  .nullable();

// ── Discriminated Union 스키마 ────────────────────────────────
const BaseSchema = z.object({
  originalNoteId: z.union([z.string(), z.number()]).transform(String),
  operationReason: z.string(),
});

const SplitSchema = BaseSchema.extend({
  operation: z.literal("split"),
  mainCardIndex: z.number().int().min(0),
  splitCards: z.array(SplitCardSchema).min(2),
  qualityChecks: QualityChecksSchema,
});

const CompactSchema = BaseSchema.extend({
  operation: z.literal("compact"),
  compactedContent: z.string().min(1),
  auditReport: z.object({
    preserved: z.array(z.string()),
    removed: z.array(z.string()),
    transformed: z.array(z.string()),
  }),
  qualityChecks: QualityChecksSchema,
});

const SkipSchema = BaseSchema.extend({
  operation: z.literal("skip"),
});

const OperationResponseSchema = z.discriminatedUnion("operation", [
  SplitSchema,
  CompactSchema,
  SkipSchema,
]);

// ── Legacy SplitResponse 스키마 (deprecated, 하위 호환용) ─────
const SplitResponseSchema = z.object({
  originalNoteId: z.union([z.string(), z.number()]).transform(String),
  shouldSplit: z.boolean(),
  mainCardIndex: z.number().int().min(0),
  splitCards: z.array(SplitCardSchema),
  splitReason: z.string(),
  qualityChecks: LegacyQualityChecksSchema,
});

// 분석 응답 스키마
const AnalysisResponseSchema = z.object({
  needsSplit: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string(),
  suggestedSplitCount: z.number().int().min(0),
  splitPoints: z.array(z.string()).optional(),
});

// ── Exported types ────────────────────────────────────────────
export type SplitCard = z.infer<typeof SplitCardSchema>;
export type SplitResponse = z.infer<typeof SplitResponseSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export type OperationResponse = z.infer<typeof OperationResponseSchema>;
export type SplitOperationResponse = z.infer<typeof SplitSchema>;
export type CompactOperationResponse = z.infer<typeof CompactSchema>;
export type SkipOperationResponse = z.infer<typeof SkipSchema>;

// ── Legacy 변환 ───────────────────────────────────────────────

interface LegacyData {
  originalNoteId: string | number;
  shouldSplit: boolean;
  mainCardIndex: number;
  splitCards: Array<{ title?: string; content: string; [key: string]: unknown }>;
  splitReason: string;
  qualityChecks?: {
    allClozeHaveHints?: boolean;
    allContextTagsPresent?: boolean;
    [key: string]: unknown;
  } | null;
}

/**
 * shouldSplit 기반 레거시 응답을 operation 기반으로 변환
 */
function convertLegacyResponse(data: LegacyData): Record<string, unknown> {
  const { originalNoteId, shouldSplit, splitCards, splitReason, qualityChecks } = data;

  if (!shouldSplit) {
    return {
      originalNoteId,
      operation: "skip",
      operationReason: splitReason,
    };
  }

  // shouldSplit: true
  if (splitCards.length === 0) {
    throw new Error("shouldSplit이 true인데 splitCards가 비어있습니다.");
  }

  if (splitCards.length === 1) {
    // compact: 단일 카드로 압축
    return {
      originalNoteId,
      operation: "compact",
      operationReason: splitReason,
      compactedContent: splitCards[0].content,
      auditReport: {
        preserved: [],
        removed: [],
        transformed: [],
      },
      qualityChecks: {
        allClozeHaveHints: qualityChecks?.allClozeHaveHints ?? false,
        allContextTagsPresent: qualityChecks?.allContextTagsPresent ?? false,
      },
    };
  }

  // split: 2개 이상 카드
  return {
    originalNoteId,
    operation: "split",
    operationReason: splitReason,
    mainCardIndex: data.mainCardIndex,
    splitCards,
    qualityChecks: {
      allClozeHaveHints: qualityChecks?.allClozeHaveHints ?? false,
      allContextTagsPresent: qualityChecks?.allContextTagsPresent ?? false,
    },
  };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Operation 응답 검증 (discriminated union)
 *
 * Legacy shouldSplit 응답도 자동 변환하여 처리합니다.
 */
export function validateOperationResponse(data: unknown): OperationResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any;

  // Legacy fallback: shouldSplit 필드 감지 시 변환
  let target: unknown = data;
  if (raw && typeof raw === "object" && "shouldSplit" in raw) {
    target = convertLegacyResponse(raw as LegacyData);
  }

  const result = OperationResponseSchema.safeParse(target);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Operation 응답 검증 실패: ${errors}`);
  }

  // 추가 검증: split의 mainCardIndex 범위
  if (result.data.operation === "split") {
    if (result.data.mainCardIndex >= result.data.splitCards.length) {
      throw new Error(
        `mainCardIndex(${result.data.mainCardIndex})가 splitCards 범위(${result.data.splitCards.length})를 벗어났습니다.`,
      );
    }
  }

  return result.data;
}

/**
 * 분할 응답 검증 (deprecated — validateOperationResponse 사용 권장)
 * @deprecated
 */
export function validateSplitResponse(data: unknown): SplitResponse {
  const result = SplitResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`분할 응답 검증 실패: ${errors}`);
  }

  // 추가 검증: 분할이 필요한 경우 splitCards가 있어야 함
  if (result.data.shouldSplit && result.data.splitCards.length === 0) {
    throw new Error("분할이 필요하다고 했지만 splitCards가 비어있습니다.");
  }

  // 추가 검증: mainCardIndex가 범위 내인지
  if (result.data.shouldSplit && result.data.mainCardIndex >= result.data.splitCards.length) {
    throw new Error(
      `mainCardIndex(${result.data.mainCardIndex})가 splitCards 범위를 벗어났습니다.`,
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
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
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
  processed: string,
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
