import { Loader2, Sparkles } from "lucide-react";

import { SplitPreviewCard } from "../card/DiffViewer";
import { Button } from "../ui/button";
import { formatCostUsd, ModelBadge } from "../ui/model-badge";
import { SplitErrorState } from "./SplitErrorState";
import type { SplitPreviewResult } from "../../lib/api";
import type { SplitCandidate } from "./types";

interface PreviewContentProps {
  isMobile: boolean;
  selectedCard: SplitCandidate | null;
  isLoadingCurrentCard: boolean;
  currentCardError: string | undefined;
  splitPreviewIsError: boolean;
  splitPreviewError: Error | null;
  splitPreviewMatchesCurrent: boolean;
  previewData: SplitPreviewResult | undefined;
  cachedPreview: SplitPreviewResult | undefined;
  activeVersionId: string | null;
  activeProvider: string | undefined;
  activeModel: string | undefined;
  llmModelsReady: boolean;
  splitPreviewIsPending: boolean;
  isAnalysisPending: boolean;
  onRequestSplit: () => void;
}

export function PreviewContent({
  isMobile,
  selectedCard,
  isLoadingCurrentCard,
  currentCardError,
  splitPreviewIsError,
  splitPreviewError,
  splitPreviewMatchesCurrent,
  previewData,
  cachedPreview,
  activeVersionId,
  activeProvider,
  activeModel,
  llmModelsReady,
  splitPreviewIsPending,
  isAnalysisPending,
  onRequestSplit,
}: PreviewContentProps) {
  return (
    <>
      {!isMobile && (
        <div className="py-3 px-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">분할 미리보기</span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedCard ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>카드를 선택하면 분할 미리보기가 표시됩니다</p>
          </div>
        ) : isLoadingCurrentCard ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : currentCardError ? (
          <SplitErrorState message={currentCardError} onRetry={onRequestSplit} />
        ) : splitPreviewIsError && splitPreviewMatchesCurrent ? (
          <SplitErrorState
            message={
              splitPreviewError instanceof Error
                ? splitPreviewError.message
                : String(splitPreviewError ?? "알 수 없는 오류")
            }
            onRetry={onRequestSplit}
          />
        ) : previewData?.splitCards ? (
          <div className="space-y-4">
            {/* 캐시 표시 */}
            {cachedPreview && (
              <span className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded">
                {"\u2713"} 캐시된 결과
                {activeVersionId && ` (${activeVersionId})`}
              </span>
            )}
            {/* 분할 요약 */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">{previewData.splitCards.length}개 카드로 분할</p>
                {previewData.provider && (
                  <ModelBadge provider={previewData.provider} model={previewData.aiModel} />
                )}
              </div>
              {previewData.splitReason && (
                <p className="text-muted-foreground text-xs">{previewData.splitReason}</p>
              )}
              <p className="text-muted-foreground text-xs mt-1">
                {previewData.executionTimeMs != null &&
                  `${(previewData.executionTimeMs / 1000).toFixed(1)}s`}
                {previewData.tokenUsage?.totalTokens != null &&
                  ` | ${previewData.tokenUsage.totalTokens} tokens`}
                {previewData.actualCost != null &&
                  ` | ${formatCostUsd(previewData.actualCost.totalCostUsd)}`}
              </p>
            </div>

            {/* 분할 카드 미리보기 */}
            <div className="space-y-3">
              {previewData.splitCards.map((card, idx) => (
                <SplitPreviewCard key={`split-${card.title}-${idx}`} card={card} index={idx} />
              ))}
            </div>

            {/* 데스크톱에서만 미리보기 내 반려 Popover 표시 (모바일은 footer에 표시) */}
          </div>
        ) : (
          // 분석 요청 필요
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 text-purple-400" />
            <p className="text-center mb-4">
              AI로 카드를 분석합니다.
              <br />
              {activeProvider && activeModel && (
                <span className="inline-block mt-1">
                  <ModelBadge provider={activeProvider} model={activeModel} />
                </span>
              )}
              <br />
              <span className="text-xs text-muted-foreground">API 비용이 발생할 수 있습니다.</span>
            </p>
            <Button
              onClick={onRequestSplit}
              disabled={!llmModelsReady || splitPreviewIsPending || isAnalysisPending}
              variant="outline"
              className="bg-purple-50 hover:bg-purple-100 border-purple-200"
            >
              <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
              분할 분석 요청
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
