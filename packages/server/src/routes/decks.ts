/**
 * Decks API Routes
 */

import {
  analyzeForSplit,
  extractTextField,
  getDeckNames,
  getDeckNotes,
} from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /api/decks
 * 덱 목록 조회
 */
app.get("/", async (c) => {
  const decks = await getDeckNames();
  return c.json({ decks });
});

/**
 * GET /api/decks/:name/stats
 * 덱 통계 조회
 */
app.get("/:name/stats", async (c) => {
  const deckName = decodeURIComponent(c.req.param("name"));
  const notes = await getDeckNotes(deckName);

  let splitCandidates = 0;

  for (const note of notes) {
    const text = extractTextField(note);
    const analysis = analyzeForSplit(text);

    if (analysis.canSplit) {
      splitCandidates++;
    }
  }

  return c.json({
    deckName,
    totalNotes: notes.length,
    splitCandidates,
  });
});

export default app;
