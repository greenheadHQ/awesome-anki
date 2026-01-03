/**
 * Anki Card Manager - Claude Code 스킬 진입점
 *
 * 명령어:
 * - status: AnkiConnect 연결 상태 및 덱 구조 확인
 * - split [deck]: 복합 카드 분할 제안 (Dry Run)
 * - split [deck] --apply: 분할 적용
 */

import 'dotenv/config';
import chalk from 'chalk';
import {
  getVersion,
  getProfiles,
  getDeckNames,
  getModelNames,
  getModelFieldNames,
} from './anki/client.js';
import {
  getDeckNotes,
  extractTextField,
  extractTags,
  applySplitResult,
  type SplitResult,
  type SplitCard,
} from './anki/operations.js';
import { analyzeForSplit, performHardSplit, type AtomicCard } from './splitter/atomic-converter.js';
import { requestCardSplit } from './gemini/client.js';
import { printSplitPreview, printProgress } from './utils/diff-viewer.js';
import { parseNidLinks } from './parser/nid-parser.js';
import { parseClozes } from './parser/cloze-parser.js';

const DEFAULT_DECK = process.env.TARGET_DECK || '[책] 이것이 취업을 위한 컴퓨터 과학이다';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  try {
    switch (command) {
      case 'status':
        await runStatus();
        break;
      case 'split':
        const deckName = args[1] || DEFAULT_DECK;
        const shouldApply = args.includes('--apply');
        await runSplit(deckName, shouldApply);
        break;
      case 'analyze':
        const targetDeck = args[1] || DEFAULT_DECK;
        const noteId = args[2] ? parseInt(args[2], 10) : undefined;
        await runAnalyze(targetDeck, noteId);
        break;
      default:
        console.log(chalk.yellow(`알 수 없는 명령어: ${command}`));
        printHelp();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`❌ 오류: ${error.message}`));
    } else {
      console.error(chalk.red('❌ 알 수 없는 오류가 발생했습니다.'));
    }
    process.exit(1);
  }
}

/**
 * status 명령어: AnkiConnect 연결 상태 및 덱 구조 확인
 */
async function runStatus() {
  console.log(chalk.bold.cyan('\n🔌 AnkiConnect 연결 상태\n'));

  // 버전 확인
  const version = await getVersion();
  console.log(chalk.green(`✅ AnkiConnect 버전: ${version}`));

  // 프로필 확인
  const profiles = await getProfiles();
  console.log(chalk.green(`✅ 프로필: ${profiles.join(', ')}`));

  // 덱 목록
  const decks = await getDeckNames();
  console.log(chalk.green(`✅ 덱 수: ${decks.length}개`));
  console.log(chalk.gray('   ' + decks.slice(0, 5).join('\n   ') + (decks.length > 5 ? '\n   ...' : '')));

  // 모델 목록
  const models = await getModelNames();
  console.log(chalk.green(`✅ 모델 수: ${models.length}개`));

  // KaTeX and Markdown Cloze 필드 확인
  const targetModel = 'KaTeX and Markdown Cloze';
  if (models.includes(targetModel)) {
    const fields = await getModelFieldNames(targetModel);
    console.log(chalk.green(`✅ ${targetModel} 필드: ${fields.join(', ')}`));
  }

  // 대상 덱 카드 수
  if (decks.includes(DEFAULT_DECK)) {
    const notes = await getDeckNotes(DEFAULT_DECK);
    console.log(chalk.green(`✅ 대상 덱 "${DEFAULT_DECK}": ${notes.length}개 노트`));
  }

  console.log(chalk.bold.cyan('\n✅ 연결 정상\n'));
}

/**
 * 분할 결과 타입 (Hard/Soft 통합)
 */
interface UnifiedSplitResult {
  noteId: number;
  originalText: string;
  tags: string[];
  splitType: 'hard' | 'soft';
  cards: Array<{ title: string; content: string; isMainCard: boolean }>;
  mainCardIndex: number;
}

/**
 * split 명령어: 복합 카드 분할
 */
