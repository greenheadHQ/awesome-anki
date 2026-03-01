import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { SplitHistoryEntry } from "@anki-splitter/core";
import type {
  CreateSessionInput,
  HistoryListQuery,
  HistoryListResult,
  HistoryStatus,
  SplitAppliedPayload,
  SplitErrorPayload,
  SplitGeneratedPayload,
  SplitNotSplitPayload,
  SplitRejectedPayload,
  SplitSessionDetail,
  SplitSessionEvent,
  SplitSessionListItem,
  TokenUsage,
} from "./types.js";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const DEFAULT_DB_PATH = join(REPO_ROOT, "data", "split-history.db");
const LEGACY_HISTORY_PATH = join(REPO_ROOT, "output", "prompts", "history");

const SCHEMA_MIGRATION_INITIAL = "001-initial-schema";
const SCHEMA_MIGRATION_LEGACY = "002-legacy-json-import-v1";
const SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE = "003-remove-split-type";
const SCHEMA_MIGRATION_ADD_PROVIDER_COST = "004-add-provider-and-cost";

function nowIso(): string {
  return new Date().toISOString();
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toNullableJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

function sanitizeSessionId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
}

function buildRuntimeSessionId(): string {
  return `session-${Date.now()}-${randomUUID().slice(0, 8)}`;
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

interface SessionRow {
  id: string;
  note_id: number;
  deck_name: string;
  status: HistoryStatus;
  prompt_version_id: string | null;
  original_text: string;
  original_tags_json: string;
  ai_response_json: string | null;
  split_cards_json: string;
  split_reason: string | null;
  ai_model: string | null;
  execution_time_ms: number | null;
  token_usage_json: string | null;
  rejection_reason: string | null;
  error_message: string | null;
  provider: string;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  source: "runtime" | "legacy_json";
  created_at: string;
  updated_at: string;
  applied_at: string | null;
}

interface EventRow {
  id: string;
  session_id: string;
  event_type: string;
  status: HistoryStatus;
  payload_json: string | null;
  created_at: string;
}

function resolveDbPath(): string {
  const override = process.env.SPLIT_HISTORY_DB_PATH?.trim();
  if (!override) return DEFAULT_DB_PATH;
  return isAbsolute(override) ? override : resolve(REPO_ROOT, override);
}

function ensureParentDir(targetPath: string): void {
  const parent = resolve(targetPath, "..");
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
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

export class HistorySessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`History session not found: ${sessionId}`);
    this.name = "HistorySessionNotFoundError";
  }
}

export class SplitHistoryStore {
  readonly dbPath: string;
  private readonly db: Database;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    ensureParentDir(this.dbPath);

