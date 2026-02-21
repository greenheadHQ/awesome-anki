/**
 * SplitWorkspace - 카드 분할 작업 공간
 * 데스크톱: 3단 레이아웃 (후보 목록 | 원본 카드 | 분할 미리보기)
 * 모바일: 탭 전환 방식
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Scissors,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ContentRenderer } from "../components/card/ContentRenderer";
import { SplitPreviewCard } from "../components/card/DiffViewer";
import { HelpTooltip } from "../components/help/HelpTooltip";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/Popover";
import { ValidationPanel } from "../components/validation/ValidationPanel";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { useDifficultCards } from "../hooks/useDifficultCards";
import { useAddPromptHistory, usePromptVersions } from "../hooks/usePrompts";
import {
  getCachedSplitPreview,
  useSplitApply,
  useSplitPreview,
} from "../hooks/useSplit";
import type {
  CardSummary,
  DifficultCard,
  SplitPreviewResult,
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { cn } from "../lib/utils";

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
type MobilePanel = "candidates" | "original" | "preview";

interface SplitCandidate {
  noteId: number;
  text: string;
  analysis: {
    canHardSplit: boolean;
    canSoftSplit: boolean;
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

function useIsMobile() {
  // SplitWorkspace는 3열 그리드에 충분한 너비가 필요하므로 lg: (1024px) 사용
  const [isMobile, setIsMobile] = useState(
    () => !window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function mapDifficultToCandidate(card: DifficultCard): SplitCandidate {
  return {
    noteId: card.noteId,
    text: card.text,
    analysis: {
      canHardSplit: false,
      canSoftSplit: true,
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
      canHardSplit: card.analysis.canHardSplit,
      canSoftSplit:
        card.analysis.canSoftSplit ??
        (!card.analysis.canHardSplit && card.analysis.clozeCount > 3),
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
  const isMobile = useIsMobile();

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<SplitCandidate | null>(null);
  const [splitType, setSplitType] = useState<"hard" | "soft">("hard");
  const [showValidation, setShowValidation] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<WorkspaceMode>("candidates");
  const [activePanel, setActivePanel] = useState<MobilePanel>("candidates");

  // 분석 상태 추적
  const [pendingAnalyses, setPendingAnalyses] = useState<Set<number>>(
    new Set(),
  );
  const [errorAnalyses, setErrorAnalyses] = useState<Map<number, string>>(
    new Map(),
  );

  const queryClient = useQueryClient();
  const { data: decksData } = useDecks();
  const activeDeck = selectedDeck ?? decksData?.decks?.[0] ?? null;
  const { data: cardsData, isLoading: isLoadingCards } = useCards(activeDeck, {
    limit: 500,
    filter: "all",
  });

  const { data: difficultData, isLoading: isLoadingDifficult } =
    useDifficultCards(activeDeck, { limit: 200 });

  // 프롬프트 버전 관련
  const { data: promptVersionsData, isLoading: isLoadingVersions } =
    usePromptVersions();
  const activeVersionId =
    selectedVersionId ??
    promptVersionsData?.activeVersionId ??
    promptVersionsData?.versions?.[0]?.id ??
    null;
  const addHistory = useAddPromptHistory();

  // 선택된 카드의 상세 정보 (전체 텍스트 포함)
  const { data: cardDetail, isLoading: isLoadingDetail } = useCardDetail(
    selectedCard?.noteId ?? null,
  );

  const splitPreview = useSplitPreview();
  const splitApply = useSplitApply();

  // 현재 선택된 카드의 캐시된 미리보기 결과 조회
  const cachedPreview = selectedCard
    ? getCachedSplitPreview(
        queryClient,
        selectedCard.noteId,
        splitType === "soft",
        activeVersionId || undefined,
      )
    : undefined;

  // 캐시 있으면 캐시 사용, 없으면 mutation 결과 사용
  const previewData: SplitPreviewResult | undefined =
    cachedPreview || splitPreview.data;

  // 현재 카드에 대한 로딩 중인지 확인 (다른 카드 분석 중에는 영향 없음)
  const isLoadingCurrentCard =
    splitPreview.isPending &&
    splitPreview.variables?.noteId === selectedCard?.noteId;

  // 현재 선택된 카드의 에러 메시지 확인
  const currentCardError = selectedCard
    ? errorAnalyses.get(selectedCard.noteId)
    : undefined;

  // 카드 상태 헬퍼
  const getCardStatus = (noteId: number): CardAnalysisStatus => {
    if (pendingAnalyses.has(noteId)) return "pending";
    if (errorAnalyses.has(noteId)) return "error";
    const cachedSoft = getCachedSplitPreview(
      queryClient,
      noteId,
      true,
      activeVersionId || undefined,
    );
    const cachedHard = getCachedSplitPreview(
      queryClient,
      noteId,
      false,
      activeVersionId || undefined,
    );
    if (cachedSoft || cachedHard) return "cached";
    return "none";
  };

  // 카드 선택 핸들러
  const handleSelectCard = (card: SplitCandidate | null) => {
    setSelectedCard(card);
    if (card) {
      splitPreview.reset();
      const type = card.analysis.canHardSplit ? "hard" : "soft";
      setSplitType(type);

      // 모바일: 원본 탭으로 자동 전환
      if (isMobile) setActivePanel("original");

      const cached = getCachedSplitPreview(
        queryClient,
        card.noteId,
        type === "soft",
        activeVersionId || undefined,
      );

      if (!cached && card.analysis.canHardSplit) {
        splitPreview.mutate({ noteId: card.noteId, useGemini: false });
      }
    }
  };

  // noteId로 카드를 찾아 선택 (toast action에서 사용 — stale closure 방지)
  const handleSelectByNoteId = (noteId: number) => {
    const list = mode === "candidates" ? candidates : difficultCards;
    const found = list.find((c) => c.noteId === noteId);
    if (found) handleSelectCard(found);
  };

  // Soft Split 분석 요청 핸들러
  const handleRequestSoftSplit = () => {
    if (!selectedCard) return;
    // 연타 방지
    if (pendingAnalyses.has(selectedCard.noteId)) return;

    const noteId = selectedCard.noteId;

    // 상태 전이: pending 추가, error 제거
    setPendingAnalyses((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
    setErrorAnalyses((prev) => {
      const next = new Map(prev);
      next.delete(noteId);
      return next;
    });

    splitPreview.mutate(
      {
        noteId,
        useGemini: true,
        versionId: activeVersionId || undefined,
      },
      {
        onSuccess: () => {
          setPendingAnalyses((prev) => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
          toast.success(`카드 ${noteId} 분석 완료`, {
            action: {
              label: "보기",
              onClick: () => handleSelectByNoteId(noteId),
            },
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          setPendingAnalyses((prev) => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
          setErrorAnalyses((prev) => {
            const next = new Map(prev);
            next.set(noteId, message);
            return next;
          });
          toast.error(`카드 ${noteId} 분석 실패: ${message}`);
        },
      },
    );
  };

  const candidates = (cardsData?.cards || [])
    .map(mapCardSummaryToCandidate)
    .filter((card) => card.analysis.canHardSplit || card.analysis.canSoftSplit);

  const difficultCards = (difficultData?.cards || []).map(
    mapDifficultToCandidate,
  );

  const handleApply = () => {
    if (!selectedCard || !activeDeck || !previewData?.splitCards) return;
    const historySplitType =
      previewData.splitType === "hard" || previewData.splitType === "soft"
        ? previewData.splitType
        : splitType;

    splitApply.mutate(
      {
        noteId: selectedCard.noteId,
        deckName: activeDeck,
        splitCards: previewData.splitCards.map((c) => ({
          title: c.title,
          content: c.content,
        })),
        mainCardIndex: previewData.mainCardIndex ?? 0,
        splitType,
      },
      {
        onSuccess: () => {
          // 히스토리 자동 기록 (확장 필드 포함)
          if (activeVersionId && previewData?.splitCards) {
            addHistory.mutate(
              {
                promptVersionId: activeVersionId,
                noteId: selectedCard.noteId,
                deckName: activeDeck,
                originalContent: cardDetail?.text || selectedCard.text,
                originalTags: cardDetail?.tags ?? [],
                splitCards: previewData.splitCards.map((c) => ({
                  title: c.title,
                  content: c.content,
                  cardType: c.cardType ?? "cloze",
                })),
                userAction: "approved",
                aiModel: previewData.aiModel,
                splitType: historySplitType,
                splitReason: previewData.splitReason,
                executionTimeMs: previewData.executionTimeMs,
                tokenUsage: previewData.tokenUsage,
                qualityChecks: null,
              },
              {
                onError: () => {
                  toast.warning("히스토리 기록 실패 (분할은 정상 적용됨)");
                },
              },
            );
          }
          toast.success("분할이 적용되었습니다");
          // 성공 후 목록에서 제거하고 다음 카드 선택
          const activeList =
            mode === "candidates" ? candidates : difficultCards;
          const nextCard = activeList.find(
            (c) => c.noteId !== selectedCard.noteId,
          );
          handleSelectCard(nextCard || null);
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          toast.error(`분할 적용 실패: ${message}`);
        },
      },
    );
  };

  const handleReject = (rejectionReason: string) => {
    if (!selectedCard || !activeDeck || !previewData?.splitCards) return;
    if (!activeVersionId) {
      toast.warning("반려를 기록하려면 프롬프트 버전이 필요합니다.");
      return;
    }
    const historySplitType =
      previewData.splitType === "hard" || previewData.splitType === "soft"
        ? previewData.splitType
        : splitType;

    addHistory.mutate(
      {
        promptVersionId: activeVersionId,
        noteId: selectedCard.noteId,
        deckName: activeDeck,
        originalContent: cardDetail?.text || selectedCard.text,
        originalTags: cardDetail?.tags ?? [],
        splitCards: previewData.splitCards.map((c) => ({
          title: c.title,
          content: c.content,
          cardType: c.cardType ?? "cloze",
        })),
        userAction: "rejected",
        rejectionReason,
        aiModel: previewData.aiModel,
        splitType: historySplitType,
        splitReason: previewData.splitReason,
        executionTimeMs: previewData.executionTimeMs,
        tokenUsage: previewData.tokenUsage,
        qualityChecks: null,
      },
      {
        onSuccess: () => {
          queryClient.removeQueries({
            queryKey: queryKeys.split.preview(
              selectedCard.noteId,
              true,
              activeVersionId,
            ),
          });
          splitPreview.reset();
          toast.info("분할 결과가 반려되었습니다");
        },
        onError: () => {
          toast.warning("반려 기록 실패");
        },
      },
    );
  };

  const handleSwitchSplitType = () => {
    const newType = splitType === "hard" ? "soft" : "hard";
    setSplitType(newType);
    if (selectedCard) {
      if (newType === "hard") {
        splitPreview.mutate({ noteId: selectedCard.noteId, useGemini: false });
      }
    }
  };

  const isLoadingList =
    mode === "candidates" ? isLoadingCards : isLoadingDifficult;
  const activeList = mode === "candidates" ? candidates : difficultCards;
  const activeCount =
    mode === "candidates" ? candidates.length : (difficultData?.total ?? 0);

  const isBusy = addHistory.isPending || splitApply.isPending;
  const canReject =
    !!selectedCard &&
    !!activeDeck &&
    !!previewData?.splitCards &&
    !!activeVersionId &&
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
            {card.analysis.canHardSplit && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                <Zap className="w-3 h-3 inline mr-0.5" />
                Hard
              </span>
            )}
            {card.analysis.canSoftSplit && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                <Sparkles className="w-3 h-3 inline mr-0.5" />
                Soft
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
                ease:{" "}
                {card.difficulty
                  ? (card.difficulty.easeFactor / 10).toFixed(0)
                  : 0}
                %
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
              if (isMobile) setActivePanel("candidates");
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
              if (isMobile) setActivePanel("candidates");
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
            {mode === "candidates"
              ? "분할 후보가 없습니다"
              : "재분할 대상이 없습니다"}
          </div>
        ) : mode === "candidates" ? (
          <div className="divide-y">{candidates.map(renderCardListItem)}</div>
        ) : (
          <div className="divide-y">
            {difficultCards.map(renderDifficultCardListItem)}
          </div>
        )}
      </div>
    </>
  );

  /** 원본 카드 패널 */
  const renderOriginalCard = () => (
    <>
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
            <span className="text-xs text-muted-foreground">
              NID: {selectedCard.noteId}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
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
                      Ease Factor:{" "}
                      {(selectedCard.difficulty.easeFactor / 10).toFixed(0)}%
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
                <ValidationPanel
                  noteId={selectedCard.noteId}
                  deckName={activeDeck}
                />
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>
                {isMobile
                  ? "후보 탭에서 카드를 선택하세요"
                  : "왼쪽에서 카드를 선택하세요"}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /** 분할 미리보기 패널 (반려 Popover 포함) */
  const renderPreviewContent = () => (
    <>
      <div className="py-3 px-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">분할 미리보기</span>
          {selectedCard && (
            <button
              type="button"
              onClick={handleSwitchSplitType}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                splitType === "hard"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700",
              )}
            >
              {splitType === "hard" ? (
                <>
                  <Zap className="w-3 h-3 inline mr-1" />
                  Hard Split
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  Soft Split
                </>
              )}
            </button>
          )}
        </div>
      </div>
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
            <Button
              onClick={handleRequestSoftSplit}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              다시 시도
            </Button>
          </div>
        ) : splitPreview.isError &&
          splitPreview.variables?.noteId === selectedCard.noteId ? (
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
            <Button
              onClick={handleRequestSoftSplit}
              variant="outline"
              size="sm"
              className="mt-3"
            >
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
              <p className="font-medium mb-1">
                {previewData.splitCards.length}개 카드로 분할
              </p>
              {previewData.splitReason && (
                <p className="text-muted-foreground text-xs">
                  {previewData.splitReason}
                </p>
              )}
              {previewData.executionTimeMs != null && (
                <p className="text-muted-foreground text-xs mt-1">
                  {(previewData.executionTimeMs / 1000).toFixed(1)}s
                  {previewData.tokenUsage?.totalTokens != null &&
                    ` | ${previewData.tokenUsage.totalTokens} tokens`}
                </p>
              )}
            </div>

            {/* 분할 카드 미리보기 */}
            <div className="space-y-3">
              {previewData.splitCards.map((card, idx) => (
                <SplitPreviewCard
                  key={`split-${card.title}-${idx}`}
                  card={card}
                  index={idx}
                />
              ))}
            </div>

            {/* 모바일: 반려 Popover를 미리보기 콘텐츠 내 표시 */}
            {isMobile && splitType === "soft" && (
              <div className="pt-2">
                <RejectPopover canReject={canReject} onReject={handleReject} />
              </div>
            )}
          </div>
        ) : splitType === "soft" ? (
          // Soft Split: Gemini 분석 요청 필요
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 text-purple-400" />
            <p className="text-center mb-4">
              Soft Split은 Gemini AI를 사용합니다.
              <br />
              <span className="text-xs text-muted-foreground">
                API 비용이 발생할 수 있습니다.
              </span>
            </p>
            <Button
              onClick={handleRequestSoftSplit}
              disabled={
                splitPreview.isPending ||
                pendingAnalyses.has(selectedCard?.noteId ?? -1)
              }
              variant="outline"
              className="bg-purple-50 hover:bg-purple-100 border-purple-200"
            >
              <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
              Gemini 분석 요청
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );

  // --- 모바일 탭 정의 ---
  const mobileTabs: { id: MobilePanel; label: string }[] = [
    { id: "candidates", label: "후보 목록" },
    { id: "original", label: "원본" },
    { id: "preview", label: "미리보기" },
  ];

  // 높이: 모바일/태블릿 dvh-5rem (h-14 헤더 + p-3 x2), 데스크톱(lg) vh-4rem (p-6 x2)
  return (
    <div className="h-[calc(100dvh-5rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      {/* 헤더 — md:text-sm은 iOS 줌 방지용으로 레이아웃 breakpoint(lg:)와 별도 */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex items-center gap-2 lg:gap-4">
          <h1 className="text-xl lg:text-2xl font-bold">분할 작업</h1>
          <select
            value={activeDeck || ""}
            onChange={(e) => {
              setSelectedDeck(e.target.value || null);
              handleSelectCard(null);
            }}
            className="px-3 py-1.5 border rounded-md bg-background text-base md:text-sm min-w-0 flex-1 lg:flex-initial"
          >
            {decksData?.decks?.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          {/* 프롬프트 버전 선택 */}
          <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-initial">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <HelpTooltip helpKey="promptVersionSelect" />
            <select
              value={activeVersionId || ""}
              onChange={(e) => setSelectedVersionId(e.target.value || null)}
              disabled={isLoadingVersions}
              className="px-3 py-1.5 border rounded-md bg-background text-base md:text-sm min-w-0 lg:min-w-[140px]"
            >
              {isLoadingVersions ? (
                <option>로딩 중...</option>
              ) : promptVersionsData?.versions?.length === 0 ? (
                <option value="">버전 없음</option>
              ) : (
                promptVersionsData?.versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                    {version.id === promptVersionsData.activeVersionId &&
                      " \u2713"}
                  </option>
                ))
              )}
            </select>
          </div>
          <span className="text-xs lg:text-sm text-muted-foreground whitespace-nowrap">
            {activeCount}개{" "}
            {mode === "candidates" ? "분할 후보" : "재분할 대상"}
          </span>
        </div>
      </div>

      {/* 모바일: 탭 전환 레이아웃 */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 탭 바 */}
          <div role="tablist" className="flex border-b shrink-0">
            {mobileTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activePanel === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActivePanel(tab.id)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  activePanel === tab.id
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 패널 콘텐츠 */}
          <div
            role="tabpanel"
            id={`panel-${activePanel}`}
            aria-labelledby={`tab-${activePanel}`}
            className="flex-1 flex flex-col min-h-0"
          >
            {activePanel === "candidates" && renderCandidatesList()}
            {activePanel === "original" && renderOriginalCard()}
            {activePanel === "preview" && renderPreviewContent()}
          </div>

          {/* Sticky footer — 분할 적용 버튼 */}
          {selectedCard && previewData?.splitCards && (
            <div className="border-t p-3 shrink-0">
              <Button
                onClick={handleApply}
                disabled={isBusy}
                className="w-full"
              >
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
          )}
        </div>
      ) : (
        /* 데스크톱: 3단 레이아웃 */
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* 왼쪽: 후보 목록 */}
          <div className="col-span-3 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              {renderCandidatesList()}
            </Card>
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
                    {/* 반려 버튼 (Soft Split만) */}
                    {splitType === "soft" && (
                      <RejectPopover
                        canReject={canReject}
                        onReject={handleReject}
                      />
                    )}

                    {/* 적용 버튼 */}
                    <Button
                      onClick={handleApply}
                      disabled={isBusy}
                      className="flex-1"
                    >
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
