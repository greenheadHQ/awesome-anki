/**
 * Backup API Routes
 */

import { getLatestBackupId, listBackups, rollback } from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /api/backup
 * 백업 목록 조회
 */
app.get("/", async (c) => {
  try {
    const backups = listBackups();

    return c.json({
      backups: backups.map((backup) => ({
        id: backup.id,
        timestamp: backup.timestamp,
        deckName: backup.deckName,
        originalNoteId: backup.originalNoteId,
        createdNoteIds: backup.createdNoteIds,
        splitType: backup.splitType,
      })),
      total: backups.length,
    });
  } catch (error) {
    console.error("Error fetching backups:", error);
    return c.json({ error: "Failed to fetch backups" }, 500);
  }
});

/**
 * GET /api/backup/latest
 * 최근 백업 ID 조회
 */
app.get("/latest", async (c) => {
  try {
    const latestId = getLatestBackupId();

    if (!latestId) {
      return c.json({ backupId: null });
    }

    return c.json({ backupId: latestId });
  } catch (error) {
    console.error("Error fetching latest backup:", error);
    return c.json({ error: "Failed to fetch latest backup" }, 500);
  }
});

/**
 * POST /api/backup/:id/rollback
 * 롤백 실행
 */
app.post("/:id/rollback", async (c) => {
  try {
    const backupId = c.req.param("id");
    const result = await rollback(backupId);

    if (result.success) {
      return c.json({
        success: true,
        restoredNoteId: result.restoredNoteId,
        deletedNoteIds: result.deletedNoteIds,
      });
    }

    return c.json(
      {
        success: false,
        error: result.error,
      },
      400,
    );
  } catch (error) {
    console.error("Error during rollback:", error);
    return c.json({ error: "Failed to rollback" }, 500);
  }
});

export default app;
