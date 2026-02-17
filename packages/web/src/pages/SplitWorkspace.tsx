/**
 * SplitWorkspace - 카드 분할 작업 공간
 * 3단 레이아웃: 후보 목록 | 원본 카드 | 분할 미리보기
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Scissors,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ContentRenderer } from "../components/card/ContentRenderer";
import { SplitPreviewCard } from "../components/card/DiffViewer";
import { HelpTooltip } from "../components/help/HelpTooltip";
import {
  MobilePanelTabs,
  type SplitPanel,
} from "../components/split/MobilePanelTabs";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
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
import type { DifficultCard, SplitPreview } from "../lib/api";
import { cn } from "../lib/utils";

export type WorkspaceMode = "candidates" | "difficult";

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

export function SplitWorkspace() {
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<SplitCandidate | null>(null);
  const [splitType, setSplitType] = useState<"hard" | "soft">("hard");
  const [showValidation, setShowValidation] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<WorkspaceMode>("candidates");
  const [activePanel, setActivePanel] = useState<SplitPanel>("candidates");

  const originalPanelRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { data: decksData } = useDecks();
  const { data: cardsData, isLoading: isLoadingCards } = useCards(
    selectedDeck,
    {
      limit: 500,
      filter: "all",
    },
  );

  const { data: difficultData, isLoading: isLoadingDifficult } =
    useDifficultCards(selectedDeck, { limit: 200 });

  // 프롬프트 버전 관련
  const { data: promptVersionsData, isLoading: isLoadingVersions } =
    usePromptVersions();
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
      )
    : undefined;

  // 캐시 있으면 캐시 사용, 없으면 mutation 결과 사용
  const previewData: SplitPreview | undefined =
    cachedPreview || splitPreview.data;

  // 현재 카드에 대한 로딩 중인지 확인 (다른 카드 분석 중에는 영향 없음)
  const isLoadingCurrentCard =
    splitPreview.isPending &&
    splitPreview.variables?.noteId === selectedCard?.noteId;

  // 덱 선택 시 첫 번째 덱 자동 선택
  useEffect(() => {
    if (decksData?.decks && decksData.decks.length > 0 && !selectedDeck) {
      setSelectedDeck(decksData.decks[0]);
    }
  }, [decksData, selectedDeck]);

  // 활성 버전 자동 선택
  useEffect(() => {
    if (promptVersionsData?.activeVersionId && !selectedVersionId) {
      setSelectedVersionId(promptVersionsData.activeVersionId);
    } else if (promptVersionsData?.versions?.length && !selectedVersionId) {
      // 활성 버전이 없으면 첫 번째 버전 선택
      setSelectedVersionId(promptVersionsData.versions[0].id);
    }
  }, [promptVersionsData, selectedVersionId]);

  // 카드 선택 핸들러 — useEffect 대신 이벤트 핸들러에서 직접 처리하여
  // splitPreview 참조 불안정으로 인한 무한 렌더 루프 방지
  const handleSelectCard = (card: SplitCandidate | null) => {
    setSelectedCard(card);
    if (card) {
      // mutation 상태 초기화 (이전 카드 결과 제거)
      splitPreview.reset();

      // 분할 타입 자동 선택
      const type = card.analysis.canHardSplit ? "hard" : "soft";
      setSplitType(type);

      // 모바일: 원본 탭으로 자동 전환 + 스크롤 리셋
      setActivePanel("original");
      if (originalPanelRef.current) {
        originalPanelRef.current.scrollTop = 0;
      }

      // 캐시 확인
      const cached = getCachedSplitPreview(
        queryClient,
        card.noteId,
        type === "soft",
      );

      // 캐시 없고 Hard Split이면 자동 요청 (Gemini 비용 없음)
      if (!cached && card.analysis.canHardSplit) {
        splitPreview.mutate({ noteId: card.noteId, useGemini: false });
      }
      // Soft Split은 사용자가 명시적으로 요청해야 함 (캐시된 결과 있으면 바로 표시)
    }
  };

  // Soft Split 분석 요청 핸들러
  const handleRequestSoftSplit = () => {
    if (selectedCard) {
      splitPreview.mutate({ noteId: selectedCard.noteId, useGemini: true });
    }
  };

  // Soft Split 완료 시 미리보기 탭으로 자동 전환
  useEffect(() => {
    if (splitPreview.isSuccess && splitPreview.data?.splitCards) {
      setActivePanel("preview");
    }
  }, [splitPreview.isSuccess, splitPreview.data]);

  const candidates = (cardsData?.cards || [])
    .filter((c) => c.analysis?.canHardSplit || c.isSplitable)
    .map(
      (c): SplitCandidate => ({
        noteId: c.noteId,
        text: c.text,
        analysis: {
          canHardSplit: c.analysis.canHardSplit,
          canSoftSplit: c.splitType === "soft",
          clozeCount: c.analysis.clozeCount,
        },
      }),
    );

  const difficultCards = (difficultData?.cards || []).map(
    mapDifficultToCandidate,
  );

  const handleApply = () => {
    if (!selectedCard || !selectedDeck || !previewData?.splitCards) return;

    splitApply.mutate(
      {
        noteId: selectedCard.noteId,
        splitType,
        deckName: selectedDeck,
      },
      {
        onSuccess: () => {
          // 히스토리 자동 기록
          if (selectedVersionId && previewData?.splitCards) {
            addHistory.mutate({
              promptVersionId: selectedVersionId,
              noteId: selectedCard.noteId,
              deckName: selectedDeck,
              originalContent: cardDetail?.text || selectedCard.text,
              splitCards: previewData.splitCards.map(
                (card: { title: string; content: string }) => ({
                  title: card.title,
                  content: card.content,
                }),
              ),
              userAction: "approved",
              qualityChecks: null, // TODO: 실제 품질 검사 결과 연동
            });
          }
          // 성공 후 목록에서 제거하고 다음 카드 선택
          const activeList =
            mode === "candidates" ? candidates : difficultCards;
          const nextCard = activeList.find(
            (c) => c.noteId !== selectedCard.noteId,
          );
          handleSelectCard(nextCard || null);
        },
      },
    );
  };

  const handleSwitchSplitType = () => {
    const newType = splitType === "hard" ? "soft" : "hard";
    setSplitType(newType);
    if (selectedCard) {
      // Hard로 전환 시만 자동 요청, Soft는 별도 버튼으로
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

  return (
    <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] flex flex-col">
      {/* 헤더 — 모바일: 컴팩트 세로 스택, 데스크톱: 가로 배치 */}
      <div className="mb-2 md:mb-4 space-y-2 md:space-y-0 md:flex md:items-center md:justify-between">
        {/* 모바일: 덱 셀렉트만 전체 폭으로 */}
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-lg md:text-2xl font-bold shrink-0">분할 작업</h1>
          <select
            value={selectedDeck || ""}
            onChange={(e) => {
              setSelectedDeck(e.target.value);
              handleSelectCard(null);
            }}
            className="px-3 py-1.5 border rounded-md bg-background text-sm flex-1 min-w-0 md:flex-initial md:w-auto"
          >
            {decksData?.decks?.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>
        </div>
        {/* 프롬프트 버전 — 모바일에서 숨김 (Prompts 페이지에서 관리) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <HelpTooltip helpKey="promptVersionSelect" />
            <select
              value={selectedVersionId || ""}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              disabled={isLoadingVersions}
              className="px-3 py-1.5 border rounded-md bg-background text-sm min-w-[140px]"
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
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {activeCount}개{" "}
            {mode === "candidates" ? "분할 후보" : "재분할 대상"}
          </span>
        </div>
      </div>

      {/* 모바일 패널 탭 — 모드 토글 통합 */}
      <MobilePanelTabs
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        hasCard={!!selectedCard}
        hasPreview={!!previewData?.splitCards}
        mode={mode}
        onChangeMode={(m) => {
          setMode(m);
          handleSelectCard(null);
        }}
        activeCount={activeCount}
      />

      {/* 3단 레이아웃 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
        {/* 왼쪽: 후보 목록 */}
        <div
          className={cn(
            "md:col-span-3 flex flex-col min-h-0",
            activePanel !== "candidates" && "hidden md:flex",
          )}
        >
          <Card className="flex-1 flex flex-col min-h-0">
            {/* 모드 토글 — 모바일에서는 MobilePanelTabs에 통합되어 있으므로 숨김 */}
            <CardHeader className="py-3 px-4 border-b shrink-0 hidden md:block">
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    setMode("candidates");
                    handleSelectCard(null);
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
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
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
                <div className="divide-y">
                  {candidates.map((card) => (
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
                          <p className="text-sm font-medium truncate">
                            {card.noteId}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {card.text.slice(0, 60)}...
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
                  ))}
                </div>
              ) : (
                <div className="divide-y">
                  {difficultCards.map((card) => (
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
                          <p className="text-sm font-medium truncate">
                            {card.noteId}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {card.text.slice(0, 60)}...
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 중앙: 원본 카드 */}
        <div
          className={cn(
            "md:col-span-5 flex flex-col min-h-0 overflow-hidden",
            activePanel !== "original" && "hidden md:flex",
          )}
        >
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">원본 카드</CardTitle>
              {selectedCard && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowValidation(!showValidation)}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors min-h-[44px] md:min-h-0",
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
            </CardHeader>
            <CardContent
              ref={originalPanelRef}
              className="flex-1 overflow-y-auto p-4 min-h-0"
            >
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
                          <span>
                            실패 횟수: {selectedCard.difficulty.lapses}회
                          </span>
                          <span>
                            Ease Factor:{" "}
                            {(selectedCard.difficulty.easeFactor / 10).toFixed(
                              0,
                            )}
                            %
                          </span>
                          <span>
                            복습 간격: {selectedCard.difficulty.interval}일
                          </span>
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
                    {showValidation && selectedDeck && (
                      <ValidationPanel
                        noteId={selectedCard.noteId}
                        deckName={selectedDeck}
                      />
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
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 분할 미리보기 */}
        <div
          className={cn(
            "md:col-span-4 flex flex-col min-h-0",
            activePanel !== "preview" && "hidden md:flex",
          )}
        >
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-3 px-4 border-b shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">분할 미리보기</CardTitle>
                {selectedCard && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSwitchSplitType}
                      className={cn(
                        "text-xs px-2 py-1 rounded transition-colors min-h-[44px] md:min-h-0",
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
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              {!selectedCard ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>카드를 선택하면 분할 미리보기가 표시됩니다</p>
                </div>
              ) : isLoadingCurrentCard ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
                    <div className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded inline-block">
                      {"\u2713"} 캐시된 결과
                    </div>
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
                  </div>

                  {/* 분할 카드 미리보기 */}
                  <div className="space-y-3">
                    {previewData.splitCards.map(
                      (
                        card: {
                          title: string;
                          content: string;
                          isMainCard: boolean;
                        },
                        idx: number,
                      ) => (
                        <SplitPreviewCard
                          key={`split-${card.title}-${idx}`}
                          card={card}
                          index={idx}
                        />
                      ),
                    )}
                  </div>
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
                    variant="outline"
                    className="bg-purple-50 hover:bg-purple-100 border-purple-200"
                  >
                    <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                    Gemini 분석 요청
                  </Button>
                </div>
              ) : null}
            </CardContent>

            {/* 적용 버튼 (데스크톱) */}
            {selectedCard && previewData && previewData.splitCards && (
              <div className="px-4 py-3 border-t shrink-0 hidden md:block">
                <Button
                  onClick={handleApply}
                  disabled={splitApply.isPending}
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
                {splitApply.isSuccess && (
                  <p className="text-sm text-green-600 mt-2 flex items-center">
                    <Check className="w-4 h-4 mr-1" />
                    분할이 적용되었습니다
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 모바일 sticky footer — 어떤 탭에서든 표시 */}
      {selectedCard && previewData && previewData.splitCards && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card p-4 md:hidden">
          <Button
            onClick={handleApply}
            disabled={splitApply.isPending}
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
                분할 적용 ({previewData.splitCards.length}개 카드)
              </>
            )}
          </Button>
          {splitApply.isSuccess && (
            <p className="text-sm text-green-600 mt-2 flex items-center justify-center">
              <Check className="w-4 h-4 mr-1" />
              분할이 적용되었습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
