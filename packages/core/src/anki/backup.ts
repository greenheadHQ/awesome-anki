/**
 * 백업 및 롤백 관리
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync, withFileMutex } from "../utils/atomic-write.js";
import {
  addTags,
  deleteNotes,
  getNotesInfo,
  type NoteInfo,
  removeTags,
  updateNoteFields,
} from "./client.js";

function getBackupDir(): string {
  return (
    process.env.ANKI_SPLITTER_BACKUP_DIR ||
    join(process.cwd(), "output", "backups")
  );
}

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
  const backupDir = getBackupDir();
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
}

/**
 * 백업 파일 경로 생성
 */
function getBackupFilePath(): string {
  const backupDir = getBackupDir();
  const date = new Date().toISOString().split("T")[0];
  return join(backupDir, `backup-${date}.json`);
}

/**
 * 백업 파일 목록 조회 (절대 경로)
 */
function listBackupFiles(): string[] {
  const backupDir = getBackupDir();
  ensureBackupDir();
  return readdirSync(backupDir)
    .filter((file) => file.startsWith("backup-") && file.endsWith(".json"))
    .map((file) => join(backupDir, file));
}

function isBackupFile(data: unknown): data is BackupFile {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const parsed = data as Partial<BackupFile>;
  return parsed.version === 1 && Array.isArray(parsed.entries);
}

function quarantineCorruptedBackup(filePath: string): string {
  const quarantinedPath = `${filePath}.corrupt-${Date.now()}`;
  renameSync(filePath, quarantinedPath);
  return quarantinedPath;
}

/**
 * 백업 파일 로드
 */
function loadBackupFile(filePath: string): BackupFile {
  if (!existsSync(filePath)) {
    return { version: 1, entries: [] };
  }
  const content = readFileSync(filePath, "utf-8");

  try {
    const parsed: unknown = JSON.parse(content);
    if (!isBackupFile(parsed)) {
      throw new Error("백업 파일 포맷이 올바르지 않습니다.");
    }
    return parsed;
  } catch (error) {
    const quarantinedPath = quarantineCorruptedBackup(filePath);
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `손상된 백업 파일을 격리했습니다: ${quarantinedPath} (${reason})`,
    );
    return { version: 1, entries: [] };
  }
}

/**
 * 백업 파일 저장
 */
function saveBackupFile(filePath: string, data: BackupFile): void {
  ensureBackupDir();
  atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
}

async function appendBackupEntry(entry: BackupEntry): Promise<void> {
  const filePath = getBackupFilePath();
  await withFileMutex(filePath, async () => {
    const backupFile = loadBackupFile(filePath);
    backupFile.entries.push(entry);
    saveBackupFile(filePath, backupFile);
  });
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

  await appendBackupEntry(entry);

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

  await appendBackupEntry(entry);

  return { backupId, originalNote };
}

/**
 * 백업 엔트리에 생성된 노트 ID 추가
 */
export async function updateBackupWithCreatedNotes(
  backupId: string,
  createdNoteIds: number[],
): Promise<void> {
  const todayFilePath = getBackupFilePath();
  const candidates = [
    todayFilePath,
    ...listBackupFiles().filter((path) => path !== todayFilePath),
  ];

  for (const filePath of candidates) {
    const updated = await withFileMutex(filePath, async () => {
      const backupFile = loadBackupFile(filePath);
      const entry = backupFile.entries.find(
        (current) => current.id === backupId,
      );

      if (!entry) {
        return false;
      }

      entry.createdNoteIds = Array.from(
        new Set([...entry.createdNoteIds, ...createdNoteIds]),
      );
      saveBackupFile(filePath, backupFile);
      return true;
    });

    if (updated) {
      return;
    }
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
  restoredFieldNames?: string[];
  restoredTags?: string[];
  warning?: string;
  error?: string;
}> {
  const filePath = listBackupFiles().find((path) => {
    const backupFile = loadBackupFile(path);
    return backupFile.entries.some((entry) => entry.id === backupId);
  });

  if (!filePath) {
    return { success: false, error: `백업 ID ${backupId}를 찾을 수 없습니다.` };
  }

  const entry = await withFileMutex(filePath, async () => {
    const backupFile = loadBackupFile(filePath);
    const target = backupFile.entries.find(
      (current) => current.id === backupId,
    );
    if (!target) {
      return null;
    }
    return JSON.parse(JSON.stringify(target)) as BackupEntry;
  });

  if (!entry) {
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

    await updateNoteFields(entry.originalNoteId, originalFields);

    const [currentNote] = await getNotesInfo([entry.originalNoteId]);
    if (!currentNote) {
      throw new Error(
        `롤백 대상 노트 ${entry.originalNoteId}를 찾을 수 없습니다.`,
      );
    }

    if (currentNote.tags.length > 0) {
      await removeTags([entry.originalNoteId], currentNote.tags.join(" "));
    }
    if (entry.originalContent.tags.length > 0) {
      await addTags(
        [entry.originalNoteId],
        entry.originalContent.tags.join(" "),
      );
    }

    // 백업 엔트리 제거 (롤백 완료 표시)
    await withFileMutex(filePath, async () => {
      const backupFile = loadBackupFile(filePath);
      backupFile.entries = backupFile.entries.filter((e) => e.id !== backupId);
      saveBackupFile(filePath, backupFile);
    });

    return {
      success: true,
      restoredNoteId: entry.originalNoteId,
      deletedNoteIds: entry.createdNoteIds,
      restoredFieldNames: Object.keys(originalFields),
      restoredTags: entry.originalContent.tags,
      warning: "카드 스케줄링 메타데이터는 자동 복원되지 않습니다.",
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
  const allEntries: BackupEntry[] = [];
  for (const path of listBackupFiles()) {
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
