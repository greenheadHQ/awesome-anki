/**
 * 임베딩 모듈 - Gemini 기반 의미적 유사도 검사
 */

// 파일 기반 캐시
export {
  type CachedEmbedding,
  type CacheStatus,
  cleanupCache,
  createCache,
  deleteCache,
  type EmbeddingCache,
  getCachedEmbedding,
  getCacheStatus,
  getTextHash,
  loadCache,
  saveCache,
  setCachedEmbedding,
} from "./cache.js";

// Gemini 임베딩 클라이언트
export {
  type EmbeddingOptions,
  getEmbedding,
  getEmbeddings,
  getSemanticSimilarity,
  preprocessTextForEmbedding,
} from "./client.js";
// 코사인 유사도
export {
  cosineSimilarity,
  fastCosineSimilarity,
  normalizeVector,
} from "./cosine.js";
