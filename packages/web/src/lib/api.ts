const BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optionHeaders, ...restOptions } = options ?? {};
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(optionHeaders || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }
  return res.json();
}

// Types
export interface DeckStats {
  deckName: string;
  totalNotes: number;
  splitCandidates: number;
}

export interface CardSummary {
  noteId: number;
  text: string;
  tags: string[];
  modelName: string;
  analysis: {
    canSplit: boolean;
    hasTodoBlock: boolean;
    clozeCount: number;
    estimatedCards: number;
  };
  clozeStats: {
    totalClozes: number;
    uniqueNumbers: number;
  };
  isSplitable: boolean;
}

export interface CardDetail extends CardSummary {
  nidLinks: Array<{
    title: string;
    nid: string;
  }>;
  clozes: Array<{
    clozeNumber: number;
    content: string;
    hint?: string;
  }>;
}

export interface SplitPreviewResult {
  sessionId?: string;
  noteId: number;
  originalText?: string;
  splitCards?: Array<{
    title: string;
    content: string;
    isMainCard?: boolean;
    cardType?: "cloze" | "basic";
    charCount?: number;
  }>;
  mainCardIndex?: number;
  splitReason?: string;
  reason?: string;
  executionTimeMs?: number;
  aiModel?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  historyWarning?: string;
}

/** @deprecated Use SplitPreviewResult instead */
export type SplitPreview = SplitPreviewResult;

export interface SplitApplyResult {
  success: boolean;
  backupId: string;
  mainNoteId: number;
  newNoteIds: number[];
  syncResult?: {
    success: boolean;
    syncedAt?: string;
    error?: string;
  };
  warning?: string;
  historyWarning?: string;
}

export interface SplitRejectResult {
  success: boolean;
  sessionId: string;
  historyWarning?: string;
}

export interface BackupEntry {
  id: string;
  timestamp: string;
  deckName: string;
  originalNoteId: number;
  createdNoteIds: number[];
}

// Validation types
export type ValidationStatus = "valid" | "warning" | "error" | "unknown";

