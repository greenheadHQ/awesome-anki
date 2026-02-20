# 프로젝트 이해 트러블슈팅

구조/실행/의존성 파악 단계에서 자주 발생하는 문제를 정리한다.

## 1) 패키지 경로를 잘못 참조함

- 증상: 수정 대상 모듈 위치를 반복 탐색함
- 점검:
  - `packages/core`, `packages/server`, `packages/web` 경계를 먼저 확인
  - `rg --files packages | rg <keyword>`로 실제 파일 경로 확인
- 조치:
  - 스킬 문서의 구조 표를 최신 기준으로 갱신
  - 모듈 책임을 한 줄 요약으로 추가

## 2) export 충돌로 빌드 실패

- 증상: `index.ts`에서 동일 이름 export 충돌 발생
- 점검:
  - `packages/core/src/index.ts`의 named export 목록 확인
- 조치:
  - `export *` 대신 명시적 named export 유지
  - 충돌 가능 함수는 접두사 네이밍으로 분리

## 3) 개발 서버가 기동되지 않음

- 증상: `bun run dev` 실행 시 포트 충돌 또는 프로세스 잔존
- 점검:
  - `lsof -ti:3000` / `lsof -ti:5173`으로 점유 프로세스 확인
- 조치:
  - 충돌 프로세스 정리 후 서버 재기동
  - 필요 시 `bun run dev:server`, `bun run dev:web`로 분리 실행

## 4) 패키지 매니저 혼용

- 증상: `node_modules`/lockfile 상태가 불안정해짐
- 점검:
  - `package.json` 스크립트와 현재 lockfile(`bun.lockb`) 기준 확인
- 조치:
  - 이 프로젝트에서는 `bun`만 사용
  - 혼용으로 생성된 불필요 산출물은 합의 후 정리
