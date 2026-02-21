import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ContentRenderer } from "../components/card/ContentRenderer";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { useCardDetail, useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import {
  useValidateCard,
  useValidationCache,
} from "../hooks/useValidationCache";
import type { ValidationStatus } from "../lib/api";
import { cn } from "../lib/utils";

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
      <span
        className="inline-flex"
        role="img"
        aria-label="미검증"
        title="미검증"
      >
        <HelpCircle
          className={cn(sizeClass, "text-gray-300")}
          aria-hidden="true"
        />
      </span>
    );
  }

  switch (status) {
    case "valid":
      return (
        <span
          className="inline-flex"
          role="img"
          aria-label="검증 통과"
          title="검증 통과"
        >
          <CheckCircle
            className={cn(sizeClass, "text-green-500")}
            aria-hidden="true"
          />
        </span>
      );
    case "warning":
      return (
        <span
          className="inline-flex"
          role="img"
          aria-label="검토 필요"
          title="검토 필요"
        >
          <AlertTriangle
            className={cn(sizeClass, "text-yellow-500")}
            aria-hidden="true"
          />
        </span>
      );
    case "error":
      return (
        <span
          className="inline-flex"
          role="img"
          aria-label="문제 발견"
          title="문제 발견"
        >
          <XCircle
            className={cn(sizeClass, "text-red-500")}
            aria-hidden="true"
          />
        </span>
      );
    default:
      return (
        <span
          className="inline-flex"
          role="img"
          aria-label="상태 불명"
          title="상태 불명"
        >
          <HelpCircle
            className={cn(sizeClass, "text-gray-400")}
            aria-hidden="true"
          />
        </span>
      );
  }
}

