/**
 * PromptManager - 프롬프트 버전 관리 페이지
 * 탭 구성: 버전 목록 | 실험 | 메트릭
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  Save,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HelpTooltip } from "../components/help/HelpTooltip";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  useActivatePrompt,
  useExperiments,
  usePromptVersions,
  useSaveSystemPrompt,
  useSystemPrompt,
} from "../hooks/usePrompts";
import {
  type Experiment,
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
  const [activeTab, setActiveTab] = useState<TabType>("versions");
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(
    null,
  );
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [draftBaseRevision, setDraftBaseRevision] = useState<number | null>(
    null,
  );
  const [hasUserEditedSystemPrompt, setHasUserEditedSystemPrompt] =
    useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [conflictLatest, setConflictLatest] =
    useState<PromptSystemConflictLatest | null>(null);
  const [lastSyncState, setLastSyncState] = useState<{
    success: boolean;
    syncedAt?: string;
    error?: string;
  } | null>(null);

  const { data: versionsData, isLoading: isLoadingVersions } =
    usePromptVersions();
  const { data: experimentsData, isLoading: isLoadingExperiments } =
    useExperiments();
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
    systemPromptQuery.data &&
      systemPromptDraft !== systemPromptQuery.data.systemPrompt,
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

  const syncSystemPromptQueryFromConflict = (
    latest: PromptSystemConflictLatest,
  ) => {
    queryClient.setQueryData<PromptSystemState>(
      queryKeys.prompts.system,
      (current) => {
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
      },
    );
  };

  const handleSaveSystemPrompt = async (expectedRevision?: number) => {
    if (!systemPromptQuery.data) {
      return;
    }

    try {
      const result = await saveSystemPrompt.mutateAsync({
        expectedRevision:
          expectedRevision ??
          draftBaseRevision ??
          systemPromptQuery.data.revision,
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
        toast.error(
          "리비전 충돌이 발생했습니다. 원격값을 확인 후 재시도하세요.",
        );
        return;
      }

      const message =
        error instanceof Error ? error.message : "systemPrompt 저장 실패";
      toast.error(message);
    }
  };

  const handleReloadRemote = async () => {
    const result = await systemPromptQuery.refetch();
    if (result.error) {
      const message =
        result.error instanceof Error
          ? result.error.message
          : "원격 systemPrompt 재조회 실패";
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

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="typo-h1">프롬프트 관리</h1>
      </div>

      <SystemPromptEditor
        systemPromptDraft={systemPromptDraft}
        setSystemPromptDraft={(value) => {
          setSystemPromptDraft(value);
          setHasUserEditedSystemPrompt(true);
        }}
        saveReason={saveReason}
        setSaveReason={setSaveReason}
        isLoading={systemPromptQuery.isLoading}
        isError={systemPromptQuery.isError}
        errorMessage={
          systemPromptQuery.error instanceof Error
            ? systemPromptQuery.error.message
            : "원격 systemPrompt 조회 실패"
        }
        revision={systemPromptQuery.data?.revision}
        activeVersionName={systemPromptQuery.data?.activeVersion.name}
        activeVersionId={systemPromptQuery.data?.activeVersion.id}
        isDirty={isSystemPromptDirty}
        canSave={canSaveSystemPrompt}
        isSaving={saveSystemPrompt.isPending}
        conflictLatest={conflictLatest}
        lastSyncState={lastSyncState}
        showRemoteAdvancedNotice={
          remoteAdvanced && isSystemPromptDirty && !hasUserEditedSystemPrompt
        }
        onSave={() => void handleSaveSystemPrompt()}
        onReloadRemote={() => void handleReloadRemote()}
        onUseRemoteValue={() => {
          if (!conflictLatest) return;
          setSystemPromptDraft(conflictLatest.systemPrompt);
          setDraftBaseRevision(conflictLatest.revision);
          setConflictLatest(null);
          setHasUserEditedSystemPrompt(false);
        }}
        onRetryWithLatest={() => {
          if (!conflictLatest) return;
          void handleSaveSystemPrompt(conflictLatest.revision);
        }}
      />

      {/* 탭 네비게이션 */}
      <div className="flex overflow-x-auto whitespace-nowrap mb-4">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border-b-2 transition-all duration-200 shrink-0",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.helpKey && <HelpTooltip helpKey={tab.helpKey} />}
            {tab.count !== undefined && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {tab.count}
              </span>
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
          {activeTab === "metrics" && (
            <MetricsTab versions={versionsData?.versions || []} />
          )}
        </div>
      </div>
    </div>
  );
}

