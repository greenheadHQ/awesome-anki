import { Check, ChevronLeft, ChevronRight, FileText, Loader2, Star } from "lucide-react";

import type { PromptVersion } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MetricCard } from "./MetricCard";

export interface VersionsTabProps {
  versions: PromptVersion[];
  activeVersionId: string | null;
  isLoading: boolean;
  onActivate: (versionId: string) => void;
  isActivating: boolean;
  selectedVersion: PromptVersion | null;
  onSelectVersion: (version: PromptVersion | null) => void;
}

export function VersionsTab({
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full grid-rows-[1fr] overflow-hidden">
      {/* 버전 목록 -- 모바일: 상세 선택 시 숨김 */}
      <div
        className={cn(
          "xl:col-span-5 overflow-y-auto min-h-0 min-w-0",
          showDetail && "hidden xl:block",
        )}
      >
        <Card className="h-full">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm">버전 목록</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">버전이 없습니다</div>
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
                      <span>{Math.round((version.metrics?.approvalRate || 0) * 100)}% 승인률</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 버전 상세 -- 모바일: 전체 너비, 뒤로 버튼 */}
      <div className={cn("xl:col-span-7 min-h-0 min-w-0", !showDetail && "hidden xl:block")}>
        {selectedVersion ? (
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectVersion(null)}
                  className="xl:hidden px-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  뒤로
                </Button>
                <CardTitle className="text-sm">{selectedVersion.name}</CardTitle>
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
            <CardContent className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
              {/* 기본 정보 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">기본 정보</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">ID:</span> {selectedVersion.id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">상태:</span>{" "}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-xs",
                        selectedVersion.status === "active" && "bg-green-100 text-green-700",
                        selectedVersion.status === "draft" && "bg-yellow-100 text-yellow-700",
                        selectedVersion.status === "archived" && "bg-gray-100 text-gray-700",
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded bg-muted px-2.5 py-2 text-center">
                    <div className="text-sm font-semibold tabular-nums">
                      {selectedVersion.config?.maxClozeChars ?? "-"}자
                    </div>
                    <div className="text-[11px] text-muted-foreground">Cloze 최대</div>
                  </div>
                  <div className="rounded bg-muted px-2.5 py-2 text-center">
                    <div className="text-sm font-semibold tabular-nums">
                      {selectedVersion.config?.maxBasicFrontChars ?? "-"}자
                    </div>
                    <div className="text-[11px] text-muted-foreground">Basic Front</div>
                  </div>
                  <div className="rounded bg-muted px-2.5 py-2 text-center">
                    <div className="text-sm font-semibold tabular-nums">
                      {selectedVersion.config?.maxBasicBackChars ?? "-"}자
                    </div>
                    <div className="text-[11px] text-muted-foreground">Basic Back</div>
                  </div>
                </div>
              </div>

              {/* 메트릭 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">성능 지표</h3>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="총 분할" value={selectedVersion.metrics?.totalSplits || 0} />
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
                    value={Math.round(selectedVersion.metrics?.avgCharCount || 0)}
                  />
                </div>
              </div>

              {/* 프롬프트 미리보기 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">시스템 프롬프트 (미리보기)</h3>
                <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words">
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
