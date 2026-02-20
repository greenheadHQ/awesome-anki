import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoot = join(
  tmpdir(),
  `anki-backup-test-${Date.now()}-${process.pid}`,
);
const backupDir = join(tempRoot, "backups");
const today = new Date().toISOString().split("T")[0];
const backupFilePath = join(backupDir, `backup-${today}.json`);

type BackupModule = typeof import("../anki/backup.js");
let backupModule: BackupModule;

function resetBackupDir(): void {
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(backupDir, { recursive: true });
}

beforeAll(async () => {
  process.env.ANKI_SPLITTER_BACKUP_DIR = backupDir;
  mkdirSync(backupDir, { recursive: true });
  backupModule = await import("../anki/backup.js");
});

afterAll(() => {
  delete process.env.ANKI_SPLITTER_BACKUP_DIR;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("backup storage integrity", () => {
  test("updateBackupWithCreatedNotes는 동시 업데이트를 안전하게 병합한다", async () => {
    resetBackupDir();

    writeFileSync(
      backupFilePath,
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              id: "note-1",
              timestamp: new Date().toISOString(),
              deckName: "test-deck",
              originalNoteId: 1,
              originalContent: {
                noteId: 1,
                fields: { Text: { value: "original", order: 0 } },
                tags: [],
                modelName: "Cloze",
              },
              createdNoteIds: [],
              splitType: "soft",
            },
          ],
        },
        null,
        2,
      ),
    );

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        backupModule.updateBackupWithCreatedNotes("note-1", [index + 100]),
      ),
    );

    const [entry] = backupModule.listBackups();
    expect(entry).toBeDefined();
    expect(entry.createdNoteIds).toHaveLength(20);
    for (let i = 100; i < 120; i += 1) {
      expect(entry.createdNoteIds).toContain(i);
    }
  });

  test("updateBackupWithCreatedNotes는 백업 ID를 찾지 못하면 실패한다", async () => {
    resetBackupDir();

    writeFileSync(
      backupFilePath,
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              id: "note-existing",
              timestamp: new Date().toISOString(),
              deckName: "test-deck",
              originalNoteId: 1,
              originalContent: {
                noteId: 1,
                fields: { Text: { value: "original", order: 0 } },
                tags: [],
                modelName: "Cloze",
              },
              createdNoteIds: [],
              splitType: "soft",
            },
          ],
        },
        null,
        2,
      ),
    );

    await expect(
      backupModule.updateBackupWithCreatedNotes("missing-id", [999]),
    ).rejects.toThrow("백업 ID missing-id를 찾을 수 없습니다.");
  });

  test("손상된 백업 파일은 격리하고 빈 목록으로 복구한다", () => {
    resetBackupDir();
    writeFileSync(backupFilePath, "{ not-valid-json");

    const backups = backupModule.listBackups();
    expect(backups).toEqual([]);

    const files = readdirSync(backupDir);
    const quarantined = files.find(
      (file) =>
        file.startsWith(`backup-${today}.json.corrupt-`) &&
        existsSync(join(backupDir, file)),
    );

    expect(quarantined).toBeDefined();
  });
});
