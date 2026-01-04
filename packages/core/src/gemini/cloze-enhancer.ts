/**
 * Cloze Enhancer - 이진 패턴 감지 및 힌트 자동 추가
 * SuperMemo's Twenty Rules 기반
 */

/**
 * 이진 패턴 정의
 * pattern: 감지할 정규식 패턴
 * hint: 추가할 힌트 텍스트
 */
export interface BinaryPattern {
  pattern: RegExp;
  hint: string;
  category: 'existence' | 'direction' | 'connection' | 'state' | 'layer' | 'evaluation';
}

/**
 * 이진 패턴 목록 (대조를 통한 기억 강화)
 */
export const BINARY_PATTERNS: BinaryPattern[] = [
  // 존재/상태 (existence)
  { pattern: /있다|없다/, hint: '있다 | 없다', category: 'existence' },
  { pattern: /가능|불가능/, hint: '가능 ○ | 불가능 ✕', category: 'existence' },
  { pattern: /필요|불필요/, hint: '필요 | 불필요', category: 'existence' },
  { pattern: /포함|미포함/, hint: '포함 | 미포함', category: 'existence' },

  // 방향성 (direction)
  { pattern: /증가|감소/, hint: '증가 ↑ | 감소 ↓', category: 'direction' },
  { pattern: /상향|하향/, hint: '상향 ↑ | 하향 ↓', category: 'direction' },
  { pattern: /상승|하락/, hint: '상승 ↑ | 하락 ↓', category: 'direction' },
  { pattern: /빠르다|느리다/, hint: '빠름 | 느림', category: 'direction' },
  { pattern: /크다|작다/, hint: '큼 | 작음', category: 'direction' },
  { pattern: /높다|낮다/, hint: '높음 | 낮음', category: 'direction' },

  // 연결/동기화 (connection)
  { pattern: /동기|비동기/, hint: 'Sync | Async', category: 'connection' },
  { pattern: /블로킹|논블로킹/, hint: 'Blocking | Non-blocking', category: 'connection' },
  { pattern: /연결 지향|비연결/, hint: '연결 지향 | 비연결', category: 'connection' },
  { pattern: /직렬|병렬/, hint: 'Serial | Parallel', category: 'connection' },

  // 상태 (state)
  { pattern: /상태|무상태/, hint: 'Stateful | Stateless', category: 'state' },
  { pattern: /유상태|무상태/, hint: 'Stateful | Stateless', category: 'state' },
  { pattern: /영구|임시/, hint: 'Persistent | Temporary', category: 'state' },
  { pattern: /휘발성|비휘발성/, hint: 'Volatile | Non-volatile', category: 'state' },

  // 물리/논리 계층 (layer)
  { pattern: /물리|논리/, hint: 'Physical | Logical', category: 'layer' },
  { pattern: /하드웨어|소프트웨어/, hint: 'HW | SW', category: 'layer' },
  { pattern: /로컬|원격/, hint: 'Local | Remote', category: 'layer' },
  { pattern: /내부|외부/, hint: 'Internal | External', category: 'layer' },

  // 평가 (evaluation)
  { pattern: /장점|단점/, hint: 'Pros ✓ | Cons ✗', category: 'evaluation' },
  { pattern: /적용된다|적용되지 않는다/, hint: '적용 ○ | 미적용 ✕', category: 'evaluation' },
  { pattern: /성공|실패/, hint: 'Success ✓ | Fail ✗', category: 'evaluation' },
  { pattern: /허용|금지/, hint: 'Allowed | Forbidden', category: 'evaluation' },
];

/**
 * Cloze 패턴에서 값 추출
 */
export function extractClozeValue(clozeMatch: string): string | null {
  // {{c1::값}} 또는 {{c1::값::힌트}} 형식
  const match = clozeMatch.match(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/);
  return match ? match[1].trim() : null;
}

/**
 * Cloze에 이미 힌트가 있는지 확인
 */
export function hasHint(clozeMatch: string): boolean {
  // {{c1::값::힌트}} 형식인지 확인
  return /\{\{c\d+::[^:}]+::[^}]+\}\}/.test(clozeMatch);
}

/**
 * 이진 패턴 감지
 */
export function detectBinaryPattern(clozeValue: string): BinaryPattern | null {
  for (const bp of BINARY_PATTERNS) {
    if (bp.pattern.test(clozeValue)) {
      return bp;
    }
  }
  return null;
}

/**
 * Cloze에 힌트 추가
 */
export function addHintToCloze(clozeMatch: string, hint: string): string {
  // {{c1::값}} -> {{c1::값::힌트}}
  return clozeMatch.replace(
    /\{\{(c\d+)::([^:}]+)\}\}/,
    `{{$1::$2::${hint}}}`
  );
}

/**
 * 텍스트 내 모든 Cloze 분석 결과
 */
