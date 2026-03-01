/**
 * 학습 통계 기반 어려운 카드 탐지 (Recursive Splitting)
 */

import { ankiConnect } from "./client.js";
import { getFullCardInfo } from "./scheduling.js";

export interface DifficultyThresholds {
  minLapses: number;
  maxEaseFactor: number;
  minReps: number;
}

export interface DifficultCardInfo {
  noteId: number;
  cardId: number;
  text: string;
  tags: string[];
  lapses: number;
  easeFactor: number;
  interval: number;
  reps: number;
  difficultyScore: number;
  difficultyReasons: string[];
}

export const DEFAULT_THRESHOLDS: DifficultyThresholds = {
  minLapses: 3,
  maxEaseFactor: 2100,
  minReps: 5,
};

const BATCH_SIZE = 100;

/**
 * 복합 난이도 점수 계산 (0-100, 높을수록 어려움)
 *
 * - lapses 비중 50%: 실패 횟수가 많을수록 어려움
 * - ease factor 비중 30%: ease가 낮을수록 어려움
 * - interval 비중 20%: 간격이 짧을수록 불안정
 */
export function computeDifficultyScore(
  lapses: number,
  easeFactor: number,
  interval: number,
  reps: number,
): number {
  if (reps === 0) return 0;

  // lapses 점수: 0~10+ lapses → 0~50점
  const lapsesScore = Math.min(lapses / 10, 1) * 50;

  // ease factor 점수: 2500(기본)~1300(최소) → 0~30점
  // ease가 낮을수록 점수가 높음
  const easeNormalized = Math.max(0, Math.min(1, (2500 - easeFactor) / (2500 - 1300)));
  const easeScore = easeNormalized * 30;

  // interval 점수: 간격이 짧을수록 불안정 → 0~20점
  // 365일 이상이면 안정적(0점), 1일이면 최대(20점)
  const intervalNormalized = Math.max(0, Math.min(1, 1 - interval / 365));
  const intervalScore = intervalNormalized * 20;

  return Math.round(lapsesScore + easeScore + intervalScore);
}

/**
 * 난이도 이유를 사람이 읽을 수 있는 형태로 반환
 */
export function getDifficultyReasons(
  lapses: number,
  easeFactor: number,
  reps: number,
  thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): string[] {
  const reasons: string[] = [];

  if (lapses >= thresholds.minLapses) {
    reasons.push(`실패 ${lapses}회`);
  }

  if (easeFactor <= thresholds.maxEaseFactor) {
    reasons.push(`Ease ${(easeFactor / 10).toFixed(0)}%`);
  }

  if (reps >= thresholds.minReps && lapses > 0) {
    const failRate = ((lapses / reps) * 100).toFixed(0);
    reasons.push(`실패율 ${failRate}%`);
  }

  return reasons;
}

/**
 * 덱 내 어려운 카드 탐지
 *
 * 1. findCards로 덱의 전체 카드 ID 조회
 * 2. getFullCardInfo 배치 호출로 카드 정보 조회
 * 3. noteId별 중복 제거 (최악 성적 카드 사용)
 * 4. 임계값 필터링 + 점수순 정렬
 */
export async function getDifficultCards(
  deckName: string,
  thresholds?: Partial<DifficultyThresholds>,
): Promise<DifficultCardInfo[]> {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // 덱의 전체 카드 ID 조회
  const cardIds = await ankiConnect<number[]>("findCards", {
    query: `deck:"${deckName}"`,
  });

  if (cardIds.length === 0) return [];

  // 배치로 카드 정보 조회
  const allCards = await fetchCardInfoInBatches(cardIds);

  // noteId별 그룹화 — 가장 어려운 카드만 유지
  const byNote = new Map<number, (typeof allCards)[number]>();
  for (const card of allCards) {
    const existing = byNote.get(card.noteId);
    if (!existing || card.lapses > existing.lapses) {
      byNote.set(card.noteId, card);
    }
  }

  // 임계값 필터링 + 변환
  const results: DifficultCardInfo[] = [];
  for (const card of byNote.values()) {
    if (card.reps < t.minReps || card.lapses < t.minLapses || card.factor > t.maxEaseFactor) {
      continue;
    }

    const text = extractTextFromFields(card.fields);
    const score = computeDifficultyScore(card.lapses, card.factor, card.interval, card.reps);
    const reasons = getDifficultyReasons(card.lapses, card.factor, card.reps, t);

    results.push({
      noteId: card.noteId,
      cardId: card.cardId,
      text: text.slice(0, 200) + (text.length > 200 ? "..." : ""),
      tags: card.tags,
      lapses: card.lapses,
      easeFactor: card.factor,
      interval: card.interval,
      reps: card.reps,
      difficultyScore: score,
      difficultyReasons: reasons,
    });
  }

  // 점수순 정렬 (높을수록 어려움)
  results.sort((a, b) => b.difficultyScore - a.difficultyScore);

  return results;
}

/** 카드 ID를 배치로 나누어 FullCardInfo 조회 */
async function fetchCardInfoInBatches(cardIds: number[]): Promise<
  Array<{
    cardId: number;
    noteId: number;
    interval: number;
    factor: number;
    reps: number;
    lapses: number;
    fields: Record<string, { value: string; order: number }>;
    tags: string[];
  }>
> {
  const results = [];
  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE);
    const infos = await getFullCardInfo(batch);
    results.push(...infos);
  }
  return results;
}

/** NoteInfo의 fields에서 Text 필드 추출 (operations.ts의 extractTextField는 NoteInfo 객체를 받으므로 별도 헬퍼) */
function extractTextFromFields(fields: Record<string, { value: string; order: number }>): string {
  return fields.Text?.value || "";
}
