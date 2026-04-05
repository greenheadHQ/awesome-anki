export type WorkspaceMode = "candidates" | "difficult";
export type CardAnalysisStatus = "pending" | "cached" | "error" | "none";

export interface SplitCandidate {
  noteId: number;
  text: string;
  analysis: {
    canSplit: boolean;
    clozeCount: number;
  };
  difficulty?: {
    score: number;
    lapses: number;
    easeFactor: number;
    interval: number;
    reps: number;
    reasons: string[];
  };
}
