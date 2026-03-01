import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ContentRenderer } from "../components/card/ContentRenderer";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import {
  useHistoryDetail,
  useHistoryList,
  useHistorySyncHealth,
} from "../hooks/useHistory";
import type { SplitHistoryStatus } from "../lib/api";
import { cn } from "../lib/utils";

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
      previewItems.push(
        `... (${value.length - AI_PREVIEW_MAX_ARRAY_ITEMS} more items)`,
      );
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
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs font-medium",
        statusStyle(status),
      )}
    >
      {status}
    </span>
  );
}

export function SplitHistory() {
  const [defaultRange] = useState(defaultDateRange);
  const [page, setPage] = useState(1);
  const [deckName, setDeckName] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [showFullAiResponse, setShowFullAiResponse] = useState(false);

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
    return JSON.stringify(
      buildAiResponsePreview(detail.data.aiResponse),
      null,
      2,
    );
  }, [detail.data?.aiResponse]);

  const aiResponseFullText = useMemo(() => {
    if (!showFullAiResponse || !detail.data?.aiResponse) return null;
    return JSON.stringify(detail.data.aiResponse, null, 2);
  }, [showFullAiResponse, detail.data?.aiResponse]);

  const listItems = historyList.data?.items || [];

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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="xl:col-span-6 flex flex-col min-h-0">
          <CardHeader className="pb-3 gap-3">
            <CardTitle className="text-base">목록</CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

              <Button
                variant="outline"
                onClick={() => historyList.refetch()}
                disabled={historyList.isFetching}
              >
                {historyList.isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "새로고침"
                )}
              </Button>
            </div>
          </CardHeader>

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
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-12">상세</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="hidden md:table-cell">
                      카드수
                    </TableHead>
                    <TableHead className="hidden md:table-cell">시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listItems.map((item) => (
                    <TableRow
                      key={item.sessionId}
                      className="cursor-pointer"
                      onClick={() => {
                        setShowFullAiResponse(false);
                        setSelectedSessionId(item.sessionId);
                      }}
                    >
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{item.noteId}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {item.deckName || "(no deck)"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {item.cardCount}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          <div className="border-t px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              total {historyList.data?.totalCount || 0}
            </span>
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
        </Card>

        <Card className="xl:col-span-6 flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">상세</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
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
                  <StatusBadge status={detail.data.status} />
                  {detail.data.aiModel && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {detail.data.aiModel}
                    </span>
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
                      <div
                        key={`${detail.data.sessionId}-card-${index}`}
                        className="border rounded"
                      >
                        <div className="px-3 py-2 border-b bg-muted/40 text-xs font-medium flex items-center justify-between">
                          <span>
                            #{index + 1} {card.title}
                          </span>
                          {card.charCount != null && (
                            <span className="text-muted-foreground">
                              {card.charCount}자
                            </span>
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

                <section>
                  <h3 className="text-sm font-semibold mb-2">
                    이벤트 타임라인
                  </h3>
                  <div className="space-y-2">
                    {detail.data.events.map((event) => (
                      <div key={event.eventId} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {event.status === "applied" && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                            {event.status === "error" && (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium">
                              {event.eventType}
                            </span>
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
                        {showFullAiResponse
                          ? aiResponseFullText
                          : aiResponsePreviewText}
                      </pre>
                      {!showFullAiResponse && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowFullAiResponse(true)}
                        >
                          전체 응답 보기
                        </Button>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