    this.db = new Database(this.dbPath, { create: true, strict: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
  }

  async initialize(): Promise<void> {
    this.applySchemaMigrations();
    await this.importLegacyJsonOnce();
  }

  close(): void {
    this.db.close(false);
  }

  private hasMigration(name: string): boolean {
    const stmt = this.db.query<{ name: string }, [string]>(
      "SELECT name FROM schema_migrations WHERE name = ?",
    );
    return !!stmt.get(name);
  }

  private markMigration(name: string): void {
    const stmt = this.db.query(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
    );
    stmt.run(name, nowIso());
  }

  private hasSplitTypeColumn(): boolean {
    const rows = this.db
      .query<{ name: string }, []>(
        "SELECT name FROM pragma_table_info('split_sessions') WHERE name = 'split_type'",
      )
      .all();
    return rows.length > 0;
  }

  private hasColumn(column: string): boolean {
    const rows = this.db
      .query<{ name: string }, [string]>(
        "SELECT name FROM pragma_table_info('split_sessions') WHERE name = ?",
      )
      .all(column);
    return rows.length > 0;
  }

  private applySchemaMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    if (!this.hasMigration(SCHEMA_MIGRATION_INITIAL)) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS split_sessions (
          id TEXT PRIMARY KEY,
          note_id INTEGER NOT NULL,
          deck_name TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL CHECK (status IN ('generating','generated','applied','rejected','error','not_split')),
          prompt_version_id TEXT,
          original_text TEXT NOT NULL,
          original_tags_json TEXT NOT NULL DEFAULT '[]',
          ai_response_json TEXT,
          split_cards_json TEXT NOT NULL DEFAULT '[]',
          split_reason TEXT,
          ai_model TEXT,
          execution_time_ms INTEGER,
          token_usage_json TEXT,
          rejection_reason TEXT,
          error_message TEXT,
          source TEXT NOT NULL DEFAULT 'runtime' CHECK (source IN ('runtime','legacy_json')),
          legacy_entry_id TEXT,
          migration_dedup_key TEXT UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          applied_at TEXT
        );

        CREATE TABLE IF NOT EXISTS split_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES split_sessions(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('generating','generated','applied','rejected','error','not_split')),
          payload_json TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_split_sessions_created_at ON split_sessions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_deck_name ON split_sessions(deck_name);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_status ON split_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_note_id ON split_sessions(note_id);
        CREATE INDEX IF NOT EXISTS idx_split_events_session_id ON split_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_split_events_created_at ON split_events(created_at);
      `);

      this.markMigration(SCHEMA_MIGRATION_INITIAL);
    }

    this.migrateRemoveSplitType();
    this.migrateAddProviderAndCost();
  }

  private migrateRemoveSplitType(): void {
    // Short-circuit: split_type 컬럼이 이미 없으면 마이그레이션 불필요
    if (!this.hasSplitTypeColumn()) {
      if (!this.hasMigration(SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE)) {
        this.markMigration(SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE);
      }
      return;
    }

    if (this.hasMigration(SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE)) {
      return;
    }

    // FK 제약 비활성화 후 try/finally로 복원 보장
    this.db.exec("PRAGMA foreign_keys = OFF;");
    try {
      this.db.transaction(() => {
        // 1. 새 테이블 생성 (split_type 컬럼 없이)
        this.db.exec(`
          CREATE TABLE split_sessions_new (
            id TEXT PRIMARY KEY,
            note_id INTEGER NOT NULL,
            deck_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK (status IN ('generating','generated','applied','rejected','error','not_split')),
            prompt_version_id TEXT,
            original_text TEXT NOT NULL,
            original_tags_json TEXT NOT NULL DEFAULT '[]',
            ai_response_json TEXT,
            split_cards_json TEXT NOT NULL DEFAULT '[]',
            split_reason TEXT,
            ai_model TEXT,
            execution_time_ms INTEGER,
            token_usage_json TEXT,
            rejection_reason TEXT,
            error_message TEXT,
            source TEXT NOT NULL DEFAULT 'runtime' CHECK (source IN ('runtime','legacy_json')),
            legacy_entry_id TEXT,
            migration_dedup_key TEXT UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            applied_at TEXT
          );
        `);

        // 2. 데이터 복사 (split_type 제외)
        this.db.exec(`
          INSERT INTO split_sessions_new
            SELECT id, note_id, deck_name, status, prompt_version_id,
                   original_text, original_tags_json, ai_response_json,
                   split_cards_json, split_reason, ai_model, execution_time_ms,
                   token_usage_json, rejection_reason, error_message, source,
                   legacy_entry_id, migration_dedup_key, created_at,
                   updated_at, applied_at
            FROM split_sessions;
        `);

        // 3. 기존 테이블 삭제 + 리네임
        this.db.exec("DROP TABLE split_sessions;");
        this.db.exec(
          "ALTER TABLE split_sessions_new RENAME TO split_sessions;",
        );

        // 4. 인덱스 재생성 (idx_split_sessions_split_type 제외)
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_split_sessions_created_at ON split_sessions(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_split_sessions_deck_name ON split_sessions(deck_name);
          CREATE INDEX IF NOT EXISTS idx_split_sessions_status ON split_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_split_sessions_note_id ON split_sessions(note_id);
        `);

