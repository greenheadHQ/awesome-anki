import { beforeEach, describe, expect, test } from "bun:test";

import {
  cleanupCache,
  createCache,
  type EmbeddingCache,
  getCachedEmbedding,
  getTextHash,
  setCachedEmbedding,
} from "../embedding/cache.js";

describe("EmbeddingCache", () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    cache = createCache("test-deck", 768);
  });

  test("새 캐시 생성", () => {
    expect(cache.deckName).toBe("test-deck");
    expect(cache.dimension).toBe(768);
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
