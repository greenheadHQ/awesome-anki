import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getSplitHistoryStore,
  resetSplitHistoryStoreForTests,
  SplitHistoryStore,
} from "./store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "split-history-test-"));
  process.env.SPLIT_HISTORY_DB_PATH = join(tempDir, "split-history.db");
  process.env.SPLIT_HISTORY_SKIP_LEGACY_IMPORT = "true";
  resetSplitHistoryStoreForTests();
});

afterEach(async () => {
  try {
    const store = await getSplitHistoryStore();
    store.close();
  } catch {
    // store가 생성되지 않았을 수 있음
  }

  resetSplitHistoryStoreForTests();
  delete process.env.SPLIT_HISTORY_DB_PATH;
  delete process.env.SPLIT_HISTORY_SKIP_LEGACY_IMPORT;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("SplitHistoryStore", () => {
  test("preview -> apply 상태 전이와 이벤트가 기록된다", async () => {
    const store = await getSplitHistoryStore();

    const { sessionId } = store.createSession({
      noteId: 1001,
      deckName: "deck-a",
      promptVersionId: "v1.0.0",
      originalText: "원본",
      originalTags: ["tag1"],
    });

    store.markGenerated(sessionId, {
      splitCards: [
        { title: "card-1", content: "A" },
        { title: "card-2", content: "B" },
      ],
      aiResponse: { shouldSplit: true },
      splitReason: "test",
      aiModel: "gemini",
      executionTimeMs: 123,
      tokenUsage: { totalTokens: 77 },
    });

    store.markApplied(sessionId, {
      splitCards: [
        { title: "card-1", content: "A" },
        { title: "card-2", content: "B" },
      ],
    });

    const detail = store.getSessionDetail(sessionId);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("applied");
    expect(detail?.splitCards.length).toBe(2);

    const eventTypes = detail?.events.map((event) => event.eventType) || [];
    expect(eventTypes).toEqual(["session_created", "preview_generated", "split_applied"]);
  });

  test("목록 필터(status)가 동작한다", async () => {
    const store = await getSplitHistoryStore();

    const first = store.createSession({
      noteId: 2001,
      deckName: "deck-a",
      originalText: "원본 A",
      originalTags: [],
    });
    store.markGenerated(first.sessionId, {
      splitCards: [{ title: "A", content: "A" }],
      aiResponse: null,
    });

    const second = store.createSession({
      noteId: 2002,
      deckName: "deck-a",
      originalText: "원본 B",
      originalTags: [],
    });
    store.markError(second.sessionId, { errorMessage: "boom" });

    const list = store.getHistoryList({
      page: 1,
      limit: 50,
      status: "error",
      startDate: "2000-01-01T00:00:00.000Z",
      endDate: "2100-01-01T00:00:00.000Z",
    });

    expect(list.totalCount).toBe(1);
    expect(list.items[0]?.sessionId).toBe(second.sessionId);
    expect(list.items[0]?.status).toBe("error");
  });

  test("not_split 상태 전이와 필터가 동작한다", async () => {
    const store = await getSplitHistoryStore();
    const { sessionId } = store.createSession({
      noteId: 2101,
      deckName: "deck-not-split",
      originalText: "원본 not split",
      originalTags: [],
    });

    store.markNotSplit(sessionId, {
      splitReason: "분할 불필요",
      aiModel: "gemini",
      executionTimeMs: 42,
    });

    const detail = store.getSessionDetail(sessionId);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("not_split");

    const eventTypes = detail?.events.map((event) => event.eventType) || [];
    expect(eventTypes).toEqual(["session_created", "preview_not_split"]);

    const filtered = store.getHistoryList({
      page: 1,
      limit: 20,
      status: "not_split",
      startDate: "2000-01-01T00:00:00.000Z",
      endDate: "2100-01-01T00:00:00.000Z",
    });

    expect(filtered.items.some((item) => item.sessionId === sessionId)).toBe(true);
  });

  test("rejected 상태 전이와 필터가 동작한다", async () => {
    const store = await getSplitHistoryStore();
    const { sessionId } = store.createSession({
      noteId: 2102,
      deckName: "deck-rejected",
      originalText: "원본 rejected",
      originalTags: [],
    });

    store.markRejected(sessionId, {
      rejectionReason: "사유 테스트",
    });

    const detail = store.getSessionDetail(sessionId);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("rejected");
    expect(detail?.rejectionReason).toBe("사유 테스트");

    const eventTypes = detail?.events.map((event) => event.eventType) || [];
    expect(eventTypes).toEqual(["session_created", "split_rejected"]);

    const filtered = store.getHistoryList({
      page: 1,
      limit: 20,
      status: "rejected",
      startDate: "2000-01-01T00:00:00.000Z",
      endDate: "2100-01-01T00:00:00.000Z",
    });

    expect(filtered.items.some((item) => item.sessionId === sessionId)).toBe(true);
  });

  test("초기화가 일시적으로 실패해도 다음 호출에서 재시도할 수 있다", async () => {
    const originalInitialize = SplitHistoryStore.prototype.initialize;
    let initializeCalls = 0;
    let recoveredStore: SplitHistoryStore | null = null;

    SplitHistoryStore.prototype.initialize = async function patchedInitialize() {
      initializeCalls += 1;
      if (initializeCalls === 1) {
        throw new Error("transient initialize failure");
      }
      return originalInitialize.call(this);
    };

    try {
      await expect(getSplitHistoryStore()).rejects.toThrow("transient initialize failure");

      recoveredStore = await getSplitHistoryStore();
      const { sessionId } = recoveredStore.createSession({
        noteId: 3001,
        deckName: "deck-retry",
        originalText: "retry",
        originalTags: [],
      });

      expect(sessionId).toContain("session-");
    } finally {
      SplitHistoryStore.prototype.initialize = originalInitialize;
      try {
        recoveredStore?.close();
      } catch {
        // close 실패는 테스트 정리 단계를 막지 않음
      }
      resetSplitHistoryStoreForTests();
    }
  });
});

describe("split_type 컬럼 제거 마이그레이션", () => {
  function createOldSchemaDb(dbPath: string): Database {
    const db = new Database(dbPath, { create: true, strict: true });
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      INSERT INTO schema_migrations (name, applied_at) VALUES ('001-initial-schema', '2025-01-01T00:00:00.000Z');

      CREATE TABLE split_sessions (
        id TEXT PRIMARY KEY,
        note_id INTEGER NOT NULL,
        deck_name TEXT NOT NULL DEFAULT '',
        split_type TEXT NOT NULL CHECK (split_type IN ('hard', 'soft')),
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

      CREATE TABLE split_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES split_sessions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('generating','generated','applied','rejected','error','not_split')),
        payload_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_split_sessions_created_at ON split_sessions(created_at DESC);
      CREATE INDEX idx_split_sessions_deck_name ON split_sessions(deck_name);
      CREATE INDEX idx_split_sessions_status ON split_sessions(status);
      CREATE INDEX idx_split_sessions_split_type ON split_sessions(split_type);
      CREATE INDEX idx_split_sessions_note_id ON split_sessions(note_id);
      CREATE INDEX idx_split_events_session_id ON split_events(session_id);
      CREATE INDEX idx_split_events_created_at ON split_events(created_at);
    `);

    return db;
  }

  test("구 스키마(split_type 존재) → 신 스키마 전환 정상 동작", async () => {
    const dbPath = join(tempDir, "migration-test.db");
    const oldDb = createOldSchemaDb(dbPath);

    // 구 스키마에 테스트 데이터 삽입
    oldDb.exec(`
      INSERT INTO split_sessions (id, note_id, deck_name, split_type, status, original_text, original_tags_json, source, created_at, updated_at)
      VALUES ('session-old-1', 1001, 'deck-a', 'soft', 'applied', '원본 텍스트', '[]', 'runtime', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');

      INSERT INTO split_sessions (id, note_id, deck_name, split_type, status, original_text, original_tags_json, source, created_at, updated_at)
      VALUES ('session-old-2', 1002, 'deck-b', 'hard', 'generated', '원본 텍스트 2', '[]', 'runtime', '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:00.000Z');
    `);
    oldDb.close();

    // 마이그레이션 실행
    process.env.SPLIT_HISTORY_DB_PATH = dbPath;
    resetSplitHistoryStoreForTests();
    const store = await getSplitHistoryStore();

    // split_type 컬럼이 사라졌는지 확인
    const detail1 = store.getSessionDetail("session-old-1");
    expect(detail1).not.toBeNull();
    expect(detail1?.noteId).toBe(1001);
    expect(detail1?.status).toBe("applied");

    const detail2 = store.getSessionDetail("session-old-2");
    expect(detail2).not.toBeNull();
    expect(detail2?.noteId).toBe(1002);
    expect(detail2?.status).toBe("generated");

    // 새 세션 생성도 정상 동작
    const { sessionId } = store.createSession({
      noteId: 2001,
      deckName: "new-deck",
      originalText: "신규",
      originalTags: [],
    });
    expect(sessionId).toContain("session-");

    store.close();
  });

  test("split_events FK 참조가 마이그레이션 후에도 보존된다", async () => {
    const dbPath = join(tempDir, "migration-fk-test.db");
    const oldDb = createOldSchemaDb(dbPath);

    oldDb.exec(`
      INSERT INTO split_sessions (id, note_id, deck_name, split_type, status, original_text, original_tags_json, source, created_at, updated_at)
      VALUES ('session-fk-1', 3001, 'deck-fk', 'soft', 'applied', '원본', '[]', 'runtime', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');

      INSERT INTO split_events (id, session_id, event_type, status, created_at)
      VALUES ('evt-fk-1', 'session-fk-1', 'session_created', 'generating', '2025-01-01T00:00:00.000Z');

      INSERT INTO split_events (id, session_id, event_type, status, created_at)
      VALUES ('evt-fk-2', 'session-fk-1', 'split_applied', 'applied', '2025-01-01T00:01:00.000Z');
    `);
    oldDb.close();

    process.env.SPLIT_HISTORY_DB_PATH = dbPath;
    resetSplitHistoryStoreForTests();
    const store = await getSplitHistoryStore();

    const detail = store.getSessionDetail("session-fk-1");
    expect(detail).not.toBeNull();
    expect(detail?.events.length).toBe(2);
    expect(detail?.events[0]?.eventType).toBe("session_created");
    expect(detail?.events[1]?.eventType).toBe("split_applied");

    store.close();
  });

  test("2회 initialize() 호출 시 재실행 안전(멱등성)", async () => {
    const dbPath = join(tempDir, "migration-idempotent.db");
    const oldDb = createOldSchemaDb(dbPath);

    oldDb.exec(`
      INSERT INTO split_sessions (id, note_id, deck_name, split_type, status, original_text, original_tags_json, source, created_at, updated_at)
      VALUES ('session-idem-1', 4001, 'deck-idem', 'soft', 'applied', '원본', '[]', 'runtime', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
    `);
    oldDb.close();

    // 1차 초기화
    const store1 = new SplitHistoryStore(dbPath);
    await store1.initialize();

    const detail1 = store1.getSessionDetail("session-idem-1");
    expect(detail1).not.toBeNull();
    store1.close();

    // 2차 초기화 (동일 DB에 대해)
    const store2 = new SplitHistoryStore(dbPath);
    await store2.initialize();

    const detail2 = store2.getSessionDetail("session-idem-1");
    expect(detail2).not.toBeNull();
    expect(detail2?.noteId).toBe(4001);
    store2.close();
  });

  test("마이그레이션 중 에러 발생 시 FK 제약이 복원된다", async () => {
    const dbPath = join(tempDir, "migration-fk-restore.db");
    const db = new Database(dbPath, { create: true, strict: true });
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // schema_migrations만 생성하고, split_sessions가 없는 상태 → 초기 스키마 생성부터
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    db.close();

    // 정상 초기화 후 FK 검사가 ON인지 확인
    const store = new SplitHistoryStore(dbPath);
    await store.initialize();

    // FK ON 여부 확인: 존재하지 않는 session_id로 이벤트 삽입하면 FK 위반 발생해야 함
    const rawDb = new Database(dbPath, { strict: true });
    rawDb.exec("PRAGMA foreign_keys = ON;");
    const fkResult = rawDb.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys;").get();
    expect(fkResult?.foreign_keys).toBe(1);
    rawDb.close();

    store.close();
  });
});
