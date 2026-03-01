/**
 * 원자적 분할기 (핵심 모듈)
 *
 * Gemini 기반 단일 Split 전략
 */

import { parseClozes } from "../parser/cloze-parser.js";
import {
  isTodoContainer,
  parseContainers,
} from "../parser/container-parser.js";

/** 카드당 최대 Cloze 수. 이를 초과하면 분할 대상 (UI: "N+1개 이상") */
export const MAX_CLOZES_PER_CARD = 3;

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

/**
 * 카드 분할 가능성 분석
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
