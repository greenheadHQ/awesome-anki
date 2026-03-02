import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMBEDDING_CACHE_SCHEMA_VERSION,
  cleanupCache,
  createCache,
  type EmbeddingCache,
  getCacheIncompatibilityReason,
  getCachedEmbedding,
  getTextHash,
  isCacheCompatible,
  loadCache,
  setCachedEmbedding,
} from "../embedding/cache.js";
import { EMBEDDING_MODEL, EMBEDDING_PROVIDER } from "../embedding/client.js";

describe("EmbeddingCache", () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    cache = createCache("test-deck", { dimension: 3072 });
  });

  test("새 캐시 생성", () => {
    expect(cache.deckName).toBe("test-deck");
    expect(cache.schemaVersion).toBe(EMBEDDING_CACHE_SCHEMA_VERSION);
    expect(cache.provider).toBe(EMBEDDING_PROVIDER);
    expect(cache.model).toBe(EMBEDDING_MODEL);
    expect(cache.dimension).toBe(3072);
    expect(Object.keys(cache.embeddings)).toHaveLength(0);
  });

  test("임베딩 저장 및 조회", () => {
    const embedding = [0.1, 0.2, 0.3];
    const textHash = getTextHash("테스트 텍스트");

    setCachedEmbedding(cache, 12345, embedding, textHash);

    const retrieved = getCachedEmbedding(cache, 12345, textHash);
    expect(retrieved).toEqual(embedding);
  });

  test("다른 텍스트 해시로 조회 시 null", () => {
    const embedding = [0.1, 0.2, 0.3];
    const textHash = getTextHash("테스트 텍스트");

    setCachedEmbedding(cache, 12345, embedding, textHash);

    const differentHash = getTextHash("다른 텍스트");
    const retrieved = getCachedEmbedding(cache, 12345, differentHash);
    expect(retrieved).toBeNull();
  });

  test("없는 노트 조회 시 null", () => {
    const retrieved = getCachedEmbedding(cache, 99999, "hash");
    expect(retrieved).toBeNull();
  });

  test("cleanupCache - 삭제된 노트 제거", () => {
    setCachedEmbedding(cache, 1, [0.1], getTextHash("1"));
    setCachedEmbedding(cache, 2, [0.2], getTextHash("2"));
    setCachedEmbedding(cache, 3, [0.3], getTextHash("3"));

    // 노트 1, 3만 유효
    const validNoteIds = new Set([1, 3]);
    const removed = cleanupCache(cache, validNoteIds);

    expect(removed).toBe(1);
    expect(getCachedEmbedding(cache, 1, getTextHash("1"))).toEqual([0.1]);
    expect(getCachedEmbedding(cache, 2, getTextHash("2"))).toBeNull();
    expect(getCachedEmbedding(cache, 3, getTextHash("3"))).toEqual([0.3]);
  });

  test("호환 캐시는 incompatibility가 null", () => {
    expect(getCacheIncompatibilityReason(cache)).toBeNull();
    expect(isCacheCompatible(cache)).toBe(true);
  });

  test("provider/model 불일치 감지", () => {
    const providerMismatch = {
      ...cache,
      provider: "gemini",
    };
    expect(getCacheIncompatibilityReason(providerMismatch)).toBe("provider_mismatch");

    const modelMismatch = {
      ...cache,
      model: "text-embedding-3-small",
    };
    expect(getCacheIncompatibilityReason(modelMismatch)).toBe("model_mismatch");
  });

  test("schema 버전 불일치 감지", () => {
    const legacyCache = {
      ...cache,
      schemaVersion: EMBEDDING_CACHE_SCHEMA_VERSION - 1,
    };
    expect(getCacheIncompatibilityReason(legacyCache)).toBe("schema_version_mismatch");
  });

  test("레거시 캐시(schemaVersion 없음)는 schema_version_mismatch로 감지", () => {
    const legacyCache = {
      ...cache,
      schemaVersion: 0,
    };
    expect(getCacheIncompatibilityReason(legacyCache)).toBe("schema_version_mismatch");
    expect(isCacheCompatible(legacyCache)).toBe(false);
  });
});

describe("getTextHash", () => {
  test("동일한 텍스트는 동일한 해시", () => {
    const text = "테스트 텍스트";
    expect(getTextHash(text)).toBe(getTextHash(text));
  });

  test("다른 텍스트는 다른 해시", () => {
    expect(getTextHash("텍스트 1")).not.toBe(getTextHash("텍스트 2"));
  });

  test("해시는 32자 (MD5)", () => {
    expect(getTextHash("아무 텍스트")).toHaveLength(32);
  });
});

describe("parseCache via loadCache (fixture)", () => {
  const CACHE_DIR = "output/embeddings";
  const fixtureDeckName = "__parseCache_fixture_test__";
  const deckHash = createHash("md5").update(fixtureDeckName).digest("hex").slice(0, 12);
  const cachePath = join(CACHE_DIR, `${deckHash}.json`);

  afterEach(() => {
    if (existsSync(cachePath)) {
      unlinkSync(cachePath);
    }
  });

  test("schemaVersion 누락 raw JSON → schemaVersion=0 폴백 → schema_version_mismatch", () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({
        deckName: fixtureDeckName,
        dimension: 3072,
        lastUpdated: Date.now(),
        embeddings: {
          "100": {
            embedding: [0.1, 0.2, 0.3],
            textHash: "abc123",
            timestamp: Date.now(),
          },
        },
      }),
    );

    const loaded = loadCache(fixtureDeckName);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(0);
    expect(loaded!.provider).toBe("gemini"); // LEGACY_EMBEDDING_PROVIDER fallback
    expect(loaded!.model).toBe("gemini-embedding-001"); // LEGACY_EMBEDDING_MODEL fallback
    expect(getCacheIncompatibilityReason(loaded!)).toBe("schema_version_mismatch");
  });
});
