import { getPrivacyStatus } from "@anki-splitter/core";
import { Hono } from "hono";

const privacy = new Hono();

/**
 * GET /api/privacy/status
 * 현재 프라이버시 모드 및 기능별 정책 조회
 */
privacy.get("/status", (c) => {
  return c.json(getPrivacyStatus());
});

export default privacy;
