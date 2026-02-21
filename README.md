# Awesome Anki

<img width="1719" height="983" alt="Awesome Anki 메인 화면" src="https://github.com/user-attachments/assets/6af494b7-0395-43d7-a41c-9a614c251047" />

Awesome Anki는 **Anki 노트를 학습 효율이 높은 원자 카드(Atomic Card)**로 분할하고, 검증하고, 필요 시 복구(롤백)할 수 있는 로컬 우선 웹 애플리케이션입니다.

## 목차

- [1. 프로젝트 소개](#1-프로젝트-소개)
- [2. 핵심 기능](#2-핵심-기능)
- [3. 기술 스택](#3-기술-스택)
- [4. 모노레포 구조](#4-모노레포-구조)
- [5. 빠른 시작](#5-빠른-시작)
- [6. 실행 방법](#6-실행-방법)
- [7. 환경 변수](#7-환경-변수)
- [8. 개발 DX 도구](#8-개발-dx-도구)
- [9. API 레퍼런스](#9-api-레퍼런스)
- [10. 품질 검증](#10-품질-검증)
- [11. 운영/트러블슈팅 체크](#11-운영트러블슈팅-체크)
- [12. 참고 링크](#12-참고-링크)
- [13. 라이선스](#13-라이선스)

## 1. 프로젝트 소개

기존 Anki 카드에 정보가 과도하게 밀집되면 복습 효율이 떨어질 수 있습니다. Awesome Anki는 다음 흐름으로 이 문제를 해결합니다.

1. 카드 구조를 분석해 분할 가능 여부를 판단합니다.
2. 규칙 기반(Hard Split) 또는 Gemini 기반(Soft Split)으로 카드를 분리합니다.
3. 분할 전 백업을 생성하고, 적용 실패 시 자동 롤백합니다.
4. 팩트/최신성/유사성/문맥 검증으로 결과 품질을 점검합니다.

## 2. 핵심 기능

### 2.1 카드 분할

- **Hard Split**: `####`, `---` 같은 구조적 구분자를 기준으로 빠르고 예측 가능하게 분할
- **Soft Split**: Gemini를 사용해 비정형 텍스트를 의미 단위로 분할
- **Preview / Apply 분리**: 적용 전 미리보기로 결과 확인 가능
- **학습 데이터 복제**: 분할 후 카드에 스케줄링 정보 복제 시도

### 2.2 검증

- **Fact Check**: 카드 내용의 사실성 점검
- **Freshness**: 최신성 점검(기준 날짜 기반)
- **Similarity**: Jaccard + 임베딩 기반 유사 카드 탐지
- **Context**: nid 링크 기반 문맥 일관성 점검
- **All-in-one 검증**: 단일 요청으로 통합 검증 실행

### 2.3 안정성

- **분할 전 백업(`preBackup`) 필수 생성**
- **적용 실패 시 자동 롤백**
- **손상 백업 파일 자동 격리(`.corrupt-*`)**
- **원클릭 수동 롤백 API 제공**

### 2.4 프롬프트 운영

- 프롬프트 버전 생성/수정/활성화/삭제
- 분할 히스토리 저장/조회
- 실패 패턴 분석
- A/B 실험(Experiment) 생성 및 완료 처리

### 2.5 보안/프라이버시

- `/api/health`를 제외한 API는 `ANKI_SPLITTER_API_KEY` 인증 필요
- 프라이버시 모드 제공: `standard`, `balanced`, `strict`
- `strict` 모드에서는 외부 AI 호출(split/validation/embedding) 차단

## 3. 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | [Bun](https://bun.sh/) |
| 언어 | TypeScript |
| 서버 | [Hono](https://hono.dev/) |
| 웹 | React 19 + Vite |
| 상태 관리 | [TanStack Query](https://tanstack.com/query) |
| 스타일링 | Tailwind CSS v4 |
| 렌더링 | markdown-it + KaTeX |
| LLM | [Google Gemini](https://ai.google.dev/) |
| 연동 | [AnkiConnect](https://ankiweb.net/shared/info/2055492159) |

## 4. 모노레포 구조

```text
awesome-anki/
├── src/                      # 루트 CLI 엔트리
├── packages/
│   ├── core/                 # 도메인 로직(분할/검증/백업/프라이버시)
│   ├── server/               # Hono REST API
│   └── web/                  # React + Vite 웹 UI
├── output/                   # 런타임 산출물(백업, 임베딩 캐시, 프롬프트 기록)
├── docs/                     # 아키텍처/기능/트러블슈팅 문서
└── templates/                # 카드 템플릿 리소스
```

## 5. 빠른 시작

### 5.1 사전 요구사항

- [Bun](https://bun.sh/)
- [Anki](https://apps.ankiweb.net/)
- [AnkiConnect 애드온](https://ankiweb.net/shared/info/2055492159)

### 5.2 설치

```bash
git clone https://github.com/greenheadHQ/awesome-anki.git
cd awesome-anki
bun install
```

### 5.3 환경 설정

```bash
cp .env.example .env
```

실제 운영값은 이 저장소 기준으로 `.envrc`에서 export 관리하며, 비밀값은 `secrets/*.age`로 암호화 관리합니다.

## 6. 실행 방법

### 6.1 웹 GUI (권장)

```bash
# 서버 + 웹 동시 실행
bun run dev

# 서버만 실행 (기본: 3000)
bun run dev:server

# 웹만 실행 (기본: 5173)
bun run dev:web
```

### 6.2 CLI

```bash
# 연결 상태 확인
bun run cli:status

# 덱 분할 미리보기
bun run cli:split

# 덱 분할 적용
bun run cli:split -- --apply

# 특정 노트 분할
bun run cli split --note <noteId>

# 분석 명령 (내부용)
bun run cli analyze <deckName> [noteId]

# 백업 목록/롤백
bun run cli backups
bun run cli rollback <backupId>
```

## 7. 환경 변수

### 7.1 핵심 서버/도메인 변수

| 변수 | 설명 |
|------|------|
| `GEMINI_API_KEY` | Gemini API 키 |
| `ANKI_SPLITTER_API_KEY` | 서버 API 인증 키 |
| `ANKI_CONNECT_URL` | AnkiConnect URL |
| `ANKI_CONNECT_VERSION` | AnkiConnect 버전(기본 6) |
| `TARGET_DECK` | 기본 대상 덱 |
| `ANKI_SPLITTER_PRIVACY_MODE` | `standard` / `balanced` / `strict` |
| `ANKI_SPLITTER_PRIVACY_MASK_SENSITIVE` | 민감정보 마스킹 여부 |
| `ANKI_SPLITTER_PRIVACY_SPLIT_MAX_CHARS` | split 전송 길이 제한 |
| `ANKI_SPLITTER_PRIVACY_VALIDATION_MAX_CHARS` | validation 전송 길이 제한 |
| `ANKI_SPLITTER_PRIVACY_EMBEDDING_MAX_CHARS` | embedding 전송 길이 제한 |

### 7.2 웹/개발 변수

| 변수 | 설명 |
|------|------|
| `VITE_API_URL` | 웹에서 직접 호출할 API 베이스 URL |
| `VITE_API_PROXY_TARGET` | Vite dev 프록시 타깃(기본 `http://localhost:3000`) |
| `VITE_LOCATOR_TARGET` | Locator 에디터 타깃 (`cursor`/`vscode`) |
| `VITE_DISABLE_LOCATOR` | Locator 강제 비활성화 |
| `VITE_DISABLE_REACT_SCAN` | React Scan 강제 비활성화 |
| `VITE_DISABLE_REACT_GRAB` | React Grab 강제 비활성화 |

## 8. 개발 DX 도구

이 섹션은 **LocatorJS / React Scan / React Grab**를 실제로 어떻게 켜고 끄는지, 어떤 설정값이 영향을 주는지, 어떤 순서로 쓰면 좋은지를 정리합니다.

### 8.1 공통 동작 원칙

1. 세 도구는 `packages/web/src/main.tsx`에서 `import.meta.env.DEV` 조건으로만 초기화됩니다.
2. 즉, `bun run dev`일 때만 동작하고 `bun run build` 산출물에서는 실행되지 않습니다.
3. 도구별 비활성화는 아래 환경변수로 즉시 제어할 수 있습니다.
   - `VITE_DISABLE_LOCATOR=true`
   - `VITE_DISABLE_REACT_SCAN=true`
   - `VITE_DISABLE_REACT_GRAB=true`

### 8.2 LocatorJS (브라우저 → 에디터 점프)

#### 설정 방법

1. 런타임 패키지 설치
   - `@locator/runtime`
2. Vite Babel 체인에 data-id 플러그인 연결
   - `@locator/babel-jsx/dist`
   - 개발 모드에서만 적용 (`mode === "development"`)
3. 런타임 초기화
   - `setupLocatorUI({ targets, showIntro: false })`
   - `showIntro: false`로 온보딩 팝업 비활성화
4. 에디터 타깃 선택
   - 기본: `VITE_LOCATOR_TARGET=cursor`
   - 전환: `VITE_LOCATOR_TARGET=vscode`

#### 사용 방법

1. `bun run dev` 실행
2. 브라우저에서 점프하려는 컴포넌트 위에 마우스를 올림
3. macOS 기준 `Option + Click` 실행
4. 설정된 에디터(Cursor/VS Code)에서 해당 파일+라인으로 이동

#### 점검 포인트

1. 점프가 안 되면 먼저 `VITE_DISABLE_LOCATOR`가 `true`인지 확인
2. 반드시 Vite 개발 서버(`bun run dev` 또는 `bun run dev:web`)에서 테스트
3. 소스 메타가 누락되면 `packages/web/vite.config.ts`의 Babel 플러그인 설정 확인

### 8.3 React Scan (렌더링 병목 시각화)

#### 설정 방법

1. 초기화 코드에서 `scan({ enabled: false, showToolbar: true })` 적용
2. 추가로 `setOptions({ enabled: false, showToolbar: true })`를 호출해 초기 상태를 OFF로 고정
3. 결과적으로 **툴바는 표시되지만 스캔은 비활성 상태로 시작**

#### 사용 방법

1. `bun run dev` 실행
2. 우측 상단 React Scan 툴바 확인
3. 토글을 ON으로 전환해 스캔 시작
4. 렌더링이 잦은 컴포넌트 강조/지표를 확인
5. 분석이 끝나면 토글을 다시 OFF

#### 점검 포인트

1. 툴바가 아예 없으면 `VITE_DISABLE_REACT_SCAN` 값 확인
2. 성능 측정 시에는 필요한 시점에만 ON으로 두는 것을 권장

### 8.4 React Grab (에이전트 컨텍스트 복사)

#### 설정 방법

1. `react-grab` 기본 엔트리를 로드해 툴바 UI를 유지
2. 초기화 시 API를 확보한 뒤:
   - `setToolbarState({ enabled: true })` (툴바 표시 유지)
   - `setEnabled(false)` (초기 토글 OFF)
3. 결과적으로 **툴바는 보이되 기본 비활성 상태로 시작**

#### 사용 방법

1. `bun run dev` 실행
2. React Grab 툴바 토글을 ON으로 전환
3. 분석할 UI 요소를 가리킴
4. macOS는 `Cmd+C`, Windows/Linux는 `Ctrl+C`로 컨텍스트 복사
5. 복사된 내용을 Cursor/Claude Code/Copilot 프롬프트에 붙여넣어 활용

#### 점검 포인트

1. 툴바가 보이지 않으면 `VITE_DISABLE_REACT_GRAB` 확인
2. 복사가 안 되면 브라우저/페이지의 클립보드 권한 또는 단축키 충돌 여부 확인
3. React Scan/Grab을 동시에 켤 때는 먼저 Locator 점프가 필요한지 판단 후 최소 도구만 활성화하는 것을 권장

### 8.5 권장 운영 시나리오

1. 평소: Locator만 활용(Scan/Grab OFF 유지)
2. 성능 점검: React Scan만 ON
3. 에이전트 전달: React Grab만 ON
4. 점검 종료 후: Scan/Grab 다시 OFF

## 9. API 레퍼런스

### 9.1 인증

- `/api/health`를 제외한 API는 인증 필요
- 인증 방법:
  - `X-API-Key: <ANKI_SPLITTER_API_KEY>`
  - `Authorization: Bearer <ANKI_SPLITTER_API_KEY>`

### 9.2 공통

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 헬스 체크 |
| GET | `/api/privacy/status` | 프라이버시 모드/정책 조회 |

### 9.3 Deck / Card

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/decks` | 덱 목록 |
| GET | `/api/decks/:name/stats` | 덱 통계 |
| GET | `/api/cards/deck/:name` | 덱 카드 목록 |
| GET | `/api/cards/deck/:name/difficult` | 어려운 카드 목록 |
| GET | `/api/cards/:noteId` | 단일 카드 상세 |

### 9.4 Split / Backup / Media

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/split/preview` | 분할 미리보기 |
| POST | `/api/split/apply` | 분할 적용 |
| GET | `/api/backup` | 백업 목록 |
| GET | `/api/backup/latest` | 최신 백업 ID |
| POST | `/api/backup/:id/rollback` | 롤백 실행 |
| GET | `/api/media/:filename` | Anki 미디어 프록시 |

### 9.5 Validation

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/validate/fact-check` | 팩트 체크 |
| POST | `/api/validate/freshness` | 최신성 검사 |
| POST | `/api/validate/similarity` | 유사성 검사 |
| POST | `/api/validate/context` | 문맥 검사 |
| POST | `/api/validate/all` | 통합 검증 |

### 9.6 Embedding

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/embedding/generate` | 덱 임베딩 생성/갱신 |
| GET | `/api/embedding/status/:deckName` | 임베딩 캐시 상태 |
| DELETE | `/api/embedding/cache/:deckName` | 캐시 삭제 |
| POST | `/api/embedding/single` | 단일 텍스트 임베딩(디버그용) |

### 9.7 Prompt Ops

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/prompts/versions` | 프롬프트 버전 목록 |
| GET | `/api/prompts/versions/:id` | 버전 상세 |
| POST | `/api/prompts/versions` | 버전 생성 |
| PUT | `/api/prompts/versions/:id` | 버전 수정 |
| DELETE | `/api/prompts/versions/:id` | 버전 삭제 |
| POST | `/api/prompts/versions/:id/activate` | 버전 활성화 |
| GET | `/api/prompts/active` | 현재 활성 버전 조회 |
| GET | `/api/prompts/history` | 분할 히스토리 조회 |
| POST | `/api/prompts/history` | 분할 히스토리 추가 |
| GET | `/api/prompts/versions/:id/failure-patterns` | 실패 패턴 분석 |
| GET | `/api/prompts/experiments` | 실험 목록 |
| GET | `/api/prompts/experiments/:id` | 실험 상세 |
| POST | `/api/prompts/experiments` | 실험 생성 |
| POST | `/api/prompts/experiments/:id/complete` | 실험 완료 |

## 10. 품질 검증

루트 디렉터리에서 실행합니다.

```bash
# 빠른 검증 (PR 최소 기준)
bun run check:quick

# 전체 검증 (권장)
bun run check
```

세부 검증:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

CI에서는 `.github/workflows/ci.yml`의 `quality-gate`가 `bun run check`를 실행합니다.

## 11. 운영/트러블슈팅 체크

문제 발생 시 아래 순서 권장:

1. `bun run check:quick`
2. `bun run check`
3. `ANKI_SPLITTER_API_KEY` 및 API 헤더 확인
4. `ANKI_CONNECT_URL` 연결 확인
5. `ANKI_SPLITTER_PRIVACY_MODE` 확인 (`strict`이면 외부 AI 기능 차단)
6. `/api/privacy/status` 응답 점검

상세 트러블슈팅 문서: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

## 12. 참고 링크

### 12.1 내부 문서

- 아키텍처: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 기능 상세: [`docs/FEATURES.md`](docs/FEATURES.md)
- 트러블슈팅: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- 작업 로드맵: [`docs/TODO.md`](docs/TODO.md)

### 12.2 외부 레퍼런스

- Bun: <https://bun.sh/>
- Hono: <https://hono.dev/>
- React: <https://react.dev/>
- Vite: <https://vite.dev/>
- Tailwind CSS: <https://tailwindcss.com/>
- TanStack Query: <https://tanstack.com/query>
- Google Gemini API: <https://ai.google.dev/>
- Anki: <https://apps.ankiweb.net/>
- AnkiConnect: <https://ankiweb.net/shared/info/2055492159>
- LocatorJS: <https://github.com/infi-pc/locatorjs>
- LocatorJS React data-id 설치 가이드: <https://www.locatorjs.com/install/react-data-id?stack=Vite>
- React Scan: <https://github.com/aidenybai/react-scan>
- React Grab: <https://github.com/aidenybai/react-grab>

## 13. 라이선스

MIT
