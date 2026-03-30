/**
 * ClinicWorkspace - 카드 검진 작업 공간
 *
 * Mockup v2 디자인 기준 완전 재작성.
 *
 * 데스크톱: 3단 레이아웃 (카드 목록 260px | 원본 카드 + 수정 미리보기 flex-1 | 검증/연관/액션 360px)
 * 모바일: list <-> detail view transition
 */

import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { ContentRenderer } from "../components/card/ContentRenderer";
import { ActionPreview } from "../components/clinic/ActionPreview";
import { AllInOnePanel } from "../components/clinic/AllInOnePanel";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { ModelBadge } from "../components/ui/model-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useBatchClinicValidate, useClinicCache, useClinicValidate } from "../hooks/useClinicCache";
import { useDecks } from "../hooks/useDecks";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useModelSelection } from "../hooks/useModelSelection";
import type { AllValidationResult, ValidationStatus } from "../lib/api";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";

type MobilePanel = "list" | "detail";
type DetailTab = "validate" | "related" | "action";

type FilterMode = "all" | "needs-review" | "unvalidated";

// 6종 검증 유형
const VALIDATION_TYPES = [
  { key: "verbose", label: "Verbose", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
  { key: "yagni", label: "YAGNI 의심", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
  { key: "factCheck", label: "팩트체크", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
  { key: "freshness", label: "최신성", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
  { key: "similarity", label: "유사도", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
  { key: "context", label: "문맥 정합성", issueIcon: "🔴", warnIcon: "🟡", okIcon: "✅" },
] as const;

// --- helper: badge color by status ---
function getBadgeClasses(status: ValidationStatus | null): string {
  switch (status) {
    case "error":
      return "bg-[#fef2f2] text-[#dc2626]";
    case "warning":
      return "bg-[#fffbeb] text-[#d97706]";
    case "valid":
      return "bg-[#f0fdf4] text-[#16a34a]";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

function getCardBorderClass(status: ValidationStatus | null): string {
  switch (status) {
    case "error":
      return "border-l-[3px] border-l-[#dc2626]";
    case "warning":
      return "border-l-[3px] border-l-[#d97706]";
    case "valid":
      return "border-l-[3px] border-l-[#16a34a]";
    default:
      return "";
  }
}

function getStatusEmoji(status: ValidationStatus): string {
  switch (status) {
    case "error":
      return "🔴";
    case "warning":
      return "🟡";
    case "valid":
      return "✅";
    default:
      return "⚪";
  }
}

/** validation-item variant class */
function getValidationItemClass(status: ValidationStatus): string {
  switch (status) {
    case "error":
      return "border-[#fecaca] bg-[#fef2f2]";
    case "warning":
      return "border-[#fed7aa] bg-[#fffbeb]";
    case "valid":
      return "border-[#bbf7d0] bg-[#f0fdf4]";
    default:
      return "border-[#e5e7eb] bg-[#f9fafb]";
  }
}

/** short description for each validation type */
function getValidationDescription(
  typeKey: string,
  result: AllValidationResult["results"][keyof AllValidationResult["results"]],
): string {
  const details = result.details as Record<string, unknown>;
  switch (typeKey) {
    case "verbose": {
      const clozeCount = (details.clozeCount as number) ?? 0;
      const wordCount = (details.wordCount as number) ?? 0;
      if (result.status === "error" || result.status === "warning") {
        return `Cloze ${clozeCount}개, ${wordCount}단어. 여러 개념이 혼합되어 있습니다.`;
      }
      return result.message || "적절한 분량입니다.";
    }
    case "yagni": {
      const reason = details.reason as string;
      if (details.isYagni) return reason || "YAGNI Cloze가 감지되었습니다.";
      return "YAGNI Cloze가 감지되지 않았습니다.";
    }
    case "factCheck": {
      const claims = (details.claims as Array<{ isVerified: boolean }>) ?? [];
      const wrongCount = claims.filter((c) => !c.isVerified).length;
      if (wrongCount > 0) return `${wrongCount}건의 사실 오류가 발견되었습니다.`;
      return result.message || "기술적 사실이 정확합니다.";
    }
    case "freshness":
      return result.message || "최신 정보를 반영하고 있습니다.";
    case "similarity": {
      const similarCards = (details.similarCards as Array<{ similarity: number }>) ?? [];
      const maxSim = similarCards.reduce((max, c) => Math.max(max, c.similarity), 0);
      if (similarCards.length > 0 && maxSim >= 70)
        return `유사 카드 ${similarCards.length}개 (최대 ${maxSim}%)`;
      return `중복 카드 없음 (유사도 최대 ${maxSim > 0 ? (maxSim / 100).toFixed(2) : "0.00"})`;
    }
    case "context":
      return result.message || "nid 링크된 카드 간 내용이 일관적입니다.";
    default:
      return result.message || "";
  }
}

/** determine what action button to show for a validation result */
function getActionButton(
  typeKey: string,
  result: AllValidationResult["results"][keyof AllValidationResult["results"]],
): { label: string; className: string; previewId: string } | null {
  if (result.status === "valid") return null;

  switch (typeKey) {
    case "verbose":
      if (result.details && (result.details as Record<string, unknown>).recommendation === "split") {
        return { label: "✂️ Split 미리보기", className: "bg-[#4f46e5] text-white", previewId: "preview-split" };
      }
      return null;
    case "yagni":
      if (result.details && (result.details as Record<string, unknown>).isYagni) {
        return { label: "🗑 제거 미리보기", className: "bg-[#f59e0b] text-white", previewId: "preview-yagni" };
      }
      return null;
    case "factCheck": {
      const claims = ((result.details as Record<string, unknown>).claims as Array<{ isVerified: boolean; correction?: string }>) ?? [];
      if (claims.some((c) => !c.isVerified && c.correction)) {
        return { label: "🔧 정정 미리보기", className: "bg-[#2563eb] text-white", previewId: "preview-fact" };
      }
      return null;
    }
    default:
      return null;
  }
}

export function ClinicWorkspace() {
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<MobilePanel>("list");
  const [detailTab, setDetailTab] = useState<DetailTab>("validate");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  const middlePanelRef = useRef<HTMLDivElement>(null);

  const { data: decksData } = useDecks();
  const activeDeck = selectedDeck ?? decksData?.decks?.[0] ?? null;
  const { data: cardsData, isLoading: isLoadingCards } = useCards(activeDeck, {
    limit: 500,
    filter: "all",
  });

  const { data: cardDetail, isLoading: isLoadingDetail } = useCardDetail(selectedNoteId);

  // LLM 모델 선택 (공통 훅)
  const { activeProvider, activeModel, activeModelKey, setSelectedModelKey, llmModelsData } =
    useModelSelection();

  const { getValidation, getValidationStatuses, uncachedCount } = useClinicCache();

  const modelOpts = { provider: activeProvider, model: activeModel };
  const validateCard = useClinicValidate(activeDeck, modelOpts);
  const batchValidate = useBatchClinicValidate(activeDeck, modelOpts);

  const allCards = useMemo(() => cardsData?.cards ?? [], [cardsData]);
  const noteIds = useMemo(() => allCards.map((c) => c.noteId), [allCards]);
  const validationStatuses = useMemo(
    () => getValidationStatuses(noteIds),
    [getValidationStatuses, noteIds],
  );

  // 필터 + 검색 적용
  const filteredCards = useMemo(() => {
    let cards = allCards;

    if (filterMode === "unvalidated") {
      cards = cards.filter((c) => !validationStatuses.get(c.noteId));
    } else if (filterMode === "needs-review") {
      cards = cards.filter((c) => {
        const status = validationStatuses.get(c.noteId);
        return status === "warning" || status === "error";
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      cards = cards.filter((c) => String(c.noteId).includes(q) || c.text.toLowerCase().includes(q));
    }

    return cards;
  }, [allCards, filterMode, validationStatuses, searchQuery]);

  const currentValidation = selectedNoteId ? getValidation(selectedNoteId) : null;

  // 통계
  const unvalidatedCount2 = uncachedCount(noteIds);
  const statusCounts = useMemo(() => {
    let red = 0;
    let yellow = 0;
    let green = 0;
    for (const [, status] of validationStatuses) {
      if (status === "error") red++;
      else if (status === "warning") yellow++;
      else if (status === "valid") green++;
    }
    return { red, yellow, green };
  }, [validationStatuses]);

  const handleSelectCard = useCallback(
    (noteId: number | null) => {
      setSelectedNoteId(noteId);
      if (noteId && isMobile) {
        startViewTransition(() => setActivePanel("detail"));
      }
    },
    [isMobile],
  );

  const handleBackToList = () => {
    startViewTransition(() => setActivePanel("list"));
  };

  const handleValidateSelected = () => {
    if (!selectedNoteId) return;
    validateCard.mutate(selectedNoteId);
  };

  const handleBatchValidate = () => {
    const unvalidated = filteredCards
      .filter((c) => !validationStatuses.get(c.noteId))
      .map((c) => c.noteId);
    if (unvalidated.length === 0) return;
    batchValidate.mutate(unvalidated);
  };

  // scroll middle panel to a preview section
  const scrollToPreview = useCallback((previewId: string) => {
    const el = document.getElementById(previewId);
    if (el && middlePanelRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  // --- active model display name ---
  const activeModelDisplayName = useMemo(() => {
    if (!llmModelsData?.models || !activeModelKey) return null;
    const m = llmModelsData.models.find((m) => `${m.provider}/${m.model}` === activeModelKey);
    return m?.displayName ?? null;
  }, [llmModelsData, activeModelKey]);

  // --- 카드 목록 패널 ---
  const renderCardList = () => (
    <>
      {/* Filter bar */}
      <div className="flex gap-2 px-4 py-3" style={{ borderBottom: "1px solid #e5e7eb" }}>
        {(["all", "needs-review", "unvalidated"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterMode(mode)}
            className={cn(
              "flex-1 py-1.5 px-2.5 text-xs rounded-md text-center cursor-pointer transition-colors",
              filterMode === mode
                ? "border-[#4f46e5] text-[#4f46e5] bg-[#eef2ff]"
                : "text-[#6b7280] bg-[#f9fafb] hover:bg-gray-100",
            )}
            style={{ border: `1px solid ${filterMode === mode ? "#4f46e5" : "#e5e7eb"}` }}
          >
            {mode === "all" ? "전체" : mode === "needs-review" ? "⚠ 문제" : "미검증"}
          </button>
        ))}
      </div>

      {/* Search (mobile only) */}
      {isMobile && (
        <div className="px-4 py-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7280]" />
            <input
              type="text"
              placeholder="카드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
            />
          </div>
        </div>
      )}

      {/* Card items */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingCards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#6b7280]" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-8 text-[#6b7280] text-sm">
            {searchQuery ? "검색 결과가 없습니다" : "카드가 없습니다"}
          </div>
        ) : (
          filteredCards.map((card) => {
            const status = validationStatuses.get(card.noteId) ?? null;
            const isSelected = selectedNoteId === card.noteId;
            return (
              <button
                type="button"
                key={card.noteId}
                onClick={() => handleSelectCard(card.noteId)}
                className={cn(
                  "w-full text-left px-4 py-3 cursor-pointer transition-colors",
                  getCardBorderClass(status),
                  isSelected ? "bg-[#eef2ff]" : "hover:bg-[#f9fafb]",
                )}
                style={{ borderBottom: "1px solid #f3f4f6" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-[#9ca3af]">{card.noteId}</span>
                  {card.analysis.clozeCount > 0 && (
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-1.5 py-px rounded",
                        getBadgeClasses(status),
                      )}
                    >
                      C{card.analysis.clozeCount}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-[#374151] leading-snug line-clamp-2">
                  {card.text.slice(0, 80)}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-xs text-[#9ca3af]"
        style={{ borderTop: "1px solid #e5e7eb" }}
      >
        <span>{filteredCards.length}개 카드</span>
        <div className="flex gap-1.5 items-center text-[11px]">
          {statusCounts.red > 0 && <span>🔴 {statusCounts.red}</span>}
          {statusCounts.yellow > 0 && <span>🟡 {statusCounts.yellow}</span>}
          {statusCounts.green > 0 && <span>🟢 {statusCounts.green}</span>}
        </div>
      </div>
    </>
  );

  // --- 원본 카드 + 수정 미리보기 패널 ---
  const renderMiddlePanel = () => (
    <>
      {/* Header */}
      {!isMobile && (
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 bg-white z-10"
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold">원본 카드</span>
            {selectedNoteId && (
              <span className="text-xs text-[#9ca3af] font-mono">NID: {selectedNoteId}</span>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6" ref={middlePanelRef}>
        {selectedNoteId ? (
          isLoadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
            </div>
          ) : (
            <>
              <ContentRenderer
                content={cardDetail?.text || ""}
                showToggle={true}
                defaultView="rendered"
              />
              {/* Preview areas with anchor IDs */}
              <div id="preview-split" />
              <div id="preview-yagni" />
              <div id="preview-fact" />
              <ActionPreview
                cardContent={cardDetail?.text || ""}
                validationResults={currentValidation?.results}
              />
            </>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-[#6b7280]">
            <div className="text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>왼쪽에서 카드를 선택하세요</p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // --- 검증 결과 패널 (우측) ---
  const renderValidationPanel = () => {
    const cachedResult = currentValidation;
    const isValidating = validateCard.isPending;

    return (
      <div className="flex flex-col min-h-0 h-full">
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid #e5e7eb" }}>
          {(["validate", "related", "action"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDetailTab(tab)}
              className={cn(
                "flex-1 py-3 text-center text-[13px] font-medium cursor-pointer transition-colors",
                detailTab === tab
                  ? "text-[#4f46e5] border-b-2 border-[#4f46e5]"
                  : "text-[#6b7280] border-b-2 border-transparent",
              )}
            >
              {tab === "validate" ? "검증" : tab === "related" ? "연관" : "액션"}
            </button>
          ))}
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-4">
          {detailTab === "validate" ? (
            renderValidateTab(cachedResult, isValidating)
          ) : detailTab === "related" ? (
            renderRelatedTab()
          ) : (
            renderActionTab()
          )}
        </div>

        {/* Panel footer */}
        {selectedNoteId && (
          <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
            <div className="text-[11px] text-[#9ca3af] text-right mb-2">
              총 예상 비용: $0.04 · 토큰: ~3.1K
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="flex-1 py-2 rounded-md text-[13px] font-medium text-[#374151] cursor-pointer transition-colors hover:bg-gray-100"
                style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
              >
                전체 무시
              </button>
              <button
                type="button"
                onClick={handleValidateSelected}
                disabled={isValidating || !selectedNoteId}
                className="flex-1 py-2 rounded-md text-[13px] font-medium text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ background: "#4f46e5" }}
              >
                {isValidating ? "검증 중..." : "✅ 검증 실행"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- 검증 탭 내용 ---
  const renderValidateTab = (
    cachedResult: ReturnType<typeof getValidation>,
    isValidating: boolean,
  ) => {
    if (!selectedNoteId) {
      return (
        <div className="text-center py-6 text-[#6b7280]">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">카드를 선택하면 검증 결과가 표시됩니다</p>
        </div>
      );
    }

    if (isValidating && !cachedResult) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#4f46e5]" />
        </div>
      );
    }

    if (!cachedResult?.results) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-[#6b7280]">
          <Shield className="w-12 h-12 mb-4 text-blue-400" />
          <p className="text-center mb-4">
            6종 검증으로 카드 건강을 진단합니다.
            <br />
            <span className="text-xs">API 비용이 발생할 수 있습니다.</span>
          </p>
        </div>
      );
    }

    // We have results
    const results = cachedResult.results;
    const completedCount = VALIDATION_TYPES.filter(
      (t) => results[t.key as keyof typeof results],
    ).length;

    return (
      <>
        {/* Scan progress / complete indicator */}
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: isValidating ? "#eef2ff" : "#f0fdf4",
            border: `1px solid ${isValidating ? "#c7d2fe" : "#bbf7d0"}`,
          }}
        >
          <div
            className="flex justify-between text-xs"
            style={{ color: isValidating ? "#4f46e5" : "#16a34a" }}
          >
            <span>{isValidating ? "🔄 스캔 진행 중..." : "✅ 스캔 완료"}</span>
            <span>{completedCount}/{VALIDATION_TYPES.length} 검증 완료</span>
          </div>
          <div className="h-1 bg-[#e5e7eb] rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(completedCount / VALIDATION_TYPES.length) * 100}%`,
                background: isValidating ? "#4f46e5" : "#16a34a",
              }}
            />
          </div>
        </div>

        {/* Validation result cards */}
        {VALIDATION_TYPES.map(({ key, label }) => {
          const result = results[key as keyof typeof results];
          if (!result) return null;
          const status = result.status;
          const emoji = getStatusEmoji(status);
          const desc = getValidationDescription(key, result);
          const action = getActionButton(key, result);

          return (
            <div
              key={key}
              className={cn("border rounded-lg p-3 mb-2.5", getValidationItemClass(status))}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{emoji}</span>
                <span className="text-[13px] font-semibold flex-1">{label}</span>
              </div>
              <div className="text-xs text-[#6b7280] leading-relaxed mb-2">{desc}</div>
              {action && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollToPreview(action.previewId)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-medium cursor-pointer border-none",
                      action.className,
                    )}
                  >
                    {action.label}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-medium cursor-pointer border-none bg-[#f3f4f6] text-[#6b7280]"
                  >
                    무시
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* All-in-One section */}
        {selectedNoteId && activeDeck && cardDetail?.text && currentValidation?.results && (
          <AllInOnePanel
            cardContent={cardDetail.text}
            noteId={selectedNoteId}
            deckName={activeDeck}
            validationResults={currentValidation.results}
          />
        )}

        {/* Related tab hint */}
        <div
          className="mt-3 p-2.5 text-center text-xs text-[#9ca3af] rounded-lg"
          style={{ background: "#f9fafb", border: "1px dashed #d1d5db" }}
        >
          <strong>[연관]</strong> 탭에서 연관 노트 및 nid 링크 제안을 확인하세요
        </div>
      </>
    );
  };

  // --- 연관 탭 ---
  const renderRelatedTab = () => {
    if (!currentValidation?.results) {
      return (
        <div className="text-center py-8 text-[#6b7280]">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">먼저 검증을 실행해주세요</p>
        </div>
      );
    }

    const results = currentValidation.results;
    const similarCards = results.similarity?.details.similarCards ?? [];
    const relatedCards = results.context?.details.relatedCards ?? [];

    if (similarCards.length === 0 && relatedCards.length === 0) {
      return (
        <div className="text-center py-8 text-[#6b7280]">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">연관 카드가 없습니다</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 유사 카드 */}
        {similarCards.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Copy className="w-4 h-4" />
              유사 카드
            </h3>
            <div className="space-y-1.5">
              {similarCards.map((card, i) => (
                <button
                  type="button"
                  key={`related-${card.noteId}-${i}`}
                  onClick={() => handleSelectCard(card.noteId)}
                  className="w-full text-left text-xs p-2.5 bg-white rounded-md border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[#9ca3af]">#{card.noteId}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-medium",
                        card.similarity >= 90
                          ? "bg-[#fef2f2] text-[#dc2626]"
                          : card.similarity >= 70
                            ? "bg-[#fffbeb] text-[#d97706]"
                            : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {card.similarity}%
                    </span>
                  </div>
                  <p className="text-[#6b7280] mt-1 line-clamp-2">{card.matchedContent}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 문맥 연결 카드 */}
        {relatedCards.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4" />
              문맥 연결 카드
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {relatedCards.map((nid) => (
                <button
                  type="button"
                  key={`ctx-${nid}`}
                  onClick={() => handleSelectCard(nid)}
                  className="text-xs font-mono px-2 py-1 bg-white border border-[#e5e7eb] rounded hover:bg-[#f9fafb] transition-colors cursor-pointer"
                >
                  #{nid}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- 액션 탭 ---
  const renderActionTab = () => {
    if (!selectedNoteId || !activeDeck || !cardDetail?.text || !currentValidation?.results) {
      return (
        <div className="text-center py-8 text-[#6b7280]">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">검증 완료 후 액션을 확인할 수 있습니다</p>
        </div>
      );
    }

    return (
      <AllInOnePanel
        cardContent={cardDetail.text}
        noteId={selectedNoteId}
        deckName={activeDeck}
        validationResults={currentValidation.results}
      />
    );
  };

  // =================== RENDER ===================

  // 높이: 모바일 dvh-5rem, 데스크톱 vh-4rem (Layout 기준)
  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* ===== 헤더 ===== */}
      {isMobile ? (
        renderMobileHeader()
      ) : (
        <div
          className="flex items-center gap-4 px-6 py-4 bg-white shrink-0"
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          <h1 className="text-[22px] font-bold shrink-0">검증 작업</h1>
          <Select
            value={activeDeck ?? undefined}
            onValueChange={(value) => {
              setSelectedDeck(value || null);
              setSelectedNoteId(null);
            }}
            disabled={!decksData?.decks?.length}
          >
            <SelectTrigger
              className="w-auto min-w-[140px] max-w-[240px] text-[13px] border-[#d1d5db] rounded-md"
            >
              <SelectValue placeholder="덱 선택" />
            </SelectTrigger>
            <SelectContent>
              {decksData?.decks?.map((deck) => (
                <SelectItem key={deck} value={deck}>
                  {deck}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Model info (green dot + name) */}
          <div className="flex items-center gap-1.5 text-[13px] text-[#6b7280]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span>{activeModelDisplayName ?? "모델 없음"}</span>
          </div>

          {/* 개별 검증 button */}
          <button
            type="button"
            onClick={handleValidateSelected}
            disabled={validateCard.isPending || !selectedNoteId}
            className="px-4 py-[7px] rounded-md text-[13px] font-medium text-[#374151] bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-gray-50"
            style={{ border: "1px solid #d1d5db" }}
          >
            {validateCard.isPending ? "검증 중..." : "개별 검증"}
          </button>

          {/* 전체 스캔 button */}
          <button
            type="button"
            onClick={handleBatchValidate}
            disabled={batchValidate.isPending || unvalidatedCount2 === 0}
            className="px-4 py-[7px] rounded-md text-[13px] font-medium text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ background: "#4f46e5" }}
          >
            {batchValidate.isPending ? "스캔 중..." : "🔍 전체 스캔"}
          </button>
        </div>
      )}

      {/* ===== 콘텐츠 ===== */}
      {isMobile ? (
        renderMobileContent()
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 좌측: 카드 목록 (260px) */}
          <div
            className="flex flex-col min-h-0 bg-white shrink-0"
            style={{ width: 260, borderRight: "1px solid #e5e7eb" }}
          >
            {renderCardList()}
          </div>
          {/* 가운데: 원본 카드 + 수정 미리보기 (flex-1) */}
          <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
            {renderMiddlePanel()}
          </div>
          {/* 우측: 검증/연관/액션 패널 (360px) */}
          <div
            className="flex flex-col min-h-0 bg-white shrink-0"
            style={{ width: 360, borderLeft: "1px solid #e5e7eb" }}
          >
            {renderValidationPanel()}
          </div>
        </div>
      )}
    </div>
  );

  // ===== Mobile sub-renderers =====

  function renderMobileHeader() {
    return (
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <h1 className="typo-h1">검증 작업</h1>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
            {allCards.length}개
          </span>
        </div>
        <Select
          value={activeDeck ?? undefined}
          onValueChange={(value) => {
            setSelectedDeck(value || null);
            setSelectedNoteId(null);
            setActivePanel("list");
          }}
          disabled={!decksData?.decks?.length}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="덱 선택" />
          </SelectTrigger>
          <SelectContent>
            {decksData?.decks?.map((deck) => (
              <SelectItem key={deck} value={deck}>
                {deck}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* 모델 선택 바 — 터치 시 설정 시트 */}
        <button
          type="button"
          onClick={() => setShowConfigSheet(true)}
          className="flex items-center gap-3 w-full rounded-lg border border-primary/20 bg-gradient-to-r from-card to-primary/5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {activeProvider ? (
                <ModelBadge provider={activeProvider} />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-muted-foreground truncate">
                {activeModelDisplayName ?? "모델 선택"}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
        <BottomSheet
          open={showConfigSheet}
          onOpenChange={setShowConfigSheet}
          title="검증 모델 설정"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">LLM 모델</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {(llmModelsData?.models ?? []).map((m) => {
                  const key = `${m.provider}/${m.model}`;
                  const isDefault =
                    m.provider === llmModelsData?.defaultModelId.provider &&
                    m.model === llmModelsData?.defaultModelId.model;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        setSelectedModelKey(key);
                        setShowConfigSheet(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-3 text-sm transition-colors hover:bg-accent",
                        key === activeModelKey && "bg-primary/10 font-medium",
                      )}
                    >
                      <div>
                        {m.displayName}
                        {isDefault && " \u2713"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ${m.inputPricePerMillionTokens}/{m.outputPricePerMillionTokens} per 1M tokens
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </BottomSheet>
      </div>
    );
  }

  function renderMobileContent() {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {activePanel === "list" ? (
          <div
            key="list"
            className="vt-list flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-left-2 duration-200"
          >
            {renderCardList()}
            {/* 모바일 배치 검증 */}
            {unvalidatedCount2 > 0 && (
              <div className="px-4 py-3 border-t shrink-0">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleBatchValidate}
                  disabled={batchValidate.isPending}
                >
                  {batchValidate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      검증 중...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-1" />
                      미검증 {unvalidatedCount2}개 전체 스캔
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            key="detail"
            className="vt-detail flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-2 duration-200"
          >
            {/* 뒤로 헤더 */}
            <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                뒤로
              </Button>
              {selectedNoteId && (
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {selectedNoteId}
                </span>
              )}
            </div>
            {/* 탭 */}
            <div role="tablist" className="flex border-b shrink-0">
              {(["validate", "related", "action"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === tab}
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium text-center transition-colors",
                    detailTab === tab
                      ? "border-b-2 border-[#4f46e5] text-[#4f46e5]"
                      : "text-muted-foreground",
                  )}
                >
                  {tab === "validate" ? "원본 + 검증" : tab === "related" ? "연관" : "액션"}
                </button>
              ))}
            </div>
            {/* 탭 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
              {detailTab === "validate" ? (
                <div className="space-y-4">
                  {/* 원본 카드 */}
                  {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
                    </div>
                  ) : (
                    <>
                      <ContentRenderer
                        content={cardDetail?.text || ""}
                        showToggle={true}
                        defaultView="rendered"
                      />
                      <ActionPreview
                        cardContent={cardDetail?.text || ""}
                        validationResults={currentValidation?.results}
                      />
                    </>
                  )}
                  {/* 검증 버튼 */}
                  <div className="flex justify-center">
                    <Button onClick={handleValidateSelected} disabled={validateCard.isPending}>
                      {validateCard.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          검증 중...
                        </>
                      ) : currentValidation ? (
                        "재검증"
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-1" />
                          검증 시작
                        </>
                      )}
                    </Button>
                  </div>
                  {/* 검증 결과 (compact cards) */}
                  {currentValidation?.results && (
                    <div className="space-y-2">
                      {VALIDATION_TYPES.map(({ key, label }) => {
                        const result =
                          currentValidation.results![key as keyof typeof currentValidation.results];
                        if (!result) return null;
                        const status = result.status;
                        const emoji = getStatusEmoji(status);
                        const desc = getValidationDescription(key, result);
                        return (
                          <div
                            key={key}
                            className={cn(
                              "border rounded-lg p-3",
                              getValidationItemClass(status),
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{emoji}</span>
                              <span className="text-[13px] font-semibold">{label}</span>
                            </div>
                            <div className="text-xs text-[#6b7280] leading-relaxed">{desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* 모바일 All-in-One */}
                  {selectedNoteId &&
                    activeDeck &&
                    cardDetail?.text &&
                    currentValidation?.results && (
                      <AllInOnePanel
                        cardContent={cardDetail.text}
                        noteId={selectedNoteId}
                        deckName={activeDeck}
                        validationResults={currentValidation.results}
                      />
                    )}
                </div>
              ) : detailTab === "related" ? (
                renderRelatedTab()
              ) : (
                renderActionTab()
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
