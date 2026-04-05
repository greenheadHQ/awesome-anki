// @anki-splitter/core - Main entry point

export {
  type BackupEntry,
  getLatestBackupId,
  listBackups,
  preBackup,
  rollback,
  updateBackupWithCreatedNotes,
} from "./anki/backup.js";
// Anki exports
export {
  addNote,
  addNotes,
  addTags,
  ankiConnect,
  deleteNotes,
  findNotes,
  getConfig,
  getDeckNames,
  getModelFieldNames,
  getModelNames,
  getNotesInfo,
  getProfiles,
  getVersion,
  type NoteFields,
  type NoteInfo,
  setConfig,
  sync,
  updateNoteFields,
} from "./anki/client.js";
export {
  computeDifficultyScore,
  DEFAULT_THRESHOLDS,
  type DifficultCardInfo,
  type DifficultyThresholds,
  getDifficultCards,
  getDifficultyReasons,
} from "./anki/difficulty.js";
export {
  addSplitCards,
  applySplitResult,
  extractTags,
  extractTextField,
  getDeckNotes,
  getNoteById,
  type SplitCard,
  type SplitResult,
  updateMainCard,
} from "./anki/operations.js";
export {
  type CardSchedulingInfo,
  cloneSchedulingAfterSplit,
  copySchedulingToNewCards,
  type FullCardInfo,
  findCardsByNote,
  getCardSchedulingInfo,
  getFullCardInfo,
  setCardScheduling,
} from "./anki/scheduling.js";
// Embedding exports
export * from "./embedding/index.js";
// Error classes
export {
  AnkiConnectError,
  type AnkiConnectErrorCode,
  AppError,
  NotFoundError,
  TimeoutError,
  ValidationError,
} from "./errors.js";
// Gemini exports
export {
  analyzeCardForSplit,
  type CardForSplit,
  estimateSplitCost,
  requestBatchCardSplit,
  requestCardSplit,
  SPLIT_MAX_OUTPUT_TOKENS,
  type SplitRequestMetadata,
} from "./gemini/client.js";
export {
  addHintToCloze,
  analyzeClozes,
  BINARY_PATTERNS,
  type BinaryPattern,
  type CardQualityCheck,
  type ClozeAnalysis,
  checkCardQuality,
  countCardChars,
  detectBinaryPattern,
  detectCardType,
  enhanceCardsWithHints,
  extractClozeValue,
  hasHint,
} from "./gemini/cloze-enhancer.js";
export {
  buildAnalysisPrompt,
  buildSplitPrompt,
  buildSplitPromptFromTemplate,
  SYSTEM_PROMPT,
} from "./gemini/prompts.js";
export {
  type AnalysisResponse,
  type SplitResponse,
  validateAllCardsHaveCloze,
  validateAnalysisResponse,
  validateClozePresence,
  validateSplitResponse,
  validateStylePreservation,
} from "./gemini/validator.js";
// LLM abstraction layer
export * from "./llm/index.js";
// Parser exports
export * from "./parser/index.js";
export {
  createVersion as createPromptVersion,
  deleteVersion as deletePromptVersion,
  getActivePrompts,
  getActiveVersion,
  getVersion as getPromptVersion,
  listVersions as listPromptVersions,
  saveVersion as savePromptVersion,
  setActiveVersion,
} from "./prompt-version/storage.js";
export {
  createExperiment,
  completeExperiment,
  getExperiment,
  listExperiments,
} from "./prompt-version/experiments.js";
export {
  analyzeFailurePatterns,
  type PromptMetricsEvent,
  recordPromptMetricsEvent,
} from "./prompt-version/analytics.js";
export {
  clearRemoteSystemPromptPayload,
  getRemoteSystemPromptPayload,
  parseRemoteSystemPromptPayload,
  type RemoteSystemPromptPayload,
  setRemoteSystemPromptPayload,
  SYSTEM_PROMPT_CONFIG_KEY,
} from "./prompt-version/remote-prompt.js";
export {
  migrateLegacySystemPromptToRemoteIfNeeded,
} from "./prompt-version/migration.js";
// Prompt Version exports (명시적 export - getVersion 충돌 방지)
export {
  type ActiveVersionInfo,
  DEFAULT_METRICS,
  DEFAULT_MODIFICATION_PATTERNS,
  // Constants
  DEFAULT_PROMPT_CONFIG,
  type Experiment,
  // Types
  type FewShotExample,
  type ModificationPatterns,
  type PromptConfig,
  type PromptMetrics,
  type PromptVersion,
  REJECTION_REASONS,
  type RejectionReasonId,
  type SplitHistoryEntry,
} from "./prompt-version/types.js";
// Splitter exports
export * from "./splitter/index.js";
// Utils exports (excluding validateStylePreservation which conflicts with gemini/validator)
export {
  cleanupEmptyLines,
  decodeHtmlEntities,
  encodeHtmlEntities,
  extractImagePaths,
  extractStyles,
  isValidImagePath,
  normalizeCardTitle,
  normalizeLineBreaks,
} from "./utils/formatters.js";
// Validator exports
export * from "./validator/index.js";
