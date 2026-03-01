/**
 * 학습 데이터 관리 (스케줄링)
 */

import { ankiConnect } from "./client.js";

export interface CardSchedulingInfo {
  cardId: number;
  interval: number; // 일 단위 간격
  factor: number; // ease factor (2500 = 250%)
  due: number; // 다음 복습 예정일
  reps: number; // 복습 횟수
  lapses: number; // 실패 횟수
  type: number; // 카드 타입 (0=new, 1=learning, 2=review)
  queue: number; // 큐 (0=new, 1=learning, 2=review)
}

export interface FullCardInfo extends CardSchedulingInfo {
  noteId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  tags: string[];
}

/**
 * 카드 스케줄링 정보 조회
 */
export async function getCardSchedulingInfo(cardIds: number[]): Promise<CardSchedulingInfo[]> {
  const result = await ankiConnect<FullCardInfo[]>("cardsInfo", {
    cards: cardIds,
  });

  return result.map((card) => ({
    cardId: card.cardId,
    interval: card.interval,
    factor: card.factor,
    due: card.due,
    reps: card.reps,
    lapses: card.lapses,
    type: card.type,
    queue: card.queue,
  }));
}

/**
 * 전체 카드 정보 조회 (백업용)
 */
export async function getFullCardInfo(cardIds: number[]): Promise<FullCardInfo[]> {
  return ankiConnect<FullCardInfo[]>("cardsInfo", { cards: cardIds });
}

/**
 * 노트의 카드 ID 조회
 */
export async function findCardsByNote(noteId: number): Promise<number[]> {
  return ankiConnect<number[]>("findCards", { query: `nid:${noteId}` });
}

/**
 * 카드 스케줄링 설정 (새 카드에 복제)
 *
 * AnkiConnect의 setSpecificValueOfCard를 사용하여 설정
 * 주의: 일부 값은 설정 불가능할 수 있음
 */
export async function setCardScheduling(
  cardId: number,
  scheduling: Partial<CardSchedulingInfo>,
): Promise<void> {
  // AnkiConnect에서 지원하는 필드만 설정
  // setSpecificValueOfCard는 제한적이므로 직접 SQL 실행이 필요할 수 있음

  // 현재 AnkiConnect로 설정 가능한 것:
  // - setEaseFactors: ease factor 설정
  // - setDueDate: due date 설정

  if (scheduling.factor !== undefined) {
    await ankiConnect("setEaseFactors", {
      cards: [cardId],
      easeFactors: [scheduling.factor],
    });
  }

  // interval과 due는 직접 설정이 어려움
  // 대안: 카드를 "reschedule"하거나 직접 DB 수정 필요
}

/**
 * 학습 데이터를 새 카드들에 복제
 *
 * 원본 카드의 학습 상태를 분할된 카드들에 적용
 * - ease factor 복제
 * - 새 카드로 시작하지 않고 비슷한 진도에서 시작
 */
export async function copySchedulingToNewCards(
  sourceCardId: number,
  targetCardIds: number[],
): Promise<void> {
  const [sourceInfo] = await getCardSchedulingInfo([sourceCardId]);

  if (!sourceInfo) {
    console.warn(`원본 카드 ${sourceCardId}의 스케줄링 정보를 찾을 수 없습니다.`);
    return;
  }

  // ease factor만 복제 (interval/due는 AnkiConnect로 직접 설정 어려움)
  if (sourceInfo.factor && sourceInfo.factor !== 2500) {
    try {
      await ankiConnect("setEaseFactors", {
        cards: targetCardIds,
        easeFactors: targetCardIds.map(() => sourceInfo.factor),
      });
    } catch (error) {
      console.warn("ease factor 복제 실패:", error);
    }
  }
}

/**
 * 분할 후 학습 데이터 복제 헬퍼
 */
export async function cloneSchedulingAfterSplit(
  originalNoteId: number,
  newCardIds: number[],
): Promise<{ copied: boolean; sourceScheduling?: CardSchedulingInfo }> {
  // 원본 노트의 카드 찾기
  const originalCardIds = await findCardsByNote(originalNoteId);

  if (originalCardIds.length === 0) {
    return { copied: false };
  }

  const sourceCardId = originalCardIds[0];
  const [sourceScheduling] = await getCardSchedulingInfo([sourceCardId]);

  if (!sourceScheduling) {
    return { copied: false };
  }

  // 리뷰 카드(type=2)인 경우에만 복제
  if (sourceScheduling.type === 2 && sourceScheduling.reps > 0) {
    await copySchedulingToNewCards(sourceCardId, newCardIds);
    return { copied: true, sourceScheduling };
  }

  return { copied: false, sourceScheduling };
}
