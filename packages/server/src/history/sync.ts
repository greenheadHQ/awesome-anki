import type { HistorySyncHealth, HistorySyncResult } from "./types.js";

export type HistorySyncMode = "local" | "remote";

function resolveMode(): HistorySyncMode {
  const raw = process.env.HISTORY_SYNC_MODE?.trim().toLowerCase();
  return raw === "remote" ? "remote" : "local";
}

interface RemoteHistorySyncAdapter {
  syncNow(): Promise<HistorySyncResult>;
  health(): Promise<HistorySyncHealth>;
}

class NoopRemoteHistorySyncAdapter implements RemoteHistorySyncAdapter {
  async syncNow(): Promise<HistorySyncResult> {
    return {
      mode: "remote",
      success: true,
      message:
        "Remote sync adapter is currently a noop. Configure rsync/scp implementation in a follow-up change.",
      syncedAt: new Date().toISOString(),
    };
  }

  async health(): Promise<HistorySyncHealth> {
    return {
      mode: "remote",
      status: "degraded",
      message:
        "Remote mode enabled with noop adapter. Data source remains local SQLite until remote adapter is implemented.",
      updatedAt: new Date().toISOString(),
    };
  }
}

const remoteAdapter = new NoopRemoteHistorySyncAdapter();

export function getHistorySyncMode(): HistorySyncMode {
  return resolveMode();
}

export async function getHistorySyncHealth(): Promise<HistorySyncHealth> {
  const mode = resolveMode();
  if (mode === "local") {
    return {
      mode: "local",
      status: "ok",
      message: "Local mode enabled. split-history.db is the source of truth.",
      updatedAt: new Date().toISOString(),
    };
  }

  return remoteAdapter.health();
}

export async function runHistorySyncNow(): Promise<HistorySyncResult> {
  const mode = resolveMode();
  if (mode === "local") {
    return {
      mode: "local",
      success: true,
      message:
        "Local mode does not require remote synchronization. Nothing to do.",
      syncedAt: new Date().toISOString(),
    };
  }

  return remoteAdapter.syncNow();
}
