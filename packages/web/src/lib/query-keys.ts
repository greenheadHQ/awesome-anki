export const queryKeys = {
  decks: ["decks"] as const,
  deckStats: (name: string) => ["decks", name, "stats"] as const,

  cards: {
    all: ["cards"] as const,
    byDeck: (deck: string, opts?: { page?: number; filter?: string }) =>
      ["cards", "deck", deck, opts] as const,
    detail: (noteId: number) => ["cards", "detail", noteId] as const,
  },

  split: {
    preview: (noteId: number, useGemini?: boolean) =>
      ["split", "preview", noteId, useGemini] as const,
  },

  backups: {
    all: ["backups"] as const,
    detail: (id: string) => ["backups", id] as const,
  },

  prompts: {
    versions: ["prompts", "versions"] as const,
    version: (id: string) => ["prompts", "versions", id] as const,
    active: ["prompts", "active"] as const,
    history: (opts?: { page?: number; versionId?: string }) =>
      ["prompts", "history", opts] as const,
    experiments: ["prompts", "experiments"] as const,
    experiment: (id: string) => ["prompts", "experiments", id] as const,
  },

  health: ["health"] as const,
};