export function CardBrowser() {
  const location = useLocation();
  const initialDeck =
    (location.state as { deckName?: string })?.deckName || null;

  const [selectedDeck, setSelectedDeck] = useState<string | null>(initialDeck);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<
    "all" | "splitable" | "unvalidated" | "needs-review"
  >("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const { data: decksData } = useDecks();
  const { data: cardsData, isLoading } = useCards(selectedDeck, {
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

  const { getValidation, getValidationStatuses, cacheSize } =
    useValidationCache();
  const validateMutation = useValidateCard(selectedDeck);
  const cards = useMemo(() => cardsData?.cards ?? [], [cardsData]);

  // 카드 목록에서 검증 상태 가져오기
  const validationStatuses = useMemo(() => {
    return getValidationStatuses(cards.map((c) => c.noteId));
  }, [cards, getValidationStatuses]);

  // 필터링된 카드 목록
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

  // 현재 선택된 카드의 검증 결과
  const selectedCardValidation = selectedNoteId
    ? getValidation(selectedNoteId)
    : null;

  // 모바일 전체화면 오버레이에서만 inert 적용 (데스크톱은 사이드 패널이므로 목록 선택 가능해야 함)
  const isMobileOverlay =
    !!(selectedNoteId && cardDetail) &&
    typeof window !== "undefined" &&
    !window.matchMedia("(min-width: 768px)").matches;

  return (
    <div className="flex gap-6">
      {/* Main Content — 모바일 상세 오버레이 열릴 때 inert로 접근성 차단 */}
      <div className="flex-1 space-y-4" inert={isMobileOverlay || undefined}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">카드 브라우저</h1>
            <p className="text-muted-foreground">
              덱의 카드를 탐색하고 분석하세요
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <Shield className="inline-block w-4 h-4 mr-1" />
            캐시: {cacheSize}개 검증됨
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <select
            className="rounded-md border bg-background px-3 py-2 text-base md:text-sm"
            value={selectedDeck || ""}
            onChange={(e) => {
              setSelectedDeck(e.target.value || null);
              setPage(1);
            }}
          >
            <option value="">덱 선택</option>
            {decksData?.decks.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-base md:text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
          >
            <option value="all">전체</option>
            <option value="splitable">분할 가능</option>
            <option value="unvalidated">미검증</option>
            <option value="needs-review">검토 필요</option>
          </select>
        </div>

        {/* Card Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                로딩 중...
              </div>
            ) : !filteredCards.length ? (
              <div className="p-4 text-center text-muted-foreground">
                카드가 없습니다
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left text-sm font-medium w-10">
                      검증
                    </th>
                    <th className="p-3 text-left text-sm font-medium">
                      Note ID
                    </th>
                    <th className="hidden md:table-cell p-3 text-left text-sm font-medium">
                      미리보기
                    </th>
                    <th className="hidden md:table-cell p-3 text-left text-sm font-medium">
                      Cloze
                    </th>
                    <th className="p-3 text-left text-sm font-medium">
                      분할 타입
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map((card) => (
                    <tr
                      key={card.noteId}
                      className={cn(
                        "cursor-pointer border-b hover:bg-muted/50",
                        selectedNoteId === card.noteId && "bg-muted",
                      )}
                      onClick={() => setSelectedNoteId(card.noteId)}
                    >
                      <td className="p-3">
                        <ValidationIcon
                          status={validationStatuses.get(card.noteId) || null}
                        />
                      </td>
                      <td className="p-3 font-mono text-sm">{card.noteId}</td>
                      <td className="hidden md:table-cell max-w-md truncate p-3 text-sm">
                        {card.text.replace(/<[^>]*>/g, "").slice(0, 100)}...
                      </td>
                      <td className="hidden md:table-cell p-3 text-sm">
                        {card.clozeStats.totalClozes}
                      </td>
                      <td className="p-3">
                        {card.splitType && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-xs font-medium",
                              card.splitType === "hard"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700",
                            )}
                          >
                            {card.splitType}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {cardsData && cardsData.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {cardsData.total}개 중 {(page - 1) * 20 + 1}-
              {Math.min(page * 20, cardsData.total)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2 text-sm">
                {page} / {cardsData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === cardsData.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel — 모바일: 전체화면 오버레이, 데스크톱: 사이드 패널 */}
      {selectedNoteId && cardDetail && (
        <>
          {/* Backdrop — z-30: 모바일 전용 */}
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSelectedNoteId(null)}
            aria-hidden="true"
          />
          <Card className="fixed inset-0 z-40 overflow-y-auto md:static md:inset-auto md:z-auto md:w-96 md:shrink-0">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 md:static">
              <CardTitle className="text-lg">카드 상세</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNoteId(null)}
                aria-label="상세 패널 닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Note ID</h4>
                <p className="font-mono text-sm text-muted-foreground">
                  {cardDetail.noteId}
                </p>
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
                      <ValidationIcon
                        status={selectedCardValidation.status}
                        size="md"
                      />
                      <span className="text-sm">
                        {selectedCardValidation.status === "valid" &&
                          "검증 통과"}
                        {selectedCardValidation.status === "warning" &&
                          "검토 필요"}
                        {selectedCardValidation.status === "error" &&
                          "문제 발견"}
                        {selectedCardValidation.status === "unknown" &&
                          "검증 불가"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      검증 시간:{" "}
                      {new Date(
                        selectedCardValidation.validatedAt,
                      ).toLocaleString("ko-KR")}
                    </p>
                    {selectedCardValidation.results && (
                      <div className="text-xs space-y-1 mt-2 p-2 bg-muted rounded">
                        <div className="flex items-center justify-between">
                          <span>팩트 체크:</span>
                          <ValidationIcon
                            status={
                              selectedCardValidation.results.factCheck.status
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>최신성:</span>
                          <ValidationIcon
                            status={
                              selectedCardValidation.results.freshness.status
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>유사성:</span>
                          <ValidationIcon
                            status={
                              selectedCardValidation.results.similarity.status
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    아직 검증되지 않았습니다
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium">태그</h4>
                <div className="flex flex-wrap gap-1">
                  {cardDetail.tags.length > 0 ? (
                    cardDetail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-muted px-2 py-0.5 text-xs"
                      >
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
                <ul className="text-sm text-muted-foreground">
                  <li>Cloze 개수: {cardDetail.clozeStats.totalClozes}</li>
                  <li>
                    Hard Split 가능:{" "}
                    {cardDetail.analysis.canHardSplit ? "예" : "아니오"}
                  </li>
                  <li>nid 링크: {cardDetail.nidLinks.length}개</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium">내용</h4>
                <div className="max-h-64 overflow-auto rounded border bg-muted/50 p-2 text-sm">
                  <ContentRenderer content={cardDetail.text} />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
