/**
 * CompactDiffView - 원본 vs 압축 콘텐츠 비교 컴포넌트
 *
 * Desktop: 2-column side-by-side 레이아웃
 * Mobile: 탭 전환 방식
 */

import { FileText, Minimize2 } from "lucide-react";
import { useState } from "react";

import { useIsMobile } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/utils";
import { AuditReportPanel, type AuditReport } from "./AuditReportPanel";
import { ContentRenderer } from "./ContentRenderer";

interface CompactDiffViewProps {
  originalText: string;
  compactedContent: string;
  auditReport: AuditReport;
  className?: string;
}

export function CompactDiffView({
  originalText,
  compactedContent,
  auditReport,
  className,
}: CompactDiffViewProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"original" | "compact">("compact");

  return (
    <div className={cn("space-y-3", className)}>
      {isMobile ? (
        /* --- Mobile: 탭 전환 --- */
        <div className="border rounded-lg overflow-hidden">
          {/* 탭 헤더 */}
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setActiveTab("original")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === "original"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              원본
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compact")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === "compact"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              압축
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="p-3 max-h-80 overflow-y-auto">
            <ContentRenderer
              content={activeTab === "original" ? originalText : compactedContent}
              showToggle
              defaultView="rendered"
            />
          </div>
        </div>
      ) : (
        /* --- Desktop: 2-column side-by-side --- */
        <div className="grid grid-cols-2 gap-3">
          {/* 원본 */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 border-b flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium text-sm">원본</span>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              <ContentRenderer content={originalText} showToggle defaultView="rendered" />
            </div>
          </div>

          {/* 압축 */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 border-b flex items-center gap-1.5">
              <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium text-sm">압축</span>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              <ContentRenderer content={compactedContent} showToggle defaultView="rendered" />
            </div>
          </div>
        </div>
      )}

      {/* 감사 보고서 */}
      <AuditReportPanel auditReport={auditReport} />
    </div>
  );
}
