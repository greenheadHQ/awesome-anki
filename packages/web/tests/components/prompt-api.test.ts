import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  PromptConflictError,
  type PromptSystemSaveResult,
} from "@/lib/api";

describe("api.prompts.saveSystemPrompt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("409 응답에서 PromptConflictError를 던진다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Revision conflict",
          latest: {
            revision: 3,
            systemPrompt: "remote prompt",
            activeVersionId: "v1.0.3",
            updatedAt: "2026-02-22T00:00:00.000Z",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      api.prompts.saveSystemPrompt({
        expectedRevision: 2,
        systemPrompt: "local prompt",
        reason: "conflict test",
      }),
    ).rejects.toBeInstanceOf(PromptConflictError);
  });

  it("성공 응답을 파싱한다", async () => {
    const result: PromptSystemSaveResult = {
      revision: 4,
      newVersion: {
        id: "v1.0.4",
        name: "Prompt rev4",
        activatedAt: "2026-02-22T01:00:00.000Z",
      },
      syncResult: {
        success: true,
        syncedAt: "2026-02-22T01:00:00.000Z",
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      api.prompts.saveSystemPrompt({
        expectedRevision: 3,
        systemPrompt: "updated prompt",
        reason: "success test",
      }),
    ).resolves.toEqual(result);
  });
});
