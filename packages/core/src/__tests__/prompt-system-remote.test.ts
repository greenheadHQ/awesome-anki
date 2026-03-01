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

  test("잘못된 JSON 문자열이면 명확한 에러를 던진다", () => {
    expect(() => parseRemoteSystemPromptPayload("{invalid-json")).toThrow("JSON 파싱 실패");
  });

  test("systemPrompt가 비어있거나 누락되면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "",
        activeVersionId: "v1.0.1",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.systemPrompt");

    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        activeVersionId: "v1.0.1",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.systemPrompt");
  });

  test("activeVersionId가 비어있거나 누락되면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "valid",
        activeVersionId: "",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.activeVersionId");

    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "valid",
        updatedAt: "2026-02-22T01:00:00.000Z",
      }),
    ).toThrow("payload.activeVersionId");
  });

  test("updatedAt이 비어있거나 누락되면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "valid",
        activeVersionId: "v1.0.1",
        updatedAt: "",
      }),
    ).toThrow("payload.updatedAt");

    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "valid",
        activeVersionId: "v1.0.1",
      }),
    ).toThrow("payload.updatedAt");
  });

  test("객체가 아닌 입력이면 예외를 던진다", () => {
    expect(() => parseRemoteSystemPromptPayload(1)).toThrow("객체 형태");
    expect(() => parseRemoteSystemPromptPayload([])).toThrow("객체 형태");
  });

  test("migratedFromFileAt이 문자열이 아니면 예외를 던진다", () => {
    expect(() =>
      parseRemoteSystemPromptPayload({
        revision: 1,
        systemPrompt: "valid",
        activeVersionId: "v1.0.1",
        updatedAt: "2026-02-22T01:00:00.000Z",
        migratedFromFileAt: 1234,
      }),
    ).toThrow("payload.migratedFromFileAt");
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
