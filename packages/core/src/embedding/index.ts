/**
 * 임베딩 모듈 - OpenAI 기반 의미적 유사도 검사
 */

// 파일 기반 캐시
export {
  type CachedEmbedding,
  type CacheStatus,
  type CacheIncompatibilityReason,
  cleanupCache,
  createCache,
  deleteCache,
  EMBEDDING_CACHE_SCHEMA_VERSION,
  type EmbeddingCache,
  getCacheIncompatibilityReason,
  getCachedEmbedding,
  getCacheStatus,
  getTextHash,
  isCacheCompatible,
  LEGACY_EMBEDDING_MODEL,
  LEGACY_EMBEDDING_PROVIDER,
  loadCache,
  saveCache,
  setCachedEmbedding,
} from "./cache.js";

// OpenAI 임베딩 클라이언트
export {
  EMBEDDING_EXPECTED_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  type EmbeddingOptions,
  getEmbedding,
  getEmbeddings,
  getSemanticSimilarity,
  preprocessTextForEmbedding,
} from "./client.js";
// 코사인 유사도
export { cosineSimilarity, fastCosineSimilarity, normalizeVector } from "./cosine.js";
