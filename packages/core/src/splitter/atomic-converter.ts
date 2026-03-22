/**
 * 원자적 분할기 (핵심 모듈)
 *
 * Gemini 기반 단일 Split 전략
 */

import { parseClozes } from "../parser/cloze-parser.js";
import { isTodoContainer, parseContainers } from "../parser/container-parser.js";
import { computeTextLength } from "../parser/text-length.js";

/** 카드당 최대 Cloze 수. 이를 초과하면 분할 대상 (UI: "N+1개 이상") */
export const MAX_CLOZES_PER_CARD = 3;

/** 카드 텍스트 최대 길이 (HTML 태그 제외). 이를 초과하면 최적화 대상 */
export const MAX_TEXT_LENGTH = 500;

export interface AtomicCard {
  title: string;
  content: string;
  images: string[];
  nidLinks: string[];
  isMainCard: boolean;
}

export interface SplitAnalysis {
  canSplit: boolean;
  hasTodoBlock: boolean;
  clozeCount: number;
  estimatedCards: number;
}

export interface OptimizationAnalysis {
  needsOptimization: boolean;
  reasons: {
    clozeOverflow: boolean;   // clozeCount > MAX_CLOZES_PER_CARD
    textOverflow: boolean;    // textLength > MAX_TEXT_LENGTH
  };
  hasTodoBlock: boolean;
  clozeCount: number;
  textLength: number;         // HTML 태그 제외 순수 텍스트 길이 (computeTextLength 사용)
}

/**
 * 카드 최적화 필요 여부 분석 (split 또는 compact 트리거 판정)
 */
export function analyzeForOptimization(htmlContent: string): OptimizationAnalysis {
  // 컨테이너 분석
  let hasTodoBlock = false;
  const containers = parseContainers(htmlContent);
  for (const container of containers) {
    if (isTodoContainer(container)) {
      hasTodoBlock = true;
    }
  }

  // Cloze 수 계산
  const clozes = parseClozes(htmlContent);
  const clozeCount = clozes.length;

  // 텍스트 길이 계산 (HTML 태그 제외)
  const textLength = computeTextLength(htmlContent);

  const clozeOverflow = clozeCount > MAX_CLOZES_PER_CARD;
  const textOverflow = textLength > MAX_TEXT_LENGTH;

  return {
    needsOptimization: clozeOverflow || textOverflow,
    reasons: {
      clozeOverflow,
      textOverflow,
    },
    hasTodoBlock,
    clozeCount,
    textLength,
  };
}

/**
 * 카드 분할 가능성 분석
 * @deprecated Use analyzeForOptimization instead
 */
export function analyzeForSplit(htmlContent: string): SplitAnalysis {
  let hasTodoBlock = false;

  // 컨테이너 분석
  const containers = parseContainers(htmlContent);
  for (const container of containers) {
    if (isTodoContainer(container)) {
      hasTodoBlock = true;
    }
  }

  // Cloze 수 계산
  const clozes = parseClozes(htmlContent);
  const clozeCount = clozes.length;

  const canSplit = clozeCount > MAX_CLOZES_PER_CARD;

  return {
    canSplit,
    hasTodoBlock,
    clozeCount,
    estimatedCards: canSplit ? Math.ceil(clozeCount / MAX_CLOZES_PER_CARD) : 1,
  };
}

/**
 * todo 블록 보존 (분할 대상에서 제외)
 */
export function extractTodoBlocks(htmlContent: string): {
  mainContent: string;
  todoBlocks: string[];
} {
  const containers = parseContainers(htmlContent);
  const todoBlocks: string[] = [];
  const mainContent = htmlContent;

  for (const container of containers) {
    if (isTodoContainer(container)) {
      todoBlocks.push(container.raw);
      // todo 블록은 mainContent에서 제거하지 않고 유지
    }
  }

  return { mainContent, todoBlocks };
}
