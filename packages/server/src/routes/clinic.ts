/**
 * Clinic API — 카드 검증 + 수정 액션
 *
 * Phase 1 (validate) 기반 + Phase 2 확장:
 * - 6종 검증 (fact-check, freshness, similarity, context, verbose, yagni)
 * - fix/apply 엔드포인트 (YAGNI 제거, 팩트 정정 적용)
 */

import {
  type CardForComparison,
  type CardForContext,
  checkContext,
  checkFacts,
  checkFreshness,
  checkSimilarity,
  checkVerbose,
  checkYagni,
  extractTextField,
  getDeckNotes,
  getNoteById,
  type NoteInfo,
  NotFoundError,
  preBackup,
  sync,
  updateNoteFields,
  ValidationError,
} from "@anki-splitter/core";
import { Hono } from "hono";

import { resolveModelId } from "../lib/resolve-model.js";

const clinic = new Hono();

// --- Helper ---

const MAX_FIXED_CONTENT_LENGTH = 1_000_000; // 1MB

/**
 * noteId 검증 + 노트 조회 헬퍼
 * DA CLEAN_CODE 수용: 보일러플레이트 추출
 */
async function validateAndFetchNote(noteId: unknown): Promise<{ noteId: number; note: NoteInfo; text: string }> {
  if (typeof noteId !== "number" || !Number.isInteger(noteId) || noteId <= 0) {
    throw new ValidationError("noteId는 양의 정수여야 합니다");
  }

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  return { noteId, note, text: extractTextField(note) };
}

// --- 검증 엔드포인트 ---

/**
 * POST /api/clinic/fact-check
 */
clinic.post("/fact-check", async (c) => {
  const { noteId, thorough, provider, model } = await c.req.json<{
    noteId: number;
    thorough?: boolean;
    provider?: string;
    model?: string;
  }>();

  const { noteId: validId, text } = await validateAndFetchNote(noteId);
  const modelId = resolveModelId(provider, model);
  const result = await checkFacts(text, { thorough, modelId });

  return c.json({ noteId: validId, result });
});

/**
 * POST /api/clinic/freshness
 */
clinic.post("/freshness", async (c) => {
  const { noteId, checkDate, provider, model } = await c.req.json<{
    noteId: number;
    checkDate?: string;
    provider?: string;
    model?: string;
  }>();

  const { noteId: validId, text } = await validateAndFetchNote(noteId);
  const modelId = resolveModelId(provider, model);
  const result = await checkFreshness(text, { checkDate, modelId });

  return c.json({ noteId: validId, result });
});

/**
 * POST /api/clinic/similarity
 */
clinic.post("/similarity", async (c) => {
  const { noteId, deckName, threshold, maxResults, useEmbedding } = await c.req.json<{
    noteId: number;
    deckName: string;
    threshold?: number;
    maxResults?: number;
    useEmbedding?: boolean;
  }>();

  if (!deckName) {
    throw new ValidationError("deckName이 필요합니다");
  }

  const { noteId: validId, text: targetText } = await validateAndFetchNote(noteId);
  const allNotes = await getDeckNotes(deckName);
  const allCards: CardForComparison[] = allNotes.map((n) => ({
    noteId: n.noteId,
    text: extractTextField(n),
  }));

  const result = await checkSimilarity({ noteId: validId, text: targetText }, allCards, {
    threshold,
    maxResults,
    useEmbedding,
    deckName,
  });

  return c.json({ noteId: validId, result });
});

/**
 * POST /api/clinic/context
 */
clinic.post("/context", async (c) => {
  const { noteId, includeReverseLinks, maxRelatedCards, thorough, provider, model } =
    await c.req.json<{
      noteId: number;
      includeReverseLinks?: boolean;
      maxRelatedCards?: number;
      thorough?: boolean;
      provider?: string;
      model?: string;
    }>();

  const { noteId: validId, note, text } = await validateAndFetchNote(noteId);
  const targetCard: CardForContext = { noteId: validId, text, tags: note.tags };
  const modelId = resolveModelId(provider, model);

  const result = await checkContext(targetCard, {
    includeReverseLinks,
    maxRelatedCards,
    thorough,
    modelId,
  });

  return c.json({ noteId: validId, result });
});

/**
 * POST /api/clinic/verbose
 */
clinic.post("/verbose", async (c) => {
  const { noteId, provider, model } = await c.req.json<{
    noteId: number;
    provider?: string;
    model?: string;
  }>();

  const { noteId: validId, text } = await validateAndFetchNote(noteId);
  const modelId = resolveModelId(provider, model);
  const result = await checkVerbose(text, { modelId });

  return c.json({ noteId: validId, result });
});

