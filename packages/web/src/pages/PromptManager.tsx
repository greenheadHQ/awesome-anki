/**
 * PromptManager - 프롬프트 버전 관리 페이지
 * 탭 구성: 버전 목록 | 히스토리 | 실험 | 메트릭
 */

import {
  BarChart3,
  Check,
  ChevronRight,
  Edit,
  FileText,
  FlaskConical,
  History,
  Loader2,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import { HelpTooltip } from "../components/help/HelpTooltip";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  useActivatePrompt,
  useExperiments,
  usePromptHistory,
  usePromptVersions,
} from "../hooks/usePrompts";
import type { Experiment, PromptVersion, SplitHistoryEntry } from "../lib/api";
import { cn } from "../lib/utils";

type TabType = "versions" | "history" | "experiments" | "metrics";

export function PromptManager() {
  const [activeTab, setActiveTab] = useState<TabType>("versions");
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(
    null,
  );

  const { data: versionsData, isLoading: isLoadingVersions } =
    usePromptVersions();
  const { data: historyData, isLoading: isLoadingHistory } = usePromptHistory({
    limit: 50,
  });
  const { data: experimentsData, isLoading: isLoadingExperiments } =
    useExperiments();
  const activatePrompt = useActivatePrompt();

  const tabs = [
    {
      id: "versions" as const,
      label: "버전",
      icon: FileText,
      count: versionsData?.versions?.length || 0,
      helpKey: "promptVersion" as const,
    },
    {
      id: "history" as const,
      label: "히스토리",
      icon: History,
      count: historyData?.total || 0,
      helpKey: "promptHistory" as const,
    },
    {
      id: "experiments" as const,
      label: "실험",
      icon: FlaskConical,
      count: experimentsData?.total || 0,
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

  return (
    <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">프롬프트 관리</h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 md:px-4 py-2 border-b-2 transition-colors whitespace-nowrap min-h-[44px]",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
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
      <div className="flex-1 min-h-0">
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
        {activeTab === "history" && (
          <HistoryTab
            entries={historyData?.entries || []}
            isLoading={isLoadingHistory}
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
      {/* 버전 목록 */}
      <div className="md:col-span-5 overflow-y-auto">
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

      {/* 버전 상세 */}
      <div className="md:col-span-7 overflow-y-auto">
        {selectedVersion ? (
          <Card className="h-full">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{selectedVersion.name}</CardTitle>
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

// 히스토리 탭
interface HistoryTabProps {
  entries: SplitHistoryEntry[];
  isLoading: boolean;
}

function HistoryTab({ entries, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm">분할 히스토리</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            히스토리가 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2">시간</th>
                  <th className="text-left px-4 py-2">Note ID</th>
                  <th className="text-left px-4 py-2">버전</th>
                  <th className="text-left px-4 py-2">결과</th>
                  <th className="text-left px-4 py-2">카드 수</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono">{entry.noteId}</td>
                    <td className="px-4 py-2">{entry.promptVersionId}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs flex items-center gap-1 w-fit",
                          entry.userAction === "approved" &&
                            "bg-green-100 text-green-700",
                          entry.userAction === "modified" &&
                            "bg-yellow-100 text-yellow-700",
                          entry.userAction === "rejected" &&
                            "bg-red-100 text-red-700",
                        )}
                      >
                        {entry.userAction === "approved" && (
                          <ThumbsUp className="w-3 h-3" />
                        )}
                        {entry.userAction === "modified" && (
                          <Edit className="w-3 h-3" />
                        )}
                        {entry.userAction === "rejected" && (
                          <ThumbsDown className="w-3 h-3" />
                        )}
                        {entry.userAction}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {entry.splitCards?.length || 0}개
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              버전 데이터가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2">버전</th>
                    <th className="text-right px-4 py-2">분할 수</th>
                    <th className="text-right px-4 py-2">승인률</th>
                    <th className="text-right px-4 py-2">수정률</th>
                    <th className="text-right px-4 py-2">거부율</th>
                    <th className="text-right px-4 py-2">평균 글자</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {versions.map((version) => (
                    <tr key={version.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{version.name}</td>
                      <td className="px-4 py-2 text-right">
                        {version.metrics?.totalSplits || 0}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={cn(
                            (version.metrics?.approvalRate || 0) >= 0.8 &&
                              "text-green-600",
                            (version.metrics?.approvalRate || 0) < 0.5 &&
                              "text-red-600",
                          )}
                        >
                          {Math.round(
                            (version.metrics?.approvalRate || 0) * 100,
                          )}
                          %
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-yellow-600">
                        {Math.round(
                          (version.metrics?.modificationRate || 0) * 100,
                        )}
                        %
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {Math.round(
                          (version.metrics?.rejectionRate || 0) * 100,
                        )}
                        %
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Math.round(version.metrics?.avgCharCount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
