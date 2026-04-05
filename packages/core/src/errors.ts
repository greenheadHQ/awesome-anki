/**
 * 커스텀 에러 클래스
 *
 * Hono 글로벌 에러 핸들러에서 statusCode로 HTTP 응답 코드를 결정한다.
 * 서버/CLI 공용 사용을 위해 core 패키지에 위치.
 */

export class AppError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "리소스를 찾을 수 없습니다") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "잘못된 요청입니다") {
    super(400, message);
    this.name = "ValidationError";
  }
}

export type AnkiConnectErrorCode = "UNSUPPORTED_REMOTE_CONFIG_ACTION";

export class AnkiConnectError extends AppError {
  readonly code?: AnkiConnectErrorCode;
  constructor(message = "AnkiConnect 요청 실패", code?: AnkiConnectErrorCode) {
    super(502, message);
    this.name = "AnkiConnectError";
    this.code = code;
  }
}

export class TimeoutError extends AppError {
  constructor(message = "요청 시간이 초과되었습니다") {
    super(504, message);
    this.name = "TimeoutError";
  }
}
