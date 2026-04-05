/**
 * ClinicWorkspace - 카드 검진 작업 공간
 * 데스크톱: 3단 레이아웃 (카드 목록 | 원본 카드 + 수정 미리보기 | 검증 결과 + All-in-One)
 * 모바일: list ↔ detail view transition
 */

import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ContentRenderer } from "../components/card/ContentRenderer";
import { ActionPreview } from "../components/clinic/ActionPreview";
import { AllInOnePanel } from "../components/clinic/AllInOnePanel";
import { VALIDATION_TYPES, type ValidationTypeKey } from "../components/clinic/clinic-constants";
import { ClinicCardList } from "../components/clinic/ClinicCardList";
import { ClinicOriginalCard } from "../components/clinic/ClinicOriginalCard";
import {
  STATUS_LABELS,
  getStatusBg,
  getSimilarityBadgeClass,
} from "../components/clinic/clinic-status-utils";
import { StatusIcon } from "../components/ui/status-icon";
import { ClinicValidationPanel } from "../components/clinic/ClinicValidationPanel";
import { ValidationSection } from "../components/clinic/ValidationSection";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { ModelBadge } from "../components/ui/model-badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useBatchClinicValidate, useClinicCache, useClinicValidate } from "../hooks/useClinicCache";
import { useDecks } from "../hooks/useDecks";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useModelSelection } from "../hooks/useModelSelection";
import type { AllValidationResult } from "../lib/api";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";
import type { MobilePanel } from "../lib/workspace-types";

type DetailTab = "validate" | "related";
type FilterMode = "all" | "unvalidated" | "needs-review";

