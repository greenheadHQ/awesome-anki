/**
 * SplitWorkspace - 카드 분할 작업 공간
 * 데스크톱: 3단 레이아웃 (후보 목록 | 원본 카드 | 분할 미리보기)
 * 모바일: list↔detail view transition (후보 목록 ↔ 원본/미리보기 탭)
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Scissors,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ContentRenderer } from "../components/card/ContentRenderer";
import { SplitPreviewCard } from "../components/card/DiffViewer";
import { HelpTooltip } from "../components/help/HelpTooltip";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import type { CompactSelectorItem } from "../components/ui/compact-selector";
import { formatCostUsd, ModelBadge } from "../components/ui/model-badge";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ValidationPanel } from "../components/validation/ValidationPanel";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { useDifficultCards } from "../hooks/useDifficultCards";
import { useIsMobile } from "../hooks/useMediaQuery";
import { usePromptVersions } from "../hooks/usePrompts";
import {
  getCachedSplitPreview,
  useLLMModels,
  useSplitApply,
  useSplitPreview,
  useSplitReject,
} from "../hooks/useSplit";
import type { CardSummary, DifficultCard, SplitPreviewResult } from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { recordSyncAttempt } from "../lib/sync-status";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";

// NOTE: core의 REJECTION_REASONS는 런타임 import 시 브라우저 번들 경계를 넘기 때문에
// web 패키지에서 동일 스키마를 로컬 상수로 유지한다.
const REJECTION_REASONS = [
  { id: "too-granular", label: "분할이 너무 세분화" },
  { id: "context-missing", label: "맥락 태그 부적절" },
  { id: "char-exceeded", label: "글자수 초과" },
  { id: "cloze-inappropriate", label: "Cloze 위치/내용 부적절" },
  { id: "quality-low", label: "전반적 품질 미달" },
  { id: "other", label: "기타" },
] as const;

type WorkspaceMode = "candidates" | "difficult";
type CardAnalysisStatus = "pending" | "cached" | "error" | "none";
type MobilePanel = "list" | "detail";

interface SplitCandidate {
  noteId: number;
  text: string;
  analysis: {
    canSplit: boolean;
    clozeCount: number;
  };
  difficulty?: {
    score: number;
    lapses: number;
    easeFactor: number;
    interval: number;
    reps: number;
    reasons: string[];
  };
}

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

function CardStatusIcon({ status }: { status: CardAnalysisStatus }) {
  switch (status) {
    case "pending":
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />;
    case "cached":
      return <Check className="w-3.5 h-3.5 text-green-600" />;
    case "error":
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return null;
  }
}

/**
 * 반려 Popover — Radix Portal로 overflow clipping 방지
 */
