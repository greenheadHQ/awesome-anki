/**
 * Cards API Routes
 */

import {
  analyzeForSplit,
  extractTags,
  extractTextField,
  getClozeStats,
  getDeckNotes,
  getDifficultCards,
  getNoteById,
  NotFoundError,
  parseClozes,
  parseNidLinks,
} from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /api/cards/deck/:name
 * 덱의 카드 목록 조회
 */
app.get("/deck/:name", async (c) => {
  const deckName = decodeURIComponent(c.req.param("name"));
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const filter = c.req.query("filter") || "all"; // all, splitable

  const notes = await getDeckNotes(deckName);

  // 분석 및 필터링
  const analyzed = notes.map((note) => {
    const text = extractTextField(note);
    const analysis = analyzeForSplit(text);
    const clozeStats = getClozeStats(text);

    return {
      noteId: note.noteId,
      text: text.slice(0, 200) + (text.length > 200 ? "..." : ""),
      tags: note.tags,
      modelName: note.modelName,
      analysis,
      clozeStats,
      isSplitable: analysis.canSplit,
    };
  });

  // 필터 적용
  const filtered = filter === "splitable" ? analyzed.filter((n) => n.isSplitable) : analyzed;

  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return c.json({
    cards: paginated,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit),
  });
});

/**
 * GET /api/cards/deck/:name/difficult
 * 학습 데이터 기반 어려운 카드 조회
 */
app.get("/deck/:name/difficult", async (c) => {
  const deckName = decodeURIComponent(c.req.param("name"));
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "50", 10);

  const difficultCards = await getDifficultCards(deckName);

  const startIndex = (page - 1) * limit;
  const paginated = difficultCards.slice(startIndex, startIndex + limit);

  return c.json({
    cards: paginated,
    total: difficultCards.length,
    page,
    limit,
    totalPages: Math.ceil(difficultCards.length / limit),
  });
});

/**
 * GET /api/cards/:noteId
 * 단일 카드 상세 조회
 */
app.get("/:noteId", async (c) => {
  const noteId = parseInt(c.req.param("noteId"), 10);
  const note = await getNoteById(noteId);

  if (!note) {
    throw new NotFoundError(`노트 ${noteId}를 찾을 수 없습니다`);
  }

  const text = extractTextField(note);
  const tags = extractTags(note);
  const analysis = analyzeForSplit(text);
  const nidLinks = parseNidLinks(text);
  const clozes = parseClozes(text);
  const clozeStats = getClozeStats(text);

  return c.json({
    noteId: note.noteId,
    text,
    tags,
    modelName: note.modelName,
    analysis,
    nidLinks,
    clozes,
    clozeStats,
    isSplitable: analysis.canSplit,
  });
});

export default app;
