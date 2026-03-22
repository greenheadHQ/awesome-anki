/**
 * AuditReportPanel - 압축 감사 보고서 시각화 컴포넌트
 *
 * preserved/removed/transformed 항목을 색상 뱃지로 표시
 */

import { Check, Sparkles, X } from "lucide-react";

import { cn } from "../../lib/utils";

export interface AuditReport {
  preserved: string[];
  removed: string[];
  transformed: string[];
}

interface AuditReportPanelProps {
  auditReport: AuditReport;
  className?: string;
}

const SECTION_CONFIG = [
  {
    key: "preserved" as const,
    label: "유지됨",
    icon: Check,
    badgeBg: "bg-green-50",
    badgeText: "text-green-700",
    badgeRing: "ring-green-200/60",
    iconColor: "text-green-600",
  },
  {
    key: "removed" as const,
    label: "제거됨",
    icon: X,
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    badgeRing: "ring-red-200/60",
    iconColor: "text-red-600",
  },
  {
    key: "transformed" as const,
    label: "변환됨",
    icon: Sparkles,
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeRing: "ring-amber-200/60",
    iconColor: "text-amber-600",
  },
] as const;

export function AuditReportPanel({ auditReport, className }: AuditReportPanelProps) {
  const totalItems =
    auditReport.preserved.length + auditReport.removed.length + auditReport.transformed.length;

  if (totalItems === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        감사 보고서
      </h4>
      <div className="space-y-1.5">
        {SECTION_CONFIG.map(
          ({ key, label, icon: Icon, badgeBg, badgeText, badgeRing, iconColor }) => {
            const items = auditReport[key];
            if (items.length === 0) return null;

            return (
              <div key={key} className="flex flex-wrap gap-1.5 items-start">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded shrink-0",
                    badgeBg,
                    badgeText,
                  )}
                >
                  <Icon className={cn("w-3 h-3", iconColor)} />
                  {label}
                </span>
                {items.map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset",
                      badgeBg,
                      badgeText,
                      badgeRing,
                    )}
                  >
                    {item}
                  </span>
                ))}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
