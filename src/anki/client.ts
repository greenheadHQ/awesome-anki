/**
 * AnkiConnect API 클라이언트
 * https://foosoft.net/projects/anki-connect/
 */

const ANKI_CONNECT_URL =
  process.env.ANKI_CONNECT_URL || "http://localhost:8765";
const ANKI_CONNECT_VERSION = 6;

export interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

export interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

export interface NoteInfo {
  noteId: number;
  profile: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  modelName: string;
  mod: number;
  cards: number[];
}

export interface NoteFields {
  Text: string;
  "Back Extra"?: string;
}

/**
 * AnkiConnect API 호출
 */
export async function ankiConnect<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const request: AnkiConnectRequest = {
    action,
    version: ANKI_CONNECT_VERSION,
    ...(params && { params }),
  };

  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as AnkiConnectResponse<T>;

  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

/**
 * AnkiConnect 버전 확인
 */
export async function getVersion(): Promise<number> {
  return ankiConnect<number>("version");
}

/**
 * 프로필 목록 조회
 */
export async function getProfiles(): Promise<string[]> {
  return ankiConnect<string[]>("getProfiles");
}

/**
 * 덱 목록 조회
 */
export async function getDeckNames(): Promise<string[]> {
  return ankiConnect<string[]>("deckNames");
}

/**
 * 모델 목록 조회
 */
export async function getModelNames(): Promise<string[]> {
  return ankiConnect<string[]>("modelNames");
}

/**
 * 모델 필드 조회
 */
export async function getModelFieldNames(modelName: string): Promise<string[]> {
  return ankiConnect<string[]>("modelFieldNames", { modelName });
}

/**
 * 노트 검색 (노트 ID 반환)
 */
export async function findNotes(query: string): Promise<number[]> {
  return ankiConnect<number[]>("findNotes", { query });
}

/**
 * 노트 정보 조회
 */
export async function getNotesInfo(notes: number[]): Promise<NoteInfo[]> {
  return ankiConnect<NoteInfo[]>("notesInfo", { notes });
}

/**
 * 노트 필드 업데이트 (기존 nid 유지)
 */
export async function updateNoteFields(
  noteId: number,
  fields: NoteFields,
): Promise<null> {
  return ankiConnect<null>("updateNoteFields", {
    note: { id: noteId, fields },
  });
}

/**
 * 새 노트 추가 (새 nid 생성)
 */
export async function addNote(
  deckName: string,
  modelName: string,
  fields: NoteFields,
  tags: string[] = [],
): Promise<number> {
  return ankiConnect<number>("addNote", {
    note: {
      deckName,
      modelName,
      fields,
      tags,
      options: {
        allowDuplicate: true,
      },
    },
  });
}

/**
 * 다수 노트 추가 (배치)
 */
export async function addNotes(
  notes: Array<{
    deckName: string;
    modelName: string;
    fields: NoteFields;
    tags: string[];
  }>,
): Promise<(number | null)[]> {
  return ankiConnect<(number | null)[]>("addNotes", {
    notes: notes.map((note) => ({
      ...note,
      options: { allowDuplicate: true },
    })),
  });
}

/**
 * 노트 태그 추가
 */
export async function addTags(notes: number[], tags: string): Promise<null> {
  return ankiConnect<null>("addTags", { notes, tags });
}

/**
 * 노트 삭제
 */
export async function deleteNotes(notes: number[]): Promise<null> {
  return ankiConnect<null>("deleteNotes", { notes });
}

/**
 * 동기화 실행
 */
export async function sync(): Promise<null> {
  return ankiConnect<null>("sync");
}
