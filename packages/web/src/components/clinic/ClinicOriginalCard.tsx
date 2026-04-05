import { AlertTriangle, Loader2, Shield } from "lucide-react";

import type { AllValidationResult } from "../../lib/api";
import { ContentRenderer } from "../card/ContentRenderer";
import { ActionPreview } from "./ActionPreview";
import { Button } from "../ui/button";

interface ClinicOriginalCardProps {
  selectedNoteId: number | null;
  isLoadingDetail: boolean;
  isDetailError: boolean;
  detailError: Error | null;
  refetchDetail: () => void;
  cardDetailText: string | undefined;
  validationResults: AllValidationResult["results"] | undefined;
}

/** 원본 카드 + 수정 미리보기 패널 */
export function ClinicOriginalCard({
  selectedNoteId,
  isLoadingDetail,
  isDetailError,
  detailError,
  refetchDetail,
  cardDetailText,
  validationResults,
}: ClinicOriginalCardProps) {
  return (
    <>
      <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
        <span className="text-sm font-semibold">원본 카드</span>
        {selectedNoteId && (
          <span className="text-xs text-muted-foreground">NID: {selectedNoteId}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {selectedNoteId ? (
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
            <>
              <ContentRenderer
                content={cardDetailText || ""}
                showToggle={true}
                defaultView="rendered"
              />
              {/* 수정 미리보기 (ActionPreview) */}
              <ActionPreview
                cardContent={cardDetailText || ""}
                validationResults={validationResults}
              />
            </>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>왼쪽에서 카드를 선택하세요</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
