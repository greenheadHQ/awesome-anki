/**
 * Split API Routes
 */

import { randomUUID } from "node:crypto";
import {
  applySplitResult,
  cloneSchedulingAfterSplit,
  detectCardType,
  extractTags,
  extractTextField,
  findCardsByNote,
  getActiveVersion,
  getNoteById,
  getPromptVersion,
  getRemoteSystemPromptPayload,
  NotFoundError,
  preBackup,
  recordPromptMetricsEvent,
  requestCardSplit,
  rollback,
  type SplitResult,
  sync,
  updateBackupWithCreatedNotes,
  ValidationError,
} from "@anki-splitter/core";
import { Hono } from "hono";
import {
  getSplitHistoryStore,
  HistorySessionNotFoundError,
} from "../history/store.js";
import type { SplitCardPayload } from "../history/types.js";

const app = new Hono();

function mapPreviewCards(
  cards: Array<{
    title: string;
    content: string;
    isMainCard?: boolean;
    cardType?: "cloze" | "basic";
    charCount?: number;
  }>,
): SplitCardPayload[] {
  return cards.map((card) => ({
    title: card.title,
    content: card.content,
    isMainCard: card.isMainCard,
    cardType: card.cardType,
    charCount: card.charCount,
  }));
}

function mapApplyCards(
  cards: Array<{
    title: string;
    content: string;
  }>,
): SplitCardPayload[] {
  return cards.map((card) => ({
    title: card.title,
    content: card.content,
  }));
}

/**
 * POST /api/split/preview
 * 분할 미리보기
 */
