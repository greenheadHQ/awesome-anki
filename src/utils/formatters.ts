/**
 * 스타일 보존 필터 및 포맷터
 */

/**
 * HTML 인라인 스타일 보존 목록
 */
const PRESERVED_PATTERNS = [
  // color 스타일
  /<span\s+style="[^"]*color[^"]*">/gi,
  /<font\s+color="[^"]*">/gi,
  // 텍스트 스타일
  /<b>/gi,
  /<\/b>/gi,
  /<u>/gi,
  /<\/u>/gi,
  /<sup>/gi,
  /<\/sup>/gi,
  // 이미지
  /<img\s+src="[^"]*"[^>]*>/gi,
];

/**
 * 원본의 스타일을 추출하여 맵으로 반환
 */
export function extractStyles(html: string): Map<string, number> {
  const styleMap = new Map<string, number>();

  for (const pattern of PRESERVED_PATTERNS) {
    const matches = html.match(pattern) || [];
    for (const match of matches) {
      styleMap.set(match, (styleMap.get(match) || 0) + 1);
    }
  }

  return styleMap;
}

/**
 * 스타일 보존 여부 검증
 */
export function validateStylePreservation(
  original: string,
  processed: string
): {
  isValid: boolean;
  missingStyles: string[];
  warnings: string[];
} {
  const originalStyles = extractStyles(original);
  const processedStyles = extractStyles(processed);
  const missingStyles: string[] = [];
  const warnings: string[] = [];

  for (const [style, count] of originalStyles) {
    const processedCount = processedStyles.get(style) || 0;
    if (processedCount < count) {
      missingStyles.push(`${style} (원본: ${count}, 결과: ${processedCount})`);
    }
  }

  // 경고: 새로 추가된 스타일
  for (const [style, count] of processedStyles) {
    if (!originalStyles.has(style)) {
      warnings.push(`새로 추가된 스타일: ${style} (${count}회)`);
    }
  }

  return {
    isValid: missingStyles.length === 0,
    missingStyles,
    warnings,
  };
}

/**
 * HTML 엔티티 디코딩
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }
  return result;
}

/**
 * HTML 엔티티 인코딩
 */
export function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 줄바꿈 정규화 (<br> 태그 통일)
 */
export function normalizeLineBreaks(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/\n/g, '<br>');
}

/**
 * 연속된 빈 줄 정리
 */
export function cleanupEmptyLines(html: string): string {
  return html
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .replace(/^\s*<br>/i, '')
    .replace(/<br>\s*$/i, '');
}

/**
 * 카드 제목 정규화
 */
export function normalizeCardTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, '') // HTML 태그 제거
    .replace(/^#+\s*/, '') // 마크다운 헤더 제거
    .replace(/\s+/g, ' ') // 연속 공백 정리
    .trim()
    .slice(0, 100); // 최대 100자
}

/**
 * 이미지 경로 추출
 */
export function extractImagePaths(html: string): string[] {
  const pattern = /<img\s+src="([^"]+)"/gi;
  const images: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    images.push(match[1]);
  }

  return images;
}

/**
 * 이미지 경로가 유효한지 확인 (확장자 기반)
 */
export function isValidImagePath(path: string): boolean {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const lowerPath = path.toLowerCase();
  return validExtensions.some((ext) => lowerPath.endsWith(ext));
}
