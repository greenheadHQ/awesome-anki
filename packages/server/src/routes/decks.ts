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
  try {
    const decks = await getDeckNames();
    return c.json({ decks });
  } catch (_error) {
    return c.json({ error: "Failed to fetch decks" }, 500);
  }
});

/**
 * GET /api/decks/:name/stats
 * 덱 통계 조회
 */
app.get("/:name/stats", async (c) => {
  try {
    const deckName = decodeURIComponent(c.req.param("name"));
    const notes = await getDeckNotes(deckName);

    let splitCandidates = 0;
    let hardSplitCount = 0;
    let softSplitCount = 0;

    for (const note of notes) {
      const text = extractTextField(note);
      const analysis = analyzeForSplit(text);

      if (analysis.canHardSplit) {
        hardSplitCount++;
        splitCandidates++;
      } else if (analysis.clozeCount > 3) {
        softSplitCount++;
        splitCandidates++;
      }
    }

    return c.json({
      deckName,
      totalNotes: notes.length,
      splitCandidates,
      hardSplitCount,
      softSplitCount,
    });
  } catch (_error) {
    return c.json({ error: "Failed to fetch deck stats" }, 500);
  }
});

export default app;
