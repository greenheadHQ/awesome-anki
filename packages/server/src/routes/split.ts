/**
 * Split API Routes
 */

import {
  applySplitResult,
  cloneSchedulingAfterSplit,
  extractTags,
  extractTextField,
  findCardsByNote,
  getNoteById,
  performHardSplit,
  preBackup,
  requestCardSplit,
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
  try {
    const { noteId, useGemini = false } = await c.req.json<{
      noteId: number;
      useGemini?: boolean;
    }>();

    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: "Note not found" }, 404);
    }

    const text = extractTextField(note);
    const tags = extractTags(note);

    // Hard Split 먼저 시도
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
        })),
        mainCardIndex: hardResult.findIndex((c) => c.isMainCard),
      });
    }

    // Soft Split (Gemini) 요청 시
    if (useGemini) {
      const geminiResult = await requestCardSplit({ noteId, text, tags });

      if (geminiResult.shouldSplit && geminiResult.splitCards.length > 1) {
        return c.json({
          noteId,
          splitType: "soft",
          originalText: text,
          splitCards: geminiResult.splitCards.map((card, idx) => ({
            title: card.title,
            content: card.content,
            isMainCard: idx === geminiResult.mainCardIndex,
          })),
          mainCardIndex: geminiResult.mainCardIndex,
          splitReason: geminiResult.splitReason,
        });
      }

      return c.json({
        noteId,
        splitType: "none",
        reason:
          geminiResult.splitReason || "Gemini determined split is not needed",
      });
    }

    return c.json({
      noteId,
      splitType: "none",
      reason: "Hard split not applicable. Enable useGemini for soft split.",
    });
  } catch (error) {
    console.error("Error in split preview:", error);
    return c.json({ error: "Failed to generate split preview" }, 500);
  }
});

/**
 * POST /api/split/apply
 * 분할 적용
 */
app.post("/apply", async (c) => {
  try {
    const { noteId, deckName, splitCards, mainCardIndex } = await c.req.json<{
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
    }>();

    // 1. 백업 생성
    const { backupId } = await preBackup(deckName, noteId, "soft");

    // 2. 분할 결과 구성
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
      splitType: "soft",
    };

    // 3. 분할 적용
    const applied = await applySplitResult(deckName, splitResult, []);

    // 4. 백업 업데이트
    updateBackupWithCreatedNotes(backupId, applied.newNoteIds);

    // 5. 학습 데이터 복제
    const newCardIds: number[] = [];
    for (const nid of applied.newNoteIds) {
      const cardIds = await findCardsByNote(nid);
      newCardIds.push(...cardIds);
    }
    if (newCardIds.length > 0) {
      await cloneSchedulingAfterSplit(noteId, newCardIds);
    }

    return c.json({
      success: true,
      backupId,
      mainNoteId: applied.mainNoteId,
      newNoteIds: applied.newNoteIds,
    });
  } catch (error) {
    console.error("Error applying split:", error);
    return c.json({ error: "Failed to apply split" }, 500);
  }
});

export default app;