async function runSplit(deckName: string, shouldApply: boolean) {
  console.log(chalk.bold.cyan(`\n📋 카드 분할 ${shouldApply ? '(적용 모드)' : '(미리보기 모드)'}\n`));
  console.log(chalk.gray(`대상 덱: ${deckName}\n`));

  // 덱 노트 조회
  const notes = await getDeckNotes(deckName);
  console.log(chalk.cyan(`총 ${notes.length}개 노트 발견\n`));

  const splitCandidates: Array<{
    noteId: number;
    text: string;
    tags: string[];
    analysis: ReturnType<typeof analyzeForSplit>;
  }> = [];

  // 1단계: 분할 후보 분석
  console.log(chalk.yellow('1단계: 분할 후보 분석...\n'));

  for (const note of notes) {
    const text = extractTextField(note);
    const analysis = analyzeForSplit(text);

    if (analysis.canHardSplit || analysis.clozeCount > 3) {
      splitCandidates.push({
        noteId: note.noteId,
        text,
        tags: extractTags(note),
        analysis,
      });
    }
  }

  console.log(chalk.green(`✅ 분할 후보: ${splitCandidates.length}개\n`));

  if (splitCandidates.length === 0) {
    console.log(chalk.green('분할이 필요한 카드가 없습니다.\n'));
    return;
  }

  // 2단계: Hard Split 시도 (정규식 기반)
  console.log(chalk.yellow('2단계: Hard Split 분석...\n'));

  const allSplitResults: UnifiedSplitResult[] = [];
  const softSplitCandidates: typeof splitCandidates = [];

  for (const candidate of splitCandidates) {
    if (candidate.analysis.canHardSplit) {
      const cards = performHardSplit(candidate.text, candidate.noteId);
      if (cards && cards.length > 1) {
        allSplitResults.push({
          noteId: candidate.noteId,
          originalText: candidate.text,
          tags: candidate.tags,
          splitType: 'hard',
          cards: cards.map((c) => ({
            title: c.title,
            content: c.content,
            isMainCard: c.isMainCard,
          })),
          mainCardIndex: cards.findIndex((c) => c.isMainCard),
        });
      } else {
        softSplitCandidates.push(candidate);
      }
    } else {
      softSplitCandidates.push(candidate);
    }
  }

  console.log(chalk.green(`✅ Hard Split: ${allSplitResults.length}개`));
  console.log(chalk.gray(`   Soft Split 후보: ${softSplitCandidates.length}개\n`));

  // 3단계: Soft Split (Gemini 기반) - 처음 5개만
  if (softSplitCandidates.length > 0) {
    console.log(chalk.yellow('3단계: Soft Split 분석 (Gemini)...\n'));

    const softTargets = softSplitCandidates.slice(0, 5);
    let softSplitCount = 0;

    for (let i = 0; i < softTargets.length; i++) {
      const candidate = softTargets[i];
      printProgress(i + 1, softTargets.length, `카드 ${candidate.noteId} 분석 중...`);

      try {
        const geminiResult = await requestCardSplit({
          noteId: candidate.noteId,
          text: candidate.text,
          tags: candidate.tags,
        });

        if (geminiResult.shouldSplit && geminiResult.splitCards.length > 1) {
          allSplitResults.push({
            noteId: candidate.noteId,
            originalText: candidate.text,
            tags: candidate.tags,
            splitType: 'soft',
            cards: geminiResult.splitCards.map((c, idx) => ({
              title: c.title,
              content: c.content,
              isMainCard: idx === geminiResult.mainCardIndex,
            })),
            mainCardIndex: geminiResult.mainCardIndex,
          });
          softSplitCount++;
        }
      } catch (error) {
        console.error(chalk.red(`\n   카드 ${candidate.noteId} 분석 실패`));
      }
    }

    console.log(chalk.green(`\n✅ Soft Split: ${softSplitCount}개\n`));
  }

  // 미리보기 출력
  console.log(chalk.bold.cyan(`\n📊 총 분할 가능: ${allSplitResults.length}개\n`));

  for (const result of allSplitResults.slice(0, 5)) {
    const typeLabel = result.splitType === 'hard' ? chalk.blue('[Hard]') : chalk.magenta('[Soft]');
    console.log(`${typeLabel} Note ${result.noteId}`);
    printSplitPreview(result.noteId, result.originalText, result.cards);
  }

  if (allSplitResults.length > 5) {
    console.log(chalk.gray(`... 외 ${allSplitResults.length - 5}개 더\n`));
  }

  // 적용 모드
  if (shouldApply && allSplitResults.length > 0) {
    console.log(chalk.yellow('\n⚠️  분할 적용을 시작합니다...\n'));

    let successCount = 0;
    let failCount = 0;

    for (const result of allSplitResults) {
      try {
        // SplitResult 형식으로 변환
        const splitResult: SplitResult = {
          originalNoteId: result.noteId,
          mainCardIndex: result.mainCardIndex,
          splitCards: result.cards.map((c) => ({
            title: c.title,
            content: c.content,
            inheritImages: [],
            inheritTags: [],
            preservedLinks: [],
            backLinks: [],
          })),
          splitReason: '',
          splitType: result.splitType,
        };

        const applied = await applySplitResult(deckName, splitResult, result.tags);
        console.log(
          chalk.green(`✅ ${result.noteId}: 메인 유지, ${applied.newNoteIds.length}개 새 카드 생성`)
        );
        successCount++;
      } catch (error) {
        console.error(chalk.red(`❌ ${result.noteId}: 적용 실패`));
        failCount++;
      }
    }

    console.log(chalk.bold.cyan(`\n📊 적용 완료: 성공 ${successCount}개, 실패 ${failCount}개\n`));
  } else if (!shouldApply) {
    console.log(chalk.cyan('\n💡 실제 적용하려면 --apply 플래그를 추가하세요.\n'));
  }
}

