/**
 * 프롬프트 버전 저장소
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ActiveVersionInfo,
  Experiment,
  ModificationPatterns,
  PromptVersion,
  SplitHistoryEntry,
} from "./types.js";

// 기본 경로 (프로젝트 루트 기준)
const BASE_PATH = join(process.cwd(), "output", "prompts");
const VERSIONS_PATH = join(BASE_PATH, "versions");
const HISTORY_PATH = join(BASE_PATH, "history");
const EXPERIMENTS_PATH = join(BASE_PATH, "experiments");
const ACTIVE_VERSION_FILE = join(BASE_PATH, "active-version.json");

/**
 * 디렉토리 존재 확인 및 생성
 */
async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

// ============================================================================
// 버전 관리
// ============================================================================

/**
 * 모든 버전 목록 조회
 */
export async function listVersions(): Promise<PromptVersion[]> {
  await ensureDir(VERSIONS_PATH);

  const files = await readdir(VERSIONS_PATH);
  const versions: PromptVersion[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const content = await readFile(join(VERSIONS_PATH, file), "utf-8");
      versions.push(JSON.parse(content));
    }
  }

  // 최신순 정렬
  return versions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * 특정 버전 조회
 */
export async function getVersion(
  versionId: string,
): Promise<PromptVersion | null> {
  const filePath = join(VERSIONS_PATH, `${versionId}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * 버전 저장
 */
export async function saveVersion(version: PromptVersion): Promise<void> {
  await ensureDir(VERSIONS_PATH);

  const filePath = join(VERSIONS_PATH, `${version.id}.json`);
  await writeFile(filePath, JSON.stringify(version, null, 2), "utf-8");
}

/**
 * 버전 삭제
 */
export async function deleteVersion(versionId: string): Promise<boolean> {
  const filePath = join(VERSIONS_PATH, `${versionId}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  const { unlink } = await import("node:fs/promises");
  await unlink(filePath);
  return true;
}

/**
 * 새 버전 생성
 */
export async function createVersion(
  base: Omit<
    PromptVersion,
    "id" | "createdAt" | "updatedAt" | "metrics" | "modificationPatterns"
  >,
): Promise<PromptVersion> {
  const versions = await listVersions();

  // 다음 버전 번호 계산
  const latestVersion = versions[0];
  let nextVersion = "v1.0.0";

  if (latestVersion) {
    const match = latestVersion.id.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const [, major, minor, patch] = match.map(Number);
      nextVersion = `v${major}.${minor}.${patch + 1}`;
    }
  }

  const now = new Date().toISOString();
  const version: PromptVersion = {
    ...base,
    id: nextVersion,
    createdAt: now,
    updatedAt: now,
    metrics: {
      totalSplits: 0,
      approvedCount: 0,
      modifiedCount: 0,
      rejectedCount: 0,
      approvalRate: 0,
      avgCardsPerSplit: 0,
      avgCharCount: 0,
      lastUsedAt: "",
    },
    modificationPatterns: {
      lengthReduced: 0,
      contextAdded: 0,
      clozeChanged: 0,
      cardsMerged: 0,
      cardsSplit: 0,
      hintAdded: 0,
    },
  };

  await saveVersion(version);
  return version;
}

// ============================================================================
// 활성 버전 관리
// ============================================================================

/**
 * 활성 버전 조회
 */
export async function getActiveVersion(): Promise<ActiveVersionInfo | null> {
  if (!existsSync(ACTIVE_VERSION_FILE)) {
    return null;
  }

  const content = await readFile(ACTIVE_VERSION_FILE, "utf-8");
  return JSON.parse(content);
}

/**
 * 활성 버전 설정
 */
export async function setActiveVersion(
  versionId: string,
  activatedBy: "user" | "system" | "experiment" = "user",
): Promise<void> {
  await ensureDir(BASE_PATH);

  // 기존 활성 버전 archived로 변경
  const currentActive = await getActiveVersion();
  if (currentActive && currentActive.versionId !== versionId) {
    const oldVersion = await getVersion(currentActive.versionId);
    if (oldVersion) {
      oldVersion.status = "archived";
      oldVersion.updatedAt = new Date().toISOString();
      await saveVersion(oldVersion);
    }
  }

  // 새 버전 active로 변경
  const newVersion = await getVersion(versionId);
  if (newVersion) {
    newVersion.status = "active";
    newVersion.updatedAt = new Date().toISOString();
    await saveVersion(newVersion);
  }

  // 활성 버전 정보 저장
  const activeInfo: ActiveVersionInfo = {
    versionId,
    activatedAt: new Date().toISOString(),
    activatedBy,
  };

  await writeFile(
    ACTIVE_VERSION_FILE,
    JSON.stringify(activeInfo, null, 2),
    "utf-8",
  );
}

