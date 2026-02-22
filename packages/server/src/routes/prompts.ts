/**
 * Prompts API - 프롬프트 버전 관리
 */

import type {
  FewShotExample,
  PromptConfig,
  PromptVersion,
  RemoteSystemPromptPayload,
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
  getRemoteSystemPromptPayload,
  listExperiments,
  listPromptVersions,
  NotFoundError,
  savePromptVersion,
  setActiveVersion,
  setRemoteSystemPromptPayload,
  sync,
  ValidationError,
} from "@anki-splitter/core";
import { Hono } from "hono";

const prompts = new Hono();

interface PromptConflictLatest {
  revision: number;
  systemPrompt: string;
  activeVersionId: string;
  updatedAt: string;
}

function buildSystemPromptVersionName(
  baseName: string,
  revision: number,
): string {
  return `${baseName} (systemPrompt rev${revision})`;
}

function buildDescriptionWithReason(
  baseDescription: string,
  reason: string,
): string {
  const normalized = reason.trim();
  if (!normalized) {
    return baseDescription;
  }
  const header = `[systemPrompt] ${normalized}`;
  return baseDescription ? `${baseDescription}\n\n${header}` : header;
}

function buildConflictLatest(
  currentPayload: RemoteSystemPromptPayload | null,
  activeVersion: PromptVersion,
): PromptConflictLatest {
  if (currentPayload) {
    return {
      revision: currentPayload.revision,
      systemPrompt: currentPayload.systemPrompt,
      activeVersionId: currentPayload.activeVersionId,
      updatedAt: currentPayload.updatedAt,
    };
  }

  return {
    revision: 0,
    systemPrompt: activeVersion.systemPrompt,
    activeVersionId: activeVersion.id,
    updatedAt: activeVersion.updatedAt,
  };
}

