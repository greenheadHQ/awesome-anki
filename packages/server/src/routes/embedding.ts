/**
 * Embedding API - OpenAI 임베딩 생성 및 관리
 */

import { randomUUID } from "node:crypto";

import {
  AppError,
  cleanupCache,
  createCache,
  deleteCache,
  EMBEDDING_EXPECTED_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  extractTextField,
  getCachedEmbedding,
  getCacheIncompatibilityReason,
  getCacheStatus,
  getDeckNotes,
  getEmbedding,
  getTextHash,
  loadCache,
  NotFoundError,
  preprocessTextForEmbedding,
  saveCache,
  setCachedEmbedding,
  ValidationError,
} from "@anki-splitter/core";
import { Hono, type Context } from "hono";

const EMBEDDING_ROUTE_SCHEMA_VERSION = 1;
const RATE_LIMIT_DELAY_MS = 400;

type EmbeddingErrorCode =
  | "VALIDATION_ERROR"
  | "DECK_NOT_FOUND"
  | "EMBEDDING_PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "CACHE_IO_ERROR"
  | "INTERNAL_ERROR";

type CacheMigrationReason =
  | "none"
  | "cache_missing"
  | "force_regenerate"
  | "schema_version_mismatch"
  | "provider_mismatch"
  | "model_mismatch";

interface EmbeddingErrorPayload {
  code: EmbeddingErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

interface MappedError {
  status: number;
  payload: EmbeddingErrorPayload;
}

function getRequestId(c: Context): string {
  const requestIdHeader = c.req.header("x-request-id")?.trim();
  return requestIdHeader && requestIdHeader.length > 0 ? requestIdHeader : randomUUID();
}

function success<T>(c: Context, requestId: string, data: T, status: 200 | 201 = 200) {
  return c.json(
    {
      ok: true,
      requestId,
      timestamp: new Date().toISOString(),
      schemaVersion: EMBEDDING_ROUTE_SCHEMA_VERSION,
      data,
    },
    status,
  );
}

function failure(c: Context, requestId: string, mapped: MappedError) {
  return c.json(
    {
      ok: false,
      requestId,
      timestamp: new Date().toISOString(),
      schemaVersion: EMBEDDING_ROUTE_SCHEMA_VERSION,
      error: mapped.payload,
    },
    mapped.status as 400 | 404 | 429 | 500 | 502 | 503 | 504,
  );
}

function mapError(error: unknown): MappedError {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      payload: {
        code: "VALIDATION_ERROR",
        message: error.message,
        retryable: false,
      },
    };
  }

  if (error instanceof NotFoundError) {
    return {
      status: 404,
      payload: {
        code: "DECK_NOT_FOUND",
        message: error.message,
        retryable: false,
      },
    };
  }

  if (error instanceof AppError) {
    if (error.statusCode === 502 || error.statusCode === 504) {
      return {
        status: error.statusCode,
        payload: {
          code: "EMBEDDING_PROVIDER_ERROR",
          message: error.message,
          retryable: true,
        },
      };
    }

    return {
      status: error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500,
      payload: {
        code: error.statusCode >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR",
        message: error.message,
        retryable: error.statusCode >= 500,
      },
    };
  }

  const message = error instanceof Error ? error.message : String(error ?? "알 수 없는 오류");
  const status =
    error && typeof error === "object" && typeof (error as { status?: unknown }).status === "number"
      ? ((error as { status: number }).status ?? 500)
      : 500;

  if (/rate limit|429/i.test(message) || status === 429) {
    return {
      status: 429,
      payload: {
        code: "RATE_LIMITED",
        message,
        retryable: true,
      },
    };
  }

  if (/OPENAI_API_KEY|openai|embedding/i.test(message)) {
    return {
      status: status >= 400 && status < 600 ? status : 502,
      payload: {
        code: "EMBEDDING_PROVIDER_ERROR",
        message,
        retryable: status >= 500,
      },
    };
  }

  if (/cache|EACCES|EPERM|ENOENT|ENOSPC|read|write|unlink/i.test(message)) {
    return {
      status: 500,
      payload: {
        code: "CACHE_IO_ERROR",
        message,
        retryable: false,
      },
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    payload: {
      code: "INTERNAL_ERROR",
      message,
      retryable: status >= 500,
    },
  };
}

