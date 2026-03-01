import { ValidationError } from "@anki-splitter/core";
import { Hono } from "hono";

import { getSplitHistoryStore } from "../history/store.js";
import { getHistorySyncHealth } from "../history/sync.js";
import { HISTORY_STATUSES, type HistoryStatus } from "../history/types.js";

const history = new Hono();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`유효하지 않은 날짜 형식입니다: ${raw}`);
  }
  return parsed;
}

function parseStatus(raw: string | undefined): HistoryStatus | undefined {
  if (!raw) return undefined;
  if (HISTORY_STATUSES.includes(raw as HistoryStatus)) {
    return raw as HistoryStatus;
  }
  throw new ValidationError(`유효하지 않은 status 값입니다: ${raw}`);
}

/**
 * GET /api/history
 * 분할 이력 목록 조회
 */
history.get("/", async (c) => {
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = Math.min(parsePositiveInt(c.req.query("limit"), 50), 200);

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const startDate = parseDate(c.req.query("startDate"), ninetyDaysAgo);
  const endDate = parseDate(c.req.query("endDate"), now);

  const deckName = c.req.query("deckName") || undefined;
  const status = parseStatus(c.req.query("status"));

  if (startDate > endDate) {
    throw new ValidationError("startDate는 endDate보다 이후일 수 없습니다.");
  }

  const store = await getSplitHistoryStore();
  const result = store.getHistoryList({
    page,
    limit,
    deckName,
    status,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  return c.json({
    ...result,
    filters: {
      deckName: deckName ?? null,
      status: status ?? null,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  });
});

/**
 * GET /api/history/sync/health
 * 히스토리 동기화 상태 조회
 */
history.get("/sync/health", async (c) => {
  const health = await getHistorySyncHealth();
  return c.json(health);
});

/**
 * GET /api/history/:sessionId
 * 분할 이력 상세 조회
 */
history.get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const store = await getSplitHistoryStore();
  const detail = store.getSessionDetail(sessionId);

  if (!detail) {
    return c.json({ error: `히스토리 세션 ${sessionId}를 찾을 수 없습니다.` }, 404);
  }

  return c.json(detail);
});

export default history;
