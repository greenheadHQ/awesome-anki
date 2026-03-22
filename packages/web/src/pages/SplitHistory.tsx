import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Filter,
  Loader2,
  Minimize2,
  RotateCw,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CompactDiffView } from "../components/card/CompactDiffView";
import { ContentRenderer } from "../components/card/ContentRenderer";
import { BottomSheet } from "../components/ui/bottom-sheet";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatCostUsd, ModelBadge } from "../components/ui/model-badge";
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
import { useDecks } from "../hooks/useDecks";
import { useHistoryDetail, useHistoryList, useHistorySyncHealth } from "../hooks/useHistory";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { SplitHistoryStatus } from "../lib/api";
import { cn } from "../lib/utils";
import { startViewTransition } from "../lib/view-transition";

const STATUS_OPTIONS: Array<{ value: SplitHistoryStatus; label: string }> = [
  { value: "generating", label: "Generating" },
  { value: "generated", label: "Generated" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
  { value: "error", label: "Error" },
  { value: "not_split", label: "Not Split" },
];

const AI_PREVIEW_MAX_DEPTH = 2;
const AI_PREVIEW_MAX_ARRAY_ITEMS = 20;
const AI_PREVIEW_MAX_OBJECT_KEYS = 30;
const AI_PREVIEW_MAX_STRING_CHARS = 400;

function buildAiResponsePreview(value: unknown, depth = 0): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    if (value.length <= AI_PREVIEW_MAX_STRING_CHARS) return value;
    const omitted = value.length - AI_PREVIEW_MAX_STRING_CHARS;
    return `${value.slice(0, AI_PREVIEW_MAX_STRING_CHARS)}... (${omitted} chars omitted)`;
  }

  if (typeof value !== "object") return value;

  if (depth >= AI_PREVIEW_MAX_DEPTH) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    const previewItems = value
      .slice(0, AI_PREVIEW_MAX_ARRAY_ITEMS)
      .map((item) => buildAiResponsePreview(item, depth + 1));

    if (value.length > AI_PREVIEW_MAX_ARRAY_ITEMS) {
      previewItems.push(`... (${value.length - AI_PREVIEW_MAX_ARRAY_ITEMS} more items)`);
    }
    return previewItems;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const previewObject: Record<string, unknown> = {};
  for (const [index, [key, nested]] of entries.entries()) {
    if (index >= AI_PREVIEW_MAX_OBJECT_KEYS) break;
    previewObject[key] = buildAiResponsePreview(nested, depth + 1);
  }

  if (entries.length > AI_PREVIEW_MAX_OBJECT_KEYS) {
    previewObject.__truncated__ = `${entries.length - AI_PREVIEW_MAX_OBJECT_KEYS} more keys`;
  }

  return previewObject;
}

function statusStyle(status: SplitHistoryStatus): string {
  switch (status) {
    case "applied":
      return "bg-green-100 text-green-700";
    case "generated":
      return "bg-blue-100 text-blue-700";
    case "rejected":
      return "bg-amber-100 text-amber-800";
    case "error":
      return "bg-red-100 text-red-700";
    case "not_split":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-purple-100 text-purple-700";
  }
}

function toStartIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toEndIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 90);

  const end = toLocalDateInputValue(endDate);
  const start = toLocalDateInputValue(startDate);
  return { start, end };
}

function StatusBadge({ status }: { status: SplitHistoryStatus }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusStyle(status))}>
      {status}
    </span>
  );
}

function OperationBadge({ operation }: { operation: "split" | "compact" | "skip" }) {
  if (operation === "compact") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
        <Minimize2 className="w-3 h-3" />
        Compact
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-700">
      <Scissors className="w-3 h-3" />
      Split
    </span>
  );
}