export function ClinicWorkspace() {
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<MobilePanel>("list");
  const [detailTab, setDetailTab] = useState<DetailTab>("validate");
  const [expandedSections, setExpandedSections] = useState<Set<ValidationTypeKey>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  const { data: decksData } = useDecks();
  const activeDeck = selectedDeck ?? decksData?.decks?.[0] ?? null;
  const { data: cardsData, isLoading: isLoadingCards } = useCards(activeDeck, {
    limit: 500,
    filter: "all",
  });

  const {
    data: cardDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    error: detailError,
    refetch: refetchDetail,
  } = useCardDetail(selectedNoteId);

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
  const totalCards = allCards.length;
  const unvalidatedCount2 = uncachedCount(noteIds);
  const issueCount = useMemo(() => {
    let count = 0;
    for (const [, status] of validationStatuses) {
      if (status === "warning" || status === "error") count++;
    }
    return count;
  }, [validationStatuses]);

  const toggleSection = (section: ValidationTypeKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSelectCard = useCallback(
    (noteId: number | null) => {
      setSelectedNoteId(noteId);
      setExpandedSections(new Set());
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

  // --- 검증 결과 섹션 렌더러 (모바일 인라인용) ---
  const renderValidationSection = (
    typeKey: ValidationTypeKey,
    icon: React.ElementType,
    label: string,
    result: AllValidationResult["results"][keyof AllValidationResult["results"]] | undefined,
  ) => {
    if (!result) return null;
    return (
      <ValidationSection
        key={typeKey}
        isExpanded={expandedSections.has(typeKey)}
        onToggle={() => toggleSection(typeKey)}
        typeKey={typeKey}
        icon={icon}
        label={label}
        result={result}
      />
    );
  };

  const cardListProps = {
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    filterMode,
    onFilterModeChange: setFilterMode,
    issueCount,
    isLoadingCards,
    filteredCards,
    validationStatuses,
    selectedNoteId,
    onSelectCard: handleSelectCard,
  };

  const validationPanelProps = {
    selectedNoteId,
    activeDeck,
    cardDetailText: cardDetail?.text,
    currentValidation,
    isValidating: validateCard.isPending,
    detailTab,
    onDetailTabChange: setDetailTab,
    expandedSections,
    onToggleSection: toggleSection,
    onValidateSelected: handleValidateSelected,
    onSelectCard: handleSelectCard,
  };

  // 높이: 모바일 dvh-5rem, 데스크톱 vh-4rem (Layout 기준)
  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* ===== 헤더 ===== */}
      {isMobile ? (
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2.5">
            <h1 className="typo-h1">Clinic</h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
              {totalCards}개
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
                  {llmModelsData?.models?.find((m) => `${m.provider}/${m.model}` === activeModelKey)
                    ?.displayName ?? "모델 선택"}
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
                          ${m.inputPricePerMillionTokens}/{m.outputPricePerMillionTokens} per 1M
                          tokens
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </BottomSheet>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <h1 className="typo-h1 shrink-0">Clinic</h1>
          <Select
            value={activeDeck ?? undefined}
            onValueChange={(value) => {
              setSelectedDeck(value || null);
              setSelectedNoteId(null);
            }}
            disabled={!decksData?.decks?.length}
          >
            <SelectTrigger className="w-auto min-w-[140px] max-w-[220px] text-sm">
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
          <div className="ml-auto flex items-center gap-3">
            {/* LLM 모델 선택 */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Select
                value={activeModelKey ?? undefined}
                onValueChange={(value) => setSelectedModelKey(value || null)}
                disabled={!llmModelsData?.models?.length}
              >
                <SelectTrigger size="sm" className="w-auto min-w-[120px] max-w-[200px] text-sm">
                  <SelectValue placeholder="모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  {llmModelsData?.availableProviders?.map((provider) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>
                        {{ gemini: "Gemini", openai: "OpenAI" }[provider] ?? provider}
                      </SelectLabel>
                      {llmModelsData.models
                        .filter((m) => m.provider === provider)
                        .map((m) => {
                          const key = `${m.provider}/${m.model}`;
                          const isDefault =
                            m.provider === llmModelsData.defaultModelId.provider &&
                            m.model === llmModelsData.defaultModelId.model;
                          return (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                <span>{m.displayName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  ${m.inputPricePerMillionTokens}/{m.outputPricePerMillionTokens}
                                </span>
                                {isDefault && <span className="text-[10px]">{"\u2713"}</span>}
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>미검증: {unvalidatedCount2}</span>
              {issueCount > 0 && <span className="text-red-500">문제: {issueCount}</span>}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchValidate}
              disabled={batchValidate.isPending || unvalidatedCount2 === 0}
            >
              {batchValidate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  검증 중...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-1" />
                  전체 검증
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ===== 콘텐츠 ===== */}
      {isMobile ? (
        // 모바일: list <-> detail 전환
        <div className="flex-1 flex flex-col min-h-0">
          {activePanel === "list" ? (
            <div
              key="list"
              className="vt-list flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-left-2 duration-200"
            >
              <ClinicCardList {...cardListProps} />
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
                        미검증 {unvalidatedCount2}개 전체 검증
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
              {/* 원본/검증 탭 */}
              <div role="tablist" className="flex border-b shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "validate"}
                  onClick={() => setDetailTab("validate")}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium text-center transition-colors",
                    detailTab === "validate"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  원본 + 검증
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "related"}
                  onClick={() => setDetailTab("related")}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium text-center transition-colors",
                    detailTab === "related"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  연관
                </button>
              </div>
              {/* 탭 콘텐츠 */}
              <div className="flex-1 overflow-y-auto p-4">
                {detailTab === "validate" ? (
                  <div className="space-y-4">
                    {/* 원본 카드 */}
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : isDetailError ? (
                      <div className="flex flex-col items-center justify-center py-8 text-destructive">
                        <AlertTriangle className="w-8 h-8 mb-3" />
                        <span className="font-medium mb-2">카드 상세 조회 실패</span>
                        {detailError && (
                          <p className="text-xs text-muted-foreground text-center max-w-xs bg-muted p-2 rounded">
                            {detailError instanceof Error
                              ? detailError.message
                              : String(detailError)}
                          </p>
                        )}
                        <Button
                          onClick={() => refetchDetail()}
                          variant="outline"
                          size="sm"
                          className="mt-3"
                        >
                          다시 시도
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ContentRenderer
                          content={cardDetail?.text || ""}
                          showToggle={true}
                          defaultView="rendered"
                        />
                        {/* 수정 미리보기 */}
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
                    {/* 검증 결과 */}
                    {currentValidation?.results && (
                      <>
                        <div
                          className={cn(
                            "p-3 rounded-lg border flex items-center gap-3",
                            getStatusBg(currentValidation.status),
                          )}
                        >
                          <StatusIcon status={currentValidation.status} size="md" />
                          <div>
                            <p className="font-medium">{STATUS_LABELS[currentValidation.status]}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(currentValidation.validatedAt).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {VALIDATION_TYPES.map(({ key, icon, label }) =>
                            renderValidationSection(
                              key,
                              icon,
                              label,
                              currentValidation.results![
                                key as keyof typeof currentValidation.results
                              ],
                            ),
                          )}
                        </div>
                      </>
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
                ) : (
                  // 연관 탭 (모바일)
                  <div className="space-y-3">
                    {currentValidation?.results ? (
                      <>
                        {/* 유사 카드 */}
                        {currentValidation.results.similarity?.details.similarCards.length > 0 && (
                          <>
                            <h3 className="text-sm font-semibold flex items-center gap-1.5">
                              <Copy className="w-4 h-4" />
                              유사 카드
                            </h3>
                            {currentValidation.results.similarity.details.similarCards.map(
                              (card, i) => (
                                <button
                                  type="button"
                                  key={`m-sim-${card.noteId}-${i}`}
                                  onClick={() => handleSelectCard(card.noteId)}
                                  className="w-full text-left text-xs p-3 bg-background rounded border hover:bg-muted transition-colors"
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="font-mono">#{card.noteId}</span>
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 rounded",
                                        getSimilarityBadgeClass(card.similarity),
                                      )}
                                    >
                                      {card.similarity}%
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground mt-1 line-clamp-2">
                                    {card.matchedContent}
                                  </p>
                                </button>
                              ),
                            )}
                          </>
                        )}
                        {/* 문맥 연결 카드 */}
                        {currentValidation.results.context?.details.relatedCards.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                              <Link2 className="w-4 h-4" />
                              문맥 연결 카드
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {currentValidation.results.context.details.relatedCards.map((nid) => (
                                <button
                                  type="button"
                                  key={`m-ctx-${nid}`}
                                  onClick={() => handleSelectCard(nid)}
                                  className="text-xs font-mono px-2 py-1 bg-background border rounded hover:bg-muted transition-colors"
                                >
                                  #{nid}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 둘 다 없을 때 */}
                        {!currentValidation.results.similarity?.details.similarCards.length &&
                          !currentValidation.results.context?.details.relatedCards.length && (
                            <div className="text-center py-8 text-muted-foreground">
                              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">연관 카드가 없습니다</p>
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">먼저 검증을 실행해주세요</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // 데스크톱: 3패널 레이아웃 — border-l dividers ("island" 제거)
        <div className="flex-1 grid grid-cols-[280px_1fr_360px] min-h-0 border rounded-lg overflow-hidden">
          {/* 좌측: 카드 목록 */}
          <div className="flex flex-col min-h-0">
            <ClinicCardList {...cardListProps} />
          </div>
          {/* 가운데: 원본 카드 + 수정 미리보기 */}
          <div className="flex flex-col min-h-0 border-l">
            <ClinicOriginalCard
              selectedNoteId={selectedNoteId}
              isLoadingDetail={isLoadingDetail}
              isDetailError={isDetailError}
              detailError={detailError}
              refetchDetail={refetchDetail}
              cardDetailText={cardDetail?.text}
              validationResults={currentValidation?.results}
            />
          </div>
          {/* 우측: 검증 결과 + All-in-One */}
          <div className="flex flex-col min-h-0 border-l">
            <ClinicValidationPanel {...validationPanelProps} />
          </div>
        </div>
      )}
    </div>
  );
}
