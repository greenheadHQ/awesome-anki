/**
 * DiffViewer - 분할 전후 Diff 비교 컴포넌트
 */

import { ArrowRight, Code, Equal, Eye, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { ContentRenderer } from "./ContentRenderer";

interface DiffViewerProps {
  original: string;
  splitCards: Array<{
    title: string;
    content: string;
    isMainCard?: boolean;
  }>;
  className?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber?: number;
}

/**
 * 간단한 라인 기반 diff 계산
 */
function computeLineDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  const result: DiffLine[] = [];

  const maxLen = Math.max(originalLines.length, modifiedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];

    if (origLine === modLine) {
      if (origLine !== undefined) {
        result.push({
          type: "unchanged",
          content: origLine,
          lineNumber: i + 1,
        });
      }
    } else if (origLine === undefined) {
      result.push({ type: "added", content: modLine, lineNumber: i + 1 });
    } else if (modLine === undefined) {
      result.push({ type: "removed", content: origLine, lineNumber: i + 1 });
    } else {
      result.push({ type: "removed", content: origLine, lineNumber: i + 1 });
      result.push({ type: "added", content: modLine });
    }
  }

  return result;
}

export function DiffViewer({ original, splitCards, className }: DiffViewerProps) {
  const mainCard = splitCards.find((c) => c.isMainCard) || splitCards[0];
  const subCards = splitCards.filter((c) => !c.isMainCard && c !== splitCards[0]);

  const diffLines = useMemo(() => {
    if (!mainCard) return [];
    return computeLineDiff(original, mainCard.content);
  }, [original, mainCard]);

  const hasChanges = diffLines.some((line) => line.type !== "unchanged");

  return (
    <div className={cn("space-y-4", className)}>
      {/* 분할 요약 */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded">
          <span className="font-medium">1</span>
          <span className="text-muted-foreground">원본</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded">
          <span className="font-medium">{splitCards.length}</span>
          <span>카드</span>
        </div>
      </div>

      {/* 메인 카드 Diff */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted px-3 py-2 border-b flex items-center justify-between">
          <span className="font-medium text-sm">
            {mainCard?.isMainCard ? "메인 카드 (nid 유지)" : "카드 1"}
          </span>
          {hasChanges ? (
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
              수정됨
            </span>
          ) : (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
              변경 없음
            </span>
          )}
        </div>
        <div className="p-3 bg-card text-sm font-mono overflow-x-auto max-h-80 overflow-y-auto">
          {diffLines.map((line, idx) => (
            <div
              key={`${line.type}-${line.lineNumber ?? idx}-${idx}`}
              className={cn(
                "flex gap-2 py-0.5 px-2 -mx-2",
                line.type === "added" && "bg-green-500/10",
                line.type === "removed" && "bg-red-500/10",
              )}
            >
              <span className="w-6 text-right text-muted-foreground select-none">
                {line.type === "removed" ? (
                  <Minus className="w-3 h-3 text-red-500 inline" />
                ) : line.type === "added" ? (
                  <Plus className="w-3 h-3 text-green-500 inline" />
                ) : (
                  <Equal className="w-3 h-3 text-muted-foreground inline" />
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

      {/* 서브 카드들 */}
      {subCards.map((card, idx) => (
        <div key={`sub-${card.title}-${idx}`} className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-3 py-2 border-b flex items-center justify-between">
            <span className="font-medium text-sm">
              새 카드 {idx + 1}: {card.title}
            </span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">새로 생성</span>
          </div>
          <div className="p-3 bg-card text-sm font-mono overflow-x-auto max-h-60 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words">{card.content}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 간단한 분할 미리보기 카드
 */
interface SplitPreviewCardProps {
  card: {
    title: string;
    content: string;
    isMainCard?: boolean;
  };
  index: number;
  className?: string;
}

export function SplitPreviewCard({ card, index, className }: SplitPreviewCardProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <div className="bg-muted px-3 py-2 border-b flex items-center justify-between">
        <span className="font-medium text-sm truncate">{card.title}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Raw/Rendered 토글 */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("rendered")}
              className={cn(
                "p-1 transition-colors",
                viewMode === "rendered" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              title="렌더링"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={cn(
                "p-1 transition-colors",
                viewMode === "raw" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              title="Raw"
            >
              <Code className="w-3 h-3" />
            </button>
          </div>
          {card.isMainCard ? (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">메인</span>
          ) : (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              #{index + 1}
            </span>
          )}
        </div>
      </div>
      <div className="p-3 text-sm max-h-60 overflow-y-auto">
        {viewMode === "rendered" ? (
          <ContentRenderer content={card.content} showToggle={false} defaultView="rendered" />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs bg-muted p-2 rounded">
            {card.content}
          </pre>
        )}
      </div>
    </div>
  );
}
