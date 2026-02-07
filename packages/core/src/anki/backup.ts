/**
 * 백업 및 롤백 관리
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  deleteNotes,
  getNotesInfo,
  type NoteInfo,
  updateNoteFields,
} from "./client.js";

const BACKUP_DIR = join(process.cwd(), "output", "backups");

export interface BackupEntry {
  id: string;
  timestamp: string;
  deckName: string;
  originalNoteId: number;
  originalContent: {
    noteId: number;
    fields: Record<string, { value: string; order: number }>;
    tags: string[];
    modelName: string;
  };
  createdNoteIds: number[];
  splitType: "hard" | "soft";
}

export interface BackupFile {
  version: 1;
  entries: BackupEntry[];
}

/**
 * 백업 디렉토리 확인/생성
 */
function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * 백업 파일 경로 생성
 */
function getBackupFilePath(): string {
  const date = new Date().toISOString().split("T")[0];
  return join(BACKUP_DIR, `backup-${date}.json`);
}

/**
 * 백업 파일 로드
 */
function loadBackupFile(filePath: string): BackupFile {
  if (!existsSync(filePath)) {
    return { version: 1, entries: [] };
  }
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * 백업 파일 저장
 */
function saveBackupFile(filePath: string, data: BackupFile): void {
  ensureBackupDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 분할 전 상태 백업
 */
export async function createBackup(
  deckName: string,
  originalNoteId: number,
  createdNoteIds: number[],
  splitType: "hard" | "soft",
): Promise<string> {
  // 원본 노트 정보 조회
  const [originalNote] = await getNotesInfo([originalNoteId]);

  if (!originalNote) {
    throw new Error(`노트 ${originalNoteId}를 찾을 수 없습니다.`);
  }

  const backupId = `${originalNoteId}-${Date.now()}`;
  const entry: BackupEntry = {
    id: backupId,
    timestamp: new Date().toISOString(),
    deckName,
    originalNoteId,
    originalContent: {
      noteId: originalNote.noteId,
      fields: originalNote.fields,
      tags: originalNote.tags,
      modelName: originalNote.modelName,
    },
    createdNoteIds,
    splitType,
  };

  const filePath = getBackupFilePath();
  const backupFile = loadBackupFile(filePath);
  backupFile.entries.push(entry);
  saveBackupFile(filePath, backupFile);

  return backupId;
}

/**
 * 사전 백업 (분할 적용 전)
 *
 * 분할 적용 전에 원본 상태를 미리 저장
 */
export async function preBackup(
  deckName: string,
  originalNoteId: number,
  splitType: "hard" | "soft",
): Promise<{ backupId: string; originalNote: NoteInfo }> {
  const [originalNote] = await getNotesInfo([originalNoteId]);

  if (!originalNote) {
    throw new Error(`노트 ${originalNoteId}를 찾을 수 없습니다.`);
  }

  const backupId = `${originalNoteId}-${Date.now()}`;
  const entry: BackupEntry = {
    id: backupId,
    timestamp: new Date().toISOString(),
    deckName,
    originalNoteId,
    originalContent: {
      noteId: originalNote.noteId,
      fields: originalNote.fields,
      tags: originalNote.tags,
      modelName: originalNote.modelName,
    },
    createdNoteIds: [], // 나중에 업데이트
    splitType,
  };

  const filePath = getBackupFilePath();
  const backupFile = loadBackupFile(filePath);
  backupFile.entries.push(entry);
  saveBackupFile(filePath, backupFile);

  return { backupId, originalNote };
}

/**
 * 백업 엔트리에 생성된 노트 ID 추가
 */
export function updateBackupWithCreatedNotes(
  backupId: string,
  createdNoteIds: number[],
): void {
  const filePath = getBackupFilePath();
  const backupFile = loadBackupFile(filePath);

  const entry = backupFile.entries.find((e) => e.id === backupId);
  if (entry) {
    entry.createdNoteIds = createdNoteIds;
    saveBackupFile(filePath, backupFile);
  }
}

/**
 * 롤백 실행
 *
 * 1. 생성된 서브 카드들 삭제
 * 2. 원본 노트 복원
 */
export async function rollback(backupId: string): Promise<{
  success: boolean;
  restoredNoteId?: number;
  deletedNoteIds?: number[];
  error?: string;
}> {
  // 모든 백업 파일에서 검색
  ensureBackupDir();
  const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-"));

  let entry: BackupEntry | undefined;
  let filePath: string | undefined;

  for (const file of files) {
    const path = join(BACKUP_DIR, file);
    const backupFile = loadBackupFile(path);
    entry = backupFile.entries.find((e) => e.id === backupId);
    if (entry) {
      filePath = path;
      break;
    }
  }

  if (!entry || !filePath) {
    return { success: false, error: `백업 ID ${backupId}를 찾을 수 없습니다.` };
  }

  try {
    // 1. 생성된 서브 카드들 삭제
    if (entry.createdNoteIds.length > 0) {
      await deleteNotes(entry.createdNoteIds);
    }

    // 2. 원본 노트 복원
    const originalFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry.originalContent.fields)) {
      originalFields[key] = value.value;
    }

    await updateNoteFields(entry.originalNoteId, {
      Text: originalFields.Text || "",
      "Back Extra": originalFields["Back Extra"] || "",
    });

    // 백업 엔트리 제거 (롤백 완료 표시)
    const backupFile = loadBackupFile(filePath);
    backupFile.entries = backupFile.entries.filter((e) => e.id !== backupId);
    saveBackupFile(filePath, backupFile);

    return {
      success: true,
      restoredNoteId: entry.originalNoteId,
      deletedNoteIds: entry.createdNoteIds,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 백업 목록 조회
 */
export function listBackups(): BackupEntry[] {
  ensureBackupDir();
  const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-"));

  const allEntries: BackupEntry[] = [];
  for (const file of files) {
    const path = join(BACKUP_DIR, file);
    const backupFile = loadBackupFile(path);
    allEntries.push(...backupFile.entries);
  }

  // 최신순 정렬
  return allEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * 최근 백업 ID 조회
 */
export function getLatestBackupId(): string | null {
  const backups = listBackups();
  return backups.length > 0 ? backups[0].id : null;
}
