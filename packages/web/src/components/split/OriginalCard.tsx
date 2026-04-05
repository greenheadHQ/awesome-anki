import { AlertTriangle, ChevronRight, Loader2, Shield } from "lucide-react";

import { cn } from "../../lib/utils";
import { ContentRenderer } from "../card/ContentRenderer";
import { Button } from "../ui/button";
import { ValidationPanel } from "../validation/ValidationPanel";
import type { SplitCandidate } from "./types";

interface OriginalCardProps {
  isMobile: boolean;
  selectedCard: SplitCandidate | null;
  cardDetail: { text: string } | undefined;
  isLoadingDetail: boolean;
  isDetailError: boolean;
  detailError: Error | null;
  refetchDetail: () => void;
  showValidation: boolean;
  onToggleValidation: () => void;
  activeDeck: string | null;
}

export function OriginalCard({
  isMobile,
  selectedCard,
  cardDetail,
  isLoadingDetail,
  isDetailError,
  detailError,
  refetchDetail,
  showValidation,
  onToggleValidation,
  activeDeck,
}: OriginalCardProps) {
  return (
    <>
      {!isMobile && (
        <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold">원본 카드</span>
          {selectedCard && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleValidation}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  showValidation
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80",
                )}
              >
                <Shield className="w-3 h-3" />
                검증
              </button>
              <span className="text-xs text-muted-foreground">NID: {selectedCard.noteId}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-4">
        {selectedCard ? (
          isLoadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : isDetailError ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertTriangle className="w-8 h-8 mb-3" />
              <span className="font-medium mb-2">카드 상세 조회 실패</span>
              {detailError && (
                <p className="text-xs text-muted-foreground text-center max-w-xs bg-muted p-2 rounded">
                  {detailError instanceof Error ? detailError.message : String(detailError)}
                </p>
              )}
              <Button onClick={() => refetchDetail()} variant="outline" size="sm" className="mt-3">
                다시 시도
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 난이도 정보 배너 */}
              {selectedCard.difficulty && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-sm text-amber-800">
                      난이도 점수: {selectedCard.difficulty.score}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                    <span>실패 횟수: {selectedCard.difficulty.lapses}회</span>
                    <span>
                      Ease Factor: {(selectedCard.difficulty.easeFactor / 10).toFixed(0)}%
                    </span>
                    <span>복습 간격: {selectedCard.difficulty.interval}일</span>
                    <span>총 복습: {selectedCard.difficulty.reps}회</span>
                  </div>
                  {selectedCard.difficulty.reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedCard.difficulty.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <ContentRenderer
                content={cardDetail?.text || selectedCard.text}
                showToggle={true}
                defaultView="rendered"
              />
              {/* 검증 패널 */}
              {showValidation && activeDeck && (
                <ValidationPanel noteId={selectedCard.noteId} deckName={activeDeck} />
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>왼쪽에서 카드를 선택하세요</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
