/**
 * 원자적 분할기 (핵심 모듈)
 *
 * 하이브리드 분할 전략:
 * - Hard Split (정규식): ---, #### 헤더가 명확한 경우 1차 분리
 * - Soft Split (LLM): 구분자 없지만 밀도 높은 경우 Gemini 제안
 */

import { isTodoContainer, parseContainers } from '../parser/container-parser.js';
import { parseClozes, resetClozesToC1 } from '../parser/cloze-parser.js';
import { parseNidLinks, createBackLink } from '../parser/nid-parser.js';

export interface AtomicCard {
  title: string;
  content: string;
  images: string[];
  nidLinks: string[];
  isMainCard: boolean;
}

export interface SplitAnalysis {
  canHardSplit: boolean;
  hardSplitPoints: HardSplitPoint[];
  hasTodoBlock: boolean;
  clozeCount: number;
  estimatedCards: number;
}

export interface HardSplitPoint {
  type: 'header' | 'divider';
  line: number;
  content: string;
}

// 헤더 패턴 (#### 이모지 헤더)
const HEADER_PATTERN = /^####\s+.+$/;
// 구분선 패턴
const DIVIDER_PATTERN = /^---+$/;
// 이미지 태그 패턴
const IMAGE_PATTERN = /<img\s+src="([^"]+)"/g;

/**
 * 카드 분할 가능성 분석
 */
export function analyzeForSplit(htmlContent: string): SplitAnalysis {
  // HTML <br>을 줄바꿈으로 변환
  const normalized = htmlContent.replace(/<br\s*\/?>/gi, '\n');
  const lines = normalized.split('\n');

  const hardSplitPoints: HardSplitPoint[] = [];
  let hasTodoBlock = false;

  // 컨테이너 분석
  const containers = parseContainers(htmlContent);
  for (const container of containers) {
    if (isTodoContainer(container)) {
      hasTodoBlock = true;
    }
  }

  // 라인별 분석
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (HEADER_PATTERN.test(line)) {
      hardSplitPoints.push({
        type: 'header',
        line: i,
        content: line,
      });
    } else if (DIVIDER_PATTERN.test(line)) {
      hardSplitPoints.push({
        type: 'divider',
        line: i,
        content: line,
      });
    }
  }

  // Cloze 수 계산
  const clozes = parseClozes(htmlContent);

  return {
    canHardSplit: hardSplitPoints.length > 0,
    hardSplitPoints,
    hasTodoBlock,
    clozeCount: clozes.length,
    estimatedCards: Math.max(1, hardSplitPoints.filter((p) => p.type === 'header').length),
  };
}

/**
 * Hard Split 수행 (정규식 기반)
 */
export function performHardSplit(
  htmlContent: string,
  originalNoteId: number
): AtomicCard[] | null {
  const analysis = analyzeForSplit(htmlContent);

  if (!analysis.canHardSplit) {
    return null;
  }

  const normalized = htmlContent.replace(/<br\s*\/?>/gi, '\n');
  const lines = normalized.split('\n');

  const cards: AtomicCard[] = [];
  let currentSection: string[] = [];
  let currentTitle = '';
  let isFirst = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 새 헤더 발견
    if (HEADER_PATTERN.test(trimmed)) {
      // 이전 섹션 저장
      if (currentSection.length > 0) {
        const content = currentSection.join('<br>');
        if (hasMeaningfulContent(content)) {
          cards.push(createAtomicCard(content, currentTitle, isFirst, originalNoteId));
          isFirst = false;
        }
      }

      // 새 섹션 시작
      currentTitle = trimmed;
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentSection.length > 0) {
    const content = currentSection.join('<br>');
    if (hasMeaningfulContent(content)) {
      cards.push(createAtomicCard(content, currentTitle, isFirst, originalNoteId));
    }
  }

  return cards.length > 1 ? cards : null;
}

/**
 * 원자적 카드 생성
 */
function createAtomicCard(
  content: string,
  title: string,
  isMainCard: boolean,
  originalNoteId: number
): AtomicCard {
  // 이미지 추출
  const images: string[] = [];
  let match: RegExpExecArray | null;
  IMAGE_PATTERN.lastIndex = 0;
  while ((match = IMAGE_PATTERN.exec(content)) !== null) {
    images.push(match[1]);
  }

  // nid 링크 추출
  const nidLinks = parseNidLinks(content).map((l) => l.nid);

  // Cloze 번호 초기화 (1 Note = 1 Atomic Card 원칙)
  const normalizedContent = resetClozesToC1(content);

  // 메인 카드가 아니면 역링크 추가
  let finalContent = normalizedContent;
  if (!isMainCard) {
    const backLink = createBackLink('원본 카드', originalNoteId.toString());
    finalContent = `${normalizedContent}<br><br>::: link 관련 카드<br>${backLink}<br>:::`;
  }

  return {
    title: title || extractTitle(content),
    content: finalContent,
    images,
    nidLinks,
    isMainCard,
  };
}

/**
 * 콘텐츠에서 제목 추출
 */
function extractTitle(content: string): string {
  // 첫 번째 헤더 찾기
  const headerMatch = content.match(/###?\s*([^<\n]+)/);
  if (headerMatch) {
    return headerMatch[1].trim().slice(0, 50);
  }

  // 첫 번째 의미 있는 텍스트
  const textMatch = content.match(/<b>([^<]+)<\/b>/);
  if (textMatch) {
    return textMatch[1].trim().slice(0, 50);
  }

  return '분할된 카드';
}

/**
 * 의미 있는 콘텐츠인지 확인
 */
function hasMeaningfulContent(content: string): boolean {
  // HTML 태그 제거
  const textOnly = content.replace(/<[^>]+>/g, '').trim();
  // 최소 20자 이상이어야 함
  return textOnly.length >= 20;
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
  let mainContent = htmlContent;

  for (const container of containers) {
    if (isTodoContainer(container)) {
      todoBlocks.push(container.raw);
      // todo 블록은 mainContent에서 제거하지 않고 유지
    }
  }

  return { mainContent, todoBlocks };
}
