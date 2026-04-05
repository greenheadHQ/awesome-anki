/**
 * 프롬프트 버전 저장소
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { atomicWriteFile } from "../utils/atomic-write.js";
import type { ActiveVersionInfo, PromptVersion } from "./types.js";

// 기본 경로 (프로젝트 루트 기준)
const BASE_PATH = join(process.cwd(), "output", "prompts");
const VERSIONS_PATH = join(BASE_PATH, "versions");
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
  return versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 특정 버전 조회
 */
export async function getVersion(versionId: string): Promise<PromptVersion | null> {
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
 * @param bumpType - major: v1.0.0→v2.0.0, minor: v1.0.0→v1.1.0, patch(기본): v1.0.0→v1.0.1
 */
export async function createVersion(
  base: Omit<PromptVersion, "id" | "createdAt" | "updatedAt" | "metrics" | "modificationPatterns">,
  bumpType: "major" | "minor" | "patch" = "patch",
): Promise<PromptVersion> {
  const versions = await listVersions();

  // 다음 버전 번호 계산
  const latestVersion = versions[0];
  let nextVersion = "v1.0.0";

  if (latestVersion) {
    const match = latestVersion.id.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const [, major, minor, patch] = match.map(Number);
      switch (bumpType) {
        case "major":
          nextVersion = `v${major + 1}.0.0`;
          break;
        case "minor":
          nextVersion = `v${major}.${minor + 1}.0`;
          break;
        case "patch":
          nextVersion = `v${major}.${minor}.${patch + 1}`;
          break;
      }
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

  await atomicWriteFile(ACTIVE_VERSION_FILE, JSON.stringify(activeInfo, null, 2));
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

// Re-exports는 순환 의존성 방지를 위해 core/src/index.ts에서 직접 import한다.
