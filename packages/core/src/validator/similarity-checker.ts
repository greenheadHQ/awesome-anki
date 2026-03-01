/**
 * 유사성 검사 - 중복/유사 카드 탐지
 *
 * 두 가지 방식 지원:
 * 1. Jaccard 유사도 (기본): 단어 집합 + 2-gram 비교
 * 2. 임베딩 기반 (useEmbedding: true): Gemini 임베딩 + 코사인 유사도
 */

import { cosineSimilarity } from "../embedding/cosine.js";
import {
  createCache,
  getCachedEmbedding,
  getEmbedding,
  getTextHash,
  loadCache,
  saveCache,
  setCachedEmbedding,
} from "../embedding/index.js";
import type { SimilarCard, SimilarityResult } from "./types.js";

export interface CardForComparison {
  noteId: number;
  text: string;
}

export interface SimilarityCheckOptions {
  /** 유사도 임계값 (Jaccard: 70, 임베딩: 85) */
  threshold?: number;
  /** 최대 결과 수 (기본: 5) */
  maxResults?: number;
  /** 임베딩 기반 검사 사용 여부 */
  useEmbedding?: boolean;
  /** 덱 이름 (임베딩 캐시용) */
  deckName?: string;
}

/**
 * 텍스트 정규화 (비교용)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1") // Cloze 제거
    .replace(/<[^>]+>/g, " ") // HTML 태그 제거
    .replace(/:::\s*\w+[^\n]*\n?/g, "") // 컨테이너 제거
    .replace(/^:::\s*$/gm, "")
    .replace(/[^\w\s가-힣]/g, " ") // 특수문자 제거
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 단어 집합 생성 (n-gram 포함)
 */
function getWordSet(text: string, ngramSize: number = 2): Set<string> {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter((w) => w.length > 1);
  const result = new Set<string>();

  // 단어 추가
  for (const w of words) {
    result.add(w);
  }

  // n-gram 추가
  for (let i = 0; i <= words.length - ngramSize; i++) {
    result.add(words.slice(i, i + ngramSize).join(" "));
  }

  return result;
}

/**
 * Jaccard 유사도 계산
 */
function calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 100;
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  return Math.round((intersection / union) * 100);
}

/**
 * 두 카드의 유사도 계산
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const set1 = getWordSet(text1);
  const set2 = getWordSet(text2);
  return calculateJaccardSimilarity(set1, set2);
}

/**
 * 카드 유사성 검사 - 다른 카드들과 비교
 */
export async function checkSimilarity(
  targetCard: CardForComparison,
  allCards: CardForComparison[],
  options: SimilarityCheckOptions = {},
): Promise<SimilarityResult> {
  // 임베딩 기반 검사
  if (options.useEmbedding) {
    return checkSimilarityWithEmbedding(targetCard, allCards, options);
  }

  // Jaccard 기반 검사 (기본)
  return checkSimilarityWithJaccard(targetCard, allCards, options);
}

/**
 * Jaccard 유사도 기반 검사
 */
async function checkSimilarityWithJaccard(
  targetCard: CardForComparison,
  allCards: CardForComparison[],
  options: SimilarityCheckOptions,
): Promise<SimilarityResult> {
  const threshold = options.threshold ?? 70;
  const maxResults = options.maxResults ?? 5;

  const targetSet = getWordSet(targetCard.text);
  const similarCards: SimilarCard[] = [];

  // 모든 카드와 비교
  for (const card of allCards) {
    // 자기 자신 제외
    if (card.noteId === targetCard.noteId) continue;

    const cardSet = getWordSet(card.text);
    const similarity = calculateJaccardSimilarity(targetSet, cardSet);

    if (similarity >= threshold) {
      similarCards.push({
        noteId: card.noteId,
        similarity,
        matchedContent: card.text.slice(0, 100) + (card.text.length > 100 ? "..." : ""),
      });
    }
  }

  return buildSimilarityResult(similarCards, maxResults, "jaccard");
}

/**
 * 임베딩 기반 유사도 검사
 */