/**
 * 활성 버전의 프롬프트 가져오기
 */
export async function getActivePrompts(): Promise<PromptVersion | null> {
  const activeInfo = await getActiveVersion();
  if (!activeInfo) {
    return null;
  }

  return getVersion(activeInfo.versionId);
}

// ============================================================================
// 히스토리 관리
// ============================================================================

/**
 * 히스토리 파일명 생성 (날짜별)
 */
function getHistoryFileName(date: Date = new Date()): string {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return `history-${dateStr}.json`;
}

/**
 * 히스토리 항목 추가
 */
export async function addHistoryEntry(
  entry: Omit<SplitHistoryEntry, "id">,
): Promise<SplitHistoryEntry> {
  await ensureDir(HISTORY_PATH);

  const fileName = getHistoryFileName();
  const filePath = join(HISTORY_PATH, fileName);

  // 기존 히스토리 로드
  let history: SplitHistoryEntry[] = [];
  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf-8");
    history = JSON.parse(content);
  }

  // 새 항목 추가
  const newEntry: SplitHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  history.push(newEntry);
  await writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");

  // 해당 버전의 메트릭 업데이트
  await updateVersionMetrics(entry.promptVersionId, newEntry);

  return newEntry;
}

/**
 * 히스토리 조회 (날짜 범위)
 */