function RejectPopover({
  canReject,
  onReject,
}: {
  canReject: boolean;
  onReject: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  const handleReject = (reason: string) => {
    setOpen(false);
    setShowOther(false);
    setOtherText("");
    onReject(reason);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setShowOther(false);
          setOtherText("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          disabled={!canReject}
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <X className="w-4 h-4 mr-1" />
          분할 반려
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-0">
        <div className="py-1">
          {REJECTION_REASONS.filter((r) => r.id !== "other").map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => handleReject(reason.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {reason.label}
            </button>
          ))}
          <div className="border-t">
            {showOther ? (
              <div className="p-2">
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="반려 사유를 입력하세요..."
                  className="w-full text-sm border rounded p-2 resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && otherText.trim()) {
                      e.preventDefault();
                      handleReject(otherText.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (otherText.trim()) handleReject(otherText.trim());
                  }}
                  disabled={!otherText.trim()}
                  className="mt-1 w-full"
                >
                  전송
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowOther(true)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                기타...
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SplitWorkspace() {
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<SplitCandidate | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("candidates");
  const [activePanel, setActivePanel] = useState<MobilePanel>("list");
  const [detailTab, setDetailTab] = useState<"original" | "preview">("original");
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  // 분석 상태 추적 — noteId:provider/model 복합 키로 멀티모델 분리
  const [pendingAnalyses, setPendingAnalyses] = useState<Set<string>>(new Set());
  const [errorAnalyses, setErrorAnalyses] = useState<Map<string, string>>(new Map());

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
  const { data: llmModelsData } = useLLMModels();
  const defaultModelKey = llmModelsData
    ? `${llmModelsData.defaultModelId.provider}/${llmModelsData.defaultModelId.model}`
    : null;
  const activeModelKey = selectedModelKey ?? defaultModelKey;
  const activeProvider = activeModelKey?.split("/")[0];
  const activeModel = activeModelKey?.split("/").slice(1).join("/");

  // 선택된 카드의 상세 정보 (전체 텍스트 포함)
  const { data: cardDetail, isLoading: isLoadingDetail } = useCardDetail(
    selectedCard?.noteId ?? null,
  );

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
  const getCardStatus = (noteId: number): CardAnalysisStatus => {
    const key = analysisKey(noteId);
    if (pendingAnalyses.has(key)) return "pending";
    if (errorAnalyses.has(key)) return "error";
    const cached = getCachedSplitPreview(
      queryClient,
      noteId,
      activeVersionId || undefined,
      activeProvider,
      activeModel,
    );
    if (cached) return "cached";
    return "none";
  };

  // 카드 선택 핸들러
  const handleSelectCard = (card: SplitCandidate | null) => {
    setSelectedCard(card);
    if (card) {
      splitPreview.reset();
      setDetailTab("original");

      // 모바일: detail 뷰로 전환
      if (isMobile) {
        startViewTransition(() => setActivePanel("detail"));
      }
    }
  };

  // 모바일: 리스트로 돌아가기
  const handleBackToList = () => {
    startViewTransition(() => {
      setActivePanel("list");
    });
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
    setPendingAnalyses((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setErrorAnalyses((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

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
          setPendingAnalyses((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
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
          setPendingAnalyses((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          setErrorAnalyses((prev) => {
            const next = new Map(prev);
            next.set(key, message);
            return next;
          });
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
  const activeList = mode === "candidates" ? candidates : difficultCards;
  const activeCount = mode === "candidates" ? candidates.length : (difficultData?.total ?? 0);

  const isBusy = splitReject.isPending || splitApply.isPending;
  const canReject =
    !!selectedCard &&
    !!activeDeck &&
    !!previewData?.splitCards &&
    !!previewData.sessionId &&
    !isBusy;

  // 카드 리스트 아이템 렌더러
  const renderCardListItem = (card: SplitCandidate) => {
    const status = getCardStatus(card.noteId);
    return (
      <button
        type="button"
        key={card.noteId}
        onClick={() => handleSelectCard(card)}
        className={cn(
          "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
          selectedCard?.noteId === card.noteId && "bg-primary/10",
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
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {card.analysis.clozeCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                C{card.analysis.clozeCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderDifficultCardListItem = (card: SplitCandidate) => {
    const status = getCardStatus(card.noteId);
    return (
      <button
        type="button"
        key={card.noteId}
        onClick={() => handleSelectCard(card)}
        className={cn(
          "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
          selectedCard?.noteId === card.noteId && "bg-primary/10",
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
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>lapses: {card.difficulty?.lapses}</span>
              <span>
                ease: {card.difficulty ? (card.difficulty.easeFactor / 10).toFixed(0) : 0}%
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                (card.difficulty?.score ?? 0) > 70
                  ? "bg-red-100 text-red-700"
                  : (card.difficulty?.score ?? 0) > 40
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700",
              )}
            >
              {card.difficulty?.score ?? 0}
            </span>
          </div>
        </div>
      </button>
    );
  };

  // --- 공유 콘텐츠 렌더러 ---

  /** 후보 목록 패널 (모드 토글 + 카드 리스트) */
  const renderCandidatesList = () => (
    <>
      <div className="py-3 px-4 border-b shrink-0">
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => {
              setMode("candidates");
              handleSelectCard(null);
              if (isMobile) setActivePanel("list");
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
              setMode("difficult");
              handleSelectCard(null);
              if (isMobile) setActivePanel("list");
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
        ) : mode === "candidates" ? (
          <div className="divide-y">{candidates.map(renderCardListItem)}</div>
        ) : (
          <div className="divide-y">{difficultCards.map(renderDifficultCardListItem)}</div>
        )}
      </div>
    </>
  );

  /** 원본 카드 패널 */
  const renderOriginalCard = () => (
    <>
      {!isMobile && (
        <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold">원본 카드</span>
          {selectedCard && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowValidation(!showValidation)}
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

  /** 분할 미리보기 패널 (반려 Popover 포함) */
  const renderPreviewContent = () => (
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
          <div className="flex flex-col items-center justify-center h-full text-destructive">
            <AlertTriangle className="w-8 h-8 mb-3" />
            <span className="font-medium mb-2">분할 분석 실패</span>
            <p className="text-xs text-muted-foreground text-center max-w-xs bg-muted p-2 rounded">
              {currentCardError}
            </p>
            <Button onClick={handleRequestSplit} variant="outline" size="sm" className="mt-3">
              다시 시도
            </Button>
          </div>
        ) : splitPreview.isError &&
          splitPreview.variables?.noteId === selectedCard.noteId &&
          splitPreview.variables?.versionId === (activeVersionId || undefined) &&
          splitPreview.variables?.provider === activeProvider &&
          splitPreview.variables?.model === activeModel ? (
          <div className="flex flex-col items-center justify-center h-full text-destructive">
            <AlertTriangle className="w-8 h-8 mb-3" />
            <span className="font-medium mb-2">분할 분석 실패</span>
            {splitPreview.error && (
              <p className="text-xs text-muted-foreground text-center max-w-xs bg-muted p-2 rounded">
                {splitPreview.error instanceof Error
                  ? splitPreview.error.message
                  : String(splitPreview.error)}
              </p>
            )}
            <Button onClick={handleRequestSplit} variant="outline" size="sm" className="mt-3">
              다시 시도
            </Button>
          </div>
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
              onClick={handleRequestSplit}
              disabled={
                !llmModelsData ||
                splitPreview.isPending ||
                pendingAnalyses.has(analysisKey(selectedCard?.noteId ?? -1))
              }
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
              {renderCandidatesList()}
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
                {detailTab === "original" ? renderOriginalCard() : renderPreviewContent()}
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
            <Card className="flex-1 flex flex-col min-h-0">{renderCandidatesList()}</Card>
          </div>

          {/* 중앙: 원본 카드 */}
          <div className="col-span-5 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {renderOriginalCard()}
            </Card>
          </div>

          {/* 오른쪽: 분할 미리보기 */}
          <div className="col-span-4 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              {renderPreviewContent()}

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
