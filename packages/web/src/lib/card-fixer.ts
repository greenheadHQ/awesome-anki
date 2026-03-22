/**
 * 카드 수정 유틸리티 (브라우저용)
 *
 * core/validator/card-fixer의 순수 문자열 조작 로직을 웹에서 사용.
 * 미리보기(ActionPreview)와 적용(AllInOnePanel) 모두 이 유틸을 공유한다.
 */

export interface FixChange {
  type: "yagni-removal" | "fact-correction";
  before: string;
  after: string;
  reason: string;
}

/**
 * YAGNI Cloze 제거 — 지정된 번호의 Cloze 마크업과 내용을 제거
 * 갭 유지 정책: 나머지 Cloze 번호를 재정렬하지 않음
 */
export function removeYagniClozes(content: string, clozesToRemove: number[]): string {
  if (clozesToRemove.length === 0) return content;

  let result = content;
  for (const clozeNum of clozesToRemove) {
    const pattern = new RegExp(`\\{\\{c${clozeNum}::([^}]+?)(?:::[^}]+)?\\}\\}`, "g");
    result = result.replace(pattern, "");
  }

  return result
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/gm, "\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/**
 * 팩트 정정 적용 — claim 텍스트를 correction으로 치환
 */
export function applyFactCorrections(
  content: string,
  corrections: Array<{ claim: string; correction: string }>,
): string {
  let result = content;
  for (const { claim, correction } of corrections) {
    if (!claim || !correction || claim === correction) continue;
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "g");
    if (!pattern.test(result)) continue;
    const fresh = new RegExp(escaped, "g");
    result = result.replace(fresh, correction);
  }
  return result;
}

/**
 * YAGNI 제거 diff 계산 (미리보기용)
 */
export function computeYagniDiff(
  content: string,
  clozesToRemove: number[],
): { fixed: string; changes: FixChange[] } {
  if (clozesToRemove.length === 0) return { fixed: content, changes: [] };

  let result = content;
  const changes: FixChange[] = [];

  for (const clozeNum of clozesToRemove) {
    const clozePattern = new RegExp(`\\{\\{c${clozeNum}::([^}]+?)(?:::[^}]+)?\\}\\}`, "g");
    const matches = [...result.matchAll(clozePattern)];
    for (const match of matches) {
      changes.push({
        type: "yagni-removal",
        before: match[0],
        after: "",
        reason: `Cloze c${clozeNum} 제거 (YAGNI): "${match[1]}"`,
      });
    }
    result = result.replace(clozePattern, "");
  }

  result = result
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/gm, "\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  return { fixed: result, changes };
}

/**
 * 팩트 정정 diff 계산 (미리보기용)
 */
export function computeFactDiff(
  content: string,
  corrections: Array<{ claim: string; correction: string }>,
): { fixed: string; changes: FixChange[] } {
  if (corrections.length === 0) return { fixed: content, changes: [] };

  let result = content;
  const changes: FixChange[] = [];

  for (const { claim, correction } of corrections) {
    if (!claim || !correction || claim === correction) continue;
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "g");
    if (!pattern.test(result)) continue;

    const fresh = new RegExp(escaped, "g");
    const before = result;
    result = result.replace(fresh, correction);
    if (before !== result) {
      changes.push({
        type: "fact-correction",
        before: claim,
        after: correction,
        reason: `팩트 정정: "${claim}" → "${correction}"`,
      });
    }
  }

  return { fixed: result, changes };
}
