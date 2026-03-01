export const HISTORY_STATUSES = [
  "generating",
  "generated",
  "applied",
  "rejected",
  "error",
  "not_split",
] as const;

export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

import type { TokenUsage } from "@anki-splitter/core";
export type { TokenUsage };

export interface SplitCardPayload {
  title: string;
  content: string;
  isMainCard?: boolean;
  cardType?: "cloze" | "basic";
  charCount?: number;
}

export interface SplitSessionListItem {
  sessionId: string;
  noteId: number;
  deckName: string;
  status: HistoryStatus;
  promptVersionId?: string;
  splitReason?: string;
  aiModel?: string;
  provider?: string;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
}

export interface SplitSessionEvent {
  eventId: string;
  sessionId: string;
  eventType: string;
  status: HistoryStatus;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

export interface SplitSessionDetail {
  sessionId: string;
  noteId: number;
  deckName: string;
  status: HistoryStatus;
  promptVersionId?: string;
  originalText: string;
  originalTags: string[];
  aiResponse: Record<string, unknown> | null;
  splitCards: SplitCardPayload[];
  splitReason?: string;
  aiModel?: string;
  provider?: string;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  executionTimeMs?: number;
  tokenUsage?: TokenUsage;
  rejectionReason?: string;
  errorMessage?: string;
  source: "runtime" | "legacy_json";
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  events: SplitSessionEvent[];
}

export interface HistoryListQuery {
  page: number;
  limit: number;
  deckName?: string;
  status?: HistoryStatus;
  startDate: string;
  endDate: string;
}

export interface HistoryListResult {
  items: SplitSessionListItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CreateSessionInput {
  noteId: number;
  deckName: string;
  promptVersionId?: string;
  originalText: string;
  originalTags: string[];
}

export interface SplitGeneratedPayload {
  splitCards: SplitCardPayload[];
  aiResponse: Record<string, unknown> | null;
  splitReason?: string;
  aiModel?: string;
  provider?: string;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  executionTimeMs?: number;
  tokenUsage?: TokenUsage;
}

export interface SplitNotSplitPayload {
  splitReason?: string;
  aiModel?: string;
  provider?: string;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  executionTimeMs?: number;
  tokenUsage?: TokenUsage;
  aiResponse?: Record<string, unknown> | null;
}

export interface SplitAppliedPayload {
  splitCards: SplitCardPayload[];
}

export interface SplitRejectedPayload {
  rejectionReason: string;
}

export interface SplitErrorPayload {
  errorMessage: string;
  provider?: string;
  aiModel?: string;
}

export interface HistorySyncHealth {
  mode: "local" | "remote";
  status: "ok" | "degraded";
  message: string;
  updatedAt: string;
}

export interface HistorySyncResult {
  mode: "local" | "remote";
  success: boolean;
  message: string;
  syncedAt?: string;
}
