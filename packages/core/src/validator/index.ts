/**
 * 카드 검증 모듈
 */

// 문맥 일관성 검사
export {
  analyzeCardGroup,
  type CardForContext,
  type ContextCheckOptions,
  checkContext,
} from "./context-checker.js";

// 팩트 체크
export { checkFacts, type FactCheckOptions } from "./fact-checker.js";

// 최신성 검사
export { checkFreshness, type FreshnessCheckOptions } from "./freshness-checker.js";

// 유사성 검사
export {
  type CardForComparison,
  calculateSimilarity,
  checkSimilarity,
  findSimilarGroups,
  type SimilarityCheckOptions,
} from "./similarity-checker.js";
// 타입 export
export * from "./types.js";