        // 5. 마이그레이션 기록 (트랜잭션 내부에서 원자성 확보)
        this.markMigration(SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE);
      })();
    } finally {
      // FK 제약 복원 보장
      this.db.exec("PRAGMA foreign_keys = ON;");
    }
  }

  private migrateAddProviderAndCost(): void {
    if (this.hasMigration(SCHEMA_MIGRATION_ADD_PROVIDER_COST)) {
      return;
    }

    // 3개 컬럼을 개별 확인하여 누락분만 추가
    const hasProvider = this.hasColumn("provider");
    const hasEstimatedCost = this.hasColumn("estimated_cost_usd");
    const hasActualCost = this.hasColumn("actual_cost_usd");

    if (hasProvider && hasEstimatedCost && hasActualCost) {
      // 모든 컬럼이 이미 존재 — 마이그레이션 기록만 추가
      this.markMigration(SCHEMA_MIGRATION_ADD_PROVIDER_COST);
      return;
    }

    this.db.transaction(() => {
      if (!hasProvider) {
        this.db.exec(
          "ALTER TABLE split_sessions ADD COLUMN provider TEXT DEFAULT 'gemini';",
        );
      }
      if (!hasEstimatedCost) {
        this.db.exec(
          "ALTER TABLE split_sessions ADD COLUMN estimated_cost_usd REAL;",
        );
      }
      if (!hasActualCost) {
        this.db.exec(
          "ALTER TABLE split_sessions ADD COLUMN actual_cost_usd REAL;",
        );
      }
      this.markMigration(SCHEMA_MIGRATION_ADD_PROVIDER_COST);
    })();
  }

  private async importLegacyJsonOnce(): Promise<void> {
    if (this.hasMigration(SCHEMA_MIGRATION_LEGACY)) {
      return;
    }

    if (process.env.SPLIT_HISTORY_SKIP_LEGACY_IMPORT === "true") {
      this.markMigration(SCHEMA_MIGRATION_LEGACY);
      return;
    }

    if (!existsSync(LEGACY_HISTORY_PATH)) {
      this.markMigration(SCHEMA_MIGRATION_LEGACY);
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

    const importAllEntries = this.db.transaction(
      (entries: SplitHistoryEntry[]) => {
        for (const entry of entries) {
          this.importLegacyEntry(entry);
        }
      },
    );
    importAllEntries(allEntries);

    this.markMigration(SCHEMA_MIGRATION_LEGACY);
  }

  private importLegacyEntry(entry: SplitHistoryEntry): void {
    if (!hasValidLegacyNoteId(entry.noteId)) return;

    const dedupKey = buildLegacyMigrationKey(entry);

    const dedupStmt = this.db.query<{ id: string }, [string]>(
      "SELECT id FROM split_sessions WHERE migration_dedup_key = ?",
    );
    if (dedupStmt.get(dedupKey)) return;

    const status = mapLegacyActionToStatus(entry.userAction);
    const timestamp = entry.timestamp || nowIso();
    const sessionId = sanitizeSessionId(
      `legacy-${entry.id || `${entry.noteId}-${Date.parse(timestamp) || Date.now()}`}`,
    );

    const hasAiResponseMetadata = Boolean(
      entry.aiModel ||
        entry.splitReason ||
        entry.executionTimeMs ||
        entry.tokenUsage,
    );
    const aiResponse = hasAiResponseMetadata
      ? {
          aiModel: entry.aiModel,
          splitReason: entry.splitReason,
          executionTimeMs: entry.executionTimeMs,
          tokenUsage: entry.tokenUsage,
        }
      : null;

    const insert = this.db.query(
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

    this.insertEvent(
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

  private insertEvent(
    sessionId: string,
    eventType: string,
    status: HistoryStatus,
    payload: Record<string, unknown> | null,
    createdAt = nowIso(),
  ): void {
    const stmt = this.db.query(
      "INSERT INTO split_events (id, session_id, event_type, status, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    stmt.run(
      `evt-${randomUUID()}`,
      sessionId,
      eventType,
      status,
      toNullableJson(payload),
      createdAt,
    );
  }

  createSession(input: CreateSessionInput): { sessionId: string } {
    const sessionId = buildRuntimeSessionId();
    const createdAt = nowIso();

    const stmt = this.db.query(
      `INSERT INTO split_sessions (
        id, note_id, deck_name, status, prompt_version_id,
        original_text, original_tags_json, source,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'generating', ?, ?, ?, 'runtime', ?, ?)`,
    );

    this.db.transaction(() => {
      stmt.run(
        sessionId,
        input.noteId,
        input.deckName,
        input.promptVersionId || null,
        input.originalText,
        JSON.stringify(input.originalTags || []),
        createdAt,
        createdAt,
      );

      this.insertEvent(
        sessionId,
        "session_created",
        "generating",
        {
          noteId: input.noteId,
          deckName: input.deckName,
          promptVersionId: input.promptVersionId,
        },
        createdAt,
      );
    })();

    return { sessionId };
  }

  markGenerated(sessionId: string, payload: SplitGeneratedPayload): void {
    const updatedAt = nowIso();
    const stmt = this.db.query(
      `UPDATE split_sessions
       SET status = 'generated',
           split_cards_json = ?,
           ai_response_json = ?,
           split_reason = ?,
           ai_model = ?,
           provider = COALESCE(?, provider),
           estimated_cost_usd = ?,
           actual_cost_usd = ?,
           execution_time_ms = ?,
           token_usage_json = ?,
           error_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(
        JSON.stringify(payload.splitCards || []),
        toNullableJson(payload.aiResponse),
        payload.splitReason || null,
        payload.aiModel || null,
        payload.provider || null,
        payload.estimatedCostUsd ?? null,
        payload.actualCostUsd ?? null,
        payload.executionTimeMs ?? null,
        toNullableJson(payload.tokenUsage ?? null),
        updatedAt,
        sessionId,
      );

      if (result.changes === 0) {
        throw new HistorySessionNotFoundError(sessionId);
      }

      this.insertEvent(
        sessionId,
        "preview_generated",
        "generated",
        {
          cardCount: payload.splitCards.length,
          splitReason: payload.splitReason,
          aiModel: payload.aiModel,
          executionTimeMs: payload.executionTimeMs,
          tokenUsage: payload.tokenUsage ?? null,
        },
        updatedAt,
      );
    })();
  }

  markNotSplit(sessionId: string, payload: SplitNotSplitPayload): void {
    const updatedAt = nowIso();
    const stmt = this.db.query(
      `UPDATE split_sessions
       SET status = 'not_split',
           split_reason = ?,
           ai_model = ?,
           provider = COALESCE(?, provider),
           estimated_cost_usd = ?,
           actual_cost_usd = ?,
           execution_time_ms = ?,
           token_usage_json = ?,
           ai_response_json = COALESCE(?, ai_response_json),
           error_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(
        payload.splitReason || null,
        payload.aiModel || null,
        payload.provider || null,
        payload.estimatedCostUsd ?? null,
        payload.actualCostUsd ?? null,
        payload.executionTimeMs ?? null,
        toNullableJson(payload.tokenUsage ?? null),
        toNullableJson(payload.aiResponse ?? null),
        updatedAt,
        sessionId,
      );

      if (result.changes === 0) {
        throw new HistorySessionNotFoundError(sessionId);
      }

      this.insertEvent(
        sessionId,
        "preview_not_split",
        "not_split",
        {
          splitReason: payload.splitReason,
          aiModel: payload.aiModel,
          executionTimeMs: payload.executionTimeMs,
          tokenUsage: payload.tokenUsage ?? null,
        },
        updatedAt,
      );
    })();
  }

  markApplied(sessionId: string, payload: SplitAppliedPayload): void {
    const timestamp = nowIso();
    const stmt = this.db.query(
      `UPDATE split_sessions
       SET status = 'applied',
           split_cards_json = ?,
           rejection_reason = NULL,
           error_message = NULL,
           applied_at = ?,
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(
        JSON.stringify(payload.splitCards || []),
        timestamp,
        timestamp,
        sessionId,
      );

      if (result.changes === 0) {
        throw new HistorySessionNotFoundError(sessionId);
      }

      this.insertEvent(
        sessionId,
        "split_applied",
        "applied",
        {
          cardCount: payload.splitCards.length,
        },
        timestamp,
      );
    })();
  }

  markRejected(sessionId: string, payload: SplitRejectedPayload): void {
    const updatedAt = nowIso();
    const stmt = this.db.query(
      `UPDATE split_sessions
       SET status = 'rejected',
           rejection_reason = ?,
           error_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(payload.rejectionReason, updatedAt, sessionId);
      if (result.changes === 0) {
        throw new HistorySessionNotFoundError(sessionId);
      }

      this.insertEvent(
        sessionId,
        "split_rejected",
        "rejected",
        {
          rejectionReason: payload.rejectionReason,
        },
        updatedAt,
      );
    })();
  }

  markError(sessionId: string, payload: SplitErrorPayload): void {
    const updatedAt = nowIso();
    const stmt = this.db.query(
      `UPDATE split_sessions
       SET status = 'error',
           error_message = ?,
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(payload.errorMessage, updatedAt, sessionId);
      if (result.changes === 0) {
        throw new HistorySessionNotFoundError(sessionId);
      }

      this.insertEvent(
        sessionId,
        "split_error",
        "error",
        {
          errorMessage: payload.errorMessage,
        },
        updatedAt,
      );
    })();
  }

  getSessionDetail(sessionId: string): SplitSessionDetail | null {
    const sessionStmt = this.db.query<SessionRow, [string]>(
      "SELECT * FROM split_sessions WHERE id = ?",
    );
    const row = sessionStmt.get(sessionId);
    if (!row) return null;

    const eventsStmt = this.db.query<EventRow, [string]>(
      "SELECT * FROM split_events WHERE session_id = ? ORDER BY created_at ASC",
    );
    const events = eventsStmt.all(sessionId).map(
      (event): SplitSessionEvent => ({
        eventId: event.id,
        sessionId: event.session_id,
        eventType: event.event_type,
        status: event.status,
        createdAt: event.created_at,
        payload: safeJsonParse(event.payload_json, null),
      }),
    );

    return {
      sessionId: row.id,
      noteId: row.note_id,
      deckName: row.deck_name,
      status: row.status,
      promptVersionId: row.prompt_version_id ?? undefined,
      originalText: row.original_text,
      originalTags: safeJsonParse(row.original_tags_json, []),
      aiResponse: safeJsonParse(row.ai_response_json, null),
      splitCards: safeJsonParse(row.split_cards_json, []),
      splitReason: row.split_reason ?? undefined,
      aiModel: row.ai_model ?? undefined,
      provider: row.provider ?? undefined,
      estimatedCostUsd: row.estimated_cost_usd ?? undefined,
      actualCostUsd: row.actual_cost_usd ?? undefined,
      executionTimeMs: row.execution_time_ms ?? undefined,
      tokenUsage:
        safeJsonParse<TokenUsage | null>(row.token_usage_json, null) ??
        undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      errorMessage: row.error_message ?? undefined,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      appliedAt: row.applied_at ?? undefined,
      events,
    };
  }

  getHistoryList(query: HistoryListQuery): HistoryListResult {
    const conditions: string[] = ["created_at >= ?", "created_at <= ?"];
    const params: Array<string | number> = [query.startDate, query.endDate];

    if (query.deckName) {
      conditions.push("deck_name = ?");
      params.push(query.deckName);
    }

    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (query.page - 1) * query.limit;

    const countStmt = this.db.query<{ total: number }, (string | number)[]>(
      `SELECT COUNT(*) AS total FROM split_sessions ${whereClause}`,
    );
    const totalCount = countStmt.get(...params)?.total ?? 0;

    const listStmt = this.db.query<SessionRow, (string | number)[]>(
      `SELECT * FROM split_sessions ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    );

    const rows = listStmt.all(...params, query.limit, offset);
    const items: SplitSessionListItem[] = rows.map((row) => ({
      sessionId: row.id,
      noteId: row.note_id,
      deckName: row.deck_name,
      status: row.status,
      promptVersionId: row.prompt_version_id ?? undefined,
      splitReason: row.split_reason ?? undefined,
      aiModel: row.ai_model ?? undefined,
      provider: row.provider ?? undefined,
      estimatedCostUsd: row.estimated_cost_usd ?? undefined,
      actualCostUsd: row.actual_cost_usd ?? undefined,
      cardCount: safeJsonParse<unknown[]>(row.split_cards_json, []).length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      appliedAt: row.applied_at ?? undefined,
    }));

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / query.limit) : 0;

    return {
      items,
      totalCount,
      page: query.page,
      limit: query.limit,
      totalPages,
      hasMore: query.page * query.limit < totalCount,
    };
  }

  getSessionMetadata(sessionId: string): {
    sessionId: string;
    promptVersionId?: string;
    splitCards: Array<{ content: string; charCount?: number; title?: string }>;
  } | null {
    const stmt = this.db.query<
      Pick<SessionRow, "id" | "prompt_version_id" | "split_cards_json">,
      [string]
    >(
      "SELECT id, prompt_version_id, split_cards_json FROM split_sessions WHERE id = ?",
    );

    const row = stmt.get(sessionId);
    if (!row) return null;

    return {
      sessionId: row.id,
      promptVersionId: row.prompt_version_id ?? undefined,
      splitCards: safeJsonParse(row.split_cards_json, []),
    };
  }
}

let storePromise: Promise<SplitHistoryStore> | null = null;

export function getSplitHistoryDbPath(): string {
  return resolveDbPath();
}

export function resetSplitHistoryStoreForTests(): void {
  storePromise = null;
}

export async function getSplitHistoryStore(): Promise<SplitHistoryStore> {
  if (!storePromise) {
    const dbPath = resolveDbPath();
    const store = new SplitHistoryStore(dbPath);
    storePromise = store
      .initialize()
      .then(() => store)
      .catch((error) => {
        try {
          store.close();
        } catch {
          // close 실패는 원래 초기화 에러를 덮어쓰지 않음
        }
        storePromise = null;
        throw error;
      });
  }

  return storePromise;
}
