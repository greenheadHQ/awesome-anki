import { useState } from "react";

import type { SplitCandidate, WorkspaceMode } from "../components/split/types";
import { startViewTransition } from "../lib/view-transition";
import type { MobilePanel } from "../lib/workspace-types";

export function useSplitNavigation(isMobile: boolean) {
  const [selectedCard, setSelectedCard] = useState<SplitCandidate | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("candidates");
  const [activePanel, setActivePanel] = useState<MobilePanel>("list");
  const [detailTab, setDetailTab] = useState<"original" | "preview">("original");

  const handleSelectCard = (card: SplitCandidate | null, splitPreviewReset?: () => void) => {
    setSelectedCard(card);
    if (card) {
      splitPreviewReset?.();
      setDetailTab("original");

      // 모바일: detail 뷰로 전환
      if (isMobile) {
        startViewTransition(() => setActivePanel("detail"));
      }
    }
  };

  const handleBackToList = () => {
    startViewTransition(() => {
      setActivePanel("list");
    });
  };

  return {
    selectedCard,
    mode,
    activePanel,
    detailTab,
    setMode,
    setActivePanel,
    setDetailTab,
    handleSelectCard,
    handleBackToList,
  };
}
