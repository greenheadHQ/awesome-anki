import { describe, expect, test } from "bun:test";
import { parseRemoteSystemPromptPayload } from "../prompt-version/storage.js";

describe("parseRemoteSystemPromptPayload", () => {
  test("유효한 객체 payload를 파싱한다", () => {
    const payload = parseRemoteSystemPromptPayload({
      revision: 2,
      systemPrompt: "System prompt text",
      activeVersionId: "v1.0.2",
      migratedFromFileAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T01:00:00.000Z",
    });

    expect(payload).toEqual({
      revision: 2,
      systemPrompt: "System prompt text",
      activeVersionId: "v1.0.2",
      migratedFromFileAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T01:00:00.000Z",
    });
  });

  test("유효한 JSON 문자열 payload를 파싱한다", () => {
    const payload = parseRemoteSystemPromptPayload(
      JSON.stringify({
        revision: 0,
        systemPrompt: "initial",
        activeVersionId: "v1.0.0",
        updatedAt: "2026-02-22T00:00:00.000Z",
      }),
    );

    expect(payload?.revision).toBe(0);
    expect(payload?.activeVersionId).toBe("v1.0.0");
  });

  test("null/undefined는 null을 반환한다", () => {
    expect(parseRemoteSystemPromptPayload(null)).toBeNull();
    expect(parseRemoteSystemPromptPayload(undefined)).toBeNull();
  });

  test("revision이 음수이면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: -1,
        systemPrompt: "invalid",
        activeVersionId: "v1.0.1",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.revision");
  });

  test("revision이 정수가 아니면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1.5,
        systemPrompt: "invalid",
        activeVersionId: "v1.0.1",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.revision");
  });
});