export function SplitHistory() {
  const isMobile = useIsMobile("xl");
  const [defaultRange] = useState(defaultDateRange);
  const [page, setPage] = useState(1);
  const [deckName, setDeckName] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showFullAiResponse, setShowFullAiResponse] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const { data: decksData } = useDecks();
  const { data: syncHealth } = useHistorySyncHealth();

  const historyList = useHistoryList({
    page,
    limit: 50,
    deckName: deckName === "all" ? undefined : deckName,
    status: status === "all" ? undefined : (status as SplitHistoryStatus),
    startDate: toStartIso(startDate),
    endDate: toEndIso(endDate),
  });

  const detail = useHistoryDetail(selectedSessionId);

  const aiResponsePreviewText = useMemo(() => {
    if (!detail.data?.aiResponse) return null;
    return JSON.stringify(buildAiResponsePreview(detail.data.aiResponse), null, 2);
  }, [detail.data?.aiResponse]);

  const aiResponseFullText = useMemo(() => {
    if (!showFullAiResponse || !detail.data?.aiResponse) return null;
    return JSON.stringify(detail.data.aiResponse, null, 2);
  }, [showFullAiResponse, detail.data?.aiResponse]);

  const listItems = historyList.data?.items || [];

  // 활성 필터 칩 목록
  const activeFilters: Array<{ label: string; onRemove: () => void }> = [];
  if (deckName !== "all") {
    activeFilters.push({
      label: deckName.length > 20 ? `${deckName.slice(0, 20)}...` : deckName,
      onRemove: () => {
        setDeckName("all");
        setPage(1);
      },
    });
  }
  if (status !== "all") {
    activeFilters.push({
      label: STATUS_OPTIONS.find((s) => s.value === status)?.label || status,
      onRemove: () => {
        setStatus("all");
        setPage(1);
      },
    });
  }

  const handleSelectSession = (sessionId: string) => {
    startViewTransition(() => {
      setShowFullAiResponse(false);
      setSelectedSessionId(sessionId);
    });
  };

  const handleBackToList = () => {
    startViewTransition(() => {
      setSelectedSessionId(null);
    });
  };

  // --- 필터 UI (모바일 BottomSheet에서도 재사용) ---
  const renderFilterContent = () => (
    <div className="grid grid-cols-2 gap-3">
      <Select
        value={deckName}
        onValueChange={(value) => {
          setDeckName(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="덱" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Decks</SelectItem>
          {decksData?.decks?.map((deck) => (
            <SelectItem key={deck} value={deck}>
              {deck}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {STATUS_OPTIONS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        type="date"
        value={startDate}
        onChange={(e) => {
          setStartDate(e.target.value);
          setPage(1);
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />

      <input
        type="date"
        value={endDate}
        onChange={(e) => {
          setEndDate(e.target.value);
          setPage(1);
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />
    </div>
  );

  // --- 상세 패널 공유 렌더러 ---
  const renderDetailContent = () => (
    <>
      {!selectedSessionId ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          목록에서 세션을 선택하세요.
        </div>
      ) : detail.isLoading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : detail.isError ? (
        <div className="h-full flex items-center justify-center text-destructive">
          <AlertTriangle className="w-5 h-5 mr-2" />
          상세 조회 실패
        </div>
      ) : detail.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <OperationBadge operation={detail.data.operation ?? "split"} />
            <StatusBadge status={detail.data.status} />
            {detail.data.aiModel && (
              <ModelBadge provider={detail.data.provider ?? "gemini"} model={detail.data.aiModel} />
            )}
            {detail.data.executionTimeMs != null && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {(detail.data.executionTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {detail.data.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {detail.data.errorMessage}
            </div>
          )}

          {detail.data.rejectionReason && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              반려 사유: {detail.data.rejectionReason}
            </div>
          )}

          {(detail.data.operation ?? "split") === "compact" ? (
            /* --- Compact detail: diff view + audit report --- */
            <>
              <CompactDiffView
                originalText={detail.data.originalText || "(empty)"}
                compactedContent={
                  ((detail.data.aiResponse as Record<string, unknown> | null)
                    ?.compactedContent as string) ?? "(empty)"
                }
                auditReport={
                  ((detail.data.aiResponse as Record<string, unknown> | null)?.auditReport as {
                    preserved: string[];
                    removed: string[];
                    transformed: string[];
                  }) ?? { preserved: [], removed: [], transformed: [] }
                }
              />
            </>
          ) : (
            /* --- Split detail: original + split cards --- */
            <>
              <section>
                <h3 className="text-sm font-semibold mb-2">원본 카드</h3>
                <div className="border rounded p-3 bg-background">
                  <ContentRenderer
                    content={detail.data.originalText || "(empty)"}
                    showToggle={true}
                    className="text-sm"
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">
                  분할 카드 ({detail.data.splitCards.length})
                </h3>
                <div className="space-y-2">
                  {detail.data.splitCards.map((card, index) => (
                    <div key={`${detail.data.sessionId}-card-${index}`} className="border rounded">
                      <div className="px-3 py-2 border-b bg-muted/40 text-xs font-medium flex items-center justify-between">
                        <span>
                          #{index + 1} {card.title}
                        </span>
                        {card.charCount != null && (
                          <span className="text-muted-foreground">{card.charCount}자</span>
                        )}
                      </div>
                      <div className="p-3">
                        <ContentRenderer
                          content={card.content}
                          showToggle={false}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section>
            <h3 className="text-sm font-semibold mb-2">이벤트 타임라인</h3>
            <div className="space-y-2">
              {detail.data.events.map((event) => (
                <div key={event.eventId} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {event.status === "applied" && <Check className="w-4 h-4 text-green-600" />}
                      {event.status === "error" && <X className="w-4 h-4 text-red-600" />}
                      <span className="text-sm font-medium">{event.eventType}</span>
                      <StatusBadge status={event.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {detail.data.aiResponse && (
            <details className="border rounded p-3">
              <summary className="cursor-pointer text-sm font-medium">
                AI Raw Response (JSON)
              </summary>
              <div className="mt-2 space-y-2">
                <pre className="text-xs overflow-x-auto bg-muted p-2 rounded">
                  {showFullAiResponse ? aiResponseFullText : aiResponsePreviewText}
                </pre>
                {!showFullAiResponse && (
                  <Button size="sm" variant="outline" onClick={() => setShowFullAiResponse(true)}>
                    전체 응답 보기
                  </Button>
                )}
              </div>
            </details>
          )}
        </div>
      ) : null}
    </>
  );

  // --- 페이지네이션 ---
  const renderPagination = () => (
    <div className="border-t px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">total {historyList.data?.totalCount || 0}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || historyList.isFetching}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </Button>
        <span className="text-xs text-muted-foreground">page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!historyList.data?.hasMore || historyList.isFetching}
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
        <h1 className="typo-h1">분할 이력</h1>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RotateCw className="w-3 h-3" />
          <span>
            sync: {syncHealth?.mode || "local"} / {syncHealth?.status || "ok"}
          </span>
        </div>
      </div>

      {/* ===== 모바일 레이아웃 (< xl) ===== */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 모바일 상세 뷰 — 목록↔상세 전환 */}
          {selectedSessionId ? (
            <div className="vt-detail flex-1 flex flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-2 duration-200">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Button variant="ghost" size="sm" onClick={handleBackToList}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  뒤로
                </Button>
                <span className="text-sm font-semibold">상세</span>
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
                  onClick={() => historyList.refetch()}
                  disabled={historyList.isFetching}
                  className="shrink-0 ml-auto"
                >
                  {historyList.isFetching ? (
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
                {historyList.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : historyList.isError ? (
                  <div className="flex items-center justify-center py-12 text-destructive text-sm">
                    <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                    {historyList.error instanceof Error
                      ? `이력 조회 실패: ${historyList.error.message}`
                      : "이력 조회 실패"}
                  </div>
                ) : listItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mb-2 opacity-60" />
                    <p>조회된 이력이 없습니다</p>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {listItems.map((item) => (
                        <button
                          type="button"
                          key={item.sessionId}
                          onClick={() => handleSelectSession(item.sessionId)}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors touch-target"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs">{item.noteId}</span>
                            <div className="flex items-center gap-1.5">
                              <OperationBadge operation={item.operation ?? "split"} />
                              <StatusBadge status={item.status} />
                              {item.provider && <ModelBadge provider={item.provider} />}
                            </div>
                          </div>
                          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs text-muted-foreground items-center">
                            <span className="truncate">{item.deckName || "(no deck)"}</span>
                            <span>{item.cardCount > 0 ? `${item.cardCount}장` : ""}</span>
                            <span className="font-mono">
                              {item.actualCostUsd != null ? formatCostUsd(item.actualCostUsd) : ""}
                            </span>
                            <span className="text-right">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
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
        /* ===== 데스크톱 레이아웃 (xl+) — 기존 좌우 분할 유지 ===== */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0">
          <Card className="xl:col-span-6 flex flex-col min-h-0">
            <div className="space-y-2 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Select
                  value={deckName}
                  onValueChange={(value) => {
                    setDeckName(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-0">
                    <SelectValue placeholder="덱 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Decks</SelectItem>
                    {decksData?.decks?.map((deck) => (
                      <SelectItem key={deck} value={deck}>
                        {deck}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-0">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 flex-1 min-w-0 rounded-md border bg-background px-2.5 text-sm"
                />
                <span className="text-xs text-muted-foreground select-none">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 flex-1 min-w-0 rounded-md border bg-background px-2.5 text-sm"
                />
              </div>
            </div>

            <CardContent className="flex-1 min-h-0 overflow-auto p-0">
              {historyList.isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : historyList.isError ? (
                <div className="h-full flex items-center justify-center text-destructive px-4 text-sm">
                  <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                  {historyList.error instanceof Error
                    ? `이력 조회 실패: ${historyList.error.message}`
                    : "이력 조회 실패"}
                </div>
              ) : listItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Sparkles className="w-8 h-8 mb-2 opacity-60" />
                  <p>조회된 이력이 없습니다</p>
                </div>
              ) : (
                <Table className="[&_th:first-child]:pl-4 [&_td:first-child]:pl-4">
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Note</TableHead>
                      <TableHead>Op</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="hidden xl:table-cell">모델</TableHead>
                      <TableHead className="hidden xl:table-cell">카드수</TableHead>
                      <TableHead className="hidden xl:table-cell">비용</TableHead>
                      <TableHead className="hidden xl:table-cell">생성일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listItems.map((item) => (
                      <TableRow
                        key={item.sessionId}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedSessionId === item.sessionId && "bg-primary/5",
                        )}
                        onClick={() => handleSelectSession(item.sessionId)}
                      >
                        <TableCell>
                          <div className="font-mono text-xs">{item.noteId}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {item.deckName || "(no deck)"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <OperationBadge operation={item.operation ?? "split"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {item.provider ? (
                            <ModelBadge provider={item.provider} />
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs">
                          {item.cardCount}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs font-mono text-muted-foreground">
                          {item.actualCostUsd != null ? formatCostUsd(item.actualCostUsd) : "--"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
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
              <CardTitle className="text-base">상세</CardTitle>
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