app.post("/preview", async (c) => {
  const {
    noteId,
    versionId,
    deckName = "",
  } = await c.req.json<{
    noteId: number;
    versionId?: string;
    deckName?: string;
  }>();

  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const tags = extractTags(note);

  let promptVersionId: string;
  if (versionId) {
    promptVersionId = versionId;
  } else {
    const activeVersionInfo = await getActiveVersion();
    if (!activeVersionInfo) {
      throw new ValidationError("분할에는 활성 프롬프트 버전이 필요합니다.");
    }
    promptVersionId = activeVersionInfo.versionId;
  }

  let sessionId: string | undefined;
  let historyWarning: string | undefined;

  try {
    const historyStore = await getSplitHistoryStore();
    sessionId = historyStore.createSession({
      noteId,
      deckName,
      promptVersionId,
      originalText: text,
      originalTags: tags,
    }).sessionId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    historyWarning = `히스토리 세션 생성 실패: ${message}`;
    // History가 비가용이어도 apply 플로우는 유지한다.
    sessionId = randomUUID();
  }

  try {
    const resolvedVersion = await getPromptVersion(promptVersionId);
    if (!resolvedVersion) {
      const versionNotFoundMessage = `프롬프트 버전 '${promptVersionId}'을 찾을 수 없습니다.`;
      if (sessionId) {
        try {
          const historyStore = await getSplitHistoryStore();
          historyStore.markError(sessionId, {
            errorMessage: versionNotFoundMessage,
          });
        } catch (historyError) {
          const message =
            historyError instanceof Error
              ? historyError.message
              : String(historyError);
          historyWarning = historyWarning
            ? `${historyWarning}; ${message}`
            : `히스토리 기록 실패: ${message}`;
        }
      }

      return c.json(
        {
          error: versionNotFoundMessage,
          requestedVersionId: promptVersionId,
          ...(historyWarning && { historyWarning }),
        },
        404,
      );
    }

    const remoteSystemPrompt = await getRemoteSystemPromptPayload();
    if (!remoteSystemPrompt) {
      const remotePromptMissingMessage =
        "원격 systemPrompt가 초기화되지 않았습니다. /api/prompts/system에서 먼저 설정하세요.";
      if (sessionId) {
        try {
          const historyStore = await getSplitHistoryStore();
          historyStore.markError(sessionId, {
            errorMessage: remotePromptMissingMessage,
          });
        } catch (historyError) {
          const message =
            historyError instanceof Error
              ? historyError.message
              : String(historyError);
          historyWarning = historyWarning
            ? `${historyWarning}; ${message}`
            : `히스토리 기록 실패: ${message}`;
        }
      }

      return c.json(
        {
          error: remotePromptMissingMessage,
          ...(historyWarning && { historyWarning }),
        },
        503,
      );
    }

    const prompts = {
      systemPrompt: remoteSystemPrompt.systemPrompt,
      splitPromptTemplate: resolvedVersion.splitPromptTemplate,
    };

    const startTime = Date.now();
    const geminiResult = await requestCardSplit(
      { noteId, text, tags },
      prompts,
    );
    const executionTimeMs = Date.now() - startTime;

    if (geminiResult.shouldSplit && geminiResult.splitCards.length > 1) {
      const splitCards = geminiResult.splitCards.map((card, idx) => ({
        title: card.title,
        content: card.content,
        isMainCard: idx === geminiResult.mainCardIndex,
        cardType: card.cardType ?? detectCardType(card.content),
        charCount: card.charCount,
      }));

      if (sessionId) {
        try {
          const historyStore = await getSplitHistoryStore();
          historyStore.markGenerated(sessionId, {
            splitCards: mapPreviewCards(splitCards),
            aiResponse: geminiResult as unknown as Record<string, unknown>,
            splitReason: geminiResult.splitReason,
            executionTimeMs,
            aiModel: geminiResult.modelName,
            tokenUsage: geminiResult.tokenUsage,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          historyWarning = historyWarning
            ? `${historyWarning}; ${message}`
            : `히스토리 기록 실패: ${message}`;
        }
      }

      return c.json({
        sessionId,
        noteId,
        originalText: text,
        splitCards,
        mainCardIndex: geminiResult.mainCardIndex,
        splitReason: geminiResult.splitReason,
        executionTimeMs,
        tokenUsage: geminiResult.tokenUsage,
        aiModel: geminiResult.modelName,
        ...(historyWarning && { historyWarning }),
      });
    }

    if (sessionId) {
      try {
        const historyStore = await getSplitHistoryStore();
        historyStore.markNotSplit(sessionId, {
          splitReason:
            geminiResult.splitReason || "분할이 필요하지 않다고 판단했습니다.",
          executionTimeMs,
          aiModel: geminiResult.modelName,
          tokenUsage: geminiResult.tokenUsage,
          aiResponse: geminiResult as unknown as Record<string, unknown>,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        historyWarning = historyWarning
          ? `${historyWarning}; ${message}`
          : `히스토리 기록 실패: ${message}`;
      }
    }

    return c.json({
      sessionId,
      noteId,
      reason:
        geminiResult.splitReason || "분할이 필요하지 않다고 판단했습니다.",
      executionTimeMs,
      tokenUsage: geminiResult.tokenUsage,
      aiModel: geminiResult.modelName,
      ...(historyWarning && { historyWarning }),
    });
  } catch (error) {
    if (sessionId) {
      try {
        const historyStore = await getSplitHistoryStore();
        const message = error instanceof Error ? error.message : String(error);
        historyStore.markError(sessionId, { errorMessage: message });
      } catch {
        // Split 실패 에러를 덮어쓰지 않음
      }
    }
    throw error;
  }
});

/**
 * POST /api/split/apply
 * 분할 적용 (자동 롤백 포함)
 */
app.post("/apply", async (c) => {
  const { sessionId, noteId, deckName, splitCards, mainCardIndex } =
    await c.req.json<{
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
    }>();

  if (!sessionId) {
    throw new ValidationError("sessionId가 필요합니다.");
  }

  let backupId: string | undefined;
  let syncResult: { success: boolean; syncedAt?: string; error?: string } = {
    success: false,
    error: "sync not attempted",
  };

  let historyWarning: string | undefined;

  try {
    // Critical Step 1: 백업 생성
    const backup = await preBackup(deckName, noteId);
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
    };

    const applied = await applySplitResult(deckName, splitResult, []);

    // Critical Step 3: 백업 업데이트
    await updateBackupWithCreatedNotes(backupId, applied.newNoteIds);

    // Non-critical: Sync Server 전파 (실패해도 split 결과는 유지)
    try {
      await sync();
      syncResult = { success: true, syncedAt: new Date().toISOString() };
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : String(syncError);
      syncResult = { success: false, error: message };
      console.warn("Anki sync failed after split apply:", message);
    }

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

    // Non-critical: 이력/메트릭 업데이트 (실패해도 split 결과는 유지)
    try {
      const historyStore = await getSplitHistoryStore();
      const persistedCards = mapApplyCards(splitCards);
      historyStore.markApplied(sessionId, {
        splitCards: persistedCards,
      });

      const metadata = historyStore.getSessionMetadata(sessionId);
      if (metadata?.promptVersionId) {
        await recordPromptMetricsEvent({
          promptVersionId: metadata.promptVersionId,
          userAction: "approved",
          splitCards: metadata.splitCards,
        });
      }
    } catch (historyError) {
      const message =
        historyError instanceof Error
          ? historyError.message
          : String(historyError);
      historyWarning = `히스토리 업데이트 실패: ${message}`;
      console.warn(historyWarning);
    }

    return c.json({
      success: true,
      backupId,
      mainNoteId: applied.mainNoteId,
      newNoteIds: applied.newNoteIds,
      syncResult,
      ...(schedulingWarning && { warning: schedulingWarning }),
      ...(historyWarning && { historyWarning }),
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

    try {
      const historyStore = await getSplitHistoryStore();
      const message = error instanceof Error ? error.message : String(error);
      historyStore.markError(sessionId, { errorMessage: message });
    } catch {
      // apply 에러를 덮어쓰지 않음
    }

    throw error;
  }
});

/**
 * POST /api/split/reject
 * 분할 결과 반려
 */
app.post("/reject", async (c) => {
  const { sessionId, rejectionReason } = await c.req.json<{
    sessionId: string;
    rejectionReason: string;
  }>();

  if (!sessionId || !rejectionReason?.trim()) {
    throw new ValidationError("sessionId, rejectionReason이 필요합니다.");
  }

  let historyStore: Awaited<ReturnType<typeof getSplitHistoryStore>>;
  try {
    historyStore = await getSplitHistoryStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      { error: `히스토리 저장소를 사용할 수 없습니다: ${message}` },
      503,
    );
  }
  try {
    historyStore.markRejected(sessionId, {
      rejectionReason: rejectionReason.trim(),
    });
  } catch (error) {
    if (error instanceof HistorySessionNotFoundError) {
      return c.json(
        { error: `히스토리 세션 ${sessionId}를 찾을 수 없습니다.` },
        404,
      );
    }
    throw error;
  }

  let historyWarning: string | undefined;
  try {
    const metadata = historyStore.getSessionMetadata(sessionId);
    if (metadata?.promptVersionId) {
      await recordPromptMetricsEvent({
        promptVersionId: metadata.promptVersionId,
        userAction: "rejected",
        splitCards: metadata.splitCards,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    historyWarning = `프롬프트 메트릭 갱신 실패: ${message}`;
    console.warn(historyWarning);
  }

  return c.json({
    success: true,
    sessionId,
    ...(historyWarning && { historyWarning }),
  });
});

export default app;
