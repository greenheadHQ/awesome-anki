/**
 * 원격 system prompt SoT (Source of Truth)
 */

import { getConfig, setConfig } from "../anki/client.js";

export const SYSTEM_PROMPT_CONFIG_KEY = "awesomeAnki.prompts.system";

export interface RemoteSystemPromptPayload {
  revision: number;
  systemPrompt: string;
  activeVersionId: string;
  migratedFromFileAt?: string;
  updatedAt: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseRemoteSystemPromptPayload(value: unknown): RemoteSystemPromptPayload | null {
  if (value === null || value === undefined) {
    return null;
  }

  let raw: unknown;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      throw new Error("원격 system prompt payload JSON 파싱 실패");
    }
  } else {
    raw = value;
  }

  if (!isPlainObject(raw)) {
    throw new Error("원격 system prompt payload가 객체 형태가 아닙니다.");
  }

  if (typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 0) {
    throw new Error("원격 system prompt payload.revision 값이 유효하지 않습니다.");
  }

  if (typeof raw.systemPrompt !== "string" || raw.systemPrompt.length === 0) {
    throw new Error("원격 system prompt payload.systemPrompt 값이 유효하지 않습니다.");
  }

  if (typeof raw.activeVersionId !== "string" || raw.activeVersionId.length === 0) {
    throw new Error("원격 system prompt payload.activeVersionId 값이 유효하지 않습니다.");
  }

  if (typeof raw.updatedAt !== "string" || raw.updatedAt.length === 0) {
    throw new Error("원격 system prompt payload.updatedAt 값이 유효하지 않습니다.");
  }

  if (raw.migratedFromFileAt !== undefined && typeof raw.migratedFromFileAt !== "string") {
    throw new Error("원격 system prompt payload.migratedFromFileAt 값이 유효하지 않습니다.");
  }

  return {
    revision: raw.revision,
    systemPrompt: raw.systemPrompt,
    activeVersionId: raw.activeVersionId,
    migratedFromFileAt: raw.migratedFromFileAt as string | undefined,
    updatedAt: raw.updatedAt,
  };
}

/**
 * 원격 system prompt payload 조회
 */
export async function getRemoteSystemPromptPayload(): Promise<RemoteSystemPromptPayload | null> {
  const raw = await getConfig<unknown>(SYSTEM_PROMPT_CONFIG_KEY);
  return parseRemoteSystemPromptPayload(raw);
}

/**
 * 원격 system prompt payload 저장
 */
export async function setRemoteSystemPromptPayload(
  payload: RemoteSystemPromptPayload,
): Promise<void> {
  await setConfig(SYSTEM_PROMPT_CONFIG_KEY, payload);
}

export async function clearRemoteSystemPromptPayload(): Promise<void> {
  await setConfig<null>(SYSTEM_PROMPT_CONFIG_KEY, null);
}
