/**
 * ContentRenderer - Anki 카드 렌더링 컴포넌트
 *
 * templates/front.html과 동일한 파싱 로직 사용 (markdown-it 기반)
 * Raw 텍스트와 렌더링된 뷰를 토글 가능
 */

import { Code, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { renderAnkiContent } from "../../lib/markdown-renderer";
import { cn } from "../../lib/utils";

// highlight.js 테마 CSS (GitHub 스타일)
import "highlight.js/styles/github.css";

interface ContentRendererProps {
  content: string;
  className?: string;
  showToggle?: boolean;
  defaultView?: "rendered" | "raw";
}

export function ContentRenderer({
  content,
  className,
  showToggle = true,
  defaultView = "rendered",
}: ContentRendererProps) {
  const [view, setView] = useState<"rendered" | "raw">(defaultView);

  const processedContent = useMemo(() => renderAnkiContent(content), [content]);

  return (
    <div className={cn("relative", className)}>
      {/* 토글 버튼 */}
      {showToggle && (
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button
            type="button"
            onClick={() => setView("rendered")}
            className={cn(
              "p-1.5 rounded transition-colors",
              view === "rendered"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80",
            )}
            title="렌더링된 뷰"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("raw")}
            className={cn(
              "p-1.5 rounded transition-colors",
              view === "raw"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80",
            )}
            title="원본 텍스트"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="pt-10">
        {view === "raw" ? (
          <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap font-mono">
            {content}
          </pre>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none content-rendered"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Anki card HTML from user's own local database via AnkiConnect; html:true passthrough is intentional for KaTeX/MathML fidelity
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        )}
      </div>
    </div>
  );
}

// 컴팩트 버전 (토글 없이 렌더링만)
export function ContentPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const processedContent = useMemo(() => renderAnkiContent(content), [content]);

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none content-rendered",
        className,
      )}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Anki card HTML from user's own local database via AnkiConnect; html:true passthrough is intentional for KaTeX/MathML fidelity
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
