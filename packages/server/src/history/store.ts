import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { importLegacyJsonOnce } from "./legacy-import.js";
import { applyAllSchemaMigrations } from "./schema-migrations.js";
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

function buildRuntimeSessionId(): string {
  return `session-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
    applyAllSchemaMigrations(this.db);
    await importLegacyJsonOnce(this.db);
  }

  close(): void {
    this.db.close(false);
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
           provider = COALESCE(?, provider),
           ai_model = COALESCE(?, ai_model),
           updated_at = ?
       WHERE id = ?`,
    );

    this.db.transaction(() => {
      const result = stmt.run(
        payload.errorMessage,
        payload.provider || null,
        payload.aiModel || null,
        updatedAt,
        sessionId,
      );
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
      tokenUsage: safeJsonParse<TokenUsage | null>(row.token_usage_json, null) ?? undefined,
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
    >("SELECT id, prompt_version_id, split_cards_json FROM split_sessions WHERE id = ?");

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
