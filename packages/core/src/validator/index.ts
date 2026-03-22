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
// Verbose 감지
export { checkVerbose, type VerboseCheckOptions } from "./verbose-checker.js";

// YAGNI 감지
export { checkYagni, type YagniCheckOptions } from "./yagni-checker.js";

// 카드 수정
export {
  applyFactCorrections,
  type FixResult,
  removeYagniClozes,
} from "./card-fixer.js";

// 유틸리티
export { cleanCardText } from "./utils.js";

// 타입 export
export * from "./types.js";
