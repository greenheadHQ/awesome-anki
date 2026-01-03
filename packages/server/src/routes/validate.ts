/**
 * Validate API - 카드 내용 검증
 */
import { Hono } from 'hono';
import {
  checkFacts,
  checkFreshness,
  checkSimilarity,
  checkContext,
  getNoteById,
  getDeckNotes,
  extractTextField,
  type CardForComparison,
  type CardForContext,
} from '@anki-splitter/core';

const validate = new Hono();

/**
 * POST /api/validate/fact-check
 * 카드 내용 팩트 체크
 */
validate.post('/fact-check', async (c) => {
  try {
    const { noteId, thorough } = await c.req.json<{
      noteId: number;
      thorough?: boolean;
    }>();

    if (!noteId) {
      return c.json({ error: 'noteId is required' }, 400);
    }

    // 카드 내용 가져오기
    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const text = extractTextField(note);

    // 팩트 체크 수행
    const result = await checkFacts(text, { thorough });

    return c.json({
      noteId,
      result,
    });
  } catch (error) {
    console.error('Fact check error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

/**
 * POST /api/validate/freshness
 * 카드 내용 최신성 검사
 */
validate.post('/freshness', async (c) => {
  try {
    const { noteId, checkDate } = await c.req.json<{
      noteId: number;
      checkDate?: string;
    }>();

    if (!noteId) {
      return c.json({ error: 'noteId is required' }, 400);
    }

    // 카드 내용 가져오기
    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const text = extractTextField(note);

    // 최신성 검사 수행
    const result = await checkFreshness(text, { checkDate });

    return c.json({
      noteId,
      result,
    });
  } catch (error) {
    console.error('Freshness check error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

/**
 * POST /api/validate/similarity
 * 카드 유사성 검사
 */
validate.post('/similarity', async (c) => {
  try {
    const { noteId, deckName, threshold, maxResults } = await c.req.json<{
      noteId: number;
      deckName: string;
      threshold?: number;
      maxResults?: number;
    }>();

    if (!noteId || !deckName) {
      return c.json({ error: 'noteId and deckName are required' }, 400);
    }

    // 대상 카드 가져오기
    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const targetText = extractTextField(note);

    // 덱의 모든 카드 가져오기
    const allNotes = await getDeckNotes(deckName);
    const allCards: CardForComparison[] = allNotes.map((n) => ({
      noteId: n.noteId,
      text: extractTextField(n),
    }));

    // 유사성 검사 수행
    const result = await checkSimilarity(
      { noteId, text: targetText },
      allCards,
      { threshold, maxResults }
    );

    return c.json({
      noteId,
      result,
    });
  } catch (error) {
    console.error('Similarity check error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

/**
 * POST /api/validate/context
 * 문맥 일관성 검사 (nid 링크로 연결된 카드들과의 일관성)
 */
validate.post('/context', async (c) => {
  try {
    const { noteId, includeReverseLinks, maxRelatedCards, thorough } = await c.req.json<{
      noteId: number;
      includeReverseLinks?: boolean;
      maxRelatedCards?: number;
      thorough?: boolean;
    }>();

    if (!noteId) {
      return c.json({ error: 'noteId is required' }, 400);
    }

    // 카드 내용 가져오기
    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const text = extractTextField(note);

    // 문맥 일관성 검사 수행
    const targetCard: CardForContext = {
      noteId,
      text,
      tags: note.tags,
    };

    const result = await checkContext(targetCard, {
      includeReverseLinks,
      maxRelatedCards,
      thorough,
    });

    return c.json({
      noteId,
      result,
    });
  } catch (error) {
    console.error('Context check error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

/**
 * POST /api/validate/all
 * 모든 검증 수행 (팩트 체크 + 최신성 + 유사성 + 문맥)
 */
validate.post('/all', async (c) => {
  try {
    const { noteId, deckName } = await c.req.json<{
      noteId: number;
      deckName: string;
    }>();

    if (!noteId || !deckName) {
      return c.json({ error: 'noteId and deckName are required' }, 400);
    }

    // 카드 내용 가져오기
    const note = await getNoteById(noteId);
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const text = extractTextField(note);

    // 병렬로 모든 검증 수행
    const [factCheckResult, freshnessResult, similarityResult, contextResult] = await Promise.all([
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

    // 전체 상태 결정
    const results = [factCheckResult, freshnessResult, similarityResult, contextResult];
    let overallStatus: 'valid' | 'warning' | 'error' | 'unknown' = 'valid';

    if (results.some((r) => r.status === 'error')) {
      overallStatus = 'error';
    } else if (results.some((r) => r.status === 'warning')) {
      overallStatus = 'warning';
    } else if (results.some((r) => r.status === 'unknown')) {
      overallStatus = 'unknown';
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
  } catch (error) {
    console.error('Validation error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default validate;
