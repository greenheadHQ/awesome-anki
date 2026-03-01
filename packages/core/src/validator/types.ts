/**
 * 카드 검증 관련 타입 정의
 */

import type { ActualCost, LLMModelId, TokenUsage } from "../llm/types.js";

// 검증 결과 상태
export type ValidationStatus = "valid" | "warning" | "error" | "unknown";

// 검증 유형
export type ValidationType = "fact-check" | "freshness" | "similarity" | "context";

// 기본 검증 결과 인터페이스
export interface ValidationResult {
  status: ValidationStatus;
  type: ValidationType;
  message: string;
  confidence: number; // 0-100
  details?: Record<string, unknown>;
  timestamp: string;
  modelId?: LLMModelId;
  tokenUsage?: TokenUsage;
  actualCost?: ActualCost;
}

// 팩트 체크 결과
export interface FactCheckResult extends ValidationResult {
  type: "fact-check";
  details: {
    claims: ClaimVerification[];
    overallAccuracy: number;
    sources?: string[];
  };
}

export interface ClaimVerification {
  claim: string;
  isVerified: boolean;
  confidence: number;
  correction?: string;
  source?: string;
}

// 최신성 검사 결과
export interface FreshnessResult extends ValidationResult {
  type: "freshness";
  details: {
    outdatedItems: OutdatedItem[];
    lastKnownUpdate?: string;
    recommendedAction?: string;
  };
}

export interface OutdatedItem {
  content: string;
  reason: string;
  currentInfo?: string;
  severity: "low" | "medium" | "high";
}

// 유사성 검사 결과
export interface SimilarityResult extends ValidationResult {
  type: "similarity";
  details: {
    similarCards: SimilarCard[];
    isDuplicate: boolean;
    /** 사용된 유사도 검사 방식 */
    method?: "jaccard" | "embedding";
  };
}

export interface SimilarCard {
  noteId: number;
  similarity: number; // 0-100
  matchedContent: string;
}

// 문맥 일관성 검사 결과
export interface ContextResult extends ValidationResult {
  type: "context";
  details: {
    inconsistencies: Inconsistency[];
    relatedCards: number[];
  };
}

export interface Inconsistency {
  description: string;
  conflictingNoteId?: number;
  severity: "low" | "medium" | "high";
}

// 전체 검증 결과
export interface CardValidation {
  noteId: number;
  results: ValidationResult[];
  overallStatus: ValidationStatus;
  validatedAt: string;
}

// 검증 요청 옵션
export interface ValidationOptions {
  types?: ValidationType[];
  thorough?: boolean; // 심층 검증 여부
  includeRelatedCards?: boolean;
}
