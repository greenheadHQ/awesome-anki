/**
 * 레거시 JSON 히스토리 → SQLite 마이그레이션
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { SplitHistoryEntry } from "@anki-splitter/core";

import type { HistoryStatus } from "./types.js";
import { hasMigration, markMigration } from "./schema-migrations.js";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const LEGACY_HISTORY_PATH = join(REPO_ROOT, "output", "prompts", "history");

const SCHEMA_MIGRATION_LEGACY = "002-legacy-json-import-v1";

function nowIso(): string {
  return new Date().toISOString();
}

function toNullableJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

function sanitizeSessionId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
}

function mapLegacyActionToStatus(action: string): HistoryStatus {
  switch (action) {
    case "approved":
    case "modified":
      return "applied";
    case "rejected":
      return "rejected";
    default:
      return "generated";
  }
}

function buildLegacyMigrationKey(entry: SplitHistoryEntry): string {
  return [
    entry.id ?? "",
    entry.timestamp ?? "",
    String(entry.noteId ?? ""),
    entry.userAction ?? "",
  ].join("|");
}

function hasValidLegacyNoteId(noteId: unknown): noteId is number {
  return typeof noteId === "number" && Number.isFinite(noteId);
}

function insertEvent(
  db: Database,
  sessionId: string,
  eventType: string,
  status: HistoryStatus,
  payload: Record<string, unknown> | null,
  createdAt = nowIso(),
): void {
  const stmt = db.query(
    "INSERT INTO split_events (id, session_id, event_type, status, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  stmt.run(`evt-${randomUUID()}`, sessionId, eventType, status, toNullableJson(payload), createdAt);
}

function importLegacyEntry(db: Database, entry: SplitHistoryEntry): void {
  if (!hasValidLegacyNoteId(entry.noteId)) return;

  const dedupKey = buildLegacyMigrationKey(entry);

  const dedupStmt = db.query<{ id: string }, [string]>(
    "SELECT id FROM split_sessions WHERE migration_dedup_key = ?",
  );
  if (dedupStmt.get(dedupKey)) return;

  const status = mapLegacyActionToStatus(entry.userAction);
  const timestamp = entry.timestamp || nowIso();
  const sessionId = sanitizeSessionId(
    `legacy-${entry.id || `${entry.noteId}-${Date.parse(timestamp) || Date.now()}`}`,
  );

  const hasAiResponseMetadata = Boolean(
    entry.aiModel || entry.splitReason || entry.executionTimeMs || entry.tokenUsage,
  );
  const aiResponse = hasAiResponseMetadata
    ? {
        aiModel: entry.aiModel,
        splitReason: entry.splitReason,
        executionTimeMs: entry.executionTimeMs,
        tokenUsage: entry.tokenUsage,
      }
    : null;

  const insert = db.query(
    `INSERT INTO split_sessions (
      id, note_id, deck_name, status, prompt_version_id,
      original_text, original_tags_json, ai_response_json, split_cards_json,
      split_reason, ai_model, execution_time_ms, token_usage_json,
      rejection_reason, source, legacy_entry_id, migration_dedup_key,
      created_at, updated_at, applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy_json', ?, ?, ?, ?, ?)`,
  );

  insert.run(
    sessionId,
    entry.noteId,
    entry.deckName || "",
    status,
    entry.promptVersionId || null,
    entry.originalContent || "",
    JSON.stringify(entry.originalTags || []),
    toNullableJson(aiResponse),
    JSON.stringify(entry.splitCards || []),
    entry.splitReason || null,
    entry.aiModel || null,
    entry.executionTimeMs ?? null,
    toNullableJson(entry.tokenUsage ?? null),
    entry.rejectionReason || null,
    entry.id || null,
    dedupKey,
    timestamp,
    timestamp,
    status === "applied" ? timestamp : null,
  );

  insertEvent(
    db,
    sessionId,
    "legacy_imported",
    status,
    {
      importedFrom: "output/prompts/history",
      legacyEntryId: entry.id,
    },
    timestamp,
  );
}

export async function importLegacyJsonOnce(db: Database): Promise<void> {
  if (hasMigration(db, SCHEMA_MIGRATION_LEGACY)) {
    return;
  }

  if (process.env.SPLIT_HISTORY_SKIP_LEGACY_IMPORT === "true") {
    markMigration(db, SCHEMA_MIGRATION_LEGACY);
    return;
  }

  if (!existsSync(LEGACY_HISTORY_PATH)) {
    markMigration(db, SCHEMA_MIGRATION_LEGACY);
    return;
  }

  const files = (await readdir(LEGACY_HISTORY_PATH))
    .filter((name) => name.startsWith("history-") && name.endsWith(".json"))
    .sort();

  const allEntries: SplitHistoryEntry[] = [];
  for (const file of files) {
    const fullPath = join(LEGACY_HISTORY_PATH, file);
    const raw = await readFile(fullPath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        allEntries.push(...(parsed as SplitHistoryEntry[]));
      }
    } catch {
      // malformed 파일은 무시
    }
  }

  const importAllEntries = db.transaction((entries: SplitHistoryEntry[]) => {
    for (const entry of entries) {
      importLegacyEntry(db, entry);
    }
  });
  importAllEntries(allEntries);

  markMigration(db, SCHEMA_MIGRATION_LEGACY);
}
