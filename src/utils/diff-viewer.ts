/**
 * 변경사항 시각화 (chalk 활용)
 */

import chalk from 'chalk';
import { diffLines, diffWords } from 'diff';

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
      lines.push(chalk.green(`+ ${change.value.replace(/\n/g, '\n+ ')}`));
    } else if (change.removed) {
      removedLines += (change.value.match(/\n/g) || []).length || 1;
      lines.push(chalk.red(`- ${change.value.replace(/\n/g, '\n- ')}`));
    } else {
      // 변경되지 않은 부분은 처음 2줄만 표시
      const unchanged = change.value.split('\n').slice(0, 2).join('\n');
      if (unchanged.trim()) {
        lines.push(chalk.gray(`  ${unchanged}`));
      }
    }
  }

  return {
    hasChanges: addedLines > 0 || removedLines > 0,
    summary: `${chalk.green(`+${addedLines}`)} ${chalk.red(`-${removedLines}`)}`,
    details: lines.join('\n'),
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

  return parts.join('');
}

/**
 * 분할 결과 미리보기 출력
 */
export function printSplitPreview(
  originalNoteId: number,
  originalContent: string,
  splitCards: Array<{ title: string; content: string; isMainCard: boolean }>
): void {
  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════'));
  console.log(chalk.bold.cyan(`📋 분할 미리보기 - Note ID: ${originalNoteId}`));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════\n'));

  console.log(chalk.yellow('📄 원본 (처음 200자):'));
  console.log(chalk.gray(truncateHtml(originalContent, 200)));
  console.log();

  console.log(chalk.yellow(`📑 분할 결과: ${splitCards.length}개 카드\n`));

  splitCards.forEach((card, index) => {
    const icon = card.isMainCard ? '⭐' : '  ';
    const mainLabel = card.isMainCard ? chalk.magenta(' [MAIN - 기존 nid 유지]') : '';

    console.log(chalk.bold(`${icon} 카드 ${index + 1}: ${card.title}${mainLabel}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(truncateHtml(card.content, 150));
    console.log();
  });

  console.log(chalk.bold.cyan('═══════════════════════════════════════════\n'));
}

/**
 * 배치 분석 결과 출력
 */
export function printBatchAnalysis(
  results: Array<{
    noteId: number;
    needsSplit: boolean;
    reason: string;
    suggestedCount: number;
  }>
): void {
  console.log(chalk.bold.cyan('\n📊 분할 분석 결과\n'));

  const needsSplit = results.filter((r) => r.needsSplit);
  const noSplit = results.filter((r) => !r.needsSplit);

  console.log(chalk.green(`✅ 분할 불필요: ${noSplit.length}개`));
  console.log(chalk.yellow(`⚠️  분할 권장: ${needsSplit.length}개\n`));

  if (needsSplit.length > 0) {
    console.log(chalk.yellow('분할 권장 카드:'));
    needsSplit.forEach((r) => {
      console.log(`  ${chalk.bold(r.noteId.toString())} → ${r.suggestedCount}개로 분할`);
      console.log(chalk.gray(`    사유: ${r.reason.slice(0, 80)}...`));
    });
  }
}

/**
 * HTML 태그 일부 제거하고 truncate
 */
function truncateHtml(html: string, maxLength: number): string {
  // <br> 태그를 줄바꿈으로
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  // 나머지 태그는 유지하되 길이 제한
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  return text;
}

/**
 * 진행률 표시
 */
export function printProgress(current: number, total: number, message: string): void {
  const percentage = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  process.stdout.write(`\r${chalk.cyan(bar)} ${percentage}% ${message}`);

  if (current === total) {
    console.log(); // 완료 시 줄바꿈
  }
}
