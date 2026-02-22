import { afterEach, describe, expect, it } from "bun:test";
import { ankiConnect, getConfig, setConfig } from "../anki/client.js";
import { AnkiConnectError, TimeoutError } from "../errors.js";

describe("ankiConnect 타임아웃 및 에러 처리", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;
  const originalUrl = process.env.ANKI_CONNECT_URL;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    server?.stop(true);
    server = null;
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.ANKI_CONNECT_URL;
    } else {
      process.env.ANKI_CONNECT_URL = originalUrl;
    }
  });

  it("타임아웃 시 TimeoutError를 던진다", async () => {
    server = Bun.serve({
      port: 0,
      async fetch() {
        await new Promise((r) => setTimeout(r, 3000));
        return new Response(JSON.stringify({ result: null, error: null }));
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(
      ankiConnect("version", undefined, { timeout: 100 }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("연결 거부 시 AnkiConnectError를 던진다", async () => {
    process.env.ANKI_CONNECT_URL = "http://localhost:19999";

    await expect(
      ankiConnect("version", undefined, { timeout: 1000 }),
    ).rejects.toBeInstanceOf(AnkiConnectError);
  });

  it("AnkiConnect API 에러 시 AnkiConnectError를 던진다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          JSON.stringify({
            result: null,
            error: "collection is not available",
          }),
        );
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(ankiConnect("version")).rejects.toBeInstanceOf(
      AnkiConnectError,
    );
  });

  it("HTTP 에러 시 AnkiConnectError를 던진다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(ankiConnect("version")).rejects.toBeInstanceOf(
      AnkiConnectError,
    );
  });

  it("정상 응답을 반환한다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ result: 6, error: null }));
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    const result = await ankiConnect<number>("version");
    expect(result).toBe(6);
  });

  it("getConfig 커스텀 액션 미지원 시 명확한 에러를 던진다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          JSON.stringify({
            result: null,
            error: "unsupported action: getConfig",
          }),
        );
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(getConfig("awesomeAnki.prompts.system")).rejects.toThrow(
      '커스텀 액션 "getConfig"',
    );
  });

  it("getConfig 성공 시 값을 반환한다", async () => {
    const payload = {
      revision: 1,
      systemPrompt: "test prompt",
      activeVersionId: "v1.0.1",
      updatedAt: "2026-02-22T05:00:00.000Z",
    };

    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ result: payload, error: null }));
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(getConfig("awesomeAnki.prompts.system")).resolves.toEqual(
      payload,
    );
  });

  it("getConfig extension 내부 에러를 미지원 에러로 오진하지 않는다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          JSON.stringify({
            result: null,
            error: "getConfig: unknown key awesomeAnki.prompts.system",
          }),
        );
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(getConfig("awesomeAnki.prompts.system")).rejects.toThrow(
      "unknown key",
    );
  });

  it("getConfig TimeoutError를 그대로 재전파한다", async () => {
    const timeoutLike = new Error("request timed out");
    timeoutLike.name = "TimeoutError";
    globalThis.fetch = (async () => {
      throw timeoutLike;
    }) as typeof fetch;

    await expect(
      getConfig("awesomeAnki.prompts.system"),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("setConfig 커스텀 액션 미지원 시 명확한 에러를 던진다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          JSON.stringify({
            result: null,
            error: "unsupported action: setConfig",
          }),
        );
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(
      setConfig("awesomeAnki.prompts.system", { revision: 0 }),
    ).rejects.toThrow('커스텀 액션 "setConfig"');
  });

  it("setConfig 성공 시 null을 반환한다", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ result: null, error: null }));
      },
    });

    process.env.ANKI_CONNECT_URL = `http://localhost:${server.port}`;

    await expect(
      setConfig("awesomeAnki.prompts.system", { revision: 0 }),
    ).resolves.toBeNull();
  });

  it("setConfig TimeoutError를 그대로 재전파한다", async () => {
    const timeoutLike = new Error("request timed out");
    timeoutLike.name = "TimeoutError";
    globalThis.fetch = (async () => {
      throw timeoutLike;
    }) as typeof fetch;

    await expect(
      setConfig("awesomeAnki.prompts.system", { revision: 0 }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
