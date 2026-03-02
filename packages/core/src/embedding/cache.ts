/**
 * 파일 기반 임베딩 캐시
 *
 * 저장 위치: output/embeddings/{deckNameHash}.json
 * 구조:
 * {
 *   schemaVersion,
 *   provider,
 *   model,
 *   dimension,
 *   embeddings: { [noteId]: { embedding, textHash, timestamp } }
 * }
 *
 * 증분 업데이트: 텍스트 변경된 카드만 재생성
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { atomicWriteFileSync } from "../utils/atomic-write.js";
import { EMBEDDING_MODEL, EMBEDDING_PROVIDER } from "./client.js";

const CACHE_DIR = "output/embeddings";
export const EMBEDDING_CACHE_SCHEMA_VERSION = 1;
export const LEGACY_EMBEDDING_PROVIDER = "gemini";
export const LEGACY_EMBEDDING_MODEL = "gemini-embedding-001";

export interface CachedEmbedding {
  /** 임베딩 벡터 */
  embedding: number[];
  /** 텍스트 MD5 해시 (변경 감지용) */
  textHash: string;
  /** 생성 타임스탬프 */
  timestamp: number;
}

export interface EmbeddingCache {
  /** 캐시 스키마 버전 */
  schemaVersion: number;
  /** 덱 이름 */
  deckName: string;
  /** 임베딩 제공자 */
  provider: string;
  /** 임베딩 모델 */
  model: string;
  /** 임베딩 차원 */
  dimension: number;
  /** 마지막 업데이트 */
  lastUpdated: number;
  /** 노트별 임베딩 */
  embeddings: Record<string, CachedEmbedding>;
}

function parseCache(deckName: string, raw: string): EmbeddingCache | null {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const embeddingsRaw = parsed.embeddings;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.deckName !== "string" ||
    typeof parsed.dimension !== "number" ||
    typeof parsed.lastUpdated !== "number" ||
    typeof embeddingsRaw !== "object" ||
    embeddingsRaw === null ||
    Array.isArray(embeddingsRaw)
  ) {
    return null;
  }

  const cache: EmbeddingCache = {
    schemaVersion:
      typeof parsed.schemaVersion === "number"
        ? parsed.schemaVersion
        : EMBEDDING_CACHE_SCHEMA_VERSION,
    deckName: parsed.deckName,
    provider: typeof parsed.provider === "string" ? parsed.provider : LEGACY_EMBEDDING_PROVIDER,
    model: typeof parsed.model === "string" ? parsed.model : LEGACY_EMBEDDING_MODEL,
    dimension: parsed.dimension,
    lastUpdated: parsed.lastUpdated,
    embeddings: {},
  };

  for (const [noteId, entry] of Object.entries(embeddingsRaw)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const typedEntry = entry as Record<string, unknown>;
    const embeddingRaw = typedEntry.embedding;
    if (!Array.isArray(embeddingRaw)) {
      continue;
    }

    const embedding = embeddingRaw.filter((value): value is number => typeof value === "number");
    const textHash = typedEntry.textHash;
    const timestamp = typedEntry.timestamp;

    if (!textHash || typeof textHash !== "string" || embedding.length === 0) {
      continue;
    }

    cache.embeddings[noteId] = {
      embedding,
      textHash,
      timestamp: typeof timestamp === "number" ? timestamp : cache.lastUpdated,
    };
  }

  if (cache.deckName !== deckName) {
    cache.deckName = deckName;
  }

  if (cache.dimension <= 0) {
    const firstEmbedding = Object.values(cache.embeddings)[0]?.embedding;
    cache.dimension = firstEmbedding?.length ?? 0;
  }

  return cache;
}

/**
 * 덱 이름을 안전한 파일명으로 변환
 */
function getDeckHash(deckName: string): string {
  return createHash("md5").update(deckName).digest("hex").slice(0, 12);
}

/**
 * 텍스트의 MD5 해시 생성
 */
export function getTextHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

/**
 * 캐시 파일 경로 생성
 */
function getCachePath(deckName: string): string {
  const hash = getDeckHash(deckName);
  return join(CACHE_DIR, `${hash}.json`);
}

/**
 * 캐시 디렉토리 생성
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 캐시 로드
 */
export function loadCache(deckName: string): EmbeddingCache | null {
  const path = getCachePath(deckName);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const data = readFileSync(path, "utf-8");
    return parseCache(deckName, data);
  } catch (error) {
    console.error(`캐시 로드 실패 (${deckName}):`, error);
    return null;
  }
}

export type CacheIncompatibilityReason =
  | "schema_version_mismatch"
  | "provider_mismatch"
  | "model_mismatch"
  | null;