function buildRollbackPayload(
  currentPayload: RemoteSystemPromptPayload | null,
  activeVersion: PromptVersion,
): RemoteSystemPromptPayload {
  if (currentPayload) {
    return currentPayload;
  }

  return {
    revision: 0,
    systemPrompt: activeVersion.systemPrompt,
    activeVersionId: activeVersion.id,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 원격 systemPrompt (CAS + sync)
// ============================================================================

/**
 * GET /api/prompts/system
 * 원격 systemPrompt 조회
 */
prompts.get("/system", async (c) => {
  const activeInfo = await getActiveVersion();
  if (!activeInfo) {
    throw new ValidationError(
      "활성 버전이 없습니다. 먼저 버전을 생성/활성화하세요.",
    );
  }

  const activeVersion = await getPromptVersion(activeInfo.versionId);
  if (!activeVersion) {
    throw new NotFoundError(
      `활성 버전 ${activeInfo.versionId}을(를) 찾을 수 없습니다.`,
    );
  }

  const payload = await getRemoteSystemPromptPayload();
  if (!payload) {
    return c.json(
      { error: "원격 systemPrompt가 아직 초기화되지 않았습니다." },
      404,
    );
  }

  return c.json({
    revision: payload.revision,
    systemPrompt: payload.systemPrompt,
    activeVersion: {
      id: activeVersion.id,
      name: activeVersion.name,
      updatedAt: activeVersion.updatedAt,
    },
  });
});

/**
 * POST /api/prompts/system
 * 원격 systemPrompt 저장 (CAS + sync)
 */
prompts.post("/system", async (c) => {
  const body = await c.req.json<{
    expectedRevision: number;
    systemPrompt: string;
    reason: string;
  }>();

  if (
    typeof body.expectedRevision !== "number" ||
    !Number.isInteger(body.expectedRevision) ||
    body.expectedRevision < 0
  ) {
    throw new ValidationError("expectedRevision은 0 이상의 정수여야 합니다.");
  }

  const rawSystemPrompt = body.systemPrompt;
  if (
    typeof rawSystemPrompt !== "string" ||
    rawSystemPrompt.trim().length === 0
  ) {
    throw new ValidationError("systemPrompt는 비어 있을 수 없습니다.");
  }
  const nextSystemPrompt = rawSystemPrompt.trim();

  const rawReason = body.reason;
  if (typeof rawReason !== "string" || rawReason.trim().length === 0) {
    throw new ValidationError("reason은 필수입니다.");
  }
  const reason = rawReason.trim();

  const activeInfo = await getActiveVersion();
  if (!activeInfo) {
    throw new ValidationError(
      "활성 버전이 없습니다. 먼저 버전을 생성/활성화하세요.",
    );
  }

  const activeVersion = await getPromptVersion(activeInfo.versionId);
  if (!activeVersion) {
    throw new NotFoundError(
      `활성 버전 ${activeInfo.versionId}을(를) 찾을 수 없습니다.`,
    );
  }

  // NOTE:
  // migrateLegacySystemPromptToRemoteIfNeeded()와 동일하게 이 경로도 TOCTOU 한계가 있다.
  // getRemoteSystemPromptPayload()와 setRemoteSystemPromptPayload()는 분리된 연산이며,
  // AnkiConnect config API는 true CAS를 지원하지 않아 동시 요청이 같은 revision을 통과할 수 있다.
  const currentPayload = await getRemoteSystemPromptPayload();
  const currentRevision = currentPayload?.revision ?? 0;
  if (body.expectedRevision !== currentRevision) {
    return c.json(
      {
        error: "Revision conflict",
        latest: buildConflictLatest(currentPayload, activeVersion),
      },
      409,
    );
  }

  const nextRevision = currentRevision + 1;
  const newVersion = await createPromptVersion({
    name: buildSystemPromptVersionName(activeVersion.name, nextRevision),
    description: buildDescriptionWithReason(activeVersion.description, reason),
    systemPrompt: nextSystemPrompt,
    splitPromptTemplate: activeVersion.splitPromptTemplate,
    analysisPromptTemplate: activeVersion.analysisPromptTemplate,
    examples: activeVersion.examples,
    config: activeVersion.config,
    status: "draft",
    parentVersionId: activeVersion.id,
    changelog: reason,
  });

  const nextPayload: RemoteSystemPromptPayload = {
    revision: nextRevision,
    systemPrompt: nextSystemPrompt,
    activeVersionId: newVersion.id,
    migratedFromFileAt: currentPayload?.migratedFromFileAt,
    updatedAt: new Date().toISOString(),
  };

  let remoteUpdated = false;
  let activeUpdated = false;
  const rollbackErrors: string[] = [];
  const previousActiveVersionId = activeVersion.id;

  try {
    await setRemoteSystemPromptPayload(nextPayload);
    remoteUpdated = true;

    await setActiveVersion(newVersion.id, "user");
    activeUpdated = true;

    await sync();
    const syncedAt = new Date().toISOString();

    return c.json({
      revision: nextRevision,
      newVersion: {
        id: newVersion.id,
        name: newVersion.name,
        activatedAt: syncedAt,
      },
      syncResult: {
        success: true,
        syncedAt,
      },
    });
  } catch (error) {
    const rollbackPayload = buildRollbackPayload(currentPayload, activeVersion);

    if (remoteUpdated) {
      try {
        await setRemoteSystemPromptPayload(rollbackPayload);
      } catch (rollbackError) {
        rollbackErrors.push(
          `remote rollback 실패: ${
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError)
          }`,
        );
      }
    }

    if (activeUpdated && previousActiveVersionId !== newVersion.id) {
      try {
        await setActiveVersion(previousActiveVersionId, "system");
      } catch (rollbackError) {
        rollbackErrors.push(
          `active rollback 실패: ${
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError)
          }`,
        );
      }
    }

    // sync 실패 시 생성된 newVersion은 삭제하지 않고 보존한다.
    // append-only 이력(감사/사후 분석) 유지를 위한 의도된 동작이다.
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        error: `systemPrompt 저장 실패: ${message}`,
        ...(rollbackErrors.length > 0 && { rollbackErrors }),
      },
      503,
    );
  }
});

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

  if (Object.hasOwn(body, "systemPrompt")) {
    throw new ValidationError(
      "systemPrompt는 /api/prompts/system 엔드포인트로만 수정할 수 있습니다.",
    );
  }

  const updated: PromptVersion = {
    ...existing,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    systemPrompt: existing.systemPrompt,
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
