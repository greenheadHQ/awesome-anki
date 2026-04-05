import { cn } from "../../lib/utils";
import { CardStatusIcon } from "./CardStatusIcon";
import type { CardAnalysisStatus, SplitCandidate } from "./types";

interface CandidateListItemProps {
  card: SplitCandidate;
  isSelected: boolean;
  status: CardAnalysisStatus;
  onSelect: (card: SplitCandidate) => void;
}

export function CandidateListItem({ card, isSelected, status, onSelect }: CandidateListItemProps) {
  return (
    <button
      type="button"
      key={card.noteId}
      onClick={() => onSelect(card)}
      className={cn(
        "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
        isSelected && "bg-primary/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{card.noteId}</p>
            <CardStatusIcon status={status} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {card.text.slice(0, 60)}
            {card.text.length > 60 ? "..." : ""}
          </p>
          {card.difficulty && (
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>lapses: {card.difficulty.lapses}</span>
              <span>ease: {(card.difficulty.easeFactor / 10).toFixed(0)}%</span>
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {card.difficulty ? (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                card.difficulty.score > 70
                  ? "bg-red-100 text-red-700"
                  : card.difficulty.score > 40
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700",
              )}
            >
              {card.difficulty.score}
            </span>
          ) : (
            card.analysis.clozeCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                C{card.analysis.clozeCount}
              </span>
            )
          )}
        </div>
      </div>
    </button>
  );
}