/**
 * analyze 명령어: 특정 카드 분석
 */
async function runAnalyze(deckName: string, noteId?: number) {
  console.log(chalk.bold.cyan('\n🔍 카드 분석\n'));

  const notes = await getDeckNotes(deckName);

  // 특정 노트만 분석
  const targetNotes = noteId
    ? notes.filter((n) => n.noteId === noteId)
    : notes.slice(0, 5); // 기본 5개만

  if (targetNotes.length === 0) {
    console.log(chalk.yellow('분석할 노트가 없습니다.\n'));
    return;
  }

  for (const note of targetNotes) {
    const text = extractTextField(note);
    const analysis = analyzeForSplit(text);
    const nidLinks = parseNidLinks(text);
    const clozes = parseClozes(text);

    console.log(chalk.bold(`\n📄 Note ID: ${note.noteId}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  모델: ${note.modelName}`);
    console.log(`  태그: ${note.tags.length > 0 ? note.tags.join(', ') : '(없음)'}`);
    console.log(`  Cloze 수: ${clozes.length}`);
    console.log(`  nid 링크: ${nidLinks.length}개`);
    console.log(`  Hard Split 가능: ${analysis.canHardSplit ? '예' : '아니오'}`);
    if (analysis.canHardSplit) {
      console.log(`    분할 지점: ${analysis.hardSplitPoints.length}개`);
      console.log(`    예상 카드 수: ${analysis.estimatedCards}개`);
    }
    console.log(`  Todo 블록: ${analysis.hasTodoBlock ? '있음 ⚠️' : '없음'}`);
  }

  console.log();
}

/**
 * 도움말 출력
 */
function printHelp() {
  console.log(chalk.bold.cyan('\n📚 Anki Card Manager - 사용법\n'));
  console.log('  tsx src/index.ts status              연결 상태 확인');
  console.log('  tsx src/index.ts split [덱이름]      분할 미리보기');
  console.log('  tsx src/index.ts split [덱이름] --apply  분할 적용');
  console.log('  tsx src/index.ts analyze [덱이름] [noteId]  카드 분석');
  console.log();
}

main();
