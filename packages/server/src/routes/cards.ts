/**
 * Cards API Routes
 */

import {
  analyzeForSplit,
  extractTags,
  extractTextField,
  getClozeStats,
  getDeckNotes,
  getNoteById,
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
  try {
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
        isSplitable: analysis.canHardSplit || analysis.clozeCount > 3,
        splitType: analysis.canHardSplit
          ? "hard"
          : analysis.clozeCount > 3
            ? "soft"
            : null,
      };
    });

    // 필터 적용
    const filtered =
      filter === "splitable" ? analyzed.filter((n) => n.isSplitable) : analyzed;

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
  } catch (error) {
    console.error("Error fetching cards:", error);
    return c.json({ error: "Failed to fetch cards" }, 500);
  }
});

/**
 * GET /api/cards/:noteId
 * 단일 카드 상세 조회
 */
app.get("/:noteId", async (c) => {
  try {
    const noteId = parseInt(c.req.param("noteId"), 10);
    const note = await getNoteById(noteId);

    if (!note) {
      return c.json({ error: "Note not found" }, 404);
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
      isSplitable: analysis.canHardSplit || analysis.clozeCount > 3,
      splitType: analysis.canHardSplit
        ? "hard"
        : analysis.clozeCount > 3
          ? "soft"
          : null,
    });
  } catch (error) {
    console.error("Error fetching card:", error);
    return c.json({ error: "Failed to fetch card" }, 500);
  }
});

export default app;
