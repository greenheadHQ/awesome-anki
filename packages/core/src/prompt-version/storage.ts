/**
 * 프롬프트 버전 저장소
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig, setConfig } from "../anki/client.js";
import { atomicWriteFile, withFileMutex } from "../utils/atomic-write.js";
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

export function parseRemoteSystemPromptPayload(
  value: unknown,
): RemoteSystemPromptPayload | null {
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

  if (
    typeof raw.revision !== "number" ||
    !Number.isInteger(raw.revision) ||
    raw.revision < 0
  ) {
    throw new Error(
      "원격 system prompt payload.revision 값이 유효하지 않습니다.",
    );
  }

  if (typeof raw.systemPrompt !== "string" || raw.systemPrompt.length === 0) {
    throw new Error(
      "원격 system prompt payload.systemPrompt 값이 유효하지 않습니다.",
    );
  }

  if (
    typeof raw.activeVersionId !== "string" ||
    raw.activeVersionId.length === 0
  ) {
    throw new Error(
      "원격 system prompt payload.activeVersionId 값이 유효하지 않습니다.",
    );
  }

  if (typeof raw.updatedAt !== "string" || raw.updatedAt.length === 0) {
    throw new Error(
      "원격 system prompt payload.updatedAt 값이 유효하지 않습니다.",
    );
  }

  if (
    raw.migratedFromFileAt !== undefined &&
    typeof raw.migratedFromFileAt !== "string"
  ) {
    throw new Error(
      "원격 system prompt payload.migratedFromFileAt 값이 유효하지 않습니다.",
    );
  }

  return {
    revision: raw.revision,
    systemPrompt: raw.systemPrompt,
    activeVersionId: raw.activeVersionId,
    migratedFromFileAt: raw.migratedFromFileAt,
    updatedAt: raw.updatedAt,
  };
}

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
  await atomicWriteFile(filePath, JSON.stringify(version, null, 2));
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

  await atomicWriteFile(
    ACTIVE_VERSION_FILE,
    JSON.stringify(activeInfo, null, 2),
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
// 원격 system prompt SoT
// ============================================================================

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

export interface SystemPromptMigrationResult {
  migrated: boolean;
  reason:
    | "already-exists"
    | "no-active-version"
    | "active-version-missing"
    | "empty-active-system-prompt"
    | "migrated";
  payload?: RemoteSystemPromptPayload;
}

/**
 * legacy file SoT(output/prompts)에서 원격 SoT로 1회 이관
 */
export async function migrateLegacySystemPromptToRemoteIfNeeded(): Promise<SystemPromptMigrationResult> {
  // NOTE:
  // getRemoteSystemPromptPayload() -> setRemoteSystemPromptPayload() 사이에 TOCTOU 창이 있다.
  // 현재는 단일 인스턴스 서버의 startup 1회 마이그레이션만 가정하므로 별도 락을 두지 않는다.
  const existing = await getRemoteSystemPromptPayload();
  if (existing) {
    return {
      migrated: false,
      reason: "already-exists",
      payload: existing,
    };
  }

  const activeInfo = await getActiveVersion();
  if (!activeInfo) {
    return {
      migrated: false,
      reason: "no-active-version",
    };
  }

  const activeVersion = await getVersion(activeInfo.versionId);
  if (!activeVersion) {
    return {
      migrated: false,
      reason: "active-version-missing",
    };
  }

  if (activeVersion.systemPrompt.length === 0) {
    return {
      migrated: false,
      reason: "empty-active-system-prompt",
    };
  }

  const now = new Date().toISOString();
  const payload: RemoteSystemPromptPayload = {
    revision: 0,
    systemPrompt: activeVersion.systemPrompt,
    activeVersionId: activeVersion.id,
    migratedFromFileAt: now,
    updatedAt: now,
  };

  await setRemoteSystemPromptPayload(payload);

  return {
    migrated: true,
    reason: "migrated",
    payload,
  };
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

export interface PromptMetricsEvent {
  promptVersionId: string;
  splitType?: "hard" | "soft";
  userAction: "approved" | "modified" | "rejected";
  splitCards: Array<{
    title?: string;
    content: string;
    charCount?: number;
    cardType?: "cloze" | "basic";
    contextTag?: string;
  }>;
  modificationDetails?: SplitHistoryEntry["modificationDetails"];
  timestamp?: string;
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

  // 파일 뮤텍스로 동시 쓰기 직렬화
  const newEntry = await withFileMutex(filePath, async () => {
    let history: SplitHistoryEntry[] = [];
    if (existsSync(filePath)) {
      const content = await readFile(filePath, "utf-8");
      history = JSON.parse(content);
    }

    const created: SplitHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    history.push(created);
    await atomicWriteFile(filePath, JSON.stringify(history, null, 2));
    return created;
  });

  // 해당 버전의 메트릭 업데이트
  await updateVersionMetrics(entry.promptVersionId, newEntry);

  return newEntry;
}

/**
 * 히스토리 본문 저장 없이 프롬프트 메트릭만 갱신
 */
export async function recordPromptMetricsEvent(
  event: PromptMetricsEvent,
): Promise<void> {
  const timestamp = event.timestamp ?? new Date().toISOString();

  const entry: SplitHistoryEntry = {
    id: `metrics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp,
    promptVersionId: event.promptVersionId,
    noteId: 0,
    deckName: "",
    originalContent: "",
    originalCharCount: 0,
    splitCards: event.splitCards.map((card) => ({
      title: card.title ?? "",
      content: card.content,
      charCount: card.charCount,
      cardType: card.cardType,
      contextTag: card.contextTag,
    })),
    userAction: event.userAction,
    modificationDetails: event.modificationDetails,
    qualityChecks: null,
    splitType: event.splitType,
  };

  await updateVersionMetrics(event.promptVersionId, entry);
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
  // Hard Split은 프롬프트 성능과 무관 — 메트릭에서 제외
  if (entry.splitType === "hard") return;

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

  // 평균 글자 수 (charCount가 undefined/NaN이면 content.length 폴백)
  const totalChars = entry.splitCards.reduce(
    (sum, card) => sum + (card.charCount || card.content.length),
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
                h.splitCards.reduce(
                  (s, c) => s + (c.charCount || c.content.length),
                  0,
                ) /
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
                h.splitCards.reduce(
                  (s, c) => s + (c.charCount || c.content.length),
                  0,
                ) /
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
  await atomicWriteFile(filePath, JSON.stringify(experiment, null, 2));
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
