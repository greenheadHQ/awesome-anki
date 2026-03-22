/**
 * ValidateWorkspace - 카드 검증 작업 공간
 * 데스크톱: 3단 레이아웃 (카드 목록 | 원본 카드 | 검증 결과)
 * 모바일: list↔detail view transition
 */

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Hash,
  HelpCircle,
  Link2,
  Loader2,
  Search,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ContentRenderer } from "../components/card/ContentRenderer";
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
import { useDecks } from "../hooks/useDecks";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useLLMModels } from "../hooks/useSplit";
import {
  useBatchValidate,
  useValidateCard,
  useValidationCache,
} from "../hooks/useValidationCache";
import type { AllValidationResult, ValidationStatus } from "../lib/api";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";

type MobilePanel = "list" | "detail";
type DetailTab = "validate" | "related";

// 검증 상태 아이콘
function StatusIcon({
  status,
  size = "sm",
}: {
  status: ValidationStatus | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  if (status === null) {
    return <HelpCircle className={cn(sizeClass, "text-gray-300")} />;
  }
  switch (status) {
    case "valid":
      return <CheckCircle className={cn(sizeClass, "text-green-500")} />;
    case "warning":
      return <AlertTriangle className={cn(sizeClass, "text-yellow-500")} />;
    case "error":
      return <XCircle className={cn(sizeClass, "text-red-500")} />;
    default:
      return <HelpCircle className={cn(sizeClass, "text-gray-400")} />;
  }
}

const STATUS_LABELS: Record<ValidationStatus, string> = {
  valid: "검증 통과",
  warning: "검토 필요",
  error: "문제 발견",
  unknown: "검증 불가",
};

function getSimilarityBadgeClass(similarity: number): string {
  if (similarity >= 90) return "bg-red-100 text-red-700";
  if (similarity >= 70) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

function getStatusBg(status: ValidationStatus): string {
  switch (status) {
    case "valid":
      return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
    case "warning":
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
    case "error":
      return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
    default:
      return "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700";
  }
}

// 검증 유형별 아이콘 + 라벨
const VALIDATION_TYPES = [
  { key: "factCheck", icon: CheckCircle, label: "팩트 체크" },
  { key: "freshness", icon: Clock, label: "최신성 검사" },
  { key: "similarity", icon: Copy, label: "유사성 검사" },
  { key: "context", icon: Link2, label: "문맥 일관성" },
  { key: "verbose", icon: Sparkles, label: "Verbose 감지" },
] as const;

type FilterMode = "all" | "unvalidated" | "needs-review";

const FILTER_LABELS: Record<FilterMode, string> = {
  all: "전체",
  unvalidated: "미검증",
  "needs-review": "검토 필요",
};

export function ValidateWorkspace() {
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<MobilePanel>("list");
  const [detailTab, setDetailTab] = useState<DetailTab>("validate");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  const { data: decksData } = useDecks();
  const activeDeck = selectedDeck ?? decksData?.decks?.[0] ?? null;
  const { data: cardsData, isLoading: isLoadingCards } = useCards(activeDeck, {
    limit: 500,
    filter: "all",
  });

  const { data: cardDetail, isLoading: isLoadingDetail } = useCardDetail(selectedNoteId);

  // LLM 모델 선택
  const { data: llmModelsData } = useLLMModels();
  const defaultModelKey = llmModelsData
    ? `${llmModelsData.defaultModelId.provider}/${llmModelsData.defaultModelId.model}`
    : null;
  const activeModelKey = selectedModelKey ?? defaultModelKey;
  const activeProvider = activeModelKey?.split("/")[0];
  const activeModel = activeModelKey?.split("/").slice(1).join("/");

  const { getValidation, getValidationStatuses, uncachedCount } = useValidationCache();

  const modelOpts = { provider: activeProvider, model: activeModel };
  const validateCard = useValidateCard(activeDeck, modelOpts);
  const batchValidate = useBatchValidate(activeDeck, modelOpts);

  const allCards = useMemo(() => cardsData?.cards ?? [], [cardsData]);
  const noteIds = useMemo(() => allCards.map((c) => c.noteId), [allCards]);
  const validationStatuses = useMemo(
    () => getValidationStatuses(noteIds),
    [getValidationStatuses, noteIds],
  );

  // 필터 + 검색 적용
  const filteredCards = useMemo(() => {
    let cards = allCards;

    // 필터
    if (filterMode === "unvalidated") {
      cards = cards.filter((c) => !validationStatuses.get(c.noteId));
    } else if (filterMode === "needs-review") {
      cards = cards.filter((c) => {
        const status = validationStatuses.get(c.noteId);
        return status === "warning" || status === "error";
      });
    }

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      cards = cards.filter((c) => String(c.noteId).includes(q) || c.text.toLowerCase().includes(q));
    }

    return cards;
  }, [allCards, filterMode, validationStatuses, searchQuery]);

  const currentValidation = selectedNoteId ? getValidation(selectedNoteId) : null;

  // 통계
  const totalCards = allCards.length;
  const unvalidatedCount = uncachedCount(noteIds);
  const issueCount = useMemo(() => {
    let count = 0;
    for (const [, status] of validationStatuses) {
      if (status === "warning" || status === "error") count++;
    }
    return count;
  }, [validationStatuses]);

  const toggleSection = (section: string) => {
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

  // --- 카드 목록 패널 ---
  const renderCardList = () => (
    <>
      {/* 필터 + 검색 */}
      <div className="py-3 px-4 border-b shrink-0 space-y-2">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="카드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {/* 필터 토글 */}
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={cn(
                "flex-1 text-xs px-2 py-1.5 rounded transition-colors",
                filterMode === mode
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {FILTER_LABELS[mode]}
              {mode === "needs-review" && issueCount > 0 && (
                <span className="ml-1 text-red-500">({issueCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* 카드 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingCards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? "검색 결과가 없습니다" : "카드가 없습니다"}
          </div>
        ) : (
          <div className="divide-y">
            {filteredCards.map((card) => {
              const status = validationStatuses.get(card.noteId) ?? null;
              return (
                <button
                  type="button"
                  key={card.noteId}
                  onClick={() => handleSelectCard(card.noteId)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                    selectedNoteId === card.noteId && "bg-primary/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={status} />
                        <p className="text-sm font-medium truncate">{card.noteId}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {card.text.slice(0, 60)}
                        {card.text.length > 60 ? "..." : ""}
                      </p>
                    </div>
                    {card.analysis.clozeCount > 0 && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        C{card.analysis.clozeCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  // --- 원본 카드 패널 ---
  const renderOriginalCard = () => (
    <>
      {!isMobile && (
        <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold">원본 카드</span>
          {selectedNoteId && (
            <span className="text-xs text-muted-foreground">NID: {selectedNoteId}</span>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-4">
        {selectedNoteId ? (
          isLoadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ContentRenderer
              content={cardDetail?.text || ""}
              showToggle={true}
              defaultView="rendered"
            />
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

  // --- 검증 결과 섹션 렌더러 ---
  const renderValidationSection = (
    typeKey: string,
    icon: React.ElementType,
    label: string,
    result: AllValidationResult["results"][keyof AllValidationResult["results"]] | undefined,
  ) => {
    if (!result) return null;
    const Icon = icon;
    const isExpanded = expandedSections.has(typeKey);

    return (
      <div key={typeKey} className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
          onClick={() => toggleSection(typeKey)}
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{label}</span>
            <StatusIcon status={result.status} />
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {isExpanded && (
          <div className="p-3 border-t bg-muted/30 text-sm">
            <p className="mb-2">{result.message}</p>
            {renderValidationDetails(typeKey, result)}
          </div>
        )}
      </div>
    );
  };

  // 검증 유형별 세부 내용 렌더러
  const renderValidationDetails = (
    typeKey: string,
    result: AllValidationResult["results"][keyof AllValidationResult["results"]],
  ) => {
    const details = result.details as Record<string, unknown>;

    switch (typeKey) {
      case "factCheck": {
        const claims =
          (details.claims as Array<{
            claim: string;
            isVerified: boolean;
            confidence: number;
            correction?: string;
          }>) ?? [];
        if (claims.length === 0) return null;
        return (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              정확도: {(details.overallAccuracy as number) ?? 0}%
            </div>
            {claims.map((claim, i) => (
              <div key={`claim-${i}`} className="text-xs p-2 bg-background rounded">
                <div className="flex items-start gap-2">
                  {claim.isVerified ? (
                    <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p>{claim.claim}</p>
                    {claim.correction && (
                      <p className="text-red-600 mt-1">수정: {claim.correction}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "freshness": {
        const items =
          (details.outdatedItems as Array<{
            content: string;
            reason: string;
            currentInfo?: string;
            severity: string;
          }>) ?? [];
        if (items.length === 0) return null;
        return (
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={`fresh-${i}`} className="text-xs p-2 bg-background rounded">
                <p className="font-medium">{item.content}</p>
                <p className="text-muted-foreground">{item.reason}</p>
                {item.currentInfo && (
                  <p className="text-green-600 mt-1">현재: {item.currentInfo}</p>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "similarity": {
        const similarCards =
          (details.similarCards as Array<{
            noteId: number;
            similarity: number;
            matchedContent: string;
          }>) ?? [];
        const method = details.method as string | undefined;
        return (
          <div className="space-y-1">
            {method && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mb-1",
                  method === "embedding"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-700",
                )}
              >
                {method === "embedding" ? (
                  <Sparkles className="w-3 h-3" />
                ) : (
                  <Hash className="w-3 h-3" />
                )}
                {method === "embedding" ? "임베딩" : "Jaccard"}
              </span>
            )}
            {similarCards.length > 0 ? (
              similarCards.map((card, i) => (
                <div key={`sim-${card.noteId}-${i}`} className="text-xs p-2 bg-background rounded">
                  <div className="flex justify-between items-start">
                    <span className="font-mono">#{card.noteId}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded",
                        getSimilarityBadgeClass(card.similarity),
                      )}
                    >
                      {card.similarity}% 유사
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2">{card.matchedContent}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">유사한 카드가 없습니다</p>
            )}
          </div>
        );
      }

      case "context": {
        const inconsistencies =
          (details.inconsistencies as Array<{
            description: string;
            conflictingNoteId?: number;
            severity: string;
          }>) ?? [];
        const relatedCards = (details.relatedCards as number[]) ?? [];
        return (
          <div className="space-y-1">
            {relatedCards.length > 0 && (
              <div className="text-xs text-muted-foreground mb-1">
                연결된 카드: {relatedCards.length}개
              </div>
            )}
            {inconsistencies.map((inc, i) => (
              <div key={`inc-${i}`} className="text-xs p-2 bg-background rounded">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                      inc.severity === "high"
                        ? "bg-red-100 text-red-700"
                        : inc.severity === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {inc.severity === "high" ? "심각" : inc.severity === "medium" ? "주의" : "경미"}
                  </span>
                  {inc.conflictingNoteId && (
                    <span className="font-mono text-muted-foreground">
                      #{inc.conflictingNoteId}
                    </span>
                  )}
                </div>
                <p className="mt-1">{inc.description}</p>
              </div>
            ))}
          </div>
        );
      }

      case "verbose": {
        const concepts = (details.concepts as string[]) ?? [];
        const recommendation = details.recommendation as string;
        const conceptCount = (details.conceptCount as number) ?? 0;
        const suggestedSplitCount = details.suggestedSplitCount as number | undefined;
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 bg-muted rounded">개념 {conceptCount}개</span>
              <span className="px-2 py-0.5 bg-muted rounded">
                Cloze {(details.clozeCount as number) ?? 0}개
              </span>
              <span className="px-2 py-0.5 bg-muted rounded">
                {(details.wordCount as number) ?? 0}자
              </span>
              {recommendation === "split" && suggestedSplitCount && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                  {suggestedSplitCount}장 분할 권장
                </span>
              )}
            </div>
            {concepts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">감지된 개념:</p>
                {concepts.map((concept, i) => (
                  <div key={`concept-${i}`} className="text-xs p-2 bg-background rounded">
                    {i + 1}. {concept}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // --- 검증 결과 패널 ---
  const renderValidationPanel = () => {
    const cachedResult = currentValidation;
    const isValidating = validateCard.isPending;

    return (
      <>
        {!isMobile && (
          <div className="py-3 px-4 border-b shrink-0 flex items-center justify-between">
            <span className="text-sm font-semibold">검증 결과</span>
            {selectedNoteId && (
              <Button size="sm" onClick={handleValidateSelected} disabled={isValidating}>
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
        )}
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
                <StatusIcon status={cachedResult.status} size="md" />
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
                  onClick={() => setDetailTab("validate")}
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
                  onClick={() => setDetailTab("related")}
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
                // 5종 검증 결과
                <div className="space-y-2">
                  {VALIDATION_TYPES.map(({ key, icon, label }) =>
                    renderValidationSection(
                      key,
                      icon,
                      label,
                      cachedResult.results![key as keyof NonNullable<typeof cachedResult.results>],
                    ),
                  )}
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
                            onClick={() => handleSelectCard(card.noteId)}
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
                            onClick={() => handleSelectCard(nid)}
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
                5종 검증으로 카드 건강을 진단합니다.
                <br />
                <span className="text-xs">API 비용이 발생할 수 있습니다.</span>
              </p>
              <Button onClick={handleValidateSelected} disabled={isValidating}>
                <Shield className="w-4 h-4 mr-2" />
                검증 시작
              </Button>
            </div>
          )}
        </div>
      </>
    );
  };

  // 높이: 모바일 dvh-5rem, 데스크톱 vh-4rem (Layout 기준)
  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* ===== 헤더 ===== */}
      {isMobile ? (
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2.5">
            <h1 className="typo-h1">카드 검증</h1>
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
                          ${m.inputPricePerMillionTokens}/${m.outputPricePerMillionTokens} per 1M
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
          <h1 className="typo-h1 shrink-0">카드 검증</h1>
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
              <span>미검증: {unvalidatedCount}</span>
              {issueCount > 0 && <span className="text-red-500">문제: {issueCount}</span>}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchValidate}
              disabled={batchValidate.isPending || unvalidatedCount === 0}
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
        // 모바일: list ↔ detail 전환
        <div className="flex-1 flex flex-col min-h-0">
          {activePanel === "list" ? (
            <div
              key="list"
              className="vt-list flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-left-2 duration-200"
            >
              {renderCardList()}
              {/* 모바일 배치 검증 */}
              {unvalidatedCount > 0 && (
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
                        미검증 {unvalidatedCount}개 전체 검증
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
                    ) : (
                      <ContentRenderer
                        content={cardDetail?.text || ""}
                        showToggle={true}
                        defaultView="rendered"
                      />
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
                            <p className="font-medium">
                              {STATUS_LABELS[currentValidation.status]}
                            </p>
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
                  </div>
                ) : (
                  // 연관 탭 (모바일)
                  <div className="space-y-3">
                    {currentValidation?.results?.similarity?.details.similarCards.length ? (
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
                          ),
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {currentValidation ? "연관 카드가 없습니다" : "먼저 검증을 실행해주세요"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // 데스크톱: 3패널 레이아웃
        <div className="flex-1 grid grid-cols-[280px_1fr_360px] gap-0 min-h-0 border rounded-lg overflow-hidden">
          {/* 좌측: 카드 목록 */}
          <div className="flex flex-col min-h-0 border-r">{renderCardList()}</div>
          {/* 가운데: 원본 카드 */}
          <div className="flex flex-col min-h-0 border-r">{renderOriginalCard()}</div>
          {/* 우측: 검증 결과 */}
          <div className="flex flex-col min-h-0">{renderValidationPanel()}</div>
        </div>
      )}
    </div>
  );
}
