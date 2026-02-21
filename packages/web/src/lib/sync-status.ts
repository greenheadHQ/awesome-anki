export const SYNC_STATUS_STORAGE_KEY = "anki_sync_status_v1";
export const SYNC_STATUS_EVENT = "anki-sync-status-updated";

export interface SyncResultPayload {
  success: boolean;
  syncedAt?: string;
  error?: string;
}

export interface SyncStatusState {
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  hasPendingChanges: boolean;
  lastError: string | null;
}

function emitSyncStatusUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
  }
}

export function readSyncStatus(): SyncStatusState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SYNC_STATUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncStatusState;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.lastAttemptAt !== "string") return null;
    if (
      parsed.lastSuccessAt !== null &&
      typeof parsed.lastSuccessAt !== "string"
    ) {
      return null;
    }
    if (typeof parsed.hasPendingChanges !== "boolean") return null;
    if (parsed.lastError !== null && typeof parsed.lastError !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSyncStatus(state: SyncStatusState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SYNC_STATUS_STORAGE_KEY, JSON.stringify(state));
  emitSyncStatusUpdated();
}

export function recordSyncAttempt(result?: SyncResultPayload): SyncStatusState {
  const now = new Date().toISOString();
  const previous = readSyncStatus();

  const next: SyncStatusState = {
    lastAttemptAt: now,
    lastSuccessAt:
      result?.success === true
        ? result.syncedAt || now
        : previous?.lastSuccessAt || null,
    hasPendingChanges: result?.success !== true,
    lastError: result?.success === true ? null : result?.error || "unknown",
  };

  writeSyncStatus(next);
  return next;
}
