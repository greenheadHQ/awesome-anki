import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import type { SyncStatusState } from "../lib/sync-status";

function formatTimestamp(value: string | null): string {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return date.toLocaleString("ko-KR", { hour12: false });
}

export function SyncStatusBadge({ status }: { status: SyncStatusState | null }) {
  if (!status) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
        <Clock3 className="h-3.5 w-3.5" />
        동기화 기록 없음
      </div>
    );
  }

  if (status.hasPendingChanges) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        미동기화 변경 있음
        {status.lastSuccessAt && ` · 마지막 성공 ${formatTimestamp(status.lastSuccessAt)}`}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
      <CheckCircle2 className="h-3.5 w-3.5" />
      마지막 동기화 {formatTimestamp(status.lastSuccessAt)}
    </div>
  );
}
