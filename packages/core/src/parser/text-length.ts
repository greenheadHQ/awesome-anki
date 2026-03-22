/**
 * HTML/Cloze/Callout을 제거한 순수 텍스트 길이 계산.
 * 모바일 1스크린 트리거 판정용.
 */

/** Cloze 마커에서 답만 추출: {{c1::답::힌트}} → 답 */
const CLOZE_RE = /\{\{c\d+::([^}]*?)(?:::([^}]*?))?\}\}/g;

/** ::: type [toggleType] 까지만 제거, 나머지(title 등)는 유지 */
const CALLOUT_MARKER_RE =
  /^:::\s*(?:tip|warning|error|note|link|toggle)(?:\s+(?:tip|warning|error|note|todo))?/gm;
const CALLOUT_CLOSE_RE = /^:::$/gm;

/** HTML 태그 전체 */
const HTML_TAG_RE = /<[^>]+>/g;

/** 연속 공백/줄바꿈 → 단일 공백 */
const MULTI_WS_RE = /\s+/g;

export function computeTextLength(html: string): number {
  let text = html;
  text = text.replace(CLOZE_RE, "$1");
  text = text.replace(CALLOUT_MARKER_RE, "");
  text = text.replace(CALLOUT_CLOSE_RE, "");
  text = text.replace(HTML_TAG_RE, "");
  text = text.replace(MULTI_WS_RE, " ").trim();
  return text.length;
}
