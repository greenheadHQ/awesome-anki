/**
 * Backup API Routes
 */

import {
  getLatestBackupId,
  listBackups,
  rollback,
  ValidationError,
} from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /api/backup
 * 백업 목록 조회
 */
app.get("/", async (c) => {
  const backups = listBackups();

  return c.json({
    backups: backups.map((backup) => ({
      id: backup.id,
      timestamp: backup.timestamp,
      deckName: backup.deckName,
      originalNoteId: backup.originalNoteId,
      createdNoteIds: backup.createdNoteIds,
    })),
    total: backups.length,
  });
});

/**
 * GET /api/backup/latest
 * 최근 백업 ID 조회
 */
app.get("/latest", async (c) => {
  const latestId = getLatestBackupId();

  if (!latestId) {
    return c.json({ backupId: null });
  }

  return c.json({ backupId: latestId });
});

/**
 * POST /api/backup/:id/rollback
 * 롤백 실행
 */
app.post("/:id/rollback", async (c) => {
  const backupId = c.req.param("id");
  const result = await rollback(backupId);

  if (!result.success) {
    throw new ValidationError(result.error || "롤백에 실패했습니다");
  }

  return c.json({
    success: true,
    restoredNoteId: result.restoredNoteId,
    deletedNoteIds: result.deletedNoteIds,
    restoredFieldNames: result.restoredFieldNames,
    restoredTags: result.restoredTags,
    warning: result.warning,
  });
});

export default app;
