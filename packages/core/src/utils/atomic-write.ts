/**
 * 원자적 파일 쓰기 유틸리티
 *
 * - 임시 파일에 먼저 쓴 후 rename으로 교체 (APFS에서 원자적)
 * - in-process 뮤텍스로 같은 파일의 동시 쓰기 직렬화
 */

import { existsSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function getTmpPath(filePath: string): string {
  return `${filePath}.${process.pid}.tmp`;
}

/**
 * 동기 원자적 파일 쓰기
 */
export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = getTmpPath(filePath);
  try {
    writeFileSync(tmpPath, data, "utf-8");
    renameSync(tmpPath, filePath);
  } finally {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch (_) {
        // 정리 실패 무시
      }
    }
  }
}

/**
 * 비동기 원자적 파일 쓰기
 */
export async function atomicWriteFile(
  filePath: string,
  data: string,
): Promise<void> {
  const tmpPath = getTmpPath(filePath);
  try {
    await writeFile(tmpPath, data, "utf-8");
    await rename(tmpPath, filePath);
  } finally {
    if (existsSync(tmpPath)) {
      try {
        await unlink(tmpPath);
      } catch (_) {
        // 정리 실패 무시
      }
    }
  }
}

/**
 * In-process 파일 뮤텍스
 *
 * 같은 파일 경로에 대한 동시 쓰기를 직렬화한다.
 * 단일 Bun 프로세스이므로 in-process 뮤텍스로 충분.
 */
const fileLocks = new Map<string, Promise<void>>();

export async function withFileMutex<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = resolve(filePath);
  const existing = fileLocks.get(key) ?? Promise.resolve();

  let release: (() => void) | undefined;
  const lock = new Promise<void>((r) => {
    release = r;
  });
  fileLocks.set(key, lock);

  try {
    await existing;
    return await fn();
  } finally {
    release?.();
    // 자기 자신이 마지막 lock이면 정리
    if (fileLocks.get(key) === lock) {
      fileLocks.delete(key);
    }
  }
}
