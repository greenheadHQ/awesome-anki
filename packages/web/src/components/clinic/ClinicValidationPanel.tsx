import { Copy, Link2, Loader2, Shield } from "lucide-react";

import type { AllValidationResult, ValidationStatus } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { AllInOnePanel } from "./AllInOnePanel";
import { ClinicStatusIcon, STATUS_LABELS, getStatusBg } from "./ClinicStatusIcon";
import { ValidationSection } from "./ValidationSection";

import { VALIDATION_TYPES } from "./clinic-constants";

type DetailTab = "validate" | "related";

/** CachedValidation shape from useClinicCache (not AllValidationResult) */
interface CachedValidationShape {
  status: ValidationStatus;
  validatedAt: string;
  results?: AllValidationResult["results"];
}

interface ClinicValidationPanelProps {
  selectedNoteId: number | null;
  activeDeck: string | null;
  cardDetailText: string | undefined;
  currentValidation: CachedValidationShape | null;
  isValidating: boolean;
  detailTab: DetailTab;
  onDetailTabChange: (tab: DetailTab) => void;
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
  onValidateSelected: () => void;
  onSelectCard: (noteId: number) => void;
}

/** 검증 결과 패널 */
export function ClinicValidationPanel({
  selectedNoteId,
  activeDeck,
  cardDetailText,
  currentValidation,
  isValidating,
  detailTab,
  onDetailTabChange,
  expandedSections,
  onToggleSection,
  onValidateSelected,
  onSelectCard,
}: ClinicValidationPanelProps) {
  const cachedResult = currentValidation;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
        <span className="text-sm font-semibold">검증 결과</span>
        {selectedNoteId && (
          <Button size="sm" onClick={onValidateSelected} disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                검증 중...
              </>
            ) : cachedResult ? (
              "재검증"
            ) : (
              "검증 시작"
            )}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!selectedNoteId ? (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">카드를 선택하면 검증 결과가 표시됩니다</p>
          </div>
        ) : isValidating && !cachedResult ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : cachedResult?.results ? (
          <>
            {/* 전체 상태 */}
            <div
              className={cn(
                "p-3 rounded-lg border flex items-center gap-3",
                getStatusBg(cachedResult.status),
              )}
            >
              <ClinicStatusIcon status={cachedResult.status} size="md" />
              <div>
                <p className="font-medium">{STATUS_LABELS[cachedResult.status]}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(cachedResult.validatedAt).toLocaleString("ko-KR")}
                </p>
              </div>
              {isValidating && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
            </div>

            {/* 서브탭: 검증 / 연관 */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => onDetailTabChange("validate")}
                className={cn(
                  "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
                  detailTab === "validate"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Shield className="w-3 h-3 inline mr-1" />
                검증
              </button>
              <button
                type="button"
                onClick={() => onDetailTabChange("related")}
                className={cn(
                  "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
                  detailTab === "related"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Link2 className="w-3 h-3 inline mr-1" />
                연관
              </button>
            </div>

            {detailTab === "validate" ? (
              // 6종 검증 결과
              <div className="space-y-2">
                {VALIDATION_TYPES.map(({ key, icon, label }) => (
                  <ValidationSection
                    key={key}
                    isExpanded={expandedSections.has(key)}
                    onToggle={() => onToggleSection(key)}
                    typeKey={key}
                    icon={icon}
                    label={label}
                    result={
                      cachedResult.results![key as keyof NonNullable<typeof cachedResult.results>]
                    }
                  />
                ))}
              </div>
            ) : (
              // 연관 노트 탭
              <div className="space-y-3">
                {/* 유사 카드 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Copy className="w-4 h-4" />
                    유사 카드
                  </h3>
                  {cachedResult.results!.similarity?.details.similarCards.length > 0 ? (
                    <div className="space-y-1">
                      {cachedResult.results!.similarity.details.similarCards.map((card, i) => (
                        <button
                          type="button"
                          key={`related-${card.noteId}-${i}`}
                          onClick={() => onSelectCard(card.noteId)}
                          className="w-full text-left text-xs p-2 bg-background rounded border hover:bg-muted transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono">#{card.noteId}</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded",
                                card.similarity >= 90
                                  ? "bg-red-100 text-red-700"
                                  : card.similarity >= 70
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-700",
                              )}
                            >
                              {card.similarity}%
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 line-clamp-2">
                            {card.matchedContent}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground p-3 bg-muted rounded">
                      유사한 카드가 없습니다
                    </p>
                  )}
                </div>
                {/* 문맥 관련 카드 */}
                {cachedResult.results!.context?.details.relatedCards.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4" />
                      문맥 연결 카드
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {cachedResult.results!.context.details.relatedCards.map((nid) => (
                        <button
                          type="button"
                          key={`ctx-${nid}`}
                          onClick={() => onSelectCard(nid)}
                          className="text-xs font-mono px-2 py-1 bg-background border rounded hover:bg-muted transition-colors"
                        >
                          #{nid}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // 미검증 상태 — 검증 시작 CTA
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Shield className="w-12 h-12 mb-4 text-blue-400" />
            <p className="text-center mb-4">
              6종 검증으로 카드 건강을 진단합니다.
              <br />
              <span className="text-xs">API 비용이 발생할 수 있습니다.</span>
            </p>
            <Button onClick={onValidateSelected} disabled={isValidating}>
              <Shield className="w-4 h-4 mr-2" />
              검증 시작
            </Button>
          </div>
        )}
      </div>

      {/* All-in-One Panel (우측 패널 하단 고정) */}
      {selectedNoteId && activeDeck && cardDetailText && currentValidation?.results && (
        <AllInOnePanel
          cardContent={cardDetailText}
          noteId={selectedNoteId}
          deckName={activeDeck}
          validationResults={currentValidation.results}
        />
      )}
    </div>
  );
}
