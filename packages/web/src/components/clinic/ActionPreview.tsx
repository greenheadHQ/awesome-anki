/**
 * ActionPreview - 검증 결과 기반 수정 미리보기
 *
 * 중앙 패널 하단에 표시되며, 적용 가능한 수정을 diff 형태로 보여준다.
 * - verbose recommendation === "split" → Split 추천 배너
 * - yagni isYagni → YAGNI 제거 diff
 * - factCheck corrections → 팩트 정정 diff
 */

import { AlertTriangle, Minus, Plus, Scissors, Trash2 } from "lucide-react";
import { useMemo } from "react";

import type { AllValidationResult } from "../../lib/api";
import { computeFactDiff, computeYagniDiff } from "../../lib/card-fixer";
import { cn } from "../../lib/utils";

interface ActionPreviewProps {
  cardContent: string;
  validationResults: AllValidationResult["results"] | undefined;
}

// --- diff 라인 계산 ---
interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

function computeLineDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o === m) {
      if (o !== undefined) result.push({ type: "unchanged", content: o });
    } else if (o === undefined) {
      result.push({ type: "added", content: m });
    } else if (m === undefined) {
      result.push({ type: "removed", content: o });
    } else {
      result.push({ type: "removed", content: o });
      result.push({ type: "added", content: m });
    }
  }
  return result;
}

export function ActionPreview({ cardContent, validationResults }: ActionPreviewProps) {
  const verboseResult = validationResults?.verbose;
  const yagniResult = validationResults?.yagni;
  const factCheckResult = validationResults?.factCheck;

  const isSplitRecommended = verboseResult?.details.recommendation === "split";
  const isYagni = yagniResult?.details.isYagni === true;
  const factCorrections = useMemo(() => {
    if (!factCheckResult?.details.claims) return [];
    return factCheckResult.details.claims
      .filter((c) => !c.isVerified && c.correction)
      .map((c) => ({ claim: c.claim, correction: c.correction! }));
  }, [factCheckResult]);
  const hasFactCorrections = factCorrections.length > 0;

  const yagniDiff = useMemo(() => {
    if (!isYagni || !yagniResult?.details.affectedClozes.length) return null;
    return computeYagniDiff(cardContent, yagniResult.details.affectedClozes);
  }, [cardContent, isYagni, yagniResult]);

  const factDiff = useMemo(() => {
    if (!hasFactCorrections) return null;
    return computeFactDiff(cardContent, factCorrections);
  }, [cardContent, hasFactCorrections, factCorrections]);

  if (!isSplitRecommended && !isYagni && !hasFactCorrections) return null;

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground px-4">수정 미리보기</h3>

      {/* Split 추천 배너 */}
      {isSplitRecommended && (
        <div className="mx-4 flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-800">
          <Scissors className="w-4 h-4 text-purple-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Split 추천</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {verboseResult?.details.conceptCount}개 개념 감지
              {verboseResult?.details.suggestedSplitCount
                ? ` — ${verboseResult.details.suggestedSplitCount}장 분할 권장`
                : ""}
            </p>
          </div>
        </div>
      )}

      {/* YAGNI 제거 diff */}
      {isYagni && yagniDiff && yagniDiff.changes.length > 0 && (
        <DiffSection
          icon={<Trash2 className="w-4 h-4 text-orange-600" />}
          title="YAGNI Cloze 제거"
          subtitle={`${yagniDiff.changes.length}개 Cloze 제거`}
          original={cardContent}
          fixed={yagniDiff.fixed}
          badgeColor="orange"
        />
      )}

      {/* 팩트 정정 diff */}
      {hasFactCorrections && factDiff && factDiff.changes.length > 0 && (
        <DiffSection
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          title="팩트 정정"
          subtitle={`${factDiff.changes.length}개 수정`}
          original={cardContent}
          fixed={factDiff.fixed}
          badgeColor="red"
        />
      )}
    </div>
  );
}

function DiffSection({
  icon,
  title,
  subtitle,
  original,
  fixed,
  badgeColor,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  original: string;
  fixed: string;
  badgeColor: "orange" | "red";
}) {
  const diffLines = useMemo(() => computeLineDiff(original, fixed), [original, fixed]);
  const changedLines = diffLines.filter((l) => l.type !== "unchanged");

  const badgeStyles = {
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    red: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="mx-4 border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium flex-1">{title}</span>
        <span className={cn("text-xs px-1.5 py-0.5 rounded border", badgeStyles[badgeColor])}>
          {subtitle}
        </span>
      </div>
      <div className="p-2 bg-card text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
        {changedLines.map((line, idx) => (
          <div
            key={`${line.type}-${idx}`}
            className={cn(
              "flex gap-1.5 py-0.5 px-1.5 -mx-1.5 rounded-sm",
              line.type === "added" && "bg-green-500/10",
              line.type === "removed" && "bg-red-500/10",
            )}
          >
            <span className="w-4 shrink-0 text-center">
              {line.type === "removed" ? (
                <Minus className="w-3 h-3 text-red-500 inline" />
              ) : (
                <Plus className="w-3 h-3 text-green-500 inline" />
              )}
            </span>
            <span
              className={cn(
                "flex-1 whitespace-pre-wrap break-words",
                line.type === "removed" && "text-red-700 line-through",
                line.type === "added" && "text-green-700",
              )}
            >
              {line.content || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
