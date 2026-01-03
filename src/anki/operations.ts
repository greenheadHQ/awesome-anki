/**
 * Anki 카드 작업 (CRUD + nid 승계 전략)
 */

import {
  findNotes,
  getNotesInfo,
  updateNoteFields,
  addNote,
  addNotes,
  addTags,
  type NoteInfo,
  type NoteFields,
} from './client.js';

export interface SplitCard {
  title: string;
  content: string;
  inheritImages: string[];
  inheritTags: string[];
  preservedLinks: string[];
  backLinks: string[];
}

export interface SplitResult {
  originalNoteId: number;
  mainCardIndex: number;
  splitCards: SplitCard[];
  splitReason: string;
  splitType: 'hard' | 'soft';
}

const MODEL_NAME = 'KaTeX and Markdown Cloze';

/**
 * 덱의 모든 노트 조회
 */
export async function getDeckNotes(deckName: string): Promise<NoteInfo[]> {
  const noteIds = await findNotes(`deck:"${deckName}"`);
  if (noteIds.length === 0) return [];
  return getNotesInfo(noteIds);
}

/**
 * 특정 노트 조회
 */
export async function getNoteById(noteId: number): Promise<NoteInfo | null> {
  const notes = await getNotesInfo([noteId]);
  return notes.length > 0 ? notes[0] : null;
}

/**
 * 메인 카드 업데이트 (기존 nid 유지)
 * - 분할 시 mainCardIndex에 해당하는 카드가 기존 nid를 승계
 */
export async function updateMainCard(
  noteId: number,
  newText: string,
  backExtra?: string
): Promise<void> {
  const fields: NoteFields = { Text: newText };
  if (backExtra !== undefined) {
    fields['Back Extra'] = backExtra;
  }
  await updateNoteFields(noteId, fields);
}

/**
 * 서브 카드 추가 (새 nid 생성)
 * - 분할 시 mainCardIndex 외의 카드들이 새 nid를 받음
 */
export async function addSplitCards(
  deckName: string,
  cards: SplitCard[],
  originalTags: string[]
): Promise<number[]> {
  const notes = cards.map((card) => ({
    deckName,
    modelName: MODEL_NAME,
    fields: {
      Text: card.content,
      'Back Extra': '',
    } as NoteFields,
    tags: [...originalTags, ...card.inheritTags],
  }));

  const results = await addNotes(notes);
  return results.filter((id): id is number => id !== null);
}

/**
 * 분할 결과 적용
 * - mainCardIndex 카드: updateNoteFields로 기존 nid 유지
 * - 나머지 카드: addNotes로 새 nid 생성
 */
export async function applySplitResult(
  deckName: string,
  result: SplitResult,
  originalTags: string[]
): Promise<{ mainNoteId: number; newNoteIds: number[] }> {
  const { originalNoteId, mainCardIndex, splitCards } = result;

  // 메인 카드 업데이트 (기존 nid 유지)
  const mainCard = splitCards[mainCardIndex];
  await updateMainCard(originalNoteId, mainCard.content);

  // 서브 카드들 추가 (새 nid 생성)
  const subCards = splitCards.filter((_, i) => i !== mainCardIndex);
  const newNoteIds = await addSplitCards(deckName, subCards, originalTags);

  return {
    mainNoteId: originalNoteId,
    newNoteIds,
  };
}

/**
 * 노트 텍스트 필드 추출
 */
export function extractTextField(note: NoteInfo): string {
  return note.fields.Text?.value || '';
}

/**
 * 노트 태그 추출
 */
export function extractTags(note: NoteInfo): string[] {
  return note.tags || [];
}
