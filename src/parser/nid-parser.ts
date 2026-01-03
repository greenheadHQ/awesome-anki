/**
 * nid 링크 파서
 *
 * 패턴: [제목|nid{13자리숫자}]
 * 예: [CPU|nid1726891647690]
 */

export interface NidLink {
  title: string;
  nid: string;
  raw: string;        // 원본 텍스트
  startIndex: number; // 문자열 내 시작 위치
  endIndex: number;   // 문자열 내 끝 위치
}

// nid 링크 패턴: [제목|nid13자리숫자]
const NID_LINK_REGEX = /\[([^\]|]+)\|nid(\d{13})\]/g;

/**
 * 텍스트에서 모든 nid 링크 추출
 */
export function parseNidLinks(content: string): NidLink[] {
  const links: NidLink[] = [];
  let match: RegExpExecArray | null;

  // 정규식 상태 초기화
  NID_LINK_REGEX.lastIndex = 0;

  while ((match = NID_LINK_REGEX.exec(content)) !== null) {
    links.push({
      title: match[1],
      nid: match[2],
      raw: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return links;
}

/**
 * 특정 nid가 텍스트에 존재하는지 확인
 */
export function hasNidLink(content: string, nid: string): boolean {
  const links = parseNidLinks(content);
  return links.some((link) => link.nid === nid);
}

/**
 * 텍스트에서 모든 고유 nid 추출
 */
export function extractUniqueNids(content: string): string[] {
  const links = parseNidLinks(content);
  return [...new Set(links.map((link) => link.nid))];
}

/**
 * nid 링크 생성
 */
export function createNidLink(title: string, nid: string): string {
  return `[${title}|nid${nid}]`;
}

/**
 * 역링크 생성 (분할 카드에서 원본 카드로의 링크)
 */
export function createBackLink(originalTitle: string, originalNid: string): string {
  return createNidLink(`원문: ${originalTitle}`, originalNid);
}

/**
 * nid를 새 nid로 교체
 */
export function replaceNid(content: string, oldNid: string, newNid: string): string {
  const pattern = new RegExp(`\\|nid${oldNid}\\]`, 'g');
  return content.replace(pattern, `|nid${newNid}]`);
}

/**
 * 자기 참조 링크인지 확인 (카드가 자신의 nid를 참조)
 */
export function isSelfReference(content: string, noteId: number): boolean {
  return hasNidLink(content, noteId.toString());
}

/**
 * 텍스트에서 nid 링크 통계 추출
 */
export function getNidLinkStats(content: string): {
  totalLinks: number;
  uniqueNids: number;
  nidCounts: Record<string, number>;
} {
  const links = parseNidLinks(content);
  const nidCounts: Record<string, number> = {};

  for (const link of links) {
    nidCounts[link.nid] = (nidCounts[link.nid] || 0) + 1;
  }

  return {
    totalLinks: links.length,
    uniqueNids: Object.keys(nidCounts).length,
    nidCounts,
  };
}
