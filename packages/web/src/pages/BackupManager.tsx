/**
 * BackupManager - 백업 관리 및 롤백
 */

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  History,
  Loader2,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useBackups, useRollback } from "../hooks/useBackups";
import type { BackupEntry } from "../lib/api";
import { cn } from "../lib/utils";

/**
 * 롤백 확인 다이얼로그
 */
function RollbackConfirmDialog({
  backup,
  onConfirm,
  onCancel,
  isLoading,
}: {
  backup: BackupEntry;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const date = new Date(backup.timestamp).toLocaleString("ko-KR");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle
            id="rollback-confirm-title"
            className="flex items-center gap-2 text-orange-600"
          >
            <AlertTriangle className="h-5 w-5" />
            롤백 확인
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            다음 분할 작업을 롤백하시겠습니까?
          </p>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>원본 노트: {backup.originalNoteId}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span>생성된 카드: {backup.createdNoteIds.length}개</span>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-3">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>주의:</strong> 이 작업은 다음을 수행합니다:
            </p>
            <ul className="mt-2 text-sm text-orange-700 dark:text-orange-300 list-disc list-inside space-y-1">
              <li>원본 노트 내용 복원</li>
              <li>생성된 서브 카드 {backup.createdNoteIds.length}개 삭제</li>
            </ul>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  롤백 중...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  롤백 실행
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 롤백 결과 다이얼로그
 */
function RollbackResultDialog({
  success,
  restoredNoteId,
  deletedNoteIds,
  restoredFieldNames,
  restoredTags,
  warning,
  error,
  onClose,
}: {
  success: boolean;
  restoredNoteId?: number;
  deletedNoteIds?: number[];
  restoredFieldNames?: string[];
  restoredTags?: string[];
  warning?: string;
  error?: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle
            id="rollback-result-title"
            className={cn(
              "flex items-center gap-2",
              success ? "text-green-600" : "text-red-600",
            )}
          >
            {success ? (
              <>
                <CheckCircle className="h-5 w-5" />
                롤백 완료
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                롤백 실패
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {success ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                분할 작업이 성공적으로 롤백되었습니다.
              </p>
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">복원된 노트:</span>{" "}
                  {restoredNoteId}
                </div>
                <div>
                  <span className="text-muted-foreground">삭제된 카드:</span>{" "}
                  {deletedNoteIds?.length || 0}개
                </div>
                <div>
                  <span className="text-muted-foreground">복원 필드:</span>{" "}
                  {restoredFieldNames?.length || 0}개
                </div>
                <div>
                  <span className="text-muted-foreground">복원 태그:</span>{" "}
                  {restoredTags?.length || 0}개
                </div>
              </div>
              {warning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {warning}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={onClose}>확인</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 백업 항목 카드
 */
function BackupCard({
  backup,
  onRollback,
}: {
  backup: BackupEntry;
  onRollback: (backup: BackupEntry) => void;
}) {
  const date = new Date(backup.timestamp);
  const formattedDate = date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const relativeTime = getRelativeTime(date);

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                  backup.splitType === "hard"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                )}
              >
                {backup.splitType === "hard" ? "Hard Split" : "Soft Split"}
              </span>
              <span className="text-xs text-muted-foreground">
                {relativeTime}
              </span>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>원본 노트: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {backup.originalNoteId}
                </code>
              </div>

              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>생성된 카드: {backup.createdNoteIds.length}개</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs">{formattedDate}</span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onRollback(backup)}
            className="hover:border-orange-500 hover:text-orange-600"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            롤백
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR");
}

/**
 * BackupManager 메인 컴포넌트
 */
export function BackupManager() {
  const { data, isLoading, error, refetch } = useBackups();
  const rollbackMutation = useRollback();

  const [selectedBackup, setSelectedBackup] = useState<BackupEntry | null>(
    null,
  );
  const [rollbackResult, setRollbackResult] = useState<{
    success: boolean;
    restoredNoteId?: number;
    deletedNoteIds?: number[];
    restoredFieldNames?: string[];
    restoredTags?: string[];
    warning?: string;
    error?: string;
  } | null>(null);

  const handleRollbackConfirm = async () => {
    if (!selectedBackup) return;

    try {
      const result = await rollbackMutation.mutateAsync(selectedBackup.id);
      setRollbackResult(result);
      setSelectedBackup(null);
    } catch (err) {
      setRollbackResult({
        success: false,
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      });
      setSelectedBackup(null);
    }
  };

  const backups = data?.backups || [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="typo-h1 flex items-center gap-2">
            <History className="h-8 w-8" />
            백업 관리
          </h1>
          <p className="typo-body text-muted-foreground mt-1">
            분할 작업 기록을 관리하고 필요시 롤백할 수 있습니다.
          </p>
        </div>

        <Button variant="outline" onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 백업</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hard Split</p>
                <p className="text-2xl font-bold text-blue-600">
                  {backups.filter((b) => b.splitType === "hard").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-blue-600 text-sm font-medium">H</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Soft Split</p>
                <p className="text-2xl font-bold text-purple-600">
                  {backups.filter((b) => b.splitType === "soft").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-purple-600 text-sm font-medium">S</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 백업 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>백업 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
              <p className="text-muted-foreground">
                백업 목록을 불러오는데 실패했습니다.
              </p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="mt-4"
              >
                다시 시도
              </Button>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">백업 기록이 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-1">
                카드 분할을 적용하면 자동으로 백업이 생성됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => (
                <BackupCard
                  key={backup.id}
                  backup={backup}
                  onRollback={setSelectedBackup}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 롤백 확인 다이얼로그 */}
      {selectedBackup && (
        <RollbackConfirmDialog
          backup={selectedBackup}
          onConfirm={handleRollbackConfirm}
          onCancel={() => setSelectedBackup(null)}
          isLoading={rollbackMutation.isPending}
        />
      )}

      {/* 롤백 결과 다이얼로그 */}
      {rollbackResult && (
        <RollbackResultDialog
          {...rollbackResult}
          onClose={() => setRollbackResult(null)}
        />
      )}
    </div>
  );
}