/**
 * POST /api/clinic/yagni
 * YAGNI 감지 — 학습 ROI 낮은 Cloze 식별
 */
clinic.post("/yagni", async (c) => {
  const { noteId, provider, model } = await c.req.json<{
    noteId: number;
    provider?: string;
    model?: string;
  }>();

  const { noteId: validId, text } = await validateAndFetchNote(noteId);
  const modelId = resolveModelId(provider, model);
  const result = await checkYagni(text, { modelId });

  return c.json({ noteId: validId, result });
});

// --- 액션 엔드포인트 ---

/**
 * POST /api/clinic/fix/apply
 * 검증 결과 기반 카드 수정 적용
 *
 * 프론트엔드에서 in-memory로 YAGNI 제거 + 팩트 정정을 누적한 최종 텍스트를 전달받아
 * 1회 Anki 업데이트를 수행한다.
 */
clinic.post("/fix/apply", async (c) => {
  const { noteId, fixedContent, deckName } = await c.req.json<{
    noteId: number;
    fixedContent: string;
    deckName: string;
  }>();

  // 입력 검증
  const { noteId: validId } = await validateAndFetchNote(noteId);

  if (!fixedContent || typeof fixedContent !== "string") {
    throw new ValidationError("fixedContent가 필요합니다");
  }
  if (fixedContent.length > MAX_FIXED_CONTENT_LENGTH) {
    throw new ValidationError(`fixedContent가 너무 깁니다 (최대 ${MAX_FIXED_CONTENT_LENGTH}자)`);
  }
  if (!deckName) {
    throw new ValidationError("deckName이 필요합니다");
  }

  // 백업 생성
  const { backupId } = await preBackup(deckName, validId);

  // 카드 수정
  await updateNoteFields(validId, { Text: fixedContent });

  // 동기화 (비필수 — 실패 시 warning)
  let syncWarning: string | undefined;
  try {
    await sync();
  } catch {
    syncWarning = "카드 수정은 완료되었으나 Anki 동기화에 실패했습니다. 수동 동기화가 필요할 수 있습니다.";
  }

  return c.json({
    success: true,
    backupId,
    ...(syncWarning && { warning: syncWarning }),
  });
});

// --- 통합 검증 ---

/**
 * POST /api/clinic/all
 * 6종 검증 일괄 수행
 */
clinic.post("/all", async (c) => {
  const { noteId, deckName, provider, model } = await c.req.json<{
    noteId: number;
    deckName: string;
    provider?: string;
    model?: string;
  }>();

  if (!deckName) {
    throw new ValidationError("deckName이 필요합니다");
  }

  const { noteId: validId, note, text } = await validateAndFetchNote(noteId);
  const modelId = resolveModelId(provider, model);

  const [factCheckResult, freshnessResult, similarityResult, contextResult, verboseResult, yagniResult] =
    await Promise.all([
      checkFacts(text, { modelId }),
      checkFreshness(text, { modelId }),
      (async () => {
        const allNotes = await getDeckNotes(deckName);
        const allCards: CardForComparison[] = allNotes.map((n) => ({
          noteId: n.noteId,
          text: extractTextField(n),
        }));
        return checkSimilarity({ noteId: validId, text }, allCards);
      })(),
      (async () => {
        const targetCard: CardForContext = {
          noteId: validId,
          text,
          tags: note.tags,
        };
        return checkContext(targetCard, { includeReverseLinks: true, modelId });
      })(),
      checkVerbose(text, { modelId }),
      checkYagni(text, { modelId }),
    ]);

  // overallStatus: verbose와 yagni는 제외 (액션 전용, SplitWorkspace/CardBrowser backward compat)
  const statusResults = [factCheckResult, freshnessResult, similarityResult, contextResult];
  let overallStatus: "valid" | "warning" | "error" | "unknown" = "valid";

  if (statusResults.some((r) => r.status === "error")) {
    overallStatus = "error";
  } else if (statusResults.some((r) => r.status === "warning")) {
    overallStatus = "warning";
  } else if (statusResults.some((r) => r.status === "unknown")) {
    overallStatus = "unknown";
  }

  return c.json({
    noteId: validId,
    overallStatus,
    results: {
      factCheck: factCheckResult,
      freshness: freshnessResult,
      similarity: similarityResult,
      context: contextResult,
      verbose: verboseResult,
      yagni: yagniResult,
    },
    validatedAt: new Date().toISOString(),
  });
});

export default clinic;
