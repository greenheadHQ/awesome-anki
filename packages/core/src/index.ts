// @anki-splitter/core - Main entry point

// Anki exports
export {
  ankiConnect,
  getVersion,
  getProfiles,
  getDeckNames,
  getModelNames,
  getModelFieldNames,
  findNotes,
  getNotesInfo,
  updateNoteFields,
  addNote,
  addNotes,
  addTags,
  deleteNotes,
  sync,
  type NoteInfo,
  type NoteFields,
} from './anki/client.js';

export {
  getDeckNotes,
  getNoteById,
  updateMainCard,
  addSplitCards,
  applySplitResult,
  extractTextField,
  extractTags,
  type SplitCard,
  type SplitResult,
} from './anki/operations.js';

export {
  createBackup,
  preBackup,
  updateBackupWithCreatedNotes,
  rollback,
  listBackups,
  getLatestBackupId,
  type BackupEntry,
} from './anki/backup.js';

export {
  getCardSchedulingInfo,
  getFullCardInfo,
  findCardsByNote,
  setCardScheduling,
  copySchedulingToNewCards,
  cloneSchedulingAfterSplit,
  type CardSchedulingInfo,
  type FullCardInfo,
} from './anki/scheduling.js';

// Gemini exports
export {
  requestCardSplit,
  requestBatchCardSplit,
  analyzeCardForSplit,
  type CardForSplit,
} from './gemini/client.js';

export {
  SYSTEM_PROMPT,
  buildSplitPrompt,
  buildAnalysisPrompt,
} from './gemini/prompts.js';

export {
  validateSplitResponse,
  validateAnalysisResponse,
  validateClozePresence,
  validateAllCardsHaveCloze,
  validateStylePreservation,
  type SplitResponse,
  type AnalysisResponse,
} from './gemini/validator.js';

export {
  BINARY_PATTERNS,
  extractClozeValue,
  hasHint,
  detectBinaryPattern,
  addHintToCloze,
  analyzeClozes,
  enhanceCardsWithHints,
  countCardChars,
  detectCardType,
  checkCardQuality,
  type BinaryPattern,
  type ClozeAnalysis,
  type CardQualityCheck,
} from './gemini/cloze-enhancer.js';

// Parser exports
export * from './parser/index.js';

// Splitter exports
export * from './splitter/index.js';

// Utils exports (excluding validateStylePreservation which conflicts with gemini/validator)
export {
  extractStyles,
  decodeHtmlEntities,
  encodeHtmlEntities,
  normalizeLineBreaks,
  cleanupEmptyLines,
  normalizeCardTitle,
  extractImagePaths,
  isValidImagePath,
} from './utils/formatters.js';

export {
  createLineDiff,
  createWordDiff,
  printSplitPreview,
  printBatchAnalysis,
  printProgress,
  type DiffResult,
} from './utils/diff-viewer.js';

// Validator exports
export * from './validator/index.js';

// Embedding exports
export * from './embedding/index.js';

// Prompt Version exports (명시적 export - getVersion 충돌 방지)
export {
  // Types
  type FewShotExample,
  type PromptConfig,
  type PromptMetrics,
  type ModificationPatterns,
  type PromptVersion,
  type SplitHistoryEntry,
  type Experiment,
  type ActiveVersionInfo,
  // Constants
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_METRICS,
  DEFAULT_MODIFICATION_PATTERNS,
} from './prompt-version/types.js';

export {
  // Version management (renamed to avoid conflict with anki/client.ts getVersion)
  listVersions as listPromptVersions,
  getVersion as getPromptVersion,
  saveVersion as savePromptVersion,
  deleteVersion as deletePromptVersion,
  createVersion as createPromptVersion,
  // Active version
  getActiveVersion,
  setActiveVersion,
  getActivePrompts,
  // History
  addHistoryEntry,
  getHistory,
  getHistoryByVersion,
  // Experiments
  createExperiment,
  listExperiments,
  getExperiment,
  completeExperiment,
  // Analysis
  analyzeFailurePatterns,
} from './prompt-version/storage.js';
