import { describe, expect, it } from "bun:test";

import {
  AnkiConnectError,
  AppError,
  NotFoundError,
  TimeoutError,
  ValidationError,
} from "../errors.js";

describe("커스텀 에러 클래스", () => {
  it("AppError는 statusCode와 message를 갖는다", () => {
    const err = new AppError(500, "서버 에러");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("서버 에러");
    expect(err.name).toBe("AppError");
  });

  it("NotFoundError는 404이다", () => {
    const err = new NotFoundError("카드를 찾을 수 없습니다");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("카드를 찾을 수 없습니다");
    expect(err.name).toBe("NotFoundError");
  });

  it("NotFoundError 기본 메시지", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("리소스를 찾을 수 없습니다");
  });

  it("ValidationError는 400이다", () => {
    const err = new ValidationError("noteId가 필요합니다");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("ValidationError");
  });

  it("AnkiConnectError는 502이다", () => {
    const err = new AnkiConnectError("연결 실패");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(502);
    expect(err.name).toBe("AnkiConnectError");
  });

  it("TimeoutError는 504이다", () => {
    const err = new TimeoutError("5000ms 초과");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(504);
    expect(err.name).toBe("TimeoutError");
  });
});
