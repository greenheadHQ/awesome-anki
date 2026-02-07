/**
 * Embedding API - 임베딩 생성 및 관리
 */

import {
  cleanupCache,
  createCache,
  deleteCache,
  extractTextField,
  getCachedEmbedding,
  getCacheStatus,
  getDeckNotes,
  getEmbedding,
  getTextHash,
  loadCache,
  preprocessTextForEmbedding,
  saveCache,
  setCachedEmbedding,
} from "@anki-splitter/core";
import { Hono } from "hono";

const embedding = new Hono();

/**
 * POST /api/embedding/generate
 * 덱 전체 임베딩 생성 (증분 업데이트)
 */
embedding.post("/generate", async (c) => {
  try {
    const { deckName, forceRegenerate } = await c.req.json<{
      deckName: string;
      forceRegenerate?: boolean;
    }>();

    if (!deckName) {
      return c.json({ error: "deckName is required" }, 400);
    }

    // 덱의 모든 노트 가져오기
    const notes = await getDeckNotes(deckName);
    if (notes.length === 0) {
      return c.json({ error: "No notes found in deck" }, 404);
    }

    // 캐시 로드 또는 생성
    let cache = loadCache(deckName);
    if (!cache || forceRegenerate) {
      cache = createCache(deckName, 768);
    }

    // 임베딩이 필요한 노트 필터링
    const notesToEmbed: { noteId: number; text: string; textHash: string }[] =
      [];
    const validNoteIds = new Set<number>();

    for (const note of notes) {
      validNoteIds.add(note.noteId);
      const text = extractTextField(note);
      const textHash = getTextHash(text);

      // 캐시에 없거나 텍스트가 변경된 경우
      const cached = getCachedEmbedding(cache, note.noteId, textHash);
      if (!cached) {
        notesToEmbed.push({ noteId: note.noteId, text, textHash });
      }
    }

    // 삭제된 노트 정리
    const removedCount = cleanupCache(cache, validNoteIds);

    // 새 임베딩 생성
    let generatedCount = 0;
    let errorCount = 0;

    for (const { noteId, text, textHash } of notesToEmbed) {
      try {
        const emb = await getEmbedding(text);
        setCachedEmbedding(cache, noteId, emb, textHash);
        generatedCount++;
      } catch (error) {
        console.error(`임베딩 생성 실패 (noteId: ${noteId}):`, error);
        errorCount++;
      }

      // Rate limit 대응
      if (generatedCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 캐시 저장
    saveCache(cache);

    return c.json({
      deckName,
      totalNotes: notes.length,
      cachedCount: Object.keys(cache.embeddings).length,
      generatedCount,
      skippedCount: notes.length - notesToEmbed.length,
      removedCount,
      errorCount,
      lastUpdated: new Date(cache.lastUpdated).toISOString(),
    });
  } catch (error) {
    console.error("Embedding generation error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * GET /api/embedding/status/:deckName
 * 임베딩 캐시 상태 확인
 */
embedding.get("/status/:deckName", async (c) => {
  try {
    const deckName = decodeURIComponent(c.req.param("deckName"));

    if (!deckName) {
      return c.json({ error: "deckName is required" }, 400);
    }

    const status = getCacheStatus(deckName);

    // 덱의 총 노트 수도 함께 반환
    let totalNotes = 0;
    try {
      const notes = await getDeckNotes(deckName);
      totalNotes = notes.length;
    } catch (_e) {
      // 덱을 찾을 수 없는 경우
    }

    return c.json({
      ...status,
      totalNotes,
      coverage:
        totalNotes > 0
          ? Math.round((status.totalEmbeddings / totalNotes) * 100)
          : 0,
    });
  } catch (error) {
    console.error("Embedding status error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * DELETE /api/embedding/cache/:deckName
 * 임베딩 캐시 삭제
 */
embedding.delete("/cache/:deckName", async (c) => {
  try {
    const deckName = decodeURIComponent(c.req.param("deckName"));

    if (!deckName) {
      return c.json({ error: "deckName is required" }, 400);
    }

    const deleted = deleteCache(deckName);

    return c.json({
      deckName,
      deleted,
      message: deleted ? "캐시가 삭제되었습니다." : "캐시가 존재하지 않습니다.",
    });
  } catch (error) {
    console.error("Cache delete error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/embedding/single
 * 단일 텍스트 임베딩 생성 (디버깅/테스트용)
 */
embedding.post("/single", async (c) => {
  try {
    const { text, preprocess } = await c.req.json<{
      text: string;
      preprocess?: boolean;
    }>();

    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }

    const processedText =
      preprocess !== false ? preprocessTextForEmbedding(text) : text;

    const emb = await getEmbedding(processedText);

    return c.json({
      originalLength: text.length,
      processedLength: processedText.length,
      dimension: emb.length,
      embedding: emb.slice(0, 10), // 처음 10개만 반환 (샘플)
      embeddingHash: getTextHash(emb.join(",")),
    });
  } catch (error) {
    console.error("Single embedding error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

export default embedding;
