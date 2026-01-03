/**
 * 카드 검증 모듈
 */

// 타입 export
export * from './types.js';

// 팩트 체크
export { checkFacts, type FactCheckOptions } from './fact-checker.js';

// 최신성 검사
export { checkFreshness, type FreshnessCheckOptions } from './freshness-checker.js';

// 유사성 검사
export {
  checkSimilarity,
  calculateSimilarity,
  findSimilarGroups,
  type CardForComparison,
  type SimilarityCheckOptions,
} from './similarity-checker.js';

// 문맥 일관성 검사
export {
  checkContext,
  analyzeCardGroup,
  type CardForContext,
  type ContextCheckOptions,
} from './context-checker.js';
