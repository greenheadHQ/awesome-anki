import { CheckCircle, Hash, Sparkles, Trash2, XCircle } from "lucide-react";

import type { AllValidationResult } from "../../lib/api";
import { cn } from "../../lib/utils";
import { getSimilarityBadgeClass } from "./ClinicStatusIcon";

interface ValidationDetailsProps {
  typeKey: string;
  result: AllValidationResult["results"][keyof AllValidationResult["results"]];
}

/** 검증 유형별 세부 내용 렌더러 */
export function ValidationDetails({ typeKey, result }: ValidationDetailsProps) {
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

    case "yagni": {
      const isYagni = details.isYagni as boolean;
      const reason = details.reason as string;
      const affectedClozes = (details.affectedClozes as number[]) ?? [];
      return (
        <div className="space-y-2">
          {isYagni ? (
            <div className="flex items-start gap-2 text-xs">
              <Trash2 className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">{reason}</p>
                {affectedClozes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {affectedClozes.map((c) => (
                      <span
                        key={`yagni-c${c}`}
                        className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-mono"
                      >
                        c{c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">YAGNI Cloze가 감지되지 않았습니다</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
