/**
 * Prompts API - 프롬프트 버전 관리
 */

import type {
  FewShotExample,
  PromptConfig,
  PromptVersion,
  SplitHistoryEntry,
} from "@anki-splitter/core";
import {
  addHistoryEntry,
  analyzeFailurePatterns,
  completeExperiment,
  createExperiment,
  createPromptVersion,
  DEFAULT_PROMPT_CONFIG,
  deletePromptVersion,
  getActivePrompts,
  getActiveVersion,
  getExperiment,
  getHistory,
  getHistoryByVersion,
  getPromptVersion,
  listExperiments,
  listPromptVersions,
  savePromptVersion,
  setActiveVersion,
} from "@anki-splitter/core";
import { Hono } from "hono";

const prompts = new Hono();

// ============================================================================
// 버전 관리
// ============================================================================

/**
 * GET /api/prompts/versions
 * 모든 프롬프트 버전 목록
 */
prompts.get("/versions", async (c) => {
  try {
    const versions = await listPromptVersions();
    const activeInfo = await getActiveVersion();

    return c.json({
      versions,
      activeVersionId: activeInfo?.versionId ?? null,
      count: versions.length,
    });
  } catch (error) {
    console.error("List versions error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * GET /api/prompts/versions/:id
 * 특정 버전 상세 조회
 */
prompts.get("/versions/:id", async (c) => {
  try {
    const versionId = c.req.param("id");
    const version = await getPromptVersion(versionId);

    if (!version) {
      return c.json({ error: `Version ${versionId} not found` }, 404);
    }

    return c.json(version);
  } catch (error) {
    console.error("Get version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/prompts/versions
 * 새 버전 생성
 */
prompts.post("/versions", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      systemPrompt: string;
      splitPromptTemplate: string;
      analysisPromptTemplate?: string;
      examples?: FewShotExample[];
      config?: Partial<PromptConfig>;
    }>();

    if (!body.name || !body.systemPrompt || !body.splitPromptTemplate) {
      return c.json(
        { error: "name, systemPrompt, and splitPromptTemplate are required" },
        400,
      );
    }

    const version = await createPromptVersion({
      name: body.name,
      description: body.description ?? "",
      systemPrompt: body.systemPrompt,
      splitPromptTemplate: body.splitPromptTemplate,
      analysisPromptTemplate: body.analysisPromptTemplate ?? "",
      examples: body.examples ?? [],
      config: {
        ...DEFAULT_PROMPT_CONFIG,
        ...(body.config ?? {}),
      },
      status: "draft",
    });

    return c.json(version, 201);
  } catch (error) {
    console.error("Create version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * PUT /api/prompts/versions/:id
 * 버전 업데이트
 */
prompts.put("/versions/:id", async (c) => {
  try {
    const versionId = c.req.param("id");
    const existing = await getPromptVersion(versionId);

    if (!existing) {
      return c.json({ error: `Version ${versionId} not found` }, 404);
    }

    const body =
      await c.req.json<
        Partial<{
          name: string;
          description: string;
          systemPrompt: string;
          splitPromptTemplate: string;
          analysisPromptTemplate: string;
          examples: FewShotExample[];
          config: Partial<PromptConfig>;
        }>
      >();

    const updated: PromptVersion = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      systemPrompt: body.systemPrompt ?? existing.systemPrompt,
      splitPromptTemplate:
        body.splitPromptTemplate ?? existing.splitPromptTemplate,
      analysisPromptTemplate:
        body.analysisPromptTemplate ?? existing.analysisPromptTemplate,
      examples: body.examples ?? existing.examples,
      config: body.config
        ? { ...existing.config, ...body.config }
        : existing.config,
      updatedAt: new Date().toISOString(),
    };

    await savePromptVersion(updated);

    return c.json(updated);
  } catch (error) {
    console.error("Update version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * DELETE /api/prompts/versions/:id
 * 버전 삭제
 */
prompts.delete("/versions/:id", async (c) => {
  try {
    const versionId = c.req.param("id");

    // 활성 버전은 삭제 불가
    const activeInfo = await getActiveVersion();
    if (activeInfo?.versionId === versionId) {
      return c.json(
        {
          error:
            "Cannot delete active version. Activate another version first.",
        },
        400,
      );
    }

    const deleted = await deletePromptVersion(versionId);

    if (!deleted) {
      return c.json({ error: `Version ${versionId} not found` }, 404);
    }

    return c.json({ message: `Version ${versionId} deleted successfully` });
  } catch (error) {
    console.error("Delete version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/prompts/versions/:id/activate
 * 버전 활성화
 */
prompts.post("/versions/:id/activate", async (c) => {
  try {
    const versionId = c.req.param("id");
    const version = await getPromptVersion(versionId);

    if (!version) {
      return c.json({ error: `Version ${versionId} not found` }, 404);
    }

    await setActiveVersion(versionId, "user");

    return c.json({
      message: `Version ${versionId} activated successfully`,
      versionId,
      activatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Activate version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * GET /api/prompts/active
 * 현재 활성 버전 조회
 */
prompts.get("/active", async (c) => {
  try {
    const activeInfo = await getActiveVersion();

    if (!activeInfo) {
      return c.json({ error: "No active version set" }, 404);
    }

    const version = await getActivePrompts();

    return c.json({
      activeInfo,
      version,
    });
  } catch (error) {
    console.error("Get active version error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

// ============================================================================
// 히스토리 관리
// ============================================================================

/**
 * GET /api/prompts/history
 * 분할 히스토리 조회
 */
prompts.get("/history", async (c) => {
  try {
    const startDateStr = c.req.query("startDate");
    const endDateStr = c.req.query("endDate");
    const versionId = c.req.query("versionId");
    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    let history: SplitHistoryEntry[];

    if (versionId) {
      history = await getHistoryByVersion(versionId);
    } else {
      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const endDate = endDateStr ? new Date(endDateStr) : undefined;
      history = await getHistory(startDate, endDate);
    }

    // 페이지네이션
    const totalCount = history.length;
    const paginatedHistory = history.slice(offset, offset + limit);

    return c.json({
      history: paginatedHistory,
      totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error("Get history error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/prompts/history
 * 히스토리 항목 추가
 */
prompts.post("/history", async (c) => {
  try {
    const body = await c.req.json<{
      promptVersionId: string;
      noteId: number;
      deckName: string;
      originalContent: string;
      splitCards: Array<{
        title: string;
        content: string;
        charCount: number;
        cardType: "cloze" | "basic";
        contextTag?: string;
      }>;
      userAction: "approved" | "modified" | "rejected";
      modificationDetails?: {
        lengthReduced: boolean;
        contextAdded: boolean;
        clozeChanged: boolean;
        cardsMerged: boolean;
        cardsSplit: boolean;
        hintAdded: boolean;
      };
      qualityChecks: {
        allCardsUnder80Chars: boolean;
        allClozeHaveHints: boolean;
        noEnumerations: boolean;
        allContextTagsPresent: boolean;
      } | null;
    }>();

    if (
      !body.promptVersionId ||
      !body.noteId ||
      !body.originalContent ||
      !body.userAction
    ) {
      return c.json(
        {
          error:
            "promptVersionId, noteId, originalContent, and userAction are required",
        },
        400,
      );
    }

    const entry = await addHistoryEntry({
      promptVersionId: body.promptVersionId,
      noteId: body.noteId,
      deckName: body.deckName || "",
      originalContent: body.originalContent,
      originalCharCount: body.originalContent.length,
      splitCards: body.splitCards || [],
      userAction: body.userAction,
      modificationDetails: body.modificationDetails,
      qualityChecks: body.qualityChecks ?? null,
      timestamp: new Date().toISOString(),
    });

    return c.json(entry, 201);
  } catch (error) {
    console.error("Add history error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

// ============================================================================
// 실패 패턴 분석
// ============================================================================

/**
 * GET /api/prompts/versions/:id/failure-patterns
 * 버전의 실패 패턴 분석
 */
prompts.get("/versions/:id/failure-patterns", async (c) => {
  try {
    const versionId = c.req.param("id");
    const version = await getPromptVersion(versionId);

    if (!version) {
      return c.json({ error: `Version ${versionId} not found` }, 404);
    }

    const analysis = await analyzeFailurePatterns(versionId);

    return c.json({
      versionId,
      versionName: version.name,
      metrics: version.metrics,
      ...analysis,
    });
  } catch (error) {
    console.error("Analyze failure patterns error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

// ============================================================================
// A/B 테스트 (Experiment)
// ============================================================================

/**
 * GET /api/prompts/experiments
 * 실험 목록 조회
 */
prompts.get("/experiments", async (c) => {
  try {
    const experiments = await listExperiments();

    return c.json({
      experiments,
      count: experiments.length,
    });
  } catch (error) {
    console.error("List experiments error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * GET /api/prompts/experiments/:id
 * 실험 상세 조회
 */
prompts.get("/experiments/:id", async (c) => {
  try {
    const experimentId = c.req.param("id");
    const experiment = await getExperiment(experimentId);

    if (!experiment) {
      return c.json({ error: `Experiment ${experimentId} not found` }, 404);
    }

    // 버전 정보도 함께 반환
    const controlVersion = await getPromptVersion(experiment.controlVersionId);
    const treatmentVersion = await getPromptVersion(
      experiment.treatmentVersionId,
    );

    return c.json({
      experiment,
      controlVersion,
      treatmentVersion,
    });
  } catch (error) {
    console.error("Get experiment error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/prompts/experiments
 * 새 실험 생성
 */
prompts.post("/experiments", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      controlVersionId: string;
      treatmentVersionId: string;
    }>();

    if (!body.name || !body.controlVersionId || !body.treatmentVersionId) {
      return c.json(
        {
          error: "name, controlVersionId, and treatmentVersionId are required",
        },
        400,
      );
    }

    // 버전 존재 확인
    const controlVersion = await getPromptVersion(body.controlVersionId);
    const treatmentVersion = await getPromptVersion(body.treatmentVersionId);

    if (!controlVersion) {
      return c.json(
        { error: `Control version ${body.controlVersionId} not found` },
        404,
      );
    }
    if (!treatmentVersion) {
      return c.json(
        { error: `Treatment version ${body.treatmentVersionId} not found` },
        404,
      );
    }

    const experiment = await createExperiment(
      body.name,
      body.controlVersionId,
      body.treatmentVersionId,
    );

    return c.json(experiment, 201);
  } catch (error) {
    console.error("Create experiment error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /api/prompts/experiments/:id/complete
 * 실험 완료
 */
prompts.post("/experiments/:id/complete", async (c) => {
  try {
    const experimentId = c.req.param("id");
    const body = await c.req.json<{
      conclusion: string;
      winnerVersionId: string;
    }>();

    if (!body.conclusion || !body.winnerVersionId) {
      return c.json(
        { error: "conclusion and winnerVersionId are required" },
        400,
      );
    }

    const experiment = await getExperiment(experimentId);
    if (!experiment) {
      return c.json({ error: `Experiment ${experimentId} not found` }, 404);
    }

    if (experiment.status === "completed") {
      return c.json({ error: "Experiment is already completed" }, 400);
    }

    await completeExperiment(
      experimentId,
      body.conclusion,
      body.winnerVersionId,
    );

    const updatedExperiment = await getExperiment(experimentId);

    return c.json({
      message: "Experiment completed successfully",
      experiment: updatedExperiment,
    });
  } catch (error) {
    console.error("Complete experiment error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

export default prompts;