async function checkSimilarityWithEmbedding(
  targetCard: CardForComparison,
  allCards: CardForComparison[],
  options: SimilarityCheckOptions,
): Promise<SimilarityResult> {
  const threshold = options.threshold ?? 85; // 임베딩은 기본 85%
  const maxResults = options.maxResults ?? 5;
  const deckName = options.deckName ?? "default";

  // 캐시 로드 또는 생성
  let cache = loadCache(deckName);
  if (!cache) {
    cache = createCache(deckName, 768);
  }

  // 타겟 카드 임베딩
  const targetTextHash = getTextHash(targetCard.text);
  let targetEmbedding = getCachedEmbedding(cache, targetCard.noteId, targetTextHash);

  if (!targetEmbedding) {
    try {
      targetEmbedding = await getEmbedding(targetCard.text);
      setCachedEmbedding(cache, targetCard.noteId, targetEmbedding, targetTextHash);
    } catch (error) {
      // 임베딩 실패 시 Jaccard로 폴백
      console.warn(`임베딩 생성 실패, Jaccard로 폴백: ${error}`);
      return checkSimilarityWithJaccard(targetCard, allCards, {
        ...options,
        useEmbedding: false,
      });
    }
  }

  const similarCards: SimilarCard[] = [];

  // 모든 카드와 비교
  for (const card of allCards) {
    if (card.noteId === targetCard.noteId) continue;

    const cardTextHash = getTextHash(card.text);
    let cardEmbedding = getCachedEmbedding(cache, card.noteId, cardTextHash);

    if (!cardEmbedding) {
      try {
        cardEmbedding = await getEmbedding(card.text);
        setCachedEmbedding(cache, card.noteId, cardEmbedding, cardTextHash);
      } catch {
        console.warn(`카드 ${card.noteId} 임베딩 실패, 스킵`);
        continue;
      }
    }

    // 코사인 유사도 계산
    const similarity = cosineSimilarity(targetEmbedding, cardEmbedding);

    if (similarity >= threshold) {
      similarCards.push({
        noteId: card.noteId,
        similarity,
        matchedContent: card.text.slice(0, 100) + (card.text.length > 100 ? "..." : ""),
      });
    }
  }

  // 캐시 저장
  saveCache(cache);

  return buildSimilarityResult(similarCards, maxResults, "embedding");
}

/**
 * 유사도 결과 생성
 */
function buildSimilarityResult(
  similarCards: SimilarCard[],
  maxResults: number,
  method: "jaccard" | "embedding",
): SimilarityResult {
  // 유사도 높은 순으로 정렬
  similarCards.sort((a, b) => b.similarity - a.similarity);

  // 최대 결과 수 제한
  const topSimilar = similarCards.slice(0, maxResults);

  // 중복 여부 판단 (95% 이상이면 중복으로 간주 - 임베딩에서 더 엄격)
  const duplicateThreshold = method === "embedding" ? 95 : 90;
  const isDuplicate = topSimilar.some((c) => c.similarity >= duplicateThreshold);

  // 상태 결정
  let status: SimilarityResult["status"] = "valid";
  if (isDuplicate) {
    status = "error";
  } else if (topSimilar.length > 0) {
    status = "warning";
  }

  // 신뢰도 계산 (유사 카드가 많을수록 낮음)
  const confidence = Math.max(0, 100 - topSimilar.length * 10);

  return {
    status,
    type: "similarity",
    message: getStatusMessage(status, topSimilar.length, isDuplicate),
    confidence,
    details: {
      similarCards: topSimilar,
      isDuplicate,
      method,
    },
    timestamp: new Date().toISOString(),
  };
}

function getStatusMessage(_status: string, count: number, isDuplicate: boolean): string {
  if (isDuplicate) {
    return "중복 카드가 존재합니다.";
  }
  if (count > 0) {
    return `${count}개의 유사한 카드가 있습니다.`;
  }
  return "중복 없음";
}

/**
 * 덱 전체의 유사 카드 그룹 찾기
 */
export async function findSimilarGroups(
  cards: CardForComparison[],
  options: SimilarityCheckOptions = {},
): Promise<Map<number, number[]>> {
  const threshold = options.threshold ?? 70;
  const groups = new Map<number, number[]>();
  const processed = new Set<number>();

  for (const card of cards) {
    if (processed.has(card.noteId)) continue;

    const similar: number[] = [];
    const cardSet = getWordSet(card.text);

    for (const other of cards) {
      if (other.noteId === card.noteId) continue;
      if (processed.has(other.noteId)) continue;

      const otherSet = getWordSet(other.text);
      const similarity = calculateJaccardSimilarity(cardSet, otherSet);

      if (similarity >= threshold) {
        similar.push(other.noteId);
        processed.add(other.noteId);
      }
    }

    if (similar.length > 0) {
      groups.set(card.noteId, similar);
    }
    processed.add(card.noteId);
  }

  return groups;
}
