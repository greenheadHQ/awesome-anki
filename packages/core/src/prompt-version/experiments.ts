/**
 * 프롬프트 A/B 실험 관리
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { atomicWriteFile } from "../utils/atomic-write.js";
import type { Experiment } from "./types.js";
import { getVersion } from "./storage.js";

// 기본 경로 (프로젝트 루트 기준)
const BASE_PATH = join(process.cwd(), "output", "prompts");
const EXPERIMENTS_PATH = join(BASE_PATH, "experiments");

/**
 * 디렉토리 존재 확인 및 생성
 */
async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path, { recursive: true });
  }
}

/**
 * 실험 생성
 */
export async function createExperiment(
  name: string,
  controlVersionId: string,
  treatmentVersionId: string,
): Promise<Experiment> {
  await ensureDir(EXPERIMENTS_PATH);

  const experiment: Experiment = {
    id: `exp-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    status: "running",
    controlVersionId,
    treatmentVersionId,
    controlResults: { splitCount: 0, approvalRate: 0, avgCharCount: 0 },
    treatmentResults: { splitCount: 0, approvalRate: 0, avgCharCount: 0 },
  };

  const filePath = join(EXPERIMENTS_PATH, `${experiment.id}.json`);
  await atomicWriteFile(filePath, JSON.stringify(experiment, null, 2));

  return experiment;
}

/**
 * 실험 목록 조회
 */
export async function listExperiments(): Promise<Experiment[]> {
  await ensureDir(EXPERIMENTS_PATH);

  const files = await readdir(EXPERIMENTS_PATH);
  const experiments: Experiment[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const content = await readFile(join(EXPERIMENTS_PATH, file), "utf-8");
      experiments.push(JSON.parse(content));
    }
  }

  return experiments.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * 실험 조회
 */
export async function getExperiment(experimentId: string): Promise<Experiment | null> {
  const filePath = join(EXPERIMENTS_PATH, `${experimentId}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * 실험 완료
 */
export async function completeExperiment(
  experimentId: string,
  conclusion: string,
  winnerVersionId: string,
): Promise<void> {
  const experiment = await getExperiment(experimentId);
  if (!experiment) return;

  const [controlVersion, treatmentVersion] = await Promise.all([
    getVersion(experiment.controlVersionId),
    getVersion(experiment.treatmentVersionId),
  ]);

  const controlMetrics = controlVersion?.metrics;
  const treatmentMetrics = treatmentVersion?.metrics;

  experiment.controlResults = {
    splitCount: controlMetrics?.totalSplits ?? 0,
    approvalRate: controlMetrics?.approvalRate ?? 0,
    avgCharCount: controlMetrics?.avgCharCount ?? 0,
  };

  experiment.treatmentResults = {
    splitCount: treatmentMetrics?.totalSplits ?? 0,
    approvalRate: treatmentMetrics?.approvalRate ?? 0,
    avgCharCount: treatmentMetrics?.avgCharCount ?? 0,
  };

  experiment.status = "completed";
  experiment.conclusion = conclusion;
  experiment.winnerVersionId = winnerVersionId;

  const filePath = join(EXPERIMENTS_PATH, `${experimentId}.json`);
  await atomicWriteFile(filePath, JSON.stringify(experiment, null, 2));
}
