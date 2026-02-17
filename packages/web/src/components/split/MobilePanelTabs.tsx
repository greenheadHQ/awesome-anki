/**
 * MobilePanelTabs - 모바일 전용 패널 전환 탭 바 + 모드 토글
 */

import { AlertTriangle, Eye, List, Scissors } from "lucide-react";
import type { WorkspaceMode } from "../../pages/SplitWorkspace";
import { cn } from "../../lib/utils";

export type SplitPanel = "candidates" | "original" | "preview";

interface MobilePanelTabsProps {
  activePanel: SplitPanel;
  onChangePanel: (panel: SplitPanel) => void;
  hasCard: boolean;
  hasPreview: boolean;
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  activeCount: number;
}

const tabs: {
  id: SplitPanel;
  label: string;
  icon: typeof List;
}[] = [
  { id: "candidates", label: "후보", icon: List },
  { id: "original", label: "원본", icon: Eye },
  { id: "preview", label: "미리보기", icon: Scissors },
];

export function MobilePanelTabs({
  activePanel,
  onChangePanel,
  hasCard,
  hasPreview,
  mode,
  onChangeMode,
  activeCount,
}: MobilePanelTabsProps) {
  return (
    <div className="md:hidden border-b bg-card">
      {/* 모드 토글 + 카운트 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b">
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => onChangeMode("candidates")}
            className={cn(
              "text-xs px-2.5 py-1 rounded transition-colors",
              mode === "candidates"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground",
            )}
          >
            <Scissors className="w-3 h-3 inline mr-1" />
            후보
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("difficult")}
            className={cn(
              "text-xs px-2.5 py-1 rounded transition-colors",
              mode === "difficult"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground",
            )}
          >
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            재분할
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeCount}개
        </span>
      </div>

      {/* 패널 탭 */}
      <div className="flex">
        {tabs.map((tab) => {
          const isDisabled = tab.id === "original" && !hasCard;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => !isDisabled && onChangePanel(tab.id)}
              disabled={isDisabled}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 min-h-[40px] text-sm font-medium transition-colors relative",
                activePanel === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground",
                isDisabled && "opacity-40 cursor-not-allowed",
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {/* 미리보기 데이터 인디케이터 */}
              {tab.id === "preview" && hasPreview && (
                <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
