import { Loader2, Search } from "lucide-react";

import type { ValidationStatus } from "../../lib/api";
import { cn } from "../../lib/utils";
import { ClinicStatusIcon, getStatusBorderColor } from "./ClinicStatusIcon";

type FilterMode = "all" | "unvalidated" | "needs-review";

const FILTER_LABELS: Record<FilterMode, string> = {
  all: "전체",
  unvalidated: "미검증",
  "needs-review": "검토 필요",
};

interface ClinicCardListProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  issueCount: number;
  isLoadingCards: boolean;
  filteredCards: Array<{
    noteId: number;
    text: string;
    analysis: { clozeCount: number };
  }>;
  validationStatuses: Map<number, ValidationStatus | null>;
  selectedNoteId: number | null;
  onSelectCard: (noteId: number) => void;
}

/** 카드 목록 패널 */
export function ClinicCardList({
  searchQuery,
  onSearchQueryChange,
  filterMode,
  onFilterModeChange,
  issueCount,
  isLoadingCards,
  filteredCards,
  validationStatuses,
  selectedNoteId,
  onSelectCard,
}: ClinicCardListProps) {
  return (
    <>
      {/* 필터 + 검색 */}
      <div className="py-3 px-4 border-b shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="카드 검색..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onFilterModeChange(mode)}
              className={cn(
                "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
                filterMode === mode
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {FILTER_LABELS[mode]}
              {mode === "needs-review" && issueCount > 0 && (
                <span className="ml-1 text-red-500">({issueCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* 카드 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingCards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? "검색 결과가 없습니다" : "카드가 없습니다"}
          </div>
        ) : (
          <div className="divide-y">
            {filteredCards.map((card) => {
              const status = validationStatuses.get(card.noteId) ?? null;
              return (
                <button
                  type="button"
                  key={card.noteId}
                  onClick={() => onSelectCard(card.noteId)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted transition-colors border-l-[3px]",
                    getStatusBorderColor(status),
                    selectedNoteId === card.noteId && "bg-primary/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ClinicStatusIcon status={status} />
                        <p className="text-sm font-medium truncate">{card.noteId}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {card.text.slice(0, 60)}
                        {card.text.length > 60 ? "..." : ""}
                      </p>
                    </div>
                    {card.analysis.clozeCount > 0 && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        C{card.analysis.clozeCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
