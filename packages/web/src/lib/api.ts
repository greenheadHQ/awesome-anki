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
  hardSplitCount: number;
  softSplitCount: number;
}

export interface CardSummary {
  noteId: number;
  text: string;
  tags: string[];
  modelName: string;
  analysis: {
    canHardSplit: boolean;
    canSoftSplit?: boolean;
    clozeCount: number;
  };
  clozeStats: {
    totalClozes: number;
    uniqueNumbers: number;
  };
  isSplitable: boolean;
  splitType: "hard" | "soft" | null;
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
  noteId: number;
  splitType: "hard" | "soft" | "none";
  originalText?: string;
  splitCards?: Array<{
    title: string;
    content: string;
    isMainCard: boolean;
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
}

/** @deprecated Use SplitPreviewResult instead */
export type SplitPreview = SplitPreviewResult;

export interface SplitApplyResult {
  success: boolean;
  backupId: string;
  splitType?: "hard" | "soft";
  mainNoteId: number;
  newNoteIds: number[];
  warning?: string;
}

export interface BackupEntry {
  id: string;
  timestamp: string;
  deckName: string;
  originalNoteId: number;
  createdNoteIds: number[];
  splitType: "hard" | "soft";
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

export type PrivacyMode = "standard" | "balanced" | "strict";
// NOTE: Canonical privacy type definitions live in packages/core/src/privacy/index.ts.

export interface FeaturePrivacyPolicy {
  enabled: boolean;
  maskSensitive: boolean;
  maxChars: number;
}

export interface PrivacyStatus {
  mode: PrivacyMode;
  description: string;
  featurePolicies: {
    split: FeaturePrivacyPolicy;
    validation: FeaturePrivacyPolicy;
    embedding: FeaturePrivacyPolicy;
  };
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

export interface SplitHistoryEntry {
  id: string;
  promptVersionId: string;
  noteId: number;
  deckName: string;
  originalContent: string;
  originalCharCount: number;
  originalTags?: string[];
  splitCards: Array<{
    title: string;
    content: string;
    charCount?: number;
    cardType?: "cloze" | "basic";
  }>;
  userAction: "approved" | "modified" | "rejected";
  rejectionReason?: string;
  modificationDetails?: {
    lengthReduced: boolean;
    contextAdded: boolean;
    clozeChanged: boolean;
    cardsMerged: boolean;
    cardsSplit: boolean;
    hintAdded: boolean;
  };
  aiModel?: string;
  splitType?: "hard" | "soft";
  splitReason?: string;
  executionTimeMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  timestamp: string;
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
    preview: (noteId: number, useGemini = false, versionId?: string) =>
      fetchJson<SplitPreviewResult>("/split/preview", {
        method: "POST",
        body: JSON.stringify({ noteId, useGemini, versionId }),
      }),
    apply: (data: {
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
      splitType?: "hard" | "soft";
    }) =>
      fetchJson<SplitApplyResult>("/split/apply", {
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

  privacy: {
    status: () => fetchJson<PrivacyStatus>("/privacy/status"),
  },

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
        activeVersion: PromptVersion | null;
        systemPrompt: string;
        splitPromptTemplate: string;
        analysisPromptTemplate: string;
      }>("/prompts/active"),
    activate: (versionId: string) =>
      fetchJson<{ versionId: string; activatedAt: string }>(
        `/prompts/versions/${versionId}/activate`,
        { method: "POST" },
      ),
    history: (opts?: { page?: number; limit?: number; versionId?: string }) => {
      const params = new URLSearchParams();
      const effectiveLimit = opts?.limit ?? 100;
      if (opts?.page && opts.page > 1) {
        params.set("offset", String((opts.page - 1) * effectiveLimit));
      }
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.versionId) params.set("versionId", opts.versionId);
      const query = params.toString();
      return fetchJson<{
        history: SplitHistoryEntry[];
        totalCount: number;
        offset: number;
        limit: number;
        hasMore: boolean;
      }>(`/prompts/history${query ? `?${query}` : ""}`);
    },
    addHistory: (data: {
      promptVersionId: string;
      noteId: number;
      deckName: string;
      originalContent: string;
      originalTags?: string[];
      splitCards: Array<{
        title: string;
        content: string;
        charCount?: number;
        cardType?: "cloze" | "basic";
      }>;
      userAction: "approved" | "modified" | "rejected";
      rejectionReason?: string;
      modificationDetails?: {
        lengthReduced: boolean;
        contextAdded: boolean;
        clozeChanged: boolean;
        cardsMerged: boolean;
        cardsSplit: boolean;
        hintAdded: boolean;
      };
      qualityChecks: {
        allCardsUnder80Chars: boolean;
        allClozeHaveHints: boolean;
        noEnumerations: boolean;
        allContextTagsPresent: boolean;
      } | null;
      aiModel?: string;
      splitType?: "hard" | "soft";
      splitReason?: string;
      executionTimeMs?: number;
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    }) =>
      fetchJson<SplitHistoryEntry>("/prompts/history", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    experiments: () =>
      fetchJson<{ experiments: Experiment[]; total: number }>(
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
      data: { conclusion: string; winnerVersionId?: string },
    ) =>
      fetchJson<Experiment>(`/prompts/experiments/${id}/complete`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
