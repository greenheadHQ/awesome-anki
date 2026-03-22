/**
 * 카드 텍스트 정제 유틸리티
 *
 * 모든 validator checker에서 공통으로 사용하는 텍스트 클리닝 로직.
 * Cloze 마크업, HTML 태그, 컨테이너 구분자를 제거하여 순수 텍스트를 추출한다.
 */

/**
 * Cloze 마크업·HTML·컨테이너를 제거한 순수 텍스트 추출
 *
 * 각 checker는 이 함수를 호출한 뒤 필요에 따라 추가 정규화를 적용한다:
 * - context-checker: `.replace(/\s+/g, " ")` (공백 정규화)
 * - similarity-checker: `.toLowerCase()` + 특수문자 제거 + 공백 정규화
 */
export function cleanCardText(cardContent: string): string {
  return cardContent
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1") // Cloze → 내용만 추출
    .replace(/<br\s*\/?>/gi, "\n") // <br> → 줄바꿈 (줄 구조 보존)
    .replace(/<[^>]+>/g, " ") // HTML 태그 제거
    .replace(/:::\s*\w+[^\n]*\n?/g, "") // 컨테이너 시작 제거
    .replace(/^:::\s*$/gm, "") // 컨테이너 끝 제거
    .trim();
}