const embedding = new Hono();

/**
 * POST /api/embedding/generate
 * 덱 전체 임베딩 생성 (증분 업데이트)
 */
embedding.post("/generate", async (c) => {
  const requestId = getRequestId(c);
  const startedAt = Date.now();

  try {
    const { deckName: rawDeckName, forceRegenerate } = await c.req.json<{
      deckName: string;
      forceRegenerate?: boolean;
    }>();
    const deckName = rawDeckName?.trim();
    if (!deckName) {
      throw new ValidationError("deckName이 필요합니다");
    }

    // 덱의 모든 노트 가져오기
    const notes = await getDeckNotes(deckName);
    if (notes.length === 0) {
      throw new NotFoundError("덱에 노트가 없습니다");
    }

    // 캐시 로드 또는 생성
    const existingCache = loadCache(deckName);
    const beforeCount = existingCache ? Object.keys(existingCache.embeddings).length : 0;

    let migrationReason: CacheMigrationReason = "none";
    let cache = existingCache;
    const cacheIncompatibility = existingCache
      ? getCacheIncompatibilityReason(existingCache)
      : null;

    if (!existingCache) {
      migrationReason = "cache_missing";
      cache = createCache(deckName);
    } else if (forceRegenerate) {
      migrationReason = "force_regenerate";
      cache = createCache(deckName);
    } else if (cacheIncompatibility) {
      migrationReason = cacheIncompatibility;
      cache = createCache(deckName);
    }

    if (!cache) {
      cache = createCache(deckName);
    }

    // 임베딩이 필요한 노트 필터링
    const notesToEmbed: { noteId: number; text: string; textHash: string }[] = [];
    const validNoteIds = new Set<number>();

    for (const note of notes) {
      validNoteIds.add(note.noteId);
      const text = extractTextField(note);
      const textHash = getTextHash(text);

      const cached = getCachedEmbedding(cache, note.noteId, textHash);
      if (!cached) {
        notesToEmbed.push({ noteId: note.noteId, text, textHash });
      }
    }

    // 삭제된 노트 정리
    const removedCount = cleanupCache(cache, validNoteIds);

    // 새 임베딩 생성
    let generatedCount = 0;
    const failures: Array<{ noteId: number; code: EmbeddingErrorCode; message: string }> = [];

    for (const { noteId, text, textHash } of notesToEmbed) {
      try {
        const emb = await getEmbedding(text);
        setCachedEmbedding(cache, noteId, emb, textHash);
        generatedCount++;
      } catch (error) {
        const mapped = mapError(error);
        failures.push({
          noteId,
          code: mapped.payload.code,
          message: mapped.payload.message,
        });
        console.error(`임베딩 생성 실패 (noteId: ${noteId}):`, error);
      }

      // Rate limit 대응
      if ((generatedCount + failures.length) % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    // 캐시 저장
    saveCache(cache);

    return success(c, requestId, {
      status: failures.length > 0 ? "completed_with_errors" : "completed",
      deckName,
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      jaccardFallbackEnabled: true,
      forceRegenerate: forceRegenerate === true,
      durationMs: Date.now() - startedAt,
      dimension: {
        detected: cache.dimension,
        expected: EMBEDDING_EXPECTED_DIMENSION,
      },
      notes: {
        total: notes.length,
        processed: notesToEmbed.length,
        generated: generatedCount,
        skipped: notes.length - notesToEmbed.length,
        failed: failures.length,
      },
      cache: {
        beforeCount,
        afterCount: Object.keys(cache.embeddings).length,
        removed: removedCount,
        migration: {
          applied: migrationReason !== "none",
          reason: migrationReason,
          from:
            existingCache && migrationReason !== "none"
              ? {
                  provider: existingCache.provider,
                  model: existingCache.model,
                  dimension: existingCache.dimension,
                  count: beforeCount,
                }
              : null,
        },
      },
      failures,
      lastUpdated: new Date(cache.lastUpdated).toISOString(),
    });
  } catch (error) {
    return failure(c, requestId, mapError(error));
  }
});

/**
 * GET /api/embedding/status/:deckName
 * 임베딩 캐시 상태 확인
 */
embedding.get("/status/:deckName", async (c) => {
  const requestId = getRequestId(c);
  try {
    const deckName = decodeURIComponent(c.req.param("deckName"));
    if (!deckName) {
      throw new ValidationError("deckName이 필요합니다");
    }

    const cacheStatus = getCacheStatus(deckName);
    const loadedCache = loadCache(deckName);
    const incompatibility = loadedCache ? getCacheIncompatibilityReason(loadedCache) : null;

    // 덱의 총 노트 수도 함께 반환
    let totalNotes = 0;
    try {
      const notes = await getDeckNotes(deckName);
      totalNotes = notes.length;
    } catch {
      // 덱을 찾을 수 없는 경우
    }

    return success(c, requestId, {
      deckName,
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      jaccardFallbackEnabled: true,
      notes: {
        total: totalNotes,
      },
      coverage: totalNotes > 0 ? Math.round((cacheStatus.totalEmbeddings / totalNotes) * 100) : 0,
      dimension: {
        detected: cacheStatus.dimension,
        expected: EMBEDDING_EXPECTED_DIMENSION,
      },
      cache: {
        exists: cacheStatus.exists,
        count: cacheStatus.totalEmbeddings,
        lastUpdated: cacheStatus.lastUpdated,
        path: cacheStatus.cacheFilePath,
        schemaVersion: cacheStatus.schemaVersion,
        provider: cacheStatus.provider,
        model: cacheStatus.model,
        health: !cacheStatus.exists
          ? "missing"
          : incompatibility
            ? incompatibility
            : cacheStatus.dimension > 0 && cacheStatus.dimension !== EMBEDDING_EXPECTED_DIMENSION
              ? "dimension_unexpected"
              : "ok",
      },
    });
  } catch (error) {
    return failure(c, requestId, mapError(error));
  }
});

/**
 * DELETE /api/embedding/cache/:deckName
 * 임베딩 캐시 삭제
 */
embedding.delete("/cache/:deckName", async (c) => {
  const requestId = getRequestId(c);
  try {
    const deckName = decodeURIComponent(c.req.param("deckName"));
    if (!deckName) {
      throw new ValidationError("deckName이 필요합니다");
    }

    const existingCache = loadCache(deckName);
    const deleted = deleteCache(deckName);
    const deletedCount =
      deleted && existingCache ? Object.keys(existingCache.embeddings).length : 0;

    return success(c, requestId, {
      deckName,
      deleted,
      deletedCount,
      message: deleted ? "캐시가 삭제되었습니다." : "캐시가 존재하지 않습니다.",
    });
  } catch (error) {
    return failure(c, requestId, mapError(error));
  }
});

/**
 * POST /api/embedding/single
 * 단일 텍스트 임베딩 생성 (디버깅/테스트용)
 */
embedding.post("/single", async (c) => {
  const requestId = getRequestId(c);
  try {
    const { text, preprocess, includeFullEmbedding } = await c.req.json<{
      text: string;
      preprocess?: boolean;
      includeFullEmbedding?: boolean;
    }>();

    if (!text) {
      throw new ValidationError("text가 필요합니다");
    }

    const preprocessApplied = preprocess !== false;
    const processedText = preprocessApplied ? preprocessTextForEmbedding(text) : text;
    const emb = await getEmbedding(processedText);

    return success(c, requestId, {
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      preprocessApplied,
      input: {
        originalLength: text.length,
        processedLength: processedText.length,
      },
      dimension: {
        detected: emb.length,
        expected: EMBEDDING_EXPECTED_DIMENSION,
      },
      embeddingPreview: emb.slice(0, 10),
      ...(includeFullEmbedding ? { embedding: emb } : {}),
      embeddingHash: getTextHash(emb.join(",")),
    });
  } catch (error) {
    return failure(c, requestId, mapError(error));
  }
});

export default embedding;
