import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Filter,
  HelpCircle,
  Loader2,
  RotateCw,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { ContentRenderer } from "../components/card/ContentRenderer";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useValidateCard, useValidationCache } from "../hooks/useValidationCache";
import type { ValidationStatus } from "../lib/api";
import { DECK_SELECT_PLACEHOLDER } from "../lib/constants";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";

const CARD_FILTER_VALUES = ["all", "splitable", "unvalidated", "needs-review"] as const;
type CardFilter = (typeof CARD_FILTER_VALUES)[number];

const FILTER_LABELS: Record<CardFilter, string> = {
  all: "전체",
  splitable: "분할 가능",
  unvalidated: "미검증",
  "needs-review": "검토 필요",
};

function isCardFilter(value: string): value is CardFilter {
  return (CARD_FILTER_VALUES as readonly string[]).includes(value);
}

// 검증 상태 아이콘 컴포넌트
function ValidationIcon({
  status,
  size = "sm",
}: {
  status: ValidationStatus | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  if (status === null) {
    return (
      <span className="inline-flex" role="img" aria-label="미검증" title="미검증">
        <HelpCircle className={cn(sizeClass, "text-gray-300")} aria-hidden="true" />
      </span>
    );
  }

  switch (status) {
    case "valid":
      return (
        <span className="inline-flex" role="img" aria-label="검증 통과" title="검증 통과">
          <CheckCircle className={cn(sizeClass, "text-green-500")} aria-hidden="true" />
        </span>
      );
    case "warning":
      return (
        <span className="inline-flex" role="img" aria-label="검토 필요" title="검토 필요">
          <AlertTriangle className={cn(sizeClass, "text-yellow-500")} aria-hidden="true" />
        </span>
      );
    case "error":
      return (
        <span className="inline-flex" role="img" aria-label="문제 발견" title="문제 발견">
          <XCircle className={cn(sizeClass, "text-red-500")} aria-hidden="true" />
        </span>
      );
    default:
      return (
        <span className="inline-flex" role="img" aria-label="상태 불명" title="상태 불명">
          <HelpCircle className={cn(sizeClass, "text-gray-400")} aria-hidden="true" />
        </span>
      );
  }
}

export function CardBrowser() {
  const location = useLocation();
  const initialDeck = (location.state as { deckName?: string })?.deckName || null;
  const isMobile = useIsMobile("xl");

  const [selectedDeck, setSelectedDeck] = useState<string | null>(initialDeck);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<CardFilter>("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const { data: decksData } = useDecks();
  const {
    data: cardsData,
    isLoading,
    refetch,
    isFetching,
  } = useCards(selectedDeck, {
    page,
    limit: 20,
    filter: filter === "splitable" ? "splitable" : "all",
  });
  const { data: cardDetail } = useCardDetail(selectedNoteId);

  // ESC 키로 상세 패널 닫기
  useEffect(() => {
    if (!selectedNoteId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedNoteId(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNoteId]);

  const { getValidation, getValidationStatuses, cacheSize } = useValidationCache();
  const validateMutation = useValidateCard(selectedDeck);
  const cards = useMemo(() => cardsData?.cards ?? [], [cardsData]);

  const validationStatuses = useMemo(() => {
    return getValidationStatuses(cards.map((c) => c.noteId));
  }, [cards, getValidationStatuses]);

  const filteredCards = useMemo(() => {
    if (filter === "unvalidated") {
      return cards.filter((card) => !validationStatuses.get(card.noteId));
    }
    if (filter === "needs-review") {
      return cards.filter((card) => {
        const status = validationStatuses.get(card.noteId);
        return status === "warning" || status === "error";
      });
    }
    return cards;
  }, [cards, filter, validationStatuses]);

  const selectedCardValidation = selectedNoteId ? getValidation(selectedNoteId) : null;
  const totalPages = cardsData?.totalPages ?? 1;

  // 활성 필터 칩 목록
  const activeFilters: Array<{ label: string; onRemove: () => void }> = [];
  if (selectedDeck) {
    activeFilters.push({
      label: selectedDeck.length > 20 ? `${selectedDeck.slice(0, 20)}...` : selectedDeck,
      onRemove: () => {
        setSelectedDeck(null);
        setPage(1);
      },
    });
  }
  if (filter !== "all") {
    activeFilters.push({
      label: FILTER_LABELS[filter],
      onRemove: () => {
        setFilter("all");
        setPage(1);
      },
    });
  }

  const handleSelectCard = (noteId: number) => {
    startViewTransition(() => {
      setSelectedNoteId(noteId);
    });
  };

  const handleBackToList = () => {
    startViewTransition(() => {
      setSelectedNoteId(null);
    });
  };

  // --- 필터 UI (모바일 BottomSheet에서도 재사용) ---
  const renderFilterContent = () => (
    <div className="grid grid-cols-1 gap-3">
      <Select
        value={selectedDeck ?? DECK_SELECT_PLACEHOLDER}
        onValueChange={(value) => {
          setSelectedDeck(value === DECK_SELECT_PLACEHOLDER ? null : value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="덱 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DECK_SELECT_PLACEHOLDER}>전체 덱</SelectItem>
          {decksData?.decks.map((deck) => (
            <SelectItem key={deck} value={deck}>
              {deck}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter}
        onValueChange={(value) => {
          if (!isCardFilter(value)) return;
          setFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CARD_FILTER_VALUES.map((f) => (
            <SelectItem key={f} value={f}>
              {FILTER_LABELS[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // --- 상세 패널 공유 렌더러 ---
  const renderDetailContent = () => (
    <>
      {!selectedNoteId ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          목록에서 카드를 선택하세요.
        </div>
      ) : !cardDetail ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium">Note ID</h4>
            <p className="font-mono text-sm text-muted-foreground">{cardDetail.noteId}</p>
          </div>

          {/* 검증 상태 섹션 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Shield className="w-4 h-4" />
                검증 상태
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => validateMutation.mutate(selectedNoteId)}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : null}
                {selectedCardValidation ? "재검증" : "검증"}
              </Button>
            </div>
            {selectedCardValidation ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ValidationIcon status={selectedCardValidation.status} size="md" />
                  <span className="text-sm">
                    {selectedCardValidation.status === "valid" && "검증 통과"}
                    {selectedCardValidation.status === "warning" && "검토 필요"}
                    {selectedCardValidation.status === "error" && "문제 발견"}
                    {selectedCardValidation.status === "unknown" && "검증 불가"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  검증 시간: {new Date(selectedCardValidation.validatedAt).toLocaleString("ko-KR")}
                </p>
                {selectedCardValidation.results && (
                  <div className="text-xs space-y-1 mt-2 p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <span>팩트 체크:</span>
                      <ValidationIcon status={selectedCardValidation.results.factCheck.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>최신성:</span>
                      <ValidationIcon status={selectedCardValidation.results.freshness.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>유사성:</span>
                      <ValidationIcon status={selectedCardValidation.results.similarity.status} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">아직 검증되지 않았습니다</p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium">태그</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              {cardDetail.tags.length > 0 ? (
                cardDetail.tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">없음</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">분석</h4>
            <ul className="text-sm text-muted-foreground mt-1">
              <li>Cloze 개수: {cardDetail.clozeStats.totalClozes}</li>
              <li>분할 가능: {cardDetail.analysis.canSplit ? "예" : "아니오"}</li>
              <li>nid 링크: {cardDetail.nidLinks.length}개</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">내용</h4>
            <div className="rounded border bg-muted/50 p-2 text-sm">
              <ContentRenderer content={cardDetail.text} />
            </div>
          </div>
        </div>
      )}
    </>
  );

  // --- 페이지네이션 ---
  const renderPagination = () => (
    <div className="border-t px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">total {cardsData?.total || 0}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </Button>
        <span className="text-xs text-muted-foreground">page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="typo-h1">카드 브라우저</h1>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="w-3 h-3" />
          <span>캐시: {cacheSize}개 검증됨</span>
        </div>
      </div>

      {/* ===== 모바일 레이아웃 (< xl) ===== */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 모바일 상세 뷰 — 목록↔상세 전환 */}
          {selectedNoteId ? (
            <div className="vt-detail flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-2 duration-200">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Button variant="ghost" size="sm" onClick={handleBackToList}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  뒤로
                </Button>
                <span className="text-sm font-semibold">카드 상세</span>
              </div>
              <div className="flex-1 overflow-y-auto">{renderDetailContent()}</div>
            </div>
          ) : (
            <div className="vt-list flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-left-2 duration-200">
              {/* 모바일 필터: 칩 + 필터 버튼 */}
              <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
                {activeFilters.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full"
                  >
                    {f.label}
                    <button type="button" onClick={f.onRemove} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterSheet(true)}
                  className="shrink-0"
                >
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  필터
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="shrink-0 ml-auto"
                >
                  {isFetching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>

              <BottomSheet open={showFilterSheet} onOpenChange={setShowFilterSheet} title="필터">
                {renderFilterContent()}
              </BottomSheet>

              {/* 모바일 카드 리스트 */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : filteredCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="w-8 h-8 mb-2 opacity-60" />
                    <p>카드가 없습니다</p>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {filteredCards.map((card) => (
                        <button
                          type="button"
                          key={card.noteId}
                          onClick={() => handleSelectCard(card.noteId)}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors touch-target"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <ValidationIcon
                                status={validationStatuses.get(card.noteId) || null}
                              />
                              <span className="font-mono text-xs">{card.noteId}</span>
                            </div>
                            {card.isSplitable && (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                                분할
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-x-3 text-xs text-muted-foreground items-center">
                            <span className="truncate">
                              {card.text.replace(/<[^>]*>/g, "").slice(0, 80)}
                            </span>
                            <span>Cloze {card.clozeStats.totalClozes}</span>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {renderPagination()}
            </div>
          )}
        </div>
      ) : (
        /* ===== 데스크톱 레이아웃 (xl+) — 좌우 분할 ===== */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0">
          <Card className="xl:col-span-6 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Select
                  value={selectedDeck ?? DECK_SELECT_PLACEHOLDER}
                  onValueChange={(value) => {
                    setSelectedDeck(value === DECK_SELECT_PLACEHOLDER ? null : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-0">
                    <SelectValue placeholder="덱 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DECK_SELECT_PLACEHOLDER}>전체 덱</SelectItem>
                    {decksData?.decks.map((deck) => (
                      <SelectItem key={deck} value={deck}>
                        {deck}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter}
                  onValueChange={(value) => {
                    if (!isCardFilter(value)) return;
                    setFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_FILTER_VALUES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FILTER_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CardContent className="flex-1 min-h-0 overflow-auto p-0">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filteredCards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="w-8 h-8 mb-2 opacity-60" />
                  <p>카드가 없습니다</p>
                </div>
              ) : (
                <Table className="[&_th:first-child]:pl-4 [&_td:first-child]:pl-4">
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead>카드</TableHead>
                      <TableHead>검증</TableHead>
                      <TableHead className="hidden md:table-cell">Cloze</TableHead>
                      <TableHead>분할</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCards.map((card) => (
                      <TableRow
                        key={card.noteId}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedNoteId === card.noteId && "bg-primary/5",
                        )}
                        onClick={() => handleSelectCard(card.noteId)}
                      >
                        <TableCell>
                          <div className="font-mono text-xs">{card.noteId}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {card.text.replace(/<[^>]*>/g, "").slice(0, 60)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ValidationIcon status={validationStatuses.get(card.noteId) || null} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {card.clozeStats.totalClozes}
                        </TableCell>
                        <TableCell>
                          {card.isSplitable && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                              가능
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {renderPagination()}
          </Card>

          <Card className="xl:col-span-6 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">카드 상세</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
              {renderDetailContent()}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