export function getCacheIncompatibilityReason(
  cache: EmbeddingCache,
  expected: { provider?: string; model?: string } = {},
): CacheIncompatibilityReason {
  const provider = expected.provider ?? EMBEDDING_PROVIDER;
  const model = expected.model ?? EMBEDDING_MODEL;

  if (cache.schemaVersion !== EMBEDDING_CACHE_SCHEMA_VERSION) {
    return "schema_version_mismatch";
  }

  if (cache.provider !== provider) {
    return "provider_mismatch";
  }

  if (cache.model !== model) {
    return "model_mismatch";
  }

  return null;
}

export function isCacheCompatible(
  cache: EmbeddingCache,
  expected: { provider?: string; model?: string } = {},
): boolean {
  return getCacheIncompatibilityReason(cache, expected) === null;
}

/**
 * 캐시 저장
 */
export function saveCache(cache: EmbeddingCache): void {
  ensureCacheDir();
  const path = getCachePath(cache.deckName);

  try {
    const data = JSON.stringify(cache, null, 2);
    atomicWriteFileSync(path, data);
  } catch (error) {
    console.error(`캐시 저장 실패 (${cache.deckName}):`, error);
    throw error;
  }
}

/**
 * 새 캐시 생성
 */
export interface CreateCacheOptions {
  provider?: string;
  model?: string;
  dimension?: number;
}

export function createCache(deckName: string, options: CreateCacheOptions = {}): EmbeddingCache {
  return {
    schemaVersion: EMBEDDING_CACHE_SCHEMA_VERSION,
    deckName,
    provider: options.provider ?? EMBEDDING_PROVIDER,
    model: options.model ?? EMBEDDING_MODEL,
    dimension: options.dimension ?? 0,
    lastUpdated: Date.now(),
    embeddings: {},
  };
}

/**
 * 캐시에서 임베딩 조회
 * @returns 임베딩 또는 null (캐시 미스 또는 텍스트 변경)
 */
export function getCachedEmbedding(
  cache: EmbeddingCache,
  noteId: number,
  currentTextHash: string,
): number[] | null {
  const cached = cache.embeddings[String(noteId)];

  if (!cached) {
    return null;
  }

  // 텍스트 변경 확인
  if (cached.textHash !== currentTextHash) {
    return null;
  }

  return cached.embedding;
}

/**
 * 캐시에 임베딩 저장
 */
export function setCachedEmbedding(
  cache: EmbeddingCache,
  noteId: number,
  embedding: number[],
  textHash: string,
): void {
  cache.embeddings[String(noteId)] = {
    embedding,
    textHash,
    timestamp: Date.now(),
  };
  cache.dimension = embedding.length;
  cache.lastUpdated = Date.now();
}

/**
 * 캐시에서 삭제된 노트 제거 (정리)
 */
export function cleanupCache(cache: EmbeddingCache, validNoteIds: Set<number>): number {
  const keysToDelete: string[] = [];

  for (const key of Object.keys(cache.embeddings)) {
    const noteId = parseInt(key, 10);
    if (!validNoteIds.has(noteId)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    delete cache.embeddings[key];
  }

  return keysToDelete.length;
}

/**
 * 캐시 상태 정보
 */
export interface CacheStatus {
  exists: boolean;
  deckName: string;
  schemaVersion: number | null;
  provider: string | null;
  model: string | null;
  dimension: number;
  totalEmbeddings: number;
  lastUpdated: string | null;
  cacheFilePath: string;
  health: "missing" | "compatible" | "legacy";
}

/**
 * 캐시 상태 조회
 */
export function getCacheStatus(deckName: string): CacheStatus {
  const cache = loadCache(deckName);
  const path = getCachePath(deckName);

  if (!cache) {
    return {
      exists: false,
      deckName,
      schemaVersion: null,
      provider: null,
      model: null,
      dimension: 0,
      totalEmbeddings: 0,
      lastUpdated: null,
      cacheFilePath: path,
      health: "missing",
    };
  }

  const incompatibility = getCacheIncompatibilityReason(cache);

  return {
    exists: true,
    deckName: cache.deckName,
    schemaVersion: cache.schemaVersion,
    provider: cache.provider,
    model: cache.model,
    dimension: cache.dimension,
    totalEmbeddings: Object.keys(cache.embeddings).length,
    lastUpdated: new Date(cache.lastUpdated).toISOString(),
    cacheFilePath: path,
    health: incompatibility ? "legacy" : "compatible",
  };
}

/**
 * 캐시 삭제
 */
export function deleteCache(deckName: string): boolean {
  const path = getCachePath(deckName);

  if (!existsSync(path)) {
    return false;
  }

  try {
    unlinkSync(path);
    return true;
  } catch (error) {
    console.error(`캐시 삭제 실패 (${deckName}):`, error);
    return false;
  }
}