interface SystemPromptEditorProps {
  systemPromptDraft: string;
  setSystemPromptDraft: (value: string) => void;
  saveReason: string;
  setSaveReason: (value: string) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  revision?: number;
  activeVersionName?: string;
  activeVersionId?: string;
  isDirty: boolean;
  canSave: boolean;
  isSaving: boolean;
  conflictLatest: PromptSystemConflictLatest | null;
  lastSyncState: {
    success: boolean;
    syncedAt?: string;
    error?: string;
  } | null;
  showRemoteAdvancedNotice: boolean;
  onSave: () => void;
  onReloadRemote: () => void;
  onUseRemoteValue: () => void;
  onRetryWithLatest: () => void;
}

function SystemPromptEditor({
  systemPromptDraft,
  setSystemPromptDraft,
  saveReason,
  setSaveReason,
  isLoading,
  isError,
  errorMessage,
  revision,
  activeVersionName,
  activeVersionId,
  isDirty,
  canSave,
  isSaving,
  conflictLatest,
  lastSyncState,
  showRemoteAdvancedNotice,
  onSave,
  onReloadRemote,
  onUseRemoteValue,
  onRetryWithLatest,
}: SystemPromptEditorProps) {
  return (
    <Card className="mb-4 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Save className="w-4 h-4 text-primary" />
            시스템 프롬프트 원격 편집
          </CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span>revision: {revision ?? "-"}</span>
            <span>active: {activeVersionName ?? "-"}</span>
            {activeVersionId && (
              <span className="font-mono text-[11px]">{activeVersionId}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            원격 systemPrompt 불러오는 중...
          </div>
        ) : isError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 space-y-2">
            <p>{errorMessage}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReloadRemote}
            >
              다시 시도
            </Button>
          </div>
        ) : (
          <>
            <label
              htmlFor="system-prompt-editor"
              className="text-xs text-muted-foreground"
            >
              시스템 프롬프트 본문
            </label>
            <textarea
              id="system-prompt-editor"
              aria-label="시스템 프롬프트"
              value={systemPromptDraft}
              onChange={(e) => setSystemPromptDraft(e.target.value)}
              className="w-full min-h-44 rounded-md border bg-background p-3 text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="원격 systemPrompt를 입력하세요."
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-3">
                <label
                  htmlFor="system-prompt-reason"
                  className="text-xs text-muted-foreground"
                >
                  변경 사유 (필수, 새 버전 changelog로 저장)
                </label>
                <input
                  id="system-prompt-reason"
                  type="text"
                  value={saveReason}
                  onChange={(e) => setSaveReason(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="예: 용어 통일, 지시문 간결화"
                />
              </div>
              <div className="md:col-span-1 flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onReloadRemote}
                  disabled={isSaving}
                >
                  원격 재조회
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  onClick={onSave}
                  disabled={!canSave}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  저장
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>{isDirty ? "로컬 변경 있음" : "원격과 동일"}</span>
              {lastSyncState?.success && (
                <span className="text-green-700">
                  sync 완료:{" "}
                  {lastSyncState.syncedAt
                    ? new Date(lastSyncState.syncedAt).toLocaleString()
                    : "방금"}
                </span>
              )}
              {lastSyncState && !lastSyncState.success && (
                <span className="text-red-700">
                  sync 실패: {lastSyncState.error || "unknown"}
                </span>
              )}
            </div>

            {showRemoteAdvancedNotice && (
              <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                원격 revision이 갱신되었습니다. 로컬 draft를 유지 중이므로
                <span className="font-medium"> 원격 재조회</span>로 최신값을
                반영하세요.
              </div>
            )}
          </>
        )}

        {conflictLatest && !isLoading && !isError && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50/70 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm text-yellow-900">
              <AlertTriangle className="w-4 h-4" />
              CAS 충돌 발생: 원격 revision {conflictLatest.revision}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <GitCompareArrows className="w-3.5 h-3.5" />
                  원격 최신값
                </p>
                <pre className="min-h-36 max-h-64 overflow-auto rounded border bg-background p-2 text-xs whitespace-pre-wrap break-words">
                  {conflictLatest.systemPrompt}
                </pre>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  로컬 수정안
                </p>
                <pre className="min-h-36 max-h-64 overflow-auto rounded border bg-background p-2 text-xs whitespace-pre-wrap break-words">
                  {systemPromptDraft}
                </pre>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onUseRemoteValue}
              >
                원격값으로 덮기
              </Button>
              <Button
                type="button"
                onClick={onRetryWithLatest}
                disabled={isSaving || saveReason.trim().length === 0}
              >
                내 수정안으로 강제 저장
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 버전 목록 탭
interface VersionsTabProps {
  versions: PromptVersion[];
  activeVersionId: string | null;
  isLoading: boolean;
  onActivate: (versionId: string) => void;
  isActivating: boolean;
  selectedVersion: PromptVersion | null;
  onSelectVersion: (version: PromptVersion | null) => void;
}

function VersionsTab({
  versions,
  activeVersionId,
  isLoading,
  onActivate,
  isActivating,
  selectedVersion,
  onSelectVersion,
}: VersionsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // 모바일: 상세 선택 시 목록 숨김
  const showDetail = !!selectedVersion;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
      {/* 버전 목록 — 모바일: 상세 선택 시 숨김 */}
      <div
        className={cn(
          "md:col-span-5 overflow-y-auto",
          showDetail && "hidden md:block",
        )}
      >
        <Card className="h-full">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm">버전 목록</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                버전이 없습니다
              </div>
            ) : (
              <div className="divide-y">
                {versions.map((version) => (
                  <button
                    type="button"
                    key={version.id}
                    onClick={() => onSelectVersion(version)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                      selectedVersion?.id === version.id && "bg-primary/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{version.name}</p>
                          {version.id === activeVersionId && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-0.5">
                              <Star className="w-3 h-3" />
                              활성
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {version.description || version.id}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    {/* 간단한 메트릭 */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{version.metrics?.totalSplits || 0}회 사용</span>
                      <span>
                        {Math.round((version.metrics?.approvalRate || 0) * 100)}
                        % 승인률
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 버전 상세 — 모바일: 전체 너비, 뒤로 버튼 */}
      <div
        className={cn(
          "md:col-span-7 overflow-y-auto",
          !showDetail && "hidden md:block",
        )}
      >
        {selectedVersion ? (
          <Card className="h-full">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectVersion(null)}
                  className="md:hidden"
                >
                  <ChevronLeft className="w-4 h-4" />
                  뒤로
                </Button>
                <CardTitle className="text-sm">
                  {selectedVersion.name}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {selectedVersion.id !== activeVersionId && (
                  <Button
                    size="sm"
                    onClick={() => onActivate(selectedVersion.id)}
                    disabled={isActivating}
                  >
                    {isActivating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    활성화
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* 기본 정보 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">기본 정보</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">ID:</span>{" "}
                    {selectedVersion.id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">상태:</span>{" "}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-xs",
                        selectedVersion.status === "active" &&
                          "bg-green-100 text-green-700",
                        selectedVersion.status === "draft" &&
                          "bg-yellow-100 text-yellow-700",
                        selectedVersion.status === "archived" &&
                          "bg-gray-100 text-gray-700",
                      )}
                    >
                      {selectedVersion.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">생성:</span>{" "}
                    {new Date(selectedVersion.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">수정:</span>{" "}
                    {new Date(selectedVersion.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* 설정 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">카드 설정</h3>
                <div className="grid grid-cols-3 gap-2 text-sm bg-muted p-3 rounded">
                  <div>
                    <span className="text-muted-foreground block">
                      Cloze 최대
                    </span>
                    <span className="font-medium">
                      {selectedVersion.config?.maxClozeChars}자
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Basic Front
                    </span>
                    <span className="font-medium">
                      {selectedVersion.config?.maxBasicFrontChars}자
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Basic Back
                    </span>
                    <span className="font-medium">
                      {selectedVersion.config?.maxBasicBackChars}자
                    </span>
                  </div>
                </div>
              </div>

              {/* 메트릭 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">성능 지표</h3>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard
                    label="총 분할"
                    value={selectedVersion.metrics?.totalSplits || 0}
                  />
                  <MetricCard
                    label="승인률"
                    value={`${Math.round((selectedVersion.metrics?.approvalRate || 0) * 100)}%`}
                    color={
                      (selectedVersion.metrics?.approvalRate || 0) >= 0.8
                        ? "green"
                        : (selectedVersion.metrics?.approvalRate || 0) >= 0.5
                          ? "yellow"
                          : "red"
                    }
                  />
                  <MetricCard
                    label="평균 글자 수"
                    value={Math.round(
                      selectedVersion.metrics?.avgCharCount || 0,
                    )}
                  />
                </div>
              </div>

              {/* 프롬프트 미리보기 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  시스템 프롬프트 (미리보기)
                </h3>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words">
                  {selectedVersion.systemPrompt}
                </pre>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>버전을 선택하세요</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// 메트릭 카드 컴포넌트
function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: "green" | "yellow" | "red";
}) {
  return (
    <div
      className={cn(
        "p-3 rounded text-center",
        color === "green" && "bg-green-50",
        color === "yellow" && "bg-yellow-50",
        color === "red" && "bg-red-50",
        !color && "bg-muted",
      )}
    >
      <div
        className={cn(
          "text-lg font-bold",
          color === "green" && "text-green-700",
          color === "yellow" && "text-yellow-700",
          color === "red" && "text-red-700",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// 실험 탭
interface ExperimentsTabProps {
  experiments: Experiment[];
  isLoading: boolean;
}

function ExperimentsTab({ experiments, isLoading }: ExperimentsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm">A/B 테스트</CardTitle>
        <Button size="sm" variant="outline">
          <FlaskConical className="w-4 h-4 mr-1" />새 실험
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto">
        {experiments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>실험이 없습니다</p>
            <p className="text-xs mt-1">
              두 버전을 비교하는 A/B 테스트를 시작해보세요
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {experiments.map((exp) => (
              <div key={exp.id} className="p-4 hover:bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{exp.name}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      exp.status === "running" && "bg-blue-100 text-blue-700",
                      exp.status === "completed" && "bg-gray-100 text-gray-700",
                    )}
                  >
                    {exp.status === "running" ? "진행 중" : "완료"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>{exp.controlVersionId}</span>
                  <span className="mx-2">vs</span>
                  <span>{exp.treatmentVersionId}</span>
                </div>
                {exp.status === "completed" && exp.winnerVersionId && (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600 font-medium">
                      우승: {exp.winnerVersionId}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 메트릭 탭
interface MetricsTabProps {
  versions: PromptVersion[];
}

function MetricsTab({ versions }: MetricsTabProps) {
  // 전체 통계 계산
  const totalSplits = versions.reduce(
    (sum, v) => sum + (v.metrics?.totalSplits || 0),
    0,
  );
  const avgApprovalRate =
    versions.length > 0
      ? versions.reduce((sum, v) => sum + (v.metrics?.approvalRate || 0), 0) /
        versions.length
      : 0;
  const avgCharCount =
    versions.length > 0
      ? versions.reduce((sum, v) => sum + (v.metrics?.avgCharCount || 0), 0) /
        versions.length
      : 0;

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* 전체 통계 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">전체 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="총 분할 수" value={totalSplits} />
            <MetricCard
              label="평균 승인률"
              value={`${Math.round(avgApprovalRate * 100)}%`}
              color={
                avgApprovalRate >= 0.8
                  ? "green"
                  : avgApprovalRate >= 0.5
                    ? "yellow"
                    : "red"
              }
            />
            <MetricCard label="평균 글자 수" value={Math.round(avgCharCount)} />
            <MetricCard label="버전 수" value={versions.length} />
          </div>
        </CardContent>
      </Card>

      {/* 버전별 비교 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">버전별 성능 비교</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              버전 데이터가 없습니다
            </div>
          ) : (
            <Table className="text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-left px-4 py-2">버전</TableHead>
                  <TableHead className="text-right px-4 py-2">
                    분할 수
                  </TableHead>
                  <TableHead className="text-right px-4 py-2">승인률</TableHead>
                  <TableHead className="hidden md:table-cell text-right px-4 py-2">
                    수정률
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right px-4 py-2">
                    거부율
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right px-4 py-2">
                    평균 글자
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {versions.map((version) => (
                  <TableRow key={version.id} className="hover:bg-muted/50">
                    <TableCell className="px-4 py-2 font-medium">
                      {version.name}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      {version.metrics?.totalSplits || 0}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      <span
                        className={cn(
                          (version.metrics?.approvalRate || 0) >= 0.8 &&
                            "text-green-600",
                          (version.metrics?.approvalRate || 0) < 0.5 &&
                            "text-red-600",
                        )}
                      >
                        {Math.round((version.metrics?.approvalRate || 0) * 100)}
                        %
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-2 text-right text-yellow-600">
                      {Math.round(
                        (version.metrics?.modificationRate || 0) * 100,
                      )}
                      %
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-2 text-right text-red-600">
                      {Math.round((version.metrics?.rejectionRate || 0) * 100)}%
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-2 text-right">
                      {Math.round(version.metrics?.avgCharCount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
