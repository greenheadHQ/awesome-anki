# Architecture

## 1. 목적

Awesome Anki는 Anki 노트를 학습 효율이 높은 원자 카드(Atomic Card)로 분할하고, 분할 결과를 검증/복구하는 도구다.
런타임은 로컬 Anki(AnkiConnect) + Bun 기반 API/CLI + React 웹 UI로 구성된다.

## 2. 모노레포 구조

| 경로 | 역할 |
|------|------|
| `src/` | 루트 CLI 엔트리 (`bun run cli ...`) |
| `packages/core/` | 도메인 로직(Anki, split, validator, embedding, backup, prompt-version) |
| `packages/server/` | Hono REST API (`/api/*`) |
| `packages/web/` | React + Vite 프런트엔드 |
| `output/` | 런타임 산출물(백업/임베딩 캐시/프롬프트 버전 및 legacy 기록) |
| `docs/` | 운영/기능/문제해결 문서 |

## 3. 실행 진입점

| 실행 방식 | 명령 | 설명 |
|-----------|------|------|
| 통합 개발 | `bun run dev` | 서버 + 웹 동시 실행 |
| 서버 개발 | `bun run dev:server` | Hono API 실행 |
| 웹 개발 | `bun run dev:web` | Vite 개발 서버 실행 |
| CLI | `bun run cli:status`, `bun run cli:split` | 직접 분할/검증 흐름 실행 |

## 4. 주요 데이터 흐름

### 4.1 Split Preview/Apply
1. 웹 또는 CLI가 noteId를 선택한다.
2. 선택된 LLM 프로바이더(Gemini/OpenAI)로 AI 분할을 수행한다.
3. 서버가 사전 비용 추정 → 예산 가드레일 확인 → AI 호출 순서로 처리한다.
4. Apply 시 `preBackup`으로 원본 상태를 저장한다.
5. 분할 카드 생성 후 `updateBackupWithCreatedNotes`로 생성 노트 ID를 반영한다.
6. 실패 시 `rollback`으로 자동 복구한다.

### 4.2 Validation
1. fact/freshness/context는 LLM(Gemini/OpenAI) 기반 검증을 사용한다.
2. similarity는 기본 Jaccard, 옵션으로 embedding 기반 비교를 사용한다.
3. 결과는 `valid/warning/error/unknown` 상태로 통일된다.

### 4.3 Backup/Rollback
1. 백업 파일은 `output/backups/backup-YYYY-MM-DD.json`에 저장된다.
2. 저장/갱신은 파일 mutex + atomic write로 직렬화된다.
3. 손상된 백업 JSON은 자동으로 `.corrupt-*`로 격리된다.
4. 롤백 시 원본 필드/태그를 복원하고 생성 노트를 삭제한다.

### 4.4 Prompt System SoT
1. systemPrompt 단일 SoT는 AnkiConnect config key `awesomeAnki.prompts.system`이다.
2. payload는 `revision`(정수 CAS), `systemPrompt`, `activeVersionId`, `updatedAt`을 포함한다.
3. `POST /api/prompts/system`은 `expectedRevision`이 일치할 때만 저장하고, 불일치 시 `409`를 반환한다.
4. systemPrompt 수정은 active 버전 복제 기반 새 버전 생성 + active 전환으로 처리된다.
5. 저장 성공 직후 `sync()`를 실행하며, sync 실패 시 원격 payload/active 전환 롤백을 시도하고 요청을 실패 처리한다.
6. 서버 시작 시 원격 payload가 비어 있으면 local legacy active 버전에서 1회 자동 이관한다.

## 5. 외부 의존

| 의존 | 용도 | 기본값 |
|------|------|--------|
| AnkiConnect | 노트 조회/수정/삭제 | `$ANKI_CONNECT_URL` (MiniPC headless Anki) |
| Gemini API | split / validation / embedding | `GEMINI_API_KEY` 필요 |
| OpenAI API | split / validation (선택) | `OPENAI_API_KEY` (미설정 시 비활성) |

### 5.1 LLM 추상화 계층

`packages/core/src/llm/`에 provider-agnostic 추상화가 위치한다.

- `factory.ts` — `createLLMClient(provider)` 팩토리 함수
- `gemini.ts` — `@google/genai` SDK 어댑터
- `openai.ts` — OpenAI Responses API 어댑터
- `pricing.ts` — 정적 가격표 + 비용 계산 + 예산 가드레일
- `types.ts` — 공유 타입 (`TokenUsage`, `ActualCost`, `LLMModelId` 등)

## 6. 보안 경계

- API 서버는 `ANKI_SPLITTER_API_KEY` 인증이 필요하다 (`X-API-Key` 또는 Bearer).

## 7. 품질 게이트

루트에서 아래 명령으로 동일 기준을 검증한다.

```bash
bun run check:quick   # lint + typecheck
bun run check         # lint + typecheck + test + build
```

GitHub Actions(`.github/workflows/ci.yml`)가 PR/Push에서 동일 `bun run check`를 실행한다.
