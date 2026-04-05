/**
 * 스키마 마이그레이션 — split_sessions 테이블 관리
 */

import { Database } from "bun:sqlite";

const SCHEMA_MIGRATION_INITIAL = "001-initial-schema";
const SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE = "003-remove-split-type";
const SCHEMA_MIGRATION_ADD_PROVIDER_COST = "004-add-provider-and-cost";

function nowIso(): string {
  return new Date().toISOString();
}

export function hasMigration(db: Database, name: string): boolean {
  const stmt = db.query<{ name: string }, [string]>(
    "SELECT name FROM schema_migrations WHERE name = ?",
  );
  return !!stmt.get(name);
}

export function markMigration(db: Database, name: string): void {
  const stmt = db.query("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  stmt.run(name, nowIso());
}

export function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db
    .query<{ name: string }, [string]>(
      `SELECT name FROM pragma_table_info('${table}') WHERE name = ?`,
    )
    .all(column);
  return rows.length > 0;
}

function hasSplitTypeColumn(db: Database): boolean {
  return hasColumn(db, "split_sessions", "split_type");
}

export function applyAllSchemaMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  if (!hasMigration(db, SCHEMA_MIGRATION_INITIAL)) {
    db.exec(`
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

    markMigration(db, SCHEMA_MIGRATION_INITIAL);
  }

  migrateRemoveSplitType(db);
  migrateAddProviderAndCost(db);
}

function migrateRemoveSplitType(db: Database): void {
  // Short-circuit: split_type 컬럼이 이미 없으면 마이그레이션 불필요
  if (!hasSplitTypeColumn(db)) {
    if (!hasMigration(db, SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE)) {
      markMigration(db, SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE);
    }
    return;
  }

  if (hasMigration(db, SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE)) {
    return;
  }

  // FK 제약 비활성화 후 try/finally로 복원 보장
  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.transaction(() => {
      // 1. 새 테이블 생성 (split_type 컬럼 없이)
      db.exec(`
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
      db.exec(`
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
      db.exec("DROP TABLE split_sessions;");
      db.exec("ALTER TABLE split_sessions_new RENAME TO split_sessions;");

      // 4. 인덱스 재생성 (idx_split_sessions_split_type 제외)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_split_sessions_created_at ON split_sessions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_deck_name ON split_sessions(deck_name);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_status ON split_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_split_sessions_note_id ON split_sessions(note_id);
      `);

      // 5. 마이그레이션 기록 (트랜잭션 내부에서 원자성 확보)
      markMigration(db, SCHEMA_MIGRATION_REMOVE_SPLIT_TYPE);
    })();
  } finally {
    // FK 제약 복원 보장
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function migrateAddProviderAndCost(db: Database): void {
  if (hasMigration(db, SCHEMA_MIGRATION_ADD_PROVIDER_COST)) {
    return;
  }

  // 3개 컬럼을 개별 확인하여 누락분만 추가
  const hasProviderCol = hasColumn(db, "split_sessions", "provider");
  const hasEstimatedCost = hasColumn(db, "split_sessions", "estimated_cost_usd");
  const hasActualCost = hasColumn(db, "split_sessions", "actual_cost_usd");

  if (hasProviderCol && hasEstimatedCost && hasActualCost) {
    // 모든 컬럼이 이미 존재 — 마이그레이션 기록만 추가
    markMigration(db, SCHEMA_MIGRATION_ADD_PROVIDER_COST);
    return;
  }

  db.transaction(() => {
    if (!hasProviderCol) {
      db.exec("ALTER TABLE split_sessions ADD COLUMN provider TEXT DEFAULT 'gemini';");
    }
    if (!hasEstimatedCost) {
      db.exec("ALTER TABLE split_sessions ADD COLUMN estimated_cost_usd REAL;");
    }
    if (!hasActualCost) {
      db.exec("ALTER TABLE split_sessions ADD COLUMN actual_cost_usd REAL;");
    }
    markMigration(db, SCHEMA_MIGRATION_ADD_PROVIDER_COST);
  })();
}