export async function getHistory(
  startDate?: Date,
  endDate?: Date,
): Promise<SplitHistoryEntry[]> {
  await ensureDir(HISTORY_PATH);

  const files = await readdir(HISTORY_PATH);
  const allEntries: SplitHistoryEntry[] = [];

  for (const file of files) {
    if (!file.startsWith("history-") || !file.endsWith(".json")) continue;

    // 날짜 필터링
    const dateMatch = file.match(/history-(\d{4}-\d{2}-\d{2})\.json/);
    if (!dateMatch) continue;

    const fileDate = new Date(dateMatch[1]);
    if (startDate && fileDate < startDate) continue;
    if (endDate && fileDate > endDate) continue;

    const content = await readFile(join(HISTORY_PATH, file), "utf-8");
    const entries = JSON.parse(content) as SplitHistoryEntry[];
    allEntries.push(...entries);
  }

  // 최신순 정렬
  return allEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * 버전별 히스토리 조회
 */
export async function getHistoryByVersion(
  versionId: string,
): Promise<SplitHistoryEntry[]> {
  const allHistory = await getHistory();
  return allHistory.filter((entry) => entry.promptVersionId === versionId);
}

// ============================================================================
// 메트릭 업데이트
// ============================================================================

/**
 * 버전 메트릭 업데이트
 */
async function updateVersionMetrics(
  versionId: string,
  entry: SplitHistoryEntry,
): Promise<void> {
  const version = await getVersion(versionId);
  if (!version) return;

  const metrics = version.metrics;
  const patterns = version.modificationPatterns;

  // 총 분할 횟수
  metrics.totalSplits++;

  // 사용자 액션별 카운트
  switch (entry.userAction) {
    case "approved":
      metrics.approvedCount++;
      break;
    case "modified":
      metrics.modifiedCount++;
      // 수정 패턴 업데이트
      if (entry.modificationDetails) {
        if (entry.modificationDetails.lengthReduced) patterns.lengthReduced++;
        if (entry.modificationDetails.contextAdded) patterns.contextAdded++;
        if (entry.modificationDetails.clozeChanged) patterns.clozeChanged++;
        if (entry.modificationDetails.cardsMerged) patterns.cardsMerged++;
        if (entry.modificationDetails.cardsSplit) patterns.cardsSplit++;
        if (entry.modificationDetails.hintAdded) patterns.hintAdded++;
      }
      break;
    case "rejected":
      metrics.rejectedCount++;
      break;
  }

  // 승인률 계산
  const totalDecisions =
    metrics.approvedCount + metrics.modifiedCount + metrics.rejectedCount;
  metrics.approvalRate =
    totalDecisions > 0
      ? Math.round((metrics.approvedCount / totalDecisions) * 100)
      : 0;

  // 평균 카드 수
  metrics.avgCardsPerSplit =
    metrics.totalSplits > 0
      ? Math.round(
          ((metrics.avgCardsPerSplit * (metrics.totalSplits - 1) +
            entry.splitCards.length) /
            metrics.totalSplits) *
            10,
        ) / 10
      : entry.splitCards.length;

  // 평균 글자 수
  const totalChars = entry.splitCards.reduce(
    (sum, card) => sum + card.charCount,
    0,
  );
  const avgChars =
    entry.splitCards.length > 0 ? totalChars / entry.splitCards.length : 0;
  metrics.avgCharCount =
    metrics.totalSplits > 0
      ? Math.round(
          (metrics.avgCharCount * (metrics.totalSplits - 1) + avgChars) /
            metrics.totalSplits,
        )
      : avgChars;

  // 마지막 사용 시간
  metrics.lastUsedAt = entry.timestamp;

  // 저장
  version.metrics = metrics;
  version.modificationPatterns = patterns;
  version.updatedAt = new Date().toISOString();
  await saveVersion(version);
}

// ============================================================================
// 실험 관리
// ============================================================================

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
  await writeFile(filePath, JSON.stringify(experiment, null, 2), "utf-8");

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
export async function getExperiment(
  experimentId: string,
): Promise<Experiment | null> {
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

  // 결과 계산 (히스토리 기반)
  const controlHistory = await getHistoryByVersion(experiment.controlVersionId);
  const treatmentHistory = await getHistoryByVersion(
    experiment.treatmentVersionId,
  );

  experiment.controlResults = {
    splitCount: controlHistory.length,
    approvalRate:
      controlHistory.length > 0
        ? Math.round(
            (controlHistory.filter((h) => h.userAction === "approved").length /
              controlHistory.length) *
              100,
          )
        : 0,
    avgCharCount:
      controlHistory.length > 0
        ? Math.round(
            controlHistory.reduce(
              (sum, h) =>
                sum +
                h.splitCards.reduce((s, c) => s + c.charCount, 0) /
                  h.splitCards.length,
              0,
            ) / controlHistory.length,
          )
        : 0,
  };

  experiment.treatmentResults = {
    splitCount: treatmentHistory.length,
    approvalRate:
      treatmentHistory.length > 0
        ? Math.round(
            (treatmentHistory.filter((h) => h.userAction === "approved")
              .length /
              treatmentHistory.length) *
              100,
          )
        : 0,
    avgCharCount:
      treatmentHistory.length > 0
        ? Math.round(
            treatmentHistory.reduce(
              (sum, h) =>
                sum +
                h.splitCards.reduce((s, c) => s + c.charCount, 0) /
                  h.splitCards.length,
              0,
            ) / treatmentHistory.length,
          )
        : 0,
  };

  experiment.status = "completed";
  experiment.conclusion = conclusion;
  experiment.winnerVersionId = winnerVersionId;

  const filePath = join(EXPERIMENTS_PATH, `${experimentId}.json`);
  await writeFile(filePath, JSON.stringify(experiment, null, 2), "utf-8");
}

// ============================================================================
// 실패 패턴 분석
// ============================================================================

/**
 * 버전의 실패 패턴 분석
 */
export async function analyzeFailurePatterns(versionId: string): Promise<{
  patterns: ModificationPatterns;
  insights: string[];
}> {
  const version = await getVersion(versionId);
  if (!version) {
    return {
      patterns: {
        lengthReduced: 0,
        contextAdded: 0,
        clozeChanged: 0,
        cardsMerged: 0,
        cardsSplit: 0,
        hintAdded: 0,
      },
      insights: [],
    };
  }

  const patterns = version.modificationPatterns;
  const total = Object.values(patterns).reduce((sum, v) => sum + v, 0);
  const insights: string[] = [];

  if (total === 0) {
    insights.push("수정된 분할이 없습니다.");
    return { patterns, insights };
  }

  // 각 패턴별 비율 계산 및 인사이트 생성
  const threshold = 0.3; // 30% 이상이면 문제로 간주

  if (patterns.lengthReduced / total > threshold) {
    insights.push(
      `글자 수 초과가 ${Math.round((patterns.lengthReduced / total) * 100)}%: 프롬프트에서 상한선 강조 필요`,
    );
  }

  if (patterns.contextAdded / total > threshold) {
    insights.push(
      `맥락 태그 누락이 ${Math.round((patterns.contextAdded / total) * 100)}%: 중첩 태그 생성 규칙 강화 필요`,
    );
  }

  if (patterns.clozeChanged / total > threshold) {
    insights.push(
      `Cloze 위치/내용 변경이 ${Math.round((patterns.clozeChanged / total) * 100)}%: Cloze 선택 기준 개선 필요`,
    );
  }

  if (patterns.cardsMerged / total > threshold) {
    insights.push(
      `카드 병합이 ${Math.round((patterns.cardsMerged / total) * 100)}%: 분할이 너무 세분화됨`,
    );
  }

  if (patterns.cardsSplit / total > threshold) {
    insights.push(
      `추가 분할이 ${Math.round((patterns.cardsSplit / total) * 100)}%: 분할이 충분히 원자적이지 않음`,
    );
  }

  if (patterns.hintAdded / total > threshold) {
    insights.push(
      `힌트 추가가 ${Math.round((patterns.hintAdded / total) * 100)}%: 이진 패턴 감지 정확도 개선 필요`,
    );
  }

  return { patterns, insights };
}
