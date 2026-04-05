import { AlertTriangle, GitCompareArrows, Loader2, Save } from "lucide-react";

import type { PromptSystemConflictLatest } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface SystemPromptEditorProps {
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

export function SystemPromptEditor({
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <CardTitle className="text-sm flex items-center gap-2 shrink-0">
            <Save className="w-4 h-4 text-primary" />
            시스템 프롬프트 원격 편집
          </CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span>revision: {revision ?? "-"}</span>
            <span className="truncate">active: {activeVersionName ?? "-"}</span>
            {activeVersionId && (
              <span className="font-mono text-[11px] truncate">{activeVersionId}</span>
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
            <Button type="button" variant="outline" size="sm" onClick={onReloadRemote}>
              다시 시도
            </Button>
          </div>
        ) : (
          <>
            <label htmlFor="system-prompt-editor" className="text-xs text-muted-foreground">
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

            <div className="space-y-3">
              <div>
                <label htmlFor="system-prompt-reason" className="text-xs text-muted-foreground">
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={onReloadRemote}
                  disabled={isSaving}
                >
                  원격 재조회
                </Button>
                <Button type="button" className="shrink-0" onClick={onSave} disabled={!canSave}>
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
                <span className="text-red-700">sync 실패: {lastSyncState.error || "unknown"}</span>
              )}
            </div>

            {showRemoteAdvancedNotice && (
              <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                원격 revision이 갱신되었습니다. 로컬 draft를 유지 중이므로
                <span className="font-medium"> 원격 재조회</span>로 최신값을 반영하세요.
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
                <p className="text-xs font-medium text-muted-foreground">로컬 수정안</p>
                <pre className="min-h-36 max-h-64 overflow-auto rounded border bg-background p-2 text-xs whitespace-pre-wrap break-words">
                  {systemPromptDraft}
                </pre>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onUseRemoteValue}>
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
