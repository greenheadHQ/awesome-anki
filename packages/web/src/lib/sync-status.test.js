import { beforeEach, describe, expect, test } from "bun:test";
import {
  readSyncStatus,
  recordSyncAttempt,
  SYNC_STATUS_STORAGE_KEY,
} from "./sync-status";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key) {
    this.store.delete(key);
  }

  setItem(key, value) {
    this.store.set(key, value);
  }
}

describe("sync-status", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      writable: true,
      configurable: true,
    });
  });

  test("records successful sync", () => {
    const state = recordSyncAttempt({
      success: true,
      syncedAt: "2026-02-21T12:34:56.000Z",
    });

    expect(state.hasPendingChanges).toBe(false);
    expect(state.lastSuccessAt).toBe("2026-02-21T12:34:56.000Z");
    expect(state.lastError).toBeNull();
  });

  test("keeps last success when sync fails", () => {
    recordSyncAttempt({
      success: true,
      syncedAt: "2026-02-21T12:34:56.000Z",
    });
    const failed = recordSyncAttempt({
      success: false,
      error: "sync: auth not configured",
    });

    expect(failed.hasPendingChanges).toBe(true);
    expect(failed.lastSuccessAt).toBe("2026-02-21T12:34:56.000Z");
    expect(failed.lastError).toContain("auth not configured");
  });

  test("returns null for malformed payload", () => {
    localStorage.setItem(SYNC_STATUS_STORAGE_KEY, "{broken");
    expect(readSyncStatus()).toBeNull();
  });
});
