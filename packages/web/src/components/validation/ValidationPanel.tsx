/**
 * ValidationPanel - 카드 검증 결과 패널
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Hash,
  HelpCircle,
  Link2,
  Loader2,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  type AllValidationResult,
  api,
  type SimilarityResult,
  type ValidationStatus,
} from "../../lib/api";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface ValidationPanelProps {
  noteId: number;
  deckName: string;
  className?: string;
}

// 상태별 아이콘
function StatusIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case "valid":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case "error":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <HelpCircle className="w-5 h-5 text-gray-400" />;
  }
}

// 상태별 배경색
function getStatusBg(status: ValidationStatus): string {
  switch (status) {
    case "valid":
      return "bg-green-50 border-green-200";
    case "warning":
      return "bg-yellow-50 border-yellow-200";
    case "error":
      return "bg-red-50 border-red-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

export function ValidationPanel({ noteId, deckName, className }: ValidationPanelProps) {
  const [result, setResult] = useState<AllValidationResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [useEmbedding, setUseEmbedding] = useState(false);
  const [similarityResult, setSimilarityResult] = useState<SimilarityResult | null>(null);

  // 임베딩 상태 조회
  const { data: embeddingStatus } = useQuery({
    queryKey: ["embedding-status", deckName],
    queryFn: () => api.embedding.status(deckName),
    staleTime: 60000, // 1분
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validate.all(noteId, deckName),
    onSuccess: (data) => setResult(data),
  });

  // 임베딩 기반 유사성 검사 (별도 호출)
  const similarityMutation = useMutation({
    mutationFn: (useEmbed: boolean) =>
      api.validate.similarity(noteId, deckName, { useEmbedding: useEmbed }),
    onSuccess: (data) => setSimilarityResult(data.result),
  });

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

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            카드 검증
          </CardTitle>
          <Button
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                검증 중...
              </>
            ) : (
              "검증 시작"
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!result && !validateMutation.isPending && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">검증 버튼을 눌러 카드 내용을 검증하세요</p>
          </div>
        )}

        {validateMutation.isError && (
          <div className="text-center py-4 text-red-500">
            <XCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">검증 중 오류 발생</p>
          </div>
        )}

        {result && (
          <>
            {/* 전체 상태 */}
            <div
              className={cn(
                "p-3 rounded-lg border flex items-center gap-3",
                getStatusBg(result.overallStatus),
              )}
            >
              <StatusIcon status={result.overallStatus} />
              <div>
                <p className="font-medium">
                  {result.overallStatus === "valid" && "검증 통과"}
                  {result.overallStatus === "warning" && "검토 필요"}
                  {result.overallStatus === "error" && "문제 발견"}
                  {result.overallStatus === "unknown" && "검증 불가"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(result.validatedAt).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>

            {/* 팩트 체크 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
                onClick={() => toggleSection("factCheck")}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">팩트 체크</span>
                  <StatusIcon status={result.results.factCheck.status} />
                </div>
                {expandedSections.has("factCheck") ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has("factCheck") && (
                <div className="p-3 border-t bg-muted/30">
                  <p className="text-sm mb-2">{result.results.factCheck.message}</p>
                  <div className="text-xs text-muted-foreground">
                    정확도: {result.results.factCheck.details.overallAccuracy}%
                  </div>
                  {result.results.factCheck.details.claims.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.results.factCheck.details.claims.map((claim, i) => (
                        <div
                          key={`claim-${claim.claim.slice(0, 20)}-${i}`}
                          className="text-xs p-2 bg-background rounded"
                        >
                          <div className="flex items-start gap-2">
                            {claim.isVerified ? (
                              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500 mt-0.5" />
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
                  )}
                </div>
              )}
            </div>

            {/* 최신성 검사 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
                onClick={() => toggleSection("freshness")}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">최신성 검사</span>
                  <StatusIcon status={result.results.freshness.status} />
                </div>
                {expandedSections.has("freshness") ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has("freshness") && (
                <div className="p-3 border-t bg-muted/30">
                  <p className="text-sm mb-2">{result.results.freshness.message}</p>
                  {result.results.freshness.details.outdatedItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.results.freshness.details.outdatedItems.map((item, i) => (
                        <div
                          key={`freshness-${item.content.slice(0, 20)}-${i}`}
                          className="text-xs p-2 bg-background rounded"
                        >
                          <p className="font-medium">{item.content}</p>
                          <p className="text-muted-foreground">{item.reason}</p>
                          {item.currentInfo && (
                            <p className="text-green-600 mt-1">현재: {item.currentInfo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 유사성 검사 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
                onClick={() => toggleSection("similarity")}
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  <span className="font-medium">유사성 검사</span>
                  <StatusIcon
                    status={similarityResult?.status ?? result.results.similarity.status}
                  />
                  {/* 검사 방식 뱃지 */}
                  {(similarityResult?.details.method ||
                    result.results.similarity.details.method) && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1",
                        (similarityResult?.details.method ??
                          result.results.similarity.details.method) === "embedding"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {(similarityResult?.details.method ??
                        result.results.similarity.details.method) === "embedding" ? (
                        <>
                          <Sparkles className="w-3 h-3" />
                          임베딩
                        </>
                      ) : (
                        <>
                          <Hash className="w-3 h-3" />
                          Jaccard
                        </>
                      )}
                    </span>
                  )}
                </div>
                {expandedSections.has("similarity") ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has("similarity") && (
                <div className="p-3 border-t bg-muted/30">
                  {/* 검사 방식 토글 */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b">
                    <span className="text-xs text-muted-foreground">검사 방식</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUseEmbedding(false);
                          similarityMutation.mutate(false);
                        }}
                        disabled={similarityMutation.isPending}
                        className={cn(
                          "px-2 py-1 text-xs rounded flex items-center gap-1 transition",
                          !useEmbedding
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80",
                        )}
                      >
                        <Hash className="w-3 h-3" />
                        Jaccard
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUseEmbedding(true);
                          similarityMutation.mutate(true);
                        }}
                        disabled={similarityMutation.isPending}
                        className={cn(
                          "px-2 py-1 text-xs rounded flex items-center gap-1 transition",
                          useEmbedding ? "bg-purple-600 text-white" : "bg-muted hover:bg-muted/80",
                        )}
                      >
                        <Sparkles className="w-3 h-3" />
                        임베딩
                        {embeddingStatus?.cache.exists && embeddingStatus.coverage > 0 && (
                          <span className="text-[10px] opacity-80">
                            ({embeddingStatus.coverage}%)
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {similarityMutation.isPending && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-xs text-muted-foreground">검사 중...</span>
                    </div>
                  )}

                  {!similarityMutation.isPending && (
                    <>
                      <p className="text-sm mb-2">
                        {similarityResult?.message ?? result.results.similarity.message}
                      </p>
                      {(
                        similarityResult?.details.similarCards ??
                        result.results.similarity.details.similarCards
                      ).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(
                            similarityResult?.details.similarCards ??
                            result.results.similarity.details.similarCards
                          ).map((card, i) => (
                            <div
                              key={`similar-${card.noteId}-${i}`}
                              className="text-xs p-2 bg-background rounded"
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
                                  {card.similarity}% 유사
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-1 line-clamp-2">
                                {card.matchedContent}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 문맥 일관성 검사 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
                onClick={() => toggleSection("context")}
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  <span className="font-medium">문맥 일관성</span>
                  <StatusIcon status={result.results.context.status} />
                </div>
                {expandedSections.has("context") ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has("context") && (
                <div className="p-3 border-t bg-muted/30">
                  <p className="text-sm mb-2">{result.results.context.message}</p>
                  {result.results.context.details.relatedCards.length > 0 && (
                    <div className="text-xs text-muted-foreground mb-2">
                      연결된 카드: {result.results.context.details.relatedCards.length}개
                    </div>
                  )}
                  {result.results.context.details.inconsistencies.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.results.context.details.inconsistencies.map((inc, i) => (
                        <div
                          key={`inc-${inc.conflictingNoteId ?? "unknown"}-${i}`}
                          className="text-xs p-2 bg-background rounded"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                inc.severity === "high"
                                  ? "bg-red-100 text-red-700"
                                  : inc.severity === "medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-700",
                              )}
                            >
                              {inc.severity === "high"
                                ? "심각"
                                : inc.severity === "medium"
                                  ? "주의"
                                  : "경미"}
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
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
