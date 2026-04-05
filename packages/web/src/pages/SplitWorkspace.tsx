/**
 * SplitWorkspace - 카드 분할 작업 공간
 * 데스크톱: 3단 레이아웃 (후보 목록 | 원본 카드 | 분할 미리보기)
 * 모바일: list↔detail view transition (후보 목록 ↔ 원본/미리보기 탭)
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Loader2,
  Scissors,
  Shield,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { HelpTooltip } from "../components/help/HelpTooltip";
import { CandidatesList } from "../components/split/CandidatesList";
import { OriginalCard } from "../components/split/OriginalCard";
import { PreviewContent } from "../components/split/PreviewContent";
import { RejectPopover } from "../components/split/RejectPopover";
import type { SplitCandidate } from "../components/split/types";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import type { CompactSelectorItem } from "../components/ui/compact-selector";
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
import { useDecks } from "../hooks/useDecks";
import { useDifficultCards } from "../hooks/useDifficultCards";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useModelSelection } from "../hooks/useModelSelection";
import { usePromptVersions } from "../hooks/usePrompts";
import {
  getCachedSplitPreview,
  useSplitApply,
  useSplitPreview,
  useSplitReject,
} from "../hooks/useSplit";
import { useSplitAnalysisState } from "../hooks/useSplitAnalysisState";
import { useSplitNavigation } from "../hooks/useSplitNavigation";
import type { CardSummary, DifficultCard, SplitPreviewResult } from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { recordSyncAttempt } from "../lib/sync-status";
import { cn } from "../lib/utils";

function mapDifficultToCandidate(card: DifficultCard): SplitCandidate {
  return {
    noteId: card.noteId,
    text: card.text,
    analysis: {
      canSplit: true,
      clozeCount: 0,
    },
    difficulty: {
      score: card.difficultyScore,
      lapses: card.lapses,
      easeFactor: card.easeFactor,
      interval: card.interval,
      reps: card.reps,
      reasons: card.difficultyReasons,
    },
  };
}

function mapCardSummaryToCandidate(card: CardSummary): SplitCandidate {
  return {
    noteId: card.noteId,
    text: card.text,
    analysis: {
      canSplit: card.analysis.canSplit,
      clozeCount: card.analysis.clozeCount,
    },
  };
}

export function SplitWorkspace() {
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  const {
    selectedCard,
    mode,
    activePanel,
    detailTab,
    setMode,
    setActivePanel,
    setDetailTab,
    handleSelectCard: navSelectCard,
    handleBackToList,
  } = useSplitNavigation(isMobile);

  const { pendingAnalyses, errorAnalyses, addPending, removePending, setError, clearError } =
    useSplitAnalysisState();

  const queryClient = useQueryClient();
  const { data: decksData } = useDecks();
  const activeDeck = selectedDeck ?? decksData?.decks?.[0] ?? null;
  const { data: cardsData, isLoading: isLoadingCards } = useCards(activeDeck, {
    limit: 500,
    filter: "all",
  });

  const { data: difficultData, isLoading: isLoadingDifficult } = useDifficultCards(activeDeck, {
    limit: 200,
  });

  // 프롬프트 버전 관련
  const { data: promptVersionsData, isLoading: isLoadingVersions } = usePromptVersions();
  const activeVersionId =
    selectedVersionId ??
    promptVersionsData?.activeVersionId ??
    promptVersionsData?.versions?.[0]?.id ??
    null;

  // LLM 모델 관련
  const { activeModelKey, activeProvider, activeModel, setSelectedModelKey, llmModelsData } =
    useModelSelection();

  // 선택된 카드의 상세 정보 (전체 텍스트 포함)
  const {
    data: cardDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    error: detailError,
    refetch: refetchDetail,
  } = useCardDetail(selectedCard?.noteId ?? null);

  const splitPreview = useSplitPreview();
  const splitApply = useSplitApply();
  const splitReject = useSplitReject();

  // 현재 선택된 카드의 캐시된 미리보기 결과 조회
  const cachedPreview = selectedCard
    ? getCachedSplitPreview(
        queryClient,
        selectedCard.noteId,
        activeVersionId || undefined,
        activeProvider,
        activeModel,
      )
    : undefined;

  // 캐시 있으면 캐시 사용, 없으면 mutation 결과 사용
  // DA Fix: mutation 결과가 현재 선택된 모델과 일치할 때만 사용 (stale preview 방지)
  const mutationMatchesCurrent =
    splitPreview.data &&
    splitPreview.variables?.noteId === selectedCard?.noteId &&
    splitPreview.variables?.versionId === (activeVersionId || undefined) &&
    splitPreview.variables?.provider === activeProvider &&
    splitPreview.variables?.model === activeModel;
  const previewData: SplitPreviewResult | undefined =
    cachedPreview || (mutationMatchesCurrent ? splitPreview.data : undefined);

  // 현재 카드+모델에 대한 로딩 중인지 확인 (다른 카드/모델 분석 중에는 영향 없음)
  const isLoadingCurrentCard =
    splitPreview.isPending &&
    splitPreview.variables?.noteId === selectedCard?.noteId &&
    splitPreview.variables?.versionId === (activeVersionId || undefined) &&
    splitPreview.variables?.provider === activeProvider &&
    splitPreview.variables?.model === activeModel;

  // 현재 선택된 카드+모델의 에러 메시지 확인
  const analysisKey = (nid: number) =>
    `${nid}:${activeVersionId || "default"}:${activeProvider}/${activeModel}`;
  const currentCardError = selectedCard
    ? errorAnalyses.get(analysisKey(selectedCard.noteId))
    : undefined;

  // 카드 상태 헬퍼
  const getCardStatus = (noteId: number) => {
    const key = analysisKey(noteId);
    if (pendingAnalyses.has(key)) return "pending" as const;
    if (errorAnalyses.has(key)) return "error" as const;
    const cached = getCachedSplitPreview(
      queryClient,
      noteId,
      activeVersionId || undefined,
      activeProvider,
      activeModel,
    );
    if (cached) return "cached" as const;
    return "none" as const;
  };

  // 카드 선택 — splitPreview.reset을 연결
  const handleSelectCard = (card: SplitCandidate | null) => {
    navSelectCard(card, () => splitPreview.reset());
  };

  // noteId로 카드를 찾아 선택 (toast action에서 사용 — stale closure 방지)
  const handleSelectByNoteId = (noteId: number) => {
    const list = mode === "candidates" ? candidates : difficultCards;
    const found = list.find((c) => c.noteId === noteId);
    if (found) handleSelectCard(found);
  };

  // 분할 분석 요청 핸들러
  const handleRequestSplit = () => {
    if (!selectedCard) return;
    const key = analysisKey(selectedCard.noteId);
    // 연타 방지
    if (pendingAnalyses.has(key)) return;

    const noteId = selectedCard.noteId;

    // 상태 전이: pending 추가, error 제거
    addPending(key);
    clearError(key);

    splitPreview.mutate(
      {
        noteId,
        versionId: activeVersionId || undefined,
        deckName: activeDeck || undefined,
        provider: activeProvider,
        model: activeModel,
      },
      {
        onSuccess: () => {
          removePending(key);
          // 모바일: 분석 완료 시 미리보기 탭으로 자동 전환
          if (isMobile) setDetailTab("preview");
          toast.success(`카드 ${noteId} 분석 완료`, {
            action: {
              label: "보기",
              onClick: () => handleSelectByNoteId(noteId),
            },
          });
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          removePending(key);
          setError(key, message);
          toast.error(`카드 ${noteId} 분석 실패: ${message}`);
        },
      },
    );
  };

  const candidates = (cardsData?.cards || [])
    .map(mapCardSummaryToCandidate)
    .filter((card) => card.analysis.canSplit);

  const difficultCards = (difficultData?.cards || []).map(mapDifficultToCandidate);

  const handleApply = () => {
    if (!selectedCard || !activeDeck || !previewData?.splitCards) return;
    if (!previewData.sessionId) {
      toast.warning("히스토리 세션이 없어 적용할 수 없습니다. 미리보기를 다시 실행해주세요.");
      return;
    }

    splitApply.mutate(
      {
        sessionId: previewData.sessionId,
        noteId: selectedCard.noteId,
        deckName: activeDeck,
        splitCards: previewData.splitCards.map((c) => ({
          title: c.title,
          content: c.content,
        })),
        mainCardIndex: previewData.mainCardIndex ?? 0,
      },
      {
        onSuccess: (result) => {
          const syncState = recordSyncAttempt(result.syncResult);

          if (syncState.hasPendingChanges) {
            toast.warning(
              `분할은 적용되었지만 동기화는 실패했습니다: ${syncState.lastError || "unknown"}`,
            );
          } else {
            toast.success("분할이 적용되고 서버와 동기화되었습니다");
          }

          if (result.historyWarning) {
            toast.warning(result.historyWarning);
          }

          // 성공 후 목록에서 제거하고 다음 카드 선택
          const activeList = mode === "candidates" ? candidates : difficultCards;
          const nextCard = activeList.find((c) => c.noteId !== selectedCard.noteId);
          if (nextCard) {
            handleSelectCard(nextCard);
          } else {
            handleSelectCard(null);
            if (isMobile) setActivePanel("list");
          }
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`분할 적용 실패: ${message}`);
        },
      },
    );
  };

  const handleReject = (rejectionReason: string) => {
    if (!selectedCard || !activeDeck || !previewData?.splitCards) return;
    if (!previewData.sessionId) {
      toast.warning("히스토리 세션이 없어 반려할 수 없습니다. 미리보기를 다시 실행해주세요.");
      return;
    }

    splitReject.mutate(
      {
        sessionId: previewData.sessionId,
        rejectionReason,
      },
      {
        onSuccess: (result) => {
          queryClient.removeQueries({
            queryKey: queryKeys.split.preview(
              selectedCard.noteId,
              activeVersionId || undefined,
              activeProvider,
              activeModel,
            ),
          });
          splitPreview.reset();
          toast.info("분할 결과가 반려되었습니다");
          if (result.historyWarning) {
            toast.warning(result.historyWarning);
          }
        },
        onError: () => {
          toast.warning("반려 기록 실패");
        },
      },
    );
  };

  const isLoadingList = mode === "candidates" ? isLoadingCards : isLoadingDifficult;
  const activeCount = mode === "candidates" ? candidates.length : (difficultData?.total ?? 0);

  const isBusy = splitReject.isPending || splitApply.isPending;
  const canReject =
    !!selectedCard &&
    !!activeDeck &&
    !!previewData?.splitCards &&
    !!previewData.sessionId &&
    !isBusy;

  // CompactSelector 아이템 빌드
  const promptSelectorItems: CompactSelectorItem[] = (promptVersionsData?.versions || []).map(
    (v) => ({
      key: v.id,
      label: `${v.name}${v.id === promptVersionsData?.activeVersionId ? " \u2713" : ""}`,
    }),
  );

  const modelSelectorItems: CompactSelectorItem[] = (llmModelsData?.models || []).map((m) => {
    const key = `${m.provider}/${m.model}`;
    const isDefault =
      m.provider === llmModelsData?.defaultModelId.provider &&
      m.model === llmModelsData?.defaultModelId.model;
    return {
      key,
      label: `${m.displayName}${isDefault ? " \u2713" : ""}`,
      description: `$${m.inputPricePerMillionTokens}/$${m.outputPricePerMillionTokens} per 1M tokens`,
    };
  });

  // splitPreview 에러가 현재 카드+모델에 대한 것인지 확인
  const splitPreviewMatchesCurrent =
    splitPreview.isError &&
    splitPreview.variables?.noteId === selectedCard?.noteId &&
    splitPreview.variables?.versionId === (activeVersionId || undefined) &&
    splitPreview.variables?.provider === activeProvider &&
    splitPreview.variables?.model === activeModel;

  // 높이: 모바일/태블릿 dvh-5rem (h-14 헤더 + p-3 x2), 데스크톱(lg) vh-4rem (p-6 x2)
  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* ===== 모바일 헤더 (< lg) ===== */}
      {isMobile ? (
        <div className="flex flex-col gap-3 overflow-hidden">
          {/* Row 1: 제목 + 카운트 배지 */}
          <div className="flex items-center gap-2.5">
            <h1 className="typo-h1">분할 작업</h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
              {activeCount}개
            </span>
          </div>
          {/* Row 2: 덱 셀렉터 (full-width) */}
          <Select
            value={activeDeck ?? undefined}
            onValueChange={(value) => {
              setSelectedDeck(value || null);
              handleSelectCard(null);
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
          {/* Row 3: 설정 요약 바 — 터치 시 설정 시트 열림 */}
          <button
            type="button"
            onClick={() => setShowConfigSheet(true)}
            className="flex items-center gap-3 w-full rounded-lg border border-primary/20 bg-gradient-to-r from-card to-primary/5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm truncate">
                  {promptSelectorItems.find((i) => i.key === activeVersionId)?.label ||
                    (isLoadingVersions ? "로딩 중..." : "프롬프트 선택")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeProvider ? (
                  <ModelBadge provider={activeProvider} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs text-muted-foreground truncate">
                  {modelSelectorItems.find((i) => i.key === activeModelKey)?.label || "모델 선택"}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
          <BottomSheet open={showConfigSheet} onOpenChange={setShowConfigSheet} title="분할 설정">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">
                  프롬프트 버전
                </p>
                <div className="divide-y rounded-lg border overflow-hidden">
                  {promptSelectorItems.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => {
                        setSelectedVersionId(item.key);
                        setShowConfigSheet(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-3 text-sm transition-colors hover:bg-accent",
                        item.key === activeVersionId && "bg-primary/10 font-medium",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">LLM 모델</p>
                <div className="divide-y rounded-lg border overflow-hidden">
                  {modelSelectorItems.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => {
                        setSelectedModelKey(item.key);
                        setShowConfigSheet(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-3 text-sm transition-colors hover:bg-accent",
                        item.key === activeModelKey && "bg-primary/10 font-medium",
                      )}
                    >
                      <div>{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </BottomSheet>
        </div>
      ) : (
        /* ===== 데스크톱 헤더 (lg+) — 기존 구조 유지 ===== */
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <h1 className="typo-h1 shrink-0">분할 작업</h1>
          <Select
            value={activeDeck ?? undefined}
            onValueChange={(value) => {
              setSelectedDeck(value || null);
              handleSelectCard(null);
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
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {/* 프롬프트 버전 선택 */}
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <HelpTooltip helpKey="promptVersionSelect" />
              <Select
                value={activeVersionId ?? undefined}
                onValueChange={(value) => setSelectedVersionId(value || null)}
                disabled={
                  isLoadingVersions ||
                  !promptVersionsData?.versions ||
                  promptVersionsData.versions.length === 0
                }
              >
                <SelectTrigger className="w-auto min-w-[120px] max-w-[220px] text-sm">
                  <SelectValue placeholder={isLoadingVersions ? "로딩 중..." : "버전 없음"} />
                </SelectTrigger>
                <SelectContent>
                  {promptVersionsData?.versions?.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.name}
                      {version.id === promptVersionsData.activeVersionId && " \u2713"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {activeCount}개 {mode === "candidates" ? "분할 후보" : "재분할 대상"}
            </span>
          </div>
        </div>
      )}

      {/* 모바일: list↔detail 뷰 전환 */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0">
          {activePanel === "list" ? (
            <div
              key="list"
              className="vt-list flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-left-2 duration-200"
            >
              <CandidatesList
                mode={mode}
                candidates={candidates}
                difficultCards={difficultCards}
                isLoadingList={isLoadingList}
                selectedNoteId={selectedCard?.noteId ?? null}
                isMobile={isMobile}
                getCardStatus={getCardStatus}
                onSelectCard={handleSelectCard}
                onChangeMode={setMode}
                onSetActivePanel={setActivePanel}
              />
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
                {selectedCard && (
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {selectedCard.noteId}
                  </span>
                )}
                {/* 검증 토글 */}
                {selectedCard && (
                  <button
                    type="button"
                    onClick={() => setShowValidation(!showValidation)}
                    className={cn(
                      "ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                      showValidation
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80",
                    )}
                  >
                    <Shield className="w-3 h-3" />
                    검증
                  </button>
                )}
              </div>

              {/* 원본/미리보기 탭 */}
              <div role="tablist" className="flex border-b shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "original"}
                  onClick={() => setDetailTab("original")}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-all duration-200",
                    detailTab === "original"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  원본
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "preview"}
                  onClick={() => setDetailTab("preview")}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-all duration-200",
                    detailTab === "preview"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  미리보기
                </button>
              </div>

              {/* 탭 콘텐츠 */}
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                {detailTab === "original" ? (
                  <OriginalCard
                    isMobile={isMobile}
                    selectedCard={selectedCard}
                    cardDetail={cardDetail}
                    isLoadingDetail={isLoadingDetail}
                    isDetailError={isDetailError}
                    detailError={detailError}
                    refetchDetail={refetchDetail}
                    showValidation={showValidation}
                    onToggleValidation={() => setShowValidation(!showValidation)}
                    activeDeck={activeDeck}
                  />
                ) : (
                  <PreviewContent
                    isMobile={isMobile}
                    selectedCard={selectedCard}
                    isLoadingCurrentCard={isLoadingCurrentCard}
                    currentCardError={currentCardError}
                    splitPreviewIsError={splitPreview.isError}
                    splitPreviewError={splitPreview.error}
                    splitPreviewMatchesCurrent={!!splitPreviewMatchesCurrent}
                    previewData={previewData}
                    cachedPreview={cachedPreview}
                    activeVersionId={activeVersionId}
                    activeProvider={activeProvider}
                    activeModel={activeModel}
                    llmModelsReady={!!llmModelsData}
                    splitPreviewIsPending={splitPreview.isPending}
                    isAnalysisPending={pendingAnalyses.has(analysisKey(selectedCard?.noteId ?? -1))}
                    onRequestSplit={handleRequestSplit}
                  />
                )}
              </div>

              {/* Sticky footer — 적용/반려 버튼 */}
              {selectedCard && previewData?.splitCards && (
                <div className="border-t p-3 shrink-0">
                  <div className="flex gap-2">
                    <RejectPopover canReject={canReject} onReject={handleReject} />
                    <Button onClick={handleApply} disabled={isBusy} className="flex-1">
                      {splitApply.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          적용 중...
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4 mr-2" />
                          분할 적용
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* 데스크톱: 3단 레이아웃 */
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* 왼쪽: 후보 목록 */}
          <div className="col-span-3 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <CandidatesList
                mode={mode}
                candidates={candidates}
                difficultCards={difficultCards}
                isLoadingList={isLoadingList}
                selectedNoteId={selectedCard?.noteId ?? null}
                isMobile={isMobile}
                getCardStatus={getCardStatus}
                onSelectCard={handleSelectCard}
                onChangeMode={setMode}
                onSetActivePanel={setActivePanel}
              />
            </Card>
          </div>

          {/* 중앙: 원본 카드 */}
          <div className="col-span-5 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <OriginalCard
                isMobile={isMobile}
                selectedCard={selectedCard}
                cardDetail={cardDetail}
                isLoadingDetail={isLoadingDetail}
                isDetailError={isDetailError}
                detailError={detailError}
                refetchDetail={refetchDetail}
                showValidation={showValidation}
                onToggleValidation={() => setShowValidation(!showValidation)}
                activeDeck={activeDeck}
              />
            </Card>
          </div>

          {/* 오른쪽: 분할 미리보기 */}
          <div className="col-span-4 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <PreviewContent
                isMobile={isMobile}
                selectedCard={selectedCard}
                isLoadingCurrentCard={isLoadingCurrentCard}
                currentCardError={currentCardError}
                splitPreviewIsError={splitPreview.isError}
                splitPreviewError={splitPreview.error}
                splitPreviewMatchesCurrent={!!splitPreviewMatchesCurrent}
                previewData={previewData}
                cachedPreview={cachedPreview}
                activeVersionId={activeVersionId}
                activeProvider={activeProvider}
                activeModel={activeModel}
                llmModelsReady={!!llmModelsData}
                splitPreviewIsPending={splitPreview.isPending}
                isAnalysisPending={pendingAnalyses.has(analysisKey(selectedCard?.noteId ?? -1))}
                onRequestSplit={handleRequestSplit}
              />

              {/* 하단 액션 영역 */}
              {selectedCard && previewData && previewData.splitCards && (
                <div className="px-4 py-3 border-t shrink-0">
                  <div className="flex gap-2">
                    {/* 반려 버튼 */}
                    <RejectPopover canReject={canReject} onReject={handleReject} />

                    {/* 적용 버튼 */}
                    <Button onClick={handleApply} disabled={isBusy} className="flex-1">
                      {splitApply.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          적용 중...
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4 mr-2" />
                          분할 적용
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