export interface ValidationResult {
  status: ValidationStatus;
  type: string;
  message: string;
  confidence: number;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface FactCheckResult extends ValidationResult {
  type: "fact-check";
  details: {
    claims: Array<{
      claim: string;
      isVerified: boolean;
      confidence: number;
      correction?: string;
      source?: string;
    }>;
    overallAccuracy: number;
    sources?: string[];
  };
}

export interface FreshnessResult extends ValidationResult {
  type: "freshness";
  details: {
    outdatedItems: Array<{
      content: string;
      reason: string;
      currentInfo?: string;
      severity: "low" | "medium" | "high";
    }>;
    lastKnownUpdate?: string;
    recommendedAction?: string;
  };
}

export interface SimilarityResult extends ValidationResult {
  type: "similarity";
  details: {
    similarCards: Array<{
      noteId: number;
      similarity: number;
      matchedContent: string;
    }>;
    isDuplicate: boolean;
    method?: "jaccard" | "embedding";
  };
}

// Difficulty types
export interface DifficultCard {
  noteId: number;
  cardId: number;
  text: string;
  tags: string[];
  lapses: number;
  easeFactor: number;
  interval: number;
  reps: number;
  difficultyScore: number;
  difficultyReasons: string[];
}

// Embedding types
export interface EmbeddingStatus {
  exists: boolean;
  deckName: string;
  dimension: number;
  totalEmbeddings: number;
  totalNotes: number;
  coverage: number;
  lastUpdated: string | null;
  cacheFilePath: string;
}

export interface EmbeddingGenerateResult {
  deckName: string;
  totalNotes: number;
  cachedCount: number;
  generatedCount: number;
  skippedCount: number;
  removedCount: number;
  errorCount: number;
  lastUpdated: string;
}

// Prompt Version types
export interface PromptVersion {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  splitPromptTemplate: string;
  analysisPromptTemplate: string;
  examples: Array<{
    input: string;
    output: string;
    explanation: string;
  }>;
  config: {
    maxClozeChars: number;
    maxBasicFrontChars: number;
    maxBasicBackChars: number;
    minClozeChars: number;
    requireContextTag: boolean;
    requireHintForBinary: boolean;
  };
  status: "draft" | "active" | "archived";
  metrics: {
    totalSplits: number;
    approvalRate: number;
    modificationRate: number;
    rejectionRate: number;
    avgCharCount: number;
    avgCardsPerSplit: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActiveVersionInfo {
  versionId: string;
  activatedAt: string;
}

export interface PromptSystemState {
  revision: number;
  systemPrompt: string;
  activeVersion: {
    id: string;
    name: string;
    updatedAt: string;
  };
}

export interface PromptSystemConflictLatest {
  revision: number;
  systemPrompt: string;
  activeVersionId: string;
  updatedAt: string;
}

export interface PromptSystemSaveResult {
  revision: number;
  newVersion: {
    id: string;
    name: string;
    activatedAt: string;
  };
  syncResult: {
    success: boolean;
    syncedAt?: string;
    error?: string;
  };
}

export class PromptConflictError extends Error {
  readonly status = 409;
  readonly latest: PromptSystemConflictLatest;

  constructor(latest: PromptSystemConflictLatest) {
    super("Prompt revision conflict");
    this.name = "PromptConflictError";
    this.latest = latest;
  }
}

export type SplitHistoryStatus =
  | "generating"
  | "generated"
  | "applied"
  | "rejected"
  | "error"
  | "not_split";

export interface SplitHistoryListItem {
  sessionId: string;
  noteId: number;
  deckName: string;
  status: SplitHistoryStatus;
  promptVersionId?: string;
  splitReason?: string;
  aiModel?: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
}

export interface SplitHistoryEvent {
  eventId: string;
  sessionId: string;
  eventType: string;
  status: SplitHistoryStatus;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

export interface SplitHistoryDetail {
  sessionId: string;
  noteId: number;
  deckName: string;
  status: SplitHistoryStatus;
  promptVersionId?: string;
  originalText: string;
  originalTags: string[];
  aiResponse: Record<string, unknown> | null;
  splitCards: Array<{
    title: string;
    content: string;
    isMainCard?: boolean;
    cardType?: "cloze" | "basic";
    charCount?: number;
  }>;
  splitReason?: string;
  aiModel?: string;
  executionTimeMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  rejectionReason?: string;
  errorMessage?: string;
  source: "runtime" | "legacy_json";
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  events: SplitHistoryEvent[];
}

export interface SplitHistorySyncHealth {
  mode: "local" | "remote";
  status: "ok" | "degraded";
  message: string;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  name: string;
  controlVersionId: string;
  treatmentVersionId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed";
  controlResults: {
    splitCount: number;
    approvalRate: number;
    modificationRate: number;
    rejectionRate: number;
    avgCharCount: number;
  };
  treatmentResults: {
    splitCount: number;
    approvalRate: number;
    modificationRate: number;
    rejectionRate: number;
    avgCharCount: number;
  };
  conclusion?: string;
  winnerVersionId?: string;
}

export interface ContextResult extends ValidationResult {
  type: "context";
  details: {
    inconsistencies: Array<{
      description: string;
      conflictingNoteId?: number;
      severity: "low" | "medium" | "high";
    }>;
    relatedCards: number[];
  };
}

export interface AllValidationResult {
  noteId: number;
  overallStatus: ValidationStatus;
  results: {
    factCheck: FactCheckResult;
    freshness: FreshnessResult;
    similarity: SimilarityResult;
    context: ContextResult;
  };
  validatedAt: string;
}

// API Functions
export const api = {
  decks: {
    list: () => fetchJson<{ decks: string[] }>("/decks"),
    stats: (name: string) =>
      fetchJson<DeckStats>(`/decks/${encodeURIComponent(name)}/stats`),
  },

  cards: {
    getByDeck: (
      deck: string,
      opts?: { page?: number; limit?: number; filter?: string },
    ) => {
      const params = new URLSearchParams();
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.filter) params.set("filter", opts.filter);
      const query = params.toString();
      return fetchJson<{
        cards: CardSummary[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/cards/deck/${encodeURIComponent(deck)}${query ? `?${query}` : ""}`);
    },
    getById: (noteId: number) => fetchJson<CardDetail>(`/cards/${noteId}`),
    getDifficult: (deck: string, opts?: { page?: number; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      return fetchJson<{
        cards: DifficultCard[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(
        `/cards/deck/${encodeURIComponent(deck)}/difficult${query ? `?${query}` : ""}`,
      );
    },
  },

  split: {
    preview: (noteId: number, versionId?: string, deckName?: string) =>
      fetchJson<SplitPreviewResult>("/split/preview", {
        method: "POST",
        body: JSON.stringify({ noteId, versionId, deckName }),
      }),
    apply: (data: {
      sessionId: string;
      noteId: number;
      deckName: string;
      splitCards: Array<{
        title: string;
        content: string;
        inheritImages?: string[];
        inheritTags?: string[];
        preservedLinks?: string[];
        backLinks?: string[];
      }>;
      mainCardIndex: number;
    }) =>
      fetchJson<SplitApplyResult>("/split/apply", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    reject: (data: { sessionId: string; rejectionReason: string }) =>
      fetchJson<SplitRejectResult>("/split/reject", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  backup: {
    list: () => fetchJson<{ backups: BackupEntry[]; total: number }>("/backup"),
    latest: () => fetchJson<{ backupId: string | null }>("/backup/latest"),
    rollback: (backupId: string) =>
      fetchJson<{
        success: boolean;
        restoredNoteId?: number;
        deletedNoteIds?: number[];
        restoredFieldNames?: string[];
        restoredTags?: string[];
        warning?: string;
        error?: string;
      }>(`/backup/${backupId}/rollback`, { method: "POST" }),
  },

  health: () => fetchJson<{ status: string; timestamp: string }>("/health"),

  validate: {
    factCheck: (noteId: number, thorough = false) =>
      fetchJson<{ noteId: number; result: FactCheckResult }>(
        "/validate/fact-check",
        {
          method: "POST",
          body: JSON.stringify({ noteId, thorough }),
        },
      ),
    freshness: (noteId: number) =>
      fetchJson<{ noteId: number; result: FreshnessResult }>(
        "/validate/freshness",
        {
          method: "POST",
          body: JSON.stringify({ noteId }),
        },
      ),
    similarity: (
      noteId: number,
      deckName: string,
      opts?: { threshold?: number; useEmbedding?: boolean },
    ) =>
      fetchJson<{ noteId: number; result: SimilarityResult }>(
        "/validate/similarity",
        {
          method: "POST",
          body: JSON.stringify({
            noteId,
            deckName,
            threshold: opts?.threshold,
            useEmbedding: opts?.useEmbedding,
          }),
        },
      ),
    context: (noteId: number, includeReverseLinks = true) =>
      fetchJson<{ noteId: number; result: ContextResult }>(
        "/validate/context",
        {
          method: "POST",
          body: JSON.stringify({ noteId, includeReverseLinks }),
        },
      ),
    all: (noteId: number, deckName: string) =>
      fetchJson<AllValidationResult>("/validate/all", {
        method: "POST",
        body: JSON.stringify({ noteId, deckName }),
      }),
  },

  embedding: {
    status: (deckName: string) =>
      fetchJson<EmbeddingStatus>(
        `/embedding/status/${encodeURIComponent(deckName)}`,
      ),
    generate: (deckName: string, forceRegenerate = false) =>
      fetchJson<EmbeddingGenerateResult>("/embedding/generate", {
        method: "POST",
        body: JSON.stringify({ deckName, forceRegenerate }),
      }),
    deleteCache: (deckName: string) =>
      fetchJson<{ deckName: string; deleted: boolean; message: string }>(
        `/embedding/cache/${encodeURIComponent(deckName)}`,
        { method: "DELETE" },
      ),
  },

  prompts: {
    versions: () =>
      fetchJson<{
        versions: PromptVersion[];
        activeVersionId: string | null;
      }>("/prompts/versions"),
    version: (id: string) =>
      fetchJson<PromptVersion>(`/prompts/versions/${id}`),
    active: () =>
      fetchJson<{
        activeInfo: {
          versionId: string;
          activatedAt: string;
          activatedBy: string;
        };
        version: PromptVersion | null;
      }>("/prompts/active"),
    system: () => fetchJson<PromptSystemState>("/prompts/system"),
    saveSystemPrompt: async (data: {
      expectedRevision: number;
      systemPrompt: string;
      reason: string;
    }) => {
      const res = await fetch(`${BASE_URL}/prompts/system`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        const rawBody = await res.text().catch(() => "");
        let payload: {
          latest?: PromptSystemConflictLatest;
        } | null = null;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody) as {
              latest?: PromptSystemConflictLatest;
            };
          } catch {
            payload = null;
          }
        }
        if (payload?.latest) {
          throw new PromptConflictError(payload.latest);
        }
        throw new Error(
          "리비전 충돌이 발생했지만 서버 응답을 파싱할 수 없습니다. 원격 재조회 후 다시 시도하세요.",
        );
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `API Error: ${res.status}`);
      }

      return (await res.json()) as PromptSystemSaveResult;
    },
    activate: (versionId: string) =>
      fetchJson<{ versionId: string; activatedAt: string }>(
        `/prompts/versions/${versionId}/activate`,
        { method: "POST" },
      ),
    experiments: () =>
      fetchJson<{ experiments: Experiment[]; count: number }>(
        "/prompts/experiments",
      ),
    experiment: (id: string) =>
      fetchJson<{
        experiment: Experiment;
        controlVersion: PromptVersion | null;
        treatmentVersion: PromptVersion | null;
      }>(`/prompts/experiments/${id}`),
    createExperiment: (data: {
      name: string;
      controlVersionId: string;
      treatmentVersionId: string;
    }) =>
      fetchJson<Experiment>("/prompts/experiments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    completeExperiment: (
      id: string,
      data: { conclusion: string; winnerVersionId: string },
    ) =>
      fetchJson<Experiment>(`/prompts/experiments/${id}/complete`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  history: {
    list: (opts?: {
      page?: number;
      limit?: number;
      deckName?: string;
      status?: SplitHistoryStatus;
      startDate?: string;
      endDate?: string;
    }) => {
      const params = new URLSearchParams();
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.deckName) params.set("deckName", opts.deckName);
      if (opts?.status) params.set("status", opts.status);
      if (opts?.startDate) params.set("startDate", opts.startDate);
      if (opts?.endDate) params.set("endDate", opts.endDate);
      const query = params.toString();
      return fetchJson<{
        items: SplitHistoryListItem[];
        totalCount: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore: boolean;
        filters: {
          deckName: string | null;
          status: SplitHistoryStatus | null;
          startDate: string;
          endDate: string;
        };
      }>(`/history${query ? `?${query}` : ""}`);
    },
    detail: (sessionId: string) =>
      fetchJson<SplitHistoryDetail>(
        `/history/${encodeURIComponent(sessionId)}`,
      ),
    syncHealth: () => fetchJson<SplitHistorySyncHealth>("/history/sync/health"),
  },
};
