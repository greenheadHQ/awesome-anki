/**
 * legacy file SoT → 원격 SoT 마이그레이션
 */

import { AnkiConnectError } from "../errors.js";
import {
  type RemoteSystemPromptPayload,
  getRemoteSystemPromptPayload,
  setRemoteSystemPromptPayload,
} from "./remote-prompt.js";
import { getActiveVersion, getVersion } from "./storage.js";

function isUnsupportedRemoteConfigActionError(error: unknown): boolean {
  if (!(error instanceof AnkiConnectError)) {
    return false;
  }

  return error.code === "UNSUPPORTED_REMOTE_CONFIG_ACTION";
}

export interface SystemPromptMigrationResult {
  migrated: boolean;
  reason:
    | "already-exists"
    | "no-active-version"
    | "active-version-missing"
    | "empty-active-system-prompt"
    | "remote-config-action-unsupported"
    | "migrated";
  payload?: RemoteSystemPromptPayload;
}

/**
 * legacy file SoT(output/prompts)에서 원격 SoT로 1회 이관
 */
export async function migrateLegacySystemPromptToRemoteIfNeeded(): Promise<SystemPromptMigrationResult> {
  // NOTE:
  // getRemoteSystemPromptPayload() -> setRemoteSystemPromptPayload() 사이에 TOCTOU 창이 있다.
  // 현재는 단일 인스턴스 서버의 startup 1회 마이그레이션만 가정하므로 별도 락을 두지 않는다.
  let existing: RemoteSystemPromptPayload | null;
  try {
    existing = await getRemoteSystemPromptPayload();
  } catch (error) {
    if (isUnsupportedRemoteConfigActionError(error)) {
      return {
        migrated: false,
        reason: "remote-config-action-unsupported",
      };
    }
    throw error;
  }

  if (existing) {
    return {
      migrated: false,
      reason: "already-exists",
      payload: existing,
    };
  }

  const activeInfo = await getActiveVersion();
  if (!activeInfo) {
    return {
      migrated: false,
      reason: "no-active-version",
    };
  }

  const activeVersion = await getVersion(activeInfo.versionId);
  if (!activeVersion) {
    return {
      migrated: false,
      reason: "active-version-missing",
    };
  }

  if (activeVersion.systemPrompt.length === 0) {
    return {
      migrated: false,
      reason: "empty-active-system-prompt",
    };
  }

  const now = new Date().toISOString();
  const payload: RemoteSystemPromptPayload = {
    revision: 0,
    systemPrompt: activeVersion.systemPrompt,
    activeVersionId: activeVersion.id,
    migratedFromFileAt: now,
    updatedAt: now,
  };

  try {
    await setRemoteSystemPromptPayload(payload);
  } catch (error) {
    if (isUnsupportedRemoteConfigActionError(error)) {
      return {
        migrated: false,
        reason: "remote-config-action-unsupported",
      };
    }
    throw error;
  }

  return {
    migrated: true,
    reason: "migrated",
    payload,
  };
}
