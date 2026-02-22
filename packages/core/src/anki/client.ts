/**
 * AnkiConnect API 클라이언트
 * https://foosoft.net/projects/anki-connect/
 */

import { AnkiConnectError, TimeoutError } from "../errors.js";

function getAnkiConnectUrl(): string {
  return process.env.ANKI_CONNECT_URL || "http://localhost:8765";
}
const ANKI_CONNECT_VERSION = 6;
const DEFAULT_TIMEOUT = 5000;
type ConfigAction = "getConfig" | "setConfig";

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

/**
 * 모델별 필드 확장을 허용하는 유연한 맵.
 * 호출자는 카드 모델의 필수 필드(일반적으로 `Text`, 필요 시 `Back Extra`)를 포함해야 한다.
 */
export interface NoteFields {
  [fieldName: string]: string;
}

/**
 * AnkiConnect API 호출
 */
export async function ankiConnect<T>(
  action: string,
  params?: Record<string, unknown>,
  options?: { timeout?: number },
): Promise<T> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT;

  const request: AnkiConnectRequest = {
    action,
    version: ANKI_CONNECT_VERSION,
    ...(params && { params }),
  };

  let response: Response;
  try {
    response = await fetch(getAnkiConnectUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (error instanceof TimeoutError || error instanceof AnkiConnectError) {
      throw error;
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new TimeoutError(
        `AnkiConnect 응답 시간 초과 (${timeoutMs}ms). Anki가 실행 중인지 확인하세요.`,
      );
    }
    // Bun: ConnectionRefused, Node: TypeError (fetch failed)
    throw new AnkiConnectError(
      "AnkiConnect에 연결할 수 없습니다. Anki가 실행 중이고 AnkiConnect 애드온이 활성화되어 있는지 확인하세요.",
    );
  }

  if (!response.ok) {
    throw new AnkiConnectError(`AnkiConnect HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as AnkiConnectResponse<T>;

  if (data.error) {
    throw new AnkiConnectError(`AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

function mapUnsupportedConfigActionError(
  action: ConfigAction,
  error: unknown,
): AnkiConnectError | null {
  if (!(error instanceof AnkiConnectError)) {
    return null;
  }

  const message = error.message.toLowerCase();
  const bareActionError = new RegExp(
    `^ankiconnect error:\\s*${action.toLowerCase()}\\s*$`,
  );
  const looksUnsupported =
    message.includes("unsupported action") ||
    message.includes("unknown action") ||
    message.includes("action not found") ||
    bareActionError.test(message);

  if (!looksUnsupported) {
    return null;
  }

  return new AnkiConnectError(
    `AnkiConnect 커스텀 액션 "${action}"을 사용할 수 없습니다. miniPC Anki 서버에 getConfig/setConfig 확장이 설치되어 있는지 확인하세요.`,
    "UNSUPPORTED_REMOTE_CONFIG_ACTION",
  );
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
 * 노트 태그 제거
 */
export async function removeTags(notes: number[], tags: string): Promise<null> {
  return ankiConnect<null>("removeTags", { notes, tags });
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

/**
 * Anki config 값 조회
 *
 * 참고: 공식 AnkiConnect에는 getConfig/setConfig 액션이 없고,
 * 이 프로젝트는 miniPC의 커스텀 AnkiConnect 확장을 전제로 사용한다.
 */
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  try {
    return await ankiConnect<T | null>("getConfig", { key });
  } catch (error) {
    const mapped = mapUnsupportedConfigActionError("getConfig", error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}

/**
 * Anki config 값 저장
 *
 * 참고: 공식 AnkiConnect에는 getConfig/setConfig 액션이 없고,
 * 이 프로젝트는 miniPC의 커스텀 AnkiConnect 확장을 전제로 사용한다.
 */
export async function setConfig<T = unknown>(
  key: string,
  value: T,
): Promise<null> {
  try {
    return await ankiConnect<null>("setConfig", { key, val: value });
  } catch (error) {
    const mapped = mapUnsupportedConfigActionError("setConfig", error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}
