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
      splitType: "soft",
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
    expect(eventTypes).toEqual([
      "session_created",
      "preview_generated",
      "split_applied",
    ]);
  });

  test("목록 필터(status)가 동작한다", async () => {
    const store = await getSplitHistoryStore();

    const first = store.createSession({
      noteId: 2001,
      deckName: "deck-a",
      splitType: "soft",
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
      splitType: "hard",
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
      splitType: "hard",
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

    expect(filtered.items.some((item) => item.sessionId === sessionId)).toBe(
      true,
    );
  });

  test("rejected 상태 전이와 필터가 동작한다", async () => {
    const store = await getSplitHistoryStore();
    const { sessionId } = store.createSession({
      noteId: 2102,
      deckName: "deck-rejected",
      splitType: "soft",
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

    expect(filtered.items.some((item) => item.sessionId === sessionId)).toBe(
      true,
    );
  });

  test("초기화가 일시적으로 실패해도 다음 호출에서 재시도할 수 있다", async () => {
    const originalInitialize = SplitHistoryStore.prototype.initialize;
    let initializeCalls = 0;
    let recoveredStore: SplitHistoryStore | null = null;

    SplitHistoryStore.prototype.initialize =
      async function patchedInitialize() {
        initializeCalls += 1;
        if (initializeCalls === 1) {
          throw new Error("transient initialize failure");
        }
        return originalInitialize.call(this);
      };

    try {
      await expect(getSplitHistoryStore()).rejects.toThrow(
        "transient initialize failure",
      );

      recoveredStore = await getSplitHistoryStore();
      const { sessionId } = recoveredStore.createSession({
        noteId: 3001,
        deckName: "deck-retry",
        splitType: "soft",
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