export interface ClozeAnalysis {
  original: string;
  clozeMatches: Array<{
    match: string;
    value: string;
    hasHint: boolean;
    detectedPattern: BinaryPattern | null;
    needsHint: boolean;
  }>;
  enhanced: string;
  enhancedCount: number;
}

/**
 * 텍스트 내 모든 Cloze 분석 및 힌트 추가
 */
export function analyzeClozes(text: string): ClozeAnalysis {
  const clozePattern = /\{\{c\d+::[^}]+\}\}/g;
  const matches = text.match(clozePattern) || [];

  const analysis: ClozeAnalysis['clozeMatches'] = [];
  let enhanced = text;
  let enhancedCount = 0;

  for (const match of matches) {
    const value = extractClozeValue(match);
    const alreadyHasHint = hasHint(match);
    const pattern = value ? detectBinaryPattern(value) : null;
    const needsHint = !alreadyHasHint && pattern !== null;

    analysis.push({
      match,
      value: value || '',
      hasHint: alreadyHasHint,
      detectedPattern: pattern,
      needsHint,
    });

    // 힌트가 필요하면 추가
    if (needsHint && pattern) {
      const newCloze = addHintToCloze(match, pattern.hint);
      enhanced = enhanced.replace(match, newCloze);
      enhancedCount++;
    }
  }

  return {
    original: text,
    clozeMatches: analysis,
    enhanced,
    enhancedCount,
  };
}

/**
 * 카드 배열에 대해 일괄 힌트 추가
 */
export function enhanceCardsWithHints(cards: Array<{ content: string }>): Array<{
  content: string;
  enhanced: boolean;
  enhancedCount: number;
}> {
  return cards.map((card) => {
    const analysis = analyzeClozes(card.content);
    return {
      content: analysis.enhanced,
      enhanced: analysis.enhancedCount > 0,
      enhancedCount: analysis.enhancedCount,
    };
  });
}

/**
 * 카드 글자 수 계산 (Cloze 마크업 제외)
 */
export function countCardChars(content: string): number {
  // Cloze 마크업 제거: {{c1::값}} -> 값, {{c1::값::힌트}} -> 값
  const withoutCloze = content
    .replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/g, '$1')
    // HTML 태그 제거
    .replace(/<[^>]+>/g, '')
    // 컨테이너 마크업 제거
    .replace(/:::\s*\w+[^\n]*/g, '')
    .replace(/:::/g, '')
    // 맥락 태그 제거 (글자 수에 포함하지 않음)
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  return withoutCloze.length;
}

/**
 * 카드 타입 자동 감지
 */
export function detectCardType(content: string): 'cloze' | 'basic' {
  // Q: ... A: ... 형식이면 Basic
  if (/^Q:|Q:\s/.test(content.trim()) && /A:|A:\s/.test(content)) {
    return 'basic';
  }
  // Cloze 마크업이 있으면 Cloze
  if (/\{\{c\d+::.+\}\}/.test(content)) {
    return 'cloze';
  }
  // 기본값은 Cloze
  return 'cloze';
}

/**
 * 카드 품질 검사
 */
export interface CardQualityCheck {
  charCount: number;
  isUnder80Chars: boolean;
  hasHint: boolean;
  needsHint: boolean;
  hasContextTag: boolean;
  cardType: 'cloze' | 'basic';
  issues: string[];
}

export function checkCardQuality(content: string): CardQualityCheck {
  const charCount = countCardChars(content);
  const analysis = analyzeClozes(content);
  const cardType = detectCardType(content);

  // 맥락 태그 확인 [A > B > C] 형식
  const hasContextTag = /^\s*\[.+>.+\]/.test(content) || /\[.+>.+\]/.test(content);

  const issues: string[] = [];

  // 글자 수 체크
  if (cardType === 'cloze' && charCount > 80) {
    issues.push(`Cloze 카드가 ${charCount}자로 80자 초과`);
  }
  if (cardType === 'basic') {
    const frontMatch = content.match(/Q:\s*([\s\S]+?)(?=A:|$)/);
    if (frontMatch) {
      const frontChars = frontMatch[1].trim().length;
      if (frontChars > 40) {
        issues.push(`Basic Front가 ${frontChars}자로 40자 초과`);
      }
    }
  }

  // 힌트 필요 여부
  const needsHint = analysis.clozeMatches.some(c => c.needsHint);
  const hasHint = analysis.clozeMatches.some(c => c.hasHint);

  if (needsHint) {
    issues.push('이진 패턴 Cloze에 힌트 필요');
  }

  // 맥락 태그
  if (!hasContextTag) {
    issues.push('중첩 맥락 태그 [A > B] 없음');
  }

  return {
    charCount,
    isUnder80Chars: charCount <= 80,
    hasHint,
    needsHint,
    hasContextTag,
    cardType,
    issues,
  };
}
