/**
 * Anki Card Splitter - API Server
 */
import "dotenv/config";
import { timingSafeEqual } from "node:crypto";

import {
  AppError,
  getAvailableProviders,
  getDefaultModelId,
  getModelPricing,
  migrateLegacySystemPromptToRemoteIfNeeded,
} from "@anki-splitter/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { getSplitHistoryStore } from "./history/store.js";
import backup from "./routes/backup.js";
import cards from "./routes/cards.js";
import decks from "./routes/decks.js";
import embedding from "./routes/embedding.js";
import history from "./routes/history.js";
import llm from "./routes/llm.js";
import media from "./routes/media.js";
import prompts from "./routes/prompts.js";
import split from "./routes/split.js";
import validate from "./routes/validate.js";

const app = new Hono();
const API_KEY = process.env.ANKI_SPLITTER_API_KEY;

function timingSafeKeyEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  const maxLength = Math.max(leftBytes.length, rightBytes.length, 1);
  const leftBuffer = Buffer.alloc(maxLength);
  const rightBuffer = Buffer.alloc(maxLength);

  leftBytes.copy(leftBuffer);
  rightBytes.copy(rightBuffer);

  return timingSafeEqual(leftBuffer, rightBuffer) && leftBytes.length === rightBytes.length;
}

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  }),
);

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health") {
    await next();
    return;
  }

  if (!API_KEY) {
    return c.json(
      {
        error:
          "Server API key is not configured. Set ANKI_SPLITTER_API_KEY before starting the server.",
      },
      503,
    );
  }

  const headerApiKey = c.req.header("x-api-key")?.trim();
  const authHeader = c.req.header("authorization");
  const bearerMatch = authHeader?.match(/^bearer\s+(\S+)\s*$/i);
  const bearerToken = bearerMatch?.[1] ?? null;
  const providedKey = headerApiKey || bearerToken;

  if (!providedKey || !timingSafeKeyEqual(providedKey, API_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.route("/api/decks", decks);
app.route("/api/cards", cards);
app.route("/api/split", split);
app.route("/api/backup", backup);
app.route("/api/media", media);
app.route("/api/validate", validate);
app.route("/api/llm", llm);
app.route("/api/embedding", embedding);
app.route("/api/prompts", prompts);
app.route("/api/history", history);

// Error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    console.error(`[${err.statusCode}] ${err.name}:`, err.message);
    return c.json({ error: err.message }, err.statusCode as 400 | 404 | 500 | 502 | 504);
  }
  console.error("Unhandled server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Start server — Bun.serve()를 직접 호출하여 HMR 이중 바인딩 방지
const port = parseInt(process.env.PORT || "3000", 10);

function validateLLMProviders(): void {
  const available = getAvailableProviders();
  console.log(
    `🤖 LLM providers available: ${available.length > 0 ? available.join(", ") : "(none)"}`,
  );

  if (available.length === 0) {
    console.error(
      "❌ 최소 1개의 LLM provider API 키가 필요합니다. GEMINI_API_KEY 또는 OPENAI_API_KEY를 설정하세요.",
    );
    process.exit(1);
  }

  const defaultModel = getDefaultModelId();
  if (!available.includes(defaultModel.provider)) {
    console.warn(
      `⚠️ 기본 provider '${defaultModel.provider}'의 API 키가 설정되지 않았습니다. 가용 provider '${available[0]}'로 대체합니다.`,
    );
    console.warn(
      "   기본 provider를 변경하려면 ANKI_SPLITTER_DEFAULT_LLM_PROVIDER 환경변수를 설정하세요.",
    );
  } else {
    const pricing = getModelPricing(defaultModel.provider, defaultModel.model);
    if (!pricing) {
      console.warn(
        `⚠️ 기본 모델 '${defaultModel.provider}/${defaultModel.model}'이 pricing table에 등록되지 않았습니다. 비용 추정이 불가능할 수 있습니다.`,
      );
    }
  }
}

async function runStartupTasks(): Promise<void> {
  validateLLMProviders();

  const [historyResult, migrationResult] = await Promise.allSettled([
    getSplitHistoryStore(),
    migrateLegacySystemPromptToRemoteIfNeeded(),
  ]);

  if (historyResult.status === "fulfilled") {
    console.log("📚 Split history store initialized");
  } else {
    console.error("⚠️ Split history store initialization failed:", historyResult.reason);
  }

  if (migrationResult.status === "fulfilled") {
    const result = migrationResult.value;
    if (result.migrated) {
      console.log("🧠 Prompt system SoT migrated to remote config");
      return;
    }

    if (result.reason === "already-exists") {
      console.log("🧠 Prompt system SoT already initialized on remote config");
      return;
    }

    if (result.reason === "remote-config-action-unsupported") {
      console.warn(
        "⚠️ Prompt system SoT migration skipped: AnkiConnect getConfig/setConfig 커스텀 액션을 사용할 수 없습니다.",
      );
      return;
    }

    console.warn(`⚠️ Prompt system SoT migration skipped: ${result.reason}`);
    return;
  }

  console.error("⚠️ Prompt system SoT migration failed:", migrationResult.reason);
}

await runStartupTasks();

if (!API_KEY) {
  console.warn(
    "⚠️  ANKI_SPLITTER_API_KEY가 설정되지 않았습니다. /api/health를 제외한 모든 API 요청은 503으로 거부됩니다.",
  );
}

declare global {
  var __ankiServer: ReturnType<typeof Bun.serve> | undefined;
}

if (globalThis.__ankiServer) {
  globalThis.__ankiServer.reload({ fetch: app.fetch });
  console.log(`🔄 Anki Splitter API Server reloaded on http://localhost:${port}`);
} else {
  globalThis.__ankiServer = Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`🚀 Anki Splitter API Server started on http://localhost:${port}`);
}
