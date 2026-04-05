/**
 * PromptManager - 프롬프트 버전 관리 페이지
 * 탭 구성: 버전 목록 | 실험 | 메트릭
 */

import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, ChevronRight, FileText, FlaskConical, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HelpTooltip } from "../components/help/HelpTooltip";
import { ExperimentsTab } from "../components/prompt/ExperimentsTab";
import { MetricsTab } from "../components/prompt/MetricsTab";
import { SystemPromptEditor } from "../components/prompt/SystemPromptEditor";
import { VersionsTab } from "../components/prompt/VersionsTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useIsMobile } from "../hooks/useMediaQuery";
import {
  useActivatePrompt,
  useExperiments,
  usePromptVersions,
  useSaveSystemPrompt,
  useSystemPrompt,
} from "../hooks/usePrompts";
import {
  PromptConflictError,
  type PromptSystemConflictLatest,
  type PromptSystemState,
  type PromptVersion,
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { cn } from "../lib/utils";

type TabType = "versions" | "experiments" | "metrics";

export function PromptManager() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile("xl");
  const [activeTab, setActiveTab] = useState<TabType>("versions");
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [draftBaseRevision, setDraftBaseRevision] = useState<number | null>(null);
  const [hasUserEditedSystemPrompt, setHasUserEditedSystemPrompt] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [conflictLatest, setConflictLatest] = useState<PromptSystemConflictLatest | null>(null);
  const [lastSyncState, setLastSyncState] = useState<{
    success: boolean;
    syncedAt?: string;
    error?: string;
  } | null>(null);
  const [showMobileEditor, setShowMobileEditor] = useState(false);

  const { data: versionsData, isLoading: isLoadingVersions } = usePromptVersions();
  const { data: experimentsData, isLoading: isLoadingExperiments } = useExperiments();
  const systemPromptQuery = useSystemPrompt();
  const activatePrompt = useActivatePrompt();
  const saveSystemPrompt = useSaveSystemPrompt();
  const remoteSystemPrompt = systemPromptQuery.data?.systemPrompt;
  const remoteRevision = systemPromptQuery.data?.revision;
  const remoteAdvanced =
    draftBaseRevision !== null &&
    remoteRevision !== undefined &&
    remoteRevision !== draftBaseRevision;

  const isSystemPromptDirty = Boolean(
    systemPromptQuery.data && systemPromptDraft !== systemPromptQuery.data.systemPrompt,
  );

  useEffect(() => {
    if (remoteSystemPrompt === undefined || remoteRevision === undefined) {
      return;
    }

    const isInitialHydration = draftBaseRevision === null;

    if (isInitialHydration || (!hasUserEditedSystemPrompt && remoteAdvanced)) {
      setSystemPromptDraft(remoteSystemPrompt);
      setDraftBaseRevision(remoteRevision);
      setConflictLatest(null);
      setHasUserEditedSystemPrompt(false);
    }
  }, [
    draftBaseRevision,
    hasUserEditedSystemPrompt,
    remoteRevision,
    remoteSystemPrompt,
    remoteAdvanced,
  ]);

  const canSaveSystemPrompt =
    !!systemPromptQuery.data &&
    isSystemPromptDirty &&
    saveReason.trim().length > 0 &&
    !saveSystemPrompt.isPending;

  const tabs = [
    {
      id: "versions" as const,
      label: "버전",
      icon: FileText,
      count: versionsData?.versions?.length || 0,
      helpKey: "promptVersion" as const,
    },
    {
      id: "experiments" as const,
      label: "실험",
      icon: FlaskConical,
      count: experimentsData?.count || 0,
      helpKey: "promptExperiment" as const,
    },
    {
      id: "metrics" as const,
      label: "메트릭",
      icon: BarChart3,
      helpKey: "promptMetrics" as const,
    },
  ];

  const handleActivate = (versionId: string) => {
    activatePrompt.mutate(versionId);
  };

  const syncSystemPromptQueryFromConflict = (latest: PromptSystemConflictLatest) => {
    queryClient.setQueryData<PromptSystemState>(queryKeys.prompts.system, (current) => {
      if (!current) {
        return {
          revision: latest.revision,
          systemPrompt: latest.systemPrompt,
          activeVersion: {
            id: latest.activeVersionId,
            name: latest.activeVersionId,
            updatedAt: latest.updatedAt,
          },
        };
      }

      return {
        ...current,
        revision: latest.revision,
        systemPrompt: latest.systemPrompt,
        activeVersion: {
          ...current.activeVersion,
          id: latest.activeVersionId,
          updatedAt: latest.updatedAt,
        },
      };
    });
  };

  const handleSaveSystemPrompt = async (expectedRevision?: number) => {
    if (!systemPromptQuery.data) {
      return;
    }

    try {
      const result = await saveSystemPrompt.mutateAsync({
        expectedRevision: expectedRevision ?? draftBaseRevision ?? systemPromptQuery.data.revision,
        systemPrompt: systemPromptDraft,
        reason: saveReason.trim(),
      });

      setSaveReason("");
      setConflictLatest(null);
      setLastSyncState(result.syncResult);
      setDraftBaseRevision(result.revision);
      setHasUserEditedSystemPrompt(false);
      toast.success(`systemPrompt 저장 완료: ${result.newVersion.id}`);
    } catch (error) {
      if (error instanceof PromptConflictError) {
        syncSystemPromptQueryFromConflict(error.latest);
        setConflictLatest(error.latest);
        setLastSyncState(null);
        toast.error("리비전 충돌이 발생했습니다. 원격값을 확인 후 재시도하세요.");
        return;
      }

      const message = error instanceof Error ? error.message : "systemPrompt 저장 실패";
      toast.error(message);
    }
  };

  const handleReloadRemote = async () => {
    const result = await systemPromptQuery.refetch();
    if (result.error) {
      const message =
        result.error instanceof Error ? result.error.message : "원격 systemPrompt 재조회 실패";
      toast.error(message);
      return;
    }

    if (!hasUserEditedSystemPrompt && result.data) {
      setSystemPromptDraft(result.data.systemPrompt);
      setDraftBaseRevision(result.data.revision);
      setConflictLatest(null);
      setHasUserEditedSystemPrompt(false);
    }
    toast.success("원격 systemPrompt를 다시 불러왔습니다.");
  };

  const systemPromptEditorProps = {
    systemPromptDraft,
    setSystemPromptDraft: (value: string) => {
      setSystemPromptDraft(value);
      setHasUserEditedSystemPrompt(true);
    },
    saveReason,
    setSaveReason,
    isLoading: systemPromptQuery.isLoading,
    isError: systemPromptQuery.isError,
    errorMessage:
      systemPromptQuery.error instanceof Error
        ? systemPromptQuery.error.message
        : "원격 systemPrompt 조회 실패",
    revision: systemPromptQuery.data?.revision,
    activeVersionName: systemPromptQuery.data?.activeVersion.name,
    activeVersionId: systemPromptQuery.data?.activeVersion.id,
    isDirty: isSystemPromptDirty,
    canSave: canSaveSystemPrompt,
    isSaving: saveSystemPrompt.isPending,
    conflictLatest,
    lastSyncState,
    showRemoteAdvancedNotice: remoteAdvanced && isSystemPromptDirty && !hasUserEditedSystemPrompt,
    onSave: () => void handleSaveSystemPrompt(),
    onReloadRemote: () => void handleReloadRemote(),
    onUseRemoteValue: () => {
      if (!conflictLatest) return;
      setSystemPromptDraft(conflictLatest.systemPrompt);
      setDraftBaseRevision(conflictLatest.revision);
      setConflictLatest(null);
      setHasUserEditedSystemPrompt(false);
    },
    onRetryWithLatest: () => {
      if (!conflictLatest) return;
      void handleSaveSystemPrompt(conflictLatest.revision);
    },
  };

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="typo-h1">프롬프트 관리</h1>
      </div>

      {/* 모바일: 접이식 요약 카드 + 풀스크린 편집 Dialog */}
      {isMobile ? (
        <>
          <button
            type="button"
            onClick={() => setShowMobileEditor(true)}
            className="mb-4 flex items-center gap-3 w-full rounded-lg border border-primary/30 bg-gradient-to-r from-card to-primary/5 px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <Save className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate flex-1">시스템 프롬프트</span>
            <span className="text-xs text-muted-foreground shrink-0">
              rev.{systemPromptQuery.data?.revision ?? "-"}
            </span>
            {isSystemPromptDirty && (
              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <Dialog open={showMobileEditor} onOpenChange={setShowMobileEditor}>
            <DialogContent className="max-w-full h-[100dvh] flex flex-col p-0 gap-0 rounded-none border-0 sm:max-w-full">
              <DialogHeader className="px-4 py-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Save className="w-4 h-4 text-primary" />
                  시스템 프롬프트 편집
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4">
                <SystemPromptEditor {...systemPromptEditorProps} />
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        /* 데스크톱: 기존 인라인 편집기 */
        <SystemPromptEditor {...systemPromptEditorProps} />
      )}

      {/* 탭 네비게이션 -- 모바일에서 sticky */}
      <div className="flex mb-4 sticky top-14 z-10 bg-background xl:static xl:z-auto">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 flex-1 min-w-0 px-2 xl:px-4 py-2.5 border-b-2 transition-all duration-200",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.helpKey && <HelpTooltip helpKey={tab.helpKey} />}
            {tab.count !== undefined && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          key={activeTab}
          className="h-full animate-in fade-in-0 slide-in-from-right-2 duration-200"
        >
          {activeTab === "versions" && (
            <VersionsTab
              versions={versionsData?.versions || []}
              activeVersionId={versionsData?.activeVersionId || null}
              isLoading={isLoadingVersions}
              onActivate={handleActivate}
              isActivating={activatePrompt.isPending}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
            />
          )}
          {activeTab === "experiments" && (
            <ExperimentsTab
              experiments={experimentsData?.experiments || []}
              isLoading={isLoadingExperiments}
            />
          )}
          {activeTab === "metrics" && <MetricsTab versions={versionsData?.versions || []} />}
        </div>
      </div>
    </div>
  );
}
