/**
 * Split API Routes
 */

import {
  applySplitResult,
  cloneSchedulingAfterSplit,
  detectCardType,
  extractTags,
  extractTextField,
  findCardsByNote,
  getNoteById,
  getPromptVersion,
  NotFoundError,
  performHardSplit,
  preBackup,
  requestCardSplit,
  rollback,
  type SplitResult,
  updateBackupWithCreatedNotes,
} from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * POST /api/split/preview
 * 분할 미리보기
 */
app.post("/preview", async (c) => {
  const {
    noteId,
    useGemini = false,
    versionId,
  } = await c.req.json<{
    noteId: number;
    useGemini?: boolean;
    versionId?: string;
  }>();

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const tags = extractTags(note);

  // Hard Split 먼저 시도 (versionId 무관)
  if (!useGemini) {
    const hardResult = performHardSplit(text, noteId);
    if (hardResult && hardResult.length > 1) {
      return c.json({
        noteId,
        splitType: "hard",
        originalText: text,
        splitCards: hardResult.map((card) => ({
          title: card.title,
          content: card.content,
          isMainCard: card.isMainCard,
          cardType: detectCardType(card.content),
        })),
        mainCardIndex: hardResult.findIndex((card) => card.isMainCard),
      });
    }

    return c.json({
      noteId,
      splitType: "none",
      reason:
        "하드 분할을 적용할 수 없습니다. 소프트 분할을 사용하려면 useGemini를 활성화하세요.",
    });
  }

  // Soft Split (Gemini) 요청 — 프롬프트 버전 resolve
  let prompts:
    | { systemPrompt: string; splitPromptTemplate: string }
    | undefined;
  if (versionId) {
    const version = await getPromptVersion(versionId);
    if (!version) {
      return c.json(
        {
          error: `프롬프트 버전 '${versionId}'을 찾을 수 없습니다.`,
          requestedVersionId: versionId,
        },
        404,
      );
    }
    prompts = {
      systemPrompt: version.systemPrompt,
      splitPromptTemplate: version.splitPromptTemplate,
    };
  }

  const startTime = Date.now();
  const geminiResult = await requestCardSplit({ noteId, text, tags }, prompts);
  const executionTimeMs = Date.now() - startTime;

  if (geminiResult.shouldSplit && geminiResult.splitCards.length > 1) {
    return c.json({
      noteId,
      splitType: "soft",
      originalText: text,
      splitCards: geminiResult.splitCards.map((card, idx) => ({
        title: card.title,
        content: card.content,
        isMainCard: idx === geminiResult.mainCardIndex,
        cardType: card.cardType ?? detectCardType(card.content),
        charCount: card.charCount,
      })),
      mainCardIndex: geminiResult.mainCardIndex,
      splitReason: geminiResult.splitReason,
      executionTimeMs,
      tokenUsage: geminiResult.tokenUsage,
      aiModel: geminiResult.modelName,
    });
  }

  return c.json({
    noteId,
    splitType: "none",
    reason:
      geminiResult.splitReason ||
      "Gemini에서 분할이 필요하지 않다고 판단했습니다.",
    executionTimeMs,
    tokenUsage: geminiResult.tokenUsage,
    aiModel: geminiResult.modelName,
  });
});

/**
 * POST /api/split/apply
 * 분할 적용 (자동 롤백 포함)
 */
app.post("/apply", async (c) => {
  const {
    noteId,
    deckName,
    splitCards,
    mainCardIndex,
    splitType = "soft",
  } = await c.req.json<{
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
  }>();

  let backupId: string | undefined;

  try {
    // Critical Step 1: 백업 생성
    const backup = await preBackup(deckName, noteId, splitType);
    backupId = backup.backupId;

    // Critical Step 2: 분할 적용
    const splitResult: SplitResult = {
      originalNoteId: noteId,
      mainCardIndex,
      splitCards: splitCards.map((card) => ({
        title: card.title,
        content: card.content,
        inheritImages: card.inheritImages || [],
        inheritTags: card.inheritTags || [],
        preservedLinks: card.preservedLinks || [],
        backLinks: card.backLinks || [],
      })),
      splitReason: "",
      splitType,
    };

    const applied = await applySplitResult(deckName, splitResult, []);

    // Critical Step 3: 백업 업데이트
    await updateBackupWithCreatedNotes(backupId, applied.newNoteIds);

    // Non-critical: 학습 데이터 복제 (실패해도 롤백하지 않음)
    let schedulingWarning: string | undefined;
    try {
      const newCardIds: number[] = [];
      for (const nid of applied.newNoteIds) {
        const cardIds = await findCardsByNote(nid);
        newCardIds.push(...cardIds);
      }
      if (newCardIds.length > 0) {
        await cloneSchedulingAfterSplit(noteId, newCardIds);
      }
    } catch (schedError) {
      schedulingWarning = "스케줄링 복제 실패 (카드 분할은 정상 완료)";
      console.warn(schedulingWarning, schedError);
    }

    return c.json({
      success: true,
      backupId,
      splitType,
      mainNoteId: applied.mainNoteId,
      newNoteIds: applied.newNoteIds,
      ...(schedulingWarning && { warning: schedulingWarning }),
    });
  } catch (error) {
    // Critical step 실패 → 자동 롤백
    if (backupId) {
      try {
        await rollback(backupId);
      } catch (rollbackErr) {
        console.error("자동 롤백 실패:", rollbackErr);
      }
    }
    throw error;
  }
});

export default app;
