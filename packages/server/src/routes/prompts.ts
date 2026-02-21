/**
 * Prompts API - 프롬프트 버전 관리
 */

import type {
  FewShotExample,
  PromptConfig,
  PromptVersion,
} from "@anki-splitter/core";
import {
  analyzeFailurePatterns,
  completeExperiment,
  createExperiment,
  createPromptVersion,
  DEFAULT_PROMPT_CONFIG,
  deletePromptVersion,
  getActivePrompts,
  getActiveVersion,
  getExperiment,
  getPromptVersion,
  listExperiments,
  listPromptVersions,
  NotFoundError,
  savePromptVersion,
  setActiveVersion,
  ValidationError,
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
  const versions = await listPromptVersions();
  const activeInfo = await getActiveVersion();

  return c.json({
    versions,
    activeVersionId: activeInfo?.versionId ?? null,
    count: versions.length,
  });
});

/**
 * GET /api/prompts/versions/:id
 * 특정 버전 상세 조회
 */
prompts.get("/versions/:id", async (c) => {
  const versionId = c.req.param("id");
  const version = await getPromptVersion(versionId);

  if (!version) {
    throw new NotFoundError(`버전 ${versionId}를 찾을 수 없습니다`);
  }

  return c.json(version);
});

/**
 * POST /api/prompts/versions
 * 새 버전 생성
 */
prompts.post("/versions", async (c) => {
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
    throw new ValidationError(
      "name, systemPrompt, splitPromptTemplate가 필요합니다",
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
});

/**
 * PUT /api/prompts/versions/:id
 * 버전 업데이트
 */
prompts.put("/versions/:id", async (c) => {
  const versionId = c.req.param("id");
  const existing = await getPromptVersion(versionId);

  if (!existing) {
    throw new NotFoundError(`버전 ${versionId}를 찾을 수 없습니다`);
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
});

/**
 * DELETE /api/prompts/versions/:id
 * 버전 삭제
 */
prompts.delete("/versions/:id", async (c) => {
  const versionId = c.req.param("id");

  // 활성 버전은 삭제 불가
  const activeInfo = await getActiveVersion();
  if (activeInfo?.versionId === versionId) {
    throw new ValidationError(
      "활성 버전은 삭제할 수 없습니다. 다른 버전을 먼저 활성화하세요.",
    );
  }

  const deleted = await deletePromptVersion(versionId);

  if (!deleted) {
    throw new NotFoundError(`버전 ${versionId}를 찾을 수 없습니다`);
  }

  return c.json({ message: `Version ${versionId} deleted successfully` });
});

/**
 * POST /api/prompts/versions/:id/activate
 * 버전 활성화
 */
prompts.post("/versions/:id/activate", async (c) => {
  const versionId = c.req.param("id");
  const version = await getPromptVersion(versionId);

  if (!version) {
    throw new NotFoundError(`버전 ${versionId}를 찾을 수 없습니다`);
  }

  await setActiveVersion(versionId, "user");

  return c.json({
    message: `Version ${versionId} activated successfully`,
    versionId,
    activatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/prompts/active
 * 현재 활성 버전 조회
 */
prompts.get("/active", async (c) => {
  const activeInfo = await getActiveVersion();

  if (!activeInfo) {
    throw new NotFoundError("활성 버전이 설정되지 않았습니다");
  }

  const version = await getActivePrompts();

  return c.json({ activeInfo, version });
});

// ============================================================================
// 실패 패턴 분석
// ============================================================================

/**
 * GET /api/prompts/versions/:id/failure-patterns
 * 버전의 실패 패턴 분석
 */
prompts.get("/versions/:id/failure-patterns", async (c) => {
  const versionId = c.req.param("id");
  const version = await getPromptVersion(versionId);

  if (!version) {
    throw new NotFoundError(`버전 ${versionId}를 찾을 수 없습니다`);
  }

  const analysis = await analyzeFailurePatterns(versionId);

  return c.json({
    versionId,
    versionName: version.name,
    metrics: version.metrics,
    ...analysis,
  });
});

// ============================================================================
// A/B 테스트 (Experiment)
// ============================================================================

/**
 * GET /api/prompts/experiments
 * 실험 목록 조회
 */
prompts.get("/experiments", async (c) => {
  const experiments = await listExperiments();

  return c.json({
    experiments,
    count: experiments.length,
  });
});

/**
 * GET /api/prompts/experiments/:id
 * 실험 상세 조회
 */
prompts.get("/experiments/:id", async (c) => {
  const experimentId = c.req.param("id");
  const experiment = await getExperiment(experimentId);

  if (!experiment) {
    throw new NotFoundError(`실험 ${experimentId}를 찾을 수 없습니다`);
  }

  const controlVersion = await getPromptVersion(experiment.controlVersionId);
  const treatmentVersion = await getPromptVersion(
    experiment.treatmentVersionId,
  );

  return c.json({ experiment, controlVersion, treatmentVersion });
});

/**
 * POST /api/prompts/experiments
 * 새 실험 생성
 */
prompts.post("/experiments", async (c) => {
  const body = await c.req.json<{
    name: string;
    controlVersionId: string;
    treatmentVersionId: string;
  }>();

  if (!body.name || !body.controlVersionId || !body.treatmentVersionId) {
    throw new ValidationError(
      "name, controlVersionId, treatmentVersionId가 필요합니다",
    );
  }

  const controlVersion = await getPromptVersion(body.controlVersionId);
  const treatmentVersion = await getPromptVersion(body.treatmentVersionId);

  if (!controlVersion) {
    throw new NotFoundError(
      `Control 버전 ${body.controlVersionId}를 찾을 수 없습니다`,
    );
  }
  if (!treatmentVersion) {
    throw new NotFoundError(
      `Treatment 버전 ${body.treatmentVersionId}를 찾을 수 없습니다`,
    );
  }

  const experiment = await createExperiment(
    body.name,
    body.controlVersionId,
    body.treatmentVersionId,
  );

  return c.json(experiment, 201);
});

/**
 * POST /api/prompts/experiments/:id/complete
 * 실험 완료
 */
prompts.post("/experiments/:id/complete", async (c) => {
  const experimentId = c.req.param("id");
  const body = await c.req.json<{
    conclusion: string;
    winnerVersionId: string;
  }>();

  if (!body.conclusion || !body.winnerVersionId) {
    throw new ValidationError("conclusion과 winnerVersionId가 필요합니다");
  }

  const experiment = await getExperiment(experimentId);
  if (!experiment) {
    throw new NotFoundError(`실험 ${experimentId}를 찾을 수 없습니다`);
  }

  if (experiment.status === "completed") {
    throw new ValidationError("이미 완료된 실험입니다");
  }

  await completeExperiment(experimentId, body.conclusion, body.winnerVersionId);

  const updatedExperiment = await getExperiment(experimentId);

  return c.json({
    message: "Experiment completed successfully",
    experiment: updatedExperiment,
  });
});

export default prompts;
