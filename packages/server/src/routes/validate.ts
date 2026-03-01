/**
 * Validate API - 카드 내용 검증
 */

import {
  type CardForComparison,
  type CardForContext,
  checkContext,
  checkFacts,
  checkFreshness,
  checkSimilarity,
  extractTextField,
  getDeckNotes,
  getNoteById,
  type LLMModelId,
  type LLMProviderName,
  NotFoundError,
  ValidationError,
} from "@anki-splitter/core";
import { Hono } from "hono";

const validate = new Hono();

/**
 * POST /api/validate/fact-check
 * 카드 내용 팩트 체크
 */
validate.post("/fact-check", async (c) => {
  const { noteId, thorough, provider, model } = await c.req.json<{
    noteId: number;
    thorough?: boolean;
    provider?: string;
    model?: string;
  }>();

  if (!noteId) {
    throw new ValidationError("noteId가 필요합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const modelId: LLMModelId | undefined = provider
    ? {
        provider: provider as LLMProviderName,
        model: model ?? "gemini-2.0-flash",
      }
    : undefined;
  const result = await checkFacts(text, { thorough, modelId });

  return c.json({ noteId, result });
});

/**
 * POST /api/validate/freshness
 * 카드 내용 최신성 검사
 */
validate.post("/freshness", async (c) => {
  const { noteId, checkDate, provider, model } = await c.req.json<{
    noteId: number;
    checkDate?: string;
    provider?: string;
    model?: string;
  }>();

  if (!noteId) {
    throw new ValidationError("noteId가 필요합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const modelId: LLMModelId | undefined = provider
    ? {
        provider: provider as LLMProviderName,
        model: model ?? "gemini-2.0-flash",
      }
    : undefined;
  const result = await checkFreshness(text, { checkDate, modelId });

  return c.json({ noteId, result });
});

/**
 * POST /api/validate/similarity
 * 카드 유사성 검사
 */
validate.post("/similarity", async (c) => {
  const { noteId, deckName, threshold, maxResults, useEmbedding } =
    await c.req.json<{
      noteId: number;
      deckName: string;
      threshold?: number;
      maxResults?: number;
      useEmbedding?: boolean;
    }>();

  if (!noteId || !deckName) {
    throw new ValidationError("noteId와 deckName이 필요합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const targetText = extractTextField(note);
  const allNotes = await getDeckNotes(deckName);
  const allCards: CardForComparison[] = allNotes.map((n) => ({
    noteId: n.noteId,
    text: extractTextField(n),
  }));

  const result = await checkSimilarity({ noteId, text: targetText }, allCards, {
    threshold,
    maxResults,
    useEmbedding,
    deckName,
  });

  return c.json({ noteId, result });
});

/**
 * POST /api/validate/context
 * 문맥 일관성 검사
 */
validate.post("/context", async (c) => {
  const {
    noteId,
    includeReverseLinks,
    maxRelatedCards,
    thorough,
    provider,
    model,
  } = await c.req.json<{
    noteId: number;
    includeReverseLinks?: boolean;
    maxRelatedCards?: number;
    thorough?: boolean;
    provider?: string;
    model?: string;
  }>();

  if (!noteId) {
    throw new ValidationError("noteId가 필요합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const targetCard: CardForContext = { noteId, text, tags: note.tags };
  const modelId: LLMModelId | undefined = provider
    ? {
        provider: provider as LLMProviderName,
        model: model ?? "gemini-2.0-flash",
      }
    : undefined;

  const result = await checkContext(targetCard, {
    includeReverseLinks,
    maxRelatedCards,
    thorough,
    modelId,
  });

  return c.json({ noteId, result });
});

/**
 * POST /api/validate/all
 * 모든 검증 수행
 */
validate.post("/all", async (c) => {
  const { noteId, deckName } = await c.req.json<{
    noteId: number;
    deckName: string;
  }>();

  if (!noteId || !deckName) {
    throw new ValidationError("noteId와 deckName이 필요합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);

  const [factCheckResult, freshnessResult, similarityResult, contextResult] =
    await Promise.all([
      checkFacts(text),
      checkFreshness(text),
      (async () => {
        const allNotes = await getDeckNotes(deckName);
        const allCards: CardForComparison[] = allNotes.map((n) => ({
          noteId: n.noteId,
          text: extractTextField(n),
        }));
        return checkSimilarity({ noteId, text }, allCards);
      })(),
      (async () => {
        const targetCard: CardForContext = {
          noteId,
          text,
          tags: note.tags,
        };
        return checkContext(targetCard, { includeReverseLinks: true });
      })(),
    ]);

  const results = [
    factCheckResult,
    freshnessResult,
    similarityResult,
    contextResult,
  ];
  let overallStatus: "valid" | "warning" | "error" | "unknown" = "valid";

  if (results.some((r) => r.status === "error")) {
    overallStatus = "error";
  } else if (results.some((r) => r.status === "warning")) {
    overallStatus = "warning";
  } else if (results.some((r) => r.status === "unknown")) {
    overallStatus = "unknown";
  }

  return c.json({
    noteId,
    overallStatus,
    results: {
      factCheck: factCheckResult,
      freshness: freshnessResult,
      similarity: similarityResult,
      context: contextResult,
    },
    validatedAt: new Date().toISOString(),
  });
});

export default validate;
