/**
 * 카드 수정 함수
 *
 * 검증 결과를 기반으로 카드 텍스트를 수정한다.
 * 순수 문자열 조작만 사용하며, LLM 호출이 필요 없다.
 */

export interface FixResult {
  original: string;
  fixed: string;
  changes: Array<{
    type: "yagni-removal" | "fact-correction";
    before: string;
    after: string;
    reason: string;
  }>;
  /** Cloze 파싱 개수 불일치 등 safeguard 경고 */
  warning?: string;
}

/**
 * YAGNI Cloze 제거 — 지정된 Cloze 번호의 마크업과 내용을 제거
 *
 * 갭 유지 정책: 나머지 Cloze 번호를 재정렬하지 않아 Anki 스케줄링 보존.
 * 예: c1, c2, c3에서 c2 제거 → c1, c3 유지 (c2 갭 허용)
 */
export function removeYagniClozes(
  cardContent: string,
  clozesToRemove: number[],
): FixResult {
  if (clozesToRemove.length === 0) {
    return { original: cardContent, fixed: cardContent, changes: [] };
  }

  // Cloze safeguard: 정규식 파싱 개수 vs 실제 매칭 개수 비교
  const allClozePattern = /\{\{c(\d+)::/g;
  const allMatches = [...cardContent.matchAll(allClozePattern)];
  const uniqueClozeNumbers = new Set(allMatches.map((m) => Number.parseInt(m[1], 10)));

  let warning: string | undefined;
  const invalidRemovals = clozesToRemove.filter((n) => !uniqueClozeNumbers.has(n));
  if (invalidRemovals.length > 0) {
    warning = `제거 대상 Cloze 번호 ${invalidRemovals.join(", ")}이(가) 카드에 존재하지 않습니다`;
  }

  let result = cardContent;
  const changes: FixResult["changes"] = [];

  for (const clozeNum of clozesToRemove) {
    // {{cN::내용}} 또는 {{cN::내용::힌트}} 전체를 제거
    const clozePattern = new RegExp(
      `\\{\\{c${clozeNum}::([^}]+?)(?:::[^}]+)?\\}\\}`,
      "g",
    );

    const matches = [...result.matchAll(clozePattern)];
    if (matches.length === 0) continue;

    for (const match of matches) {
      const fullMatch = match[0];
      const clozeContent = match[1];

      changes.push({
        type: "yagni-removal",
        before: fullMatch,
        after: "",
        reason: `Cloze c${clozeNum} 제거 (YAGNI): "${clozeContent}"`,
      });
    }

    // Cloze 마크업과 내용을 모두 제거
    result = result.replace(clozePattern, "");
  }

  // 빈 줄 정리: 연속된 빈 줄을 하나로, 앞뒤 공백 정리
  result = result
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/gm, "\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  return {
    original: cardContent,
    fixed: result,
    changes,
    warning,
  };
}

/**
 * 팩트 정정 적용 — fact-check 결과의 correction을 카드 텍스트에 반영
 *
 * claim 텍스트를 카드에서 찾아 correction으로 치환한다.
 * Cloze 마크업 내부의 텍스트도 매칭한다.
 */
export function applyFactCorrections(
  cardContent: string,
  corrections: Array<{ claim: string; correction: string }>,
): FixResult {
  if (corrections.length === 0) {
    return { original: cardContent, fixed: cardContent, changes: [] };
  }

  let result = cardContent;
  const changes: FixResult["changes"] = [];

  for (const { claim, correction } of corrections) {
    if (!claim || !correction || claim === correction) continue;

    // claim 텍스트를 이스케이프하여 정규식으로 사용
    const escapedClaim = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const claimPattern = new RegExp(escapedClaim, "g");

    if (!claimPattern.test(result)) continue;

    // 매칭 위치 확인을 위해 다시 생성 (test()가 lastIndex를 변경하므로)
    const freshPattern = new RegExp(escapedClaim, "g");
    const before = result;
    result = result.replace(freshPattern, correction);

    if (before !== result) {
      changes.push({
        type: "fact-correction",
        before: claim,
        after: correction,
        reason: `팩트 정정: "${claim}" → "${correction}"`,
      });
    }
  }

  return {
    original: cardContent,
    fixed: result,
    changes,
  };
}
