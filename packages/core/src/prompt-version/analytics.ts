/**
 * 프롬프트 메트릭 기록 및 실패 패턴 분석
 */

// NOTE: countCardChars는 순수 텍스트 유틸리티. gemini 모듈에 위치하지만 순환 의존 아님.
import { countCardChars } from "../gemini/cloze-enhancer.js";
import { getVersion, saveVersion } from "./storage.js";
import type { ModificationPatterns, SplitHistoryEntry } from "./types.js";

export interface PromptMetricsEvent {
  promptVersionId: string;
  userAction: "approved" | "modified" | "rejected";
  splitCards: Array<{
    title?: string;
    content: string;
    charCount?: number;
    cardType?: "cloze" | "basic";
    contextTag?: string;
  }>;
  modificationDetails?: SplitHistoryEntry["modificationDetails"];
  timestamp?: string;
}

/**
 * 히스토리 본문 저장 없이 프롬프트 메트릭만 갱신
 */
export async function recordPromptMetricsEvent(event: PromptMetricsEvent): Promise<void> {
  const timestamp = event.timestamp ?? new Date().toISOString();

  const entry: SplitHistoryEntry = {
    id: `metrics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp,
    promptVersionId: event.promptVersionId,
    noteId: 0,
    deckName: "",
    originalContent: "",
    originalCharCount: 0,
    splitCards: event.splitCards.map((card) => ({
      title: card.title ?? "",
      content: card.content,
      charCount: card.charCount,
      cardType: card.cardType,
      contextTag: card.contextTag,
    })),
    userAction: event.userAction,
    modificationDetails: event.modificationDetails,
    qualityChecks: null,
  };

  await updateVersionMetrics(event.promptVersionId, entry);
}

/**
 * 버전 메트릭 업데이트
 */
async function updateVersionMetrics(versionId: string, entry: SplitHistoryEntry): Promise<void> {
  const version = await getVersion(versionId);
  if (!version) return;

  const metrics = version.metrics;
  const patterns = version.modificationPatterns;

  // 총 분할 횟수
  metrics.totalSplits++;

  // 사용자 액션별 카운트
  switch (entry.userAction) {
    case "approved":
      metrics.approvedCount++;
      break;
    case "modified":
      metrics.modifiedCount++;
      // 수정 패턴 업데이트
      if (entry.modificationDetails) {
        if (entry.modificationDetails.lengthReduced) patterns.lengthReduced++;
        if (entry.modificationDetails.contextAdded) patterns.contextAdded++;
        if (entry.modificationDetails.clozeChanged) patterns.clozeChanged++;
        if (entry.modificationDetails.cardsMerged) patterns.cardsMerged++;
        if (entry.modificationDetails.cardsSplit) patterns.cardsSplit++;
        if (entry.modificationDetails.hintAdded) patterns.hintAdded++;
      }
      break;
    case "rejected":
      metrics.rejectedCount++;
      break;
  }

  // 승인률 계산
  const totalDecisions = metrics.approvedCount + metrics.modifiedCount + metrics.rejectedCount;
  metrics.approvalRate =
    totalDecisions > 0 ? Math.round((metrics.approvedCount / totalDecisions) * 100) : 0;

  // 평균 카드 수
  metrics.avgCardsPerSplit =
    metrics.totalSplits > 0
      ? Math.round(
          ((metrics.avgCardsPerSplit * (metrics.totalSplits - 1) + entry.splitCards.length) /
            metrics.totalSplits) *
            10,
        ) / 10
      : entry.splitCards.length;

  // 평균 글자 수 (charCount가 없으면 countCardChars 폴백)
  const totalChars = entry.splitCards.reduce(
    (sum, card) => sum + (card.charCount ?? countCardChars(card.content)),
    0,
  );
  const avgChars = entry.splitCards.length > 0 ? totalChars / entry.splitCards.length : 0;
  metrics.avgCharCount =
    metrics.totalSplits > 0
      ? Math.round(
          (metrics.avgCharCount * (metrics.totalSplits - 1) + avgChars) / metrics.totalSplits,
        )
      : avgChars;

  // 마지막 사용 시간
  metrics.lastUsedAt = entry.timestamp;

  // 저장
  version.metrics = metrics;
  version.modificationPatterns = patterns;
  version.updatedAt = new Date().toISOString();
  await saveVersion(version);
}

/**
 * 버전의 실패 패턴 분석
 */
export async function analyzeFailurePatterns(versionId: string): Promise<{
  patterns: ModificationPatterns;
  insights: string[];
}> {
  const version = await getVersion(versionId);
  if (!version) {
    return {
      patterns: {
        lengthReduced: 0,
        contextAdded: 0,
        clozeChanged: 0,
        cardsMerged: 0,
        cardsSplit: 0,
        hintAdded: 0,
      },
      insights: [],
    };
  }

  const patterns = version.modificationPatterns;
  const total = Object.values(patterns).reduce((sum, v) => sum + v, 0);
  const insights: string[] = [];

  if (total === 0) {
    insights.push("수정된 분할이 없습니다.");
    return { patterns, insights };
  }

  // 각 패턴별 비율 계산 및 인사이트 생성
  const threshold = 0.3; // 30% 이상이면 문제로 간주

  if (patterns.lengthReduced / total > threshold) {
    insights.push(
      `글자 수 초과가 ${Math.round((patterns.lengthReduced / total) * 100)}%: 프롬프트에서 상한선 강조 필요`,
    );
  }

  if (patterns.contextAdded / total > threshold) {
    insights.push(
      `맥락 태그 누락이 ${Math.round((patterns.contextAdded / total) * 100)}%: 중첩 태그 생성 규칙 강화 필요`,
    );
  }

  if (patterns.clozeChanged / total > threshold) {
    insights.push(
      `Cloze 위치/내용 변경이 ${Math.round((patterns.clozeChanged / total) * 100)}%: Cloze 선택 기준 개선 필요`,
    );
  }

  if (patterns.cardsMerged / total > threshold) {
    insights.push(
      `카드 병합이 ${Math.round((patterns.cardsMerged / total) * 100)}%: 분할이 너무 세분화됨`,
    );
  }

  if (patterns.cardsSplit / total > threshold) {
    insights.push(
      `추가 분할이 ${Math.round((patterns.cardsSplit / total) * 100)}%: 분할이 충분히 원자적이지 않음`,
    );
  }

  if (patterns.hintAdded / total > threshold) {
    insights.push(
      `힌트 추가가 ${Math.round((patterns.hintAdded / total) * 100)}%: 이진 패턴 감지 정확도 개선 필요`,
    );
  }

  return { patterns, insights };
}
