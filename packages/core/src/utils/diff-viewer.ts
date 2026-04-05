/**
 * 변경사항 시각화 (chalk 활용)
 */

import chalk from "chalk";
import { diffLines, diffWords } from "diff";

export interface DiffResult {
  hasChanges: boolean;
  summary: string;
  details: string;
  addedLines: number;
  removedLines: number;
}

/**
 * 두 텍스트의 라인 단위 diff 생성
 */
export function createLineDiff(original: string, modified: string): DiffResult {
  const changes = diffLines(original, modified);

  let addedLines = 0;
  let removedLines = 0;
  const lines: string[] = [];

  for (const change of changes) {
    if (change.added) {
      addedLines += (change.value.match(/\n/g) || []).length || 1;
      lines.push(chalk.green(`+ ${change.value.replace(/\n/g, "\n+ ")}`));
    } else if (change.removed) {
      removedLines += (change.value.match(/\n/g) || []).length || 1;
      lines.push(chalk.red(`- ${change.value.replace(/\n/g, "\n- ")}`));
    } else {
      // 변경되지 않은 부분은 처음 2줄만 표시
      const unchanged = change.value.split("\n").slice(0, 2).join("\n");
      if (unchanged.trim()) {
        lines.push(chalk.gray(`  ${unchanged}`));
      }
    }
  }

  return {
    hasChanges: addedLines > 0 || removedLines > 0,
    summary: `${chalk.green(`+${addedLines}`)} ${chalk.red(`-${removedLines}`)}`,
    details: lines.join("\n"),
    addedLines,
    removedLines,
  };
}

/**
 * 단어 단위 diff 생성 (인라인)
 */
export function createWordDiff(original: string, modified: string): string {
  const changes = diffWords(original, modified);
  const parts: string[] = [];

  for (const change of changes) {
    if (change.added) {
      parts.push(chalk.bgGreen.black(change.value));
    } else if (change.removed) {
      parts.push(chalk.bgRed.white.strikethrough(change.value));
    } else {
      parts.push(change.value);
    }
  }

  return parts.join("");
}
