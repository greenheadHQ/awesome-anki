/**
 * 파일 기반 임베딩 캐시
 *
 * 저장 위치: output/embeddings/{deckNameHash}.json
 * 구조: { [noteId]: { embedding, textHash, timestamp } }
 *
 * 증분 업데이트: 텍스트 변경된 카드만 재생성
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { atomicWriteFileSync } from "../utils/atomic-write.js";

const CACHE_DIR = "output/embeddings";

export interface CachedEmbedding {
  /** 임베딩 벡터 */
  embedding: number[];
  /** 텍스트 MD5 해시 (변경 감지용) */
  textHash: string;
  /** 생성 타임스탬프 */
  timestamp: number;
}

export interface EmbeddingCache {
  /** 덱 이름 */
  deckName: string;
  /** 임베딩 차원 */
  dimension: number;
  /** 마지막 업데이트 */
  lastUpdated: number;
  /** 노트별 임베딩 */
  embeddings: Record<string, CachedEmbedding>;
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
    return JSON.parse(data) as EmbeddingCache;
  } catch (error) {
    console.error(`캐시 로드 실패 (${deckName}):`, error);
    return null;
  }
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
export function createCache(deckName: string, dimension: number): EmbeddingCache {
  return {
    deckName,
    dimension,
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
  dimension: number;
  totalEmbeddings: number;
  lastUpdated: string | null;
  cacheFilePath: string;
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
      dimension: 0,
      totalEmbeddings: 0,
      lastUpdated: null,
      cacheFilePath: path,
    };
  }

  return {
    exists: true,
    deckName: cache.deckName,
    dimension: cache.dimension,
    totalEmbeddings: Object.keys(cache.embeddings).length,
    lastUpdated: new Date(cache.lastUpdated).toISOString(),
    cacheFilePath: path,
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
    const fs = require("node:fs");
    fs.unlinkSync(path);
    return true;
  } catch (error) {
    console.error(`캐시 삭제 실패 (${deckName}):`, error);
    return false;
  }
}
