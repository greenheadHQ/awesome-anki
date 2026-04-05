import { AlertTriangle, Loader2, Scissors } from "lucide-react";

import { cn } from "../../lib/utils";
import type { MobilePanel } from "../../lib/workspace-types";
import { CandidateListItem } from "./CandidateListItem";
import type { CardAnalysisStatus, SplitCandidate, WorkspaceMode } from "./types";

interface CandidatesListProps {
  mode: WorkspaceMode;
  candidates: SplitCandidate[];
  difficultCards: SplitCandidate[];
  isLoadingList: boolean;
  selectedNoteId: number | null;
  isMobile: boolean;
  getCardStatus: (noteId: number) => CardAnalysisStatus;
  onSelectCard: (card: SplitCandidate | null) => void;
  onChangeMode: (mode: WorkspaceMode) => void;
  onSetActivePanel: (panel: MobilePanel) => void;
}

export function CandidatesList({
  mode,
  candidates,
  difficultCards,
  isLoadingList,
  selectedNoteId,
  isMobile,
  getCardStatus,
  onSelectCard,
  onChangeMode,
  onSetActivePanel,
}: CandidatesListProps) {
  const activeList = mode === "candidates" ? candidates : difficultCards;

  return (
    <>
      <div className="py-3 px-4 border-b shrink-0">
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => {
              onChangeMode("candidates");
              onSelectCard(null);
              if (isMobile) onSetActivePanel("list");
            }}
            className={cn(
              "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
              mode === "candidates"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Scissors className="w-3 h-3 inline mr-1" />
            분할 후보
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeMode("difficult");
              onSelectCard(null);
              if (isMobile) onSetActivePanel("list");
            }}
            className={cn(
              "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
              mode === "difficult"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            재분할 대상
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : activeList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {mode === "candidates" ? "분할 후보가 없습니다" : "재분할 대상이 없습니다"}
          </div>
        ) : (
          <div className="divide-y">
            {activeList.map((card) => (
              <CandidateListItem
                key={card.noteId}
                card={card}
                isSelected={selectedNoteId === card.noteId}
                status={getCardStatus(card.noteId)}
                onSelect={onSelectCard}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
