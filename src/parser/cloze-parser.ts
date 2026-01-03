/**
 * Cloze 구문 파서
 *
 * 패턴: {{c숫자::내용::힌트?}}
 * 예: {{c1::정답}}, {{c1::정답::힌트}}
 */

export interface ClozeItem {
  clozeNumber: number;  // c 뒤의 숫자
  content: string;      // :: 사이의 내용
  hint?: string;        // 힌트 (있는 경우)
  raw: string;          // 원본 텍스트
  startIndex: number;
  endIndex: number;
}

// Cloze 패턴: {{c숫자::내용}} 또는 {{c숫자::내용::힌트}}
const CLOZE_REGEX = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

/**
 * 텍스트에서 모든 Cloze 추출
 */
export function parseClozes(content: string): ClozeItem[] {
  const clozes: ClozeItem[] = [];
  let match: RegExpExecArray | null;

  // 정규식 상태 초기화
  CLOZE_REGEX.lastIndex = 0;

  while ((match = CLOZE_REGEX.exec(content)) !== null) {
    clozes.push({
      clozeNumber: parseInt(match[1], 10),
      content: match[2],
      hint: match[3] || undefined,
      raw: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return clozes;
}

/**
 * 가장 높은 Cloze 번호 반환
 */
export function getMaxClozeNumber(content: string): number {
  const clozes = parseClozes(content);
  if (clozes.length === 0) return 0;
  return Math.max(...clozes.map((c) => c.clozeNumber));
}

/**
 * 사용된 모든 Cloze 번호 추출
 */
export function getUsedClozeNumbers(content: string): number[] {
  const clozes = parseClozes(content);
  return [...new Set(clozes.map((c) => c.clozeNumber))].sort((a, b) => a - b);
}

/**
 * Cloze 생성
 */
export function createCloze(number: number, content: string, hint?: string): string {
  if (hint) {
    return `{{c${number}::${content}::${hint}}}`;
  }
  return `{{c${number}::${content}}}`;
}

/**
 * 모든 Cloze 번호를 1로 리셋 (분할 후 원자적 카드용)
 * 1 Note = 1 Atomic Card 원칙: 분할된 카드는 {{c1::}}로 통일
 */
export function resetClozesToC1(content: string): string {
  return content.replace(CLOZE_REGEX, (match, _num, innerContent, hint) => {
    return createCloze(1, innerContent, hint);
  });
}

/**
 * Cloze 번호 재정렬 (1부터 순차적으로)
 */
export function renumberClozes(content: string): string {
  const clozes = parseClozes(content);
  if (clozes.length === 0) return content;

  // 기존 번호 -> 새 번호 매핑
  const usedNumbers = getUsedClozeNumbers(content);
  const numberMap: Record<number, number> = {};
  usedNumbers.forEach((num, i) => {
    numberMap[num] = i + 1;
  });

  // 역순으로 교체 (인덱스 변경 방지)
  let result = content;
  for (let i = clozes.length - 1; i >= 0; i--) {
    const cloze = clozes[i];
    const newNumber = numberMap[cloze.clozeNumber];
    const newCloze = createCloze(newNumber, cloze.content, cloze.hint);
    result = result.slice(0, cloze.startIndex) + newCloze + result.slice(cloze.endIndex);
  }

  return result;
}

/**
 * Cloze 통계 추출
 */
export function getClozeStats(content: string): {
  totalClozes: number;
  uniqueNumbers: number;
  numberCounts: Record<number, number>;
} {
  const clozes = parseClozes(content);
  const numberCounts: Record<number, number> = {};

  for (const cloze of clozes) {
    numberCounts[cloze.clozeNumber] = (numberCounts[cloze.clozeNumber] || 0) + 1;
  }

  return {
    totalClozes: clozes.length,
    uniqueNumbers: Object.keys(numberCounts).length,
    numberCounts,
  };
}

/**
 * Cloze가 없는 텍스트인지 확인
 */
export function hasNoCloze(content: string): boolean {
  const clozes = parseClozes(content);
  return clozes.length === 0;
}

/**
 * Cloze 내용만 추출 (Cloze 마크업 제거)
 */
export function extractClozeContents(content: string): string {
  return content.replace(CLOZE_REGEX, '$2');
}
