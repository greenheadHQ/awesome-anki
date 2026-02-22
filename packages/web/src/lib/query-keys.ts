export const queryKeys = {
  decks: ["decks"] as const,
  deckStats: (name: string) => ["decks", name, "stats"] as const,

  cards: {
    all: ["cards"] as const,
    byDeck: (deck: string, opts?: { page?: number; filter?: string }) =>
      ["cards", "deck", deck, opts] as const,
    detail: (noteId: number) => ["cards", "detail", noteId] as const,
    difficult: (deck: string, opts?: { page?: number; limit?: number }) =>
      ["cards", "difficult", deck, opts] as const,
  },

  split: {
    preview: (noteId: number, useGemini?: boolean, versionId?: string) =>
      [
        "split",
        "preview",
        noteId,
        useGemini,
        useGemini ? versionId : undefined,
      ] as const,
  },

  backups: {
    all: ["backups"] as const,
    detail: (id: string) => ["backups", id] as const,
  },

  prompts: {
    versions: ["prompts", "versions"] as const,
    version: (id: string) => ["prompts", "versions", id] as const,
    active: ["prompts", "active"] as const,
    system: ["prompts", "system"] as const,
    experiments: ["prompts", "experiments"] as const,
    experiment: (id: string) => ["prompts", "experiments", id] as const,
  },

  history: {
    list: (opts?: {
      page?: number;
      limit?: number;
      deckName?: string;
      status?: string;
      splitType?: "hard" | "soft";
      startDate?: string;
      endDate?: string;
    }) => ["history", "list", opts] as const,
    detail: (sessionId: string) => ["history", "detail", sessionId] as const,
    syncHealth: ["history", "sync-health"] as const,
  },

  health: ["health"] as const,
  privacyStatus: ["privacy", "status"] as const,
};
