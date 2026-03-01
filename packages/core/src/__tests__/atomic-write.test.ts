import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { atomicWriteFile, atomicWriteFileSync, withFileMutex } from "../utils/atomic-write.js";

const TEST_DIR = join(import.meta.dir, "__atomic_test_tmp__");

beforeAll(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("atomicWriteFileSync", () => {
  it("파일을 정상적으로 쓴다", () => {
    const filePath = join(TEST_DIR, "sync-test.json");
    atomicWriteFileSync(filePath, '{"hello":"world"}');

    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe('{"hello":"world"}');
  });

  it("기존 파일을 덮어쓴다", () => {
    const filePath = join(TEST_DIR, "sync-overwrite.json");
    atomicWriteFileSync(filePath, "first");
    atomicWriteFileSync(filePath, "second");

    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("second");
  });

  it("임시 파일이 남지 않는다", () => {
    const filePath = join(TEST_DIR, "sync-no-tmp.json");
    atomicWriteFileSync(filePath, "data");

    const tmpPath = `${filePath}.${process.pid}.tmp`;
    expect(existsSync(tmpPath)).toBe(false);
  });
});

describe("atomicWriteFile", () => {
  it("파일을 비동기로 정상 쓴다", async () => {
    const filePath = join(TEST_DIR, "async-test.json");
    await atomicWriteFile(filePath, '{"async":true}');

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe('{"async":true}');
  });

  it("임시 파일이 남지 않는다", async () => {
    const filePath = join(TEST_DIR, "async-no-tmp.json");
    await atomicWriteFile(filePath, "data");

    const tmpPath = `${filePath}.${process.pid}.tmp`;
    expect(existsSync(tmpPath)).toBe(false);
  });
});

describe("withFileMutex", () => {
  it("같은 파일에 대한 동시 쓰기를 직렬화한다", async () => {
    const filePath = join(TEST_DIR, "mutex-test.json");
    const log: number[] = [];

    // 동시에 3개의 쓰기 실행
    const writes = [1, 2, 3].map((n) =>
      withFileMutex(filePath, async () => {
        log.push(n);
        await atomicWriteFile(filePath, String(n));
        return n;
      }),
    );

    const results = await Promise.all(writes);

    // 모두 실행되었는지 확인
    expect(results).toEqual([1, 2, 3]);
    expect(log.length).toBe(3);

    // 마지막에 쓴 값이 파일에 있어야 함
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe(String(log[log.length - 1]));
  });

  it("다른 파일은 동시에 쓸 수 있다", async () => {
    const fileA = join(TEST_DIR, "mutex-a.json");
    const fileB = join(TEST_DIR, "mutex-b.json");

    const [a, b] = await Promise.all([
      withFileMutex(fileA, async () => {
        await atomicWriteFile(fileA, "a");
        return "a";
      }),
      withFileMutex(fileB, async () => {
        await atomicWriteFile(fileB, "b");
        return "b";
      }),
    ]);

    expect(a).toBe("a");
    expect(b).toBe("b");
  });
});
