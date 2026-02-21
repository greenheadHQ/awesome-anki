# Awesome Anki

<img width="1719" height="983" alt="example" src="https://github.com/user-attachments/assets/6af494b7-0395-43d7-a41c-9a614c251047" />

Anki 카드를 원자적 단위로 분할하는 웹 애플리케이션. 정보 밀도가 높은 카드를 학습 효율이 좋은 작은 카드들로 자동 분리합니다.

## 주요 기능

### 카드 분할
- **Hard Split**: `####` 헤더 기반 정규식 분할 (빠르고 정확)
- **Soft Split**: Gemini AI 기반 의미 분석 분할 (복잡한 카드 처리)
- **nid 승계**: 원본 카드 ID 유지 + 역링크 자동 생성
- **학습 데이터 복제**: ease factor 복제로 학습 진도 보존

### 카드 검증
- **팩트 체크**: Gemini AI 기반 내용 정확성 검사
- **최신성 검사**: 기술 정보 최신성 확인
- **유사성 검사**: Jaccard + Gemini 임베딩 기반 중복 탐지
- **문맥 일관성**: nid 링크로 연결된 카드 간 논리 검증

### 기타
- **백업/롤백**: 분할 전 자동 백업 + 원클릭 롤백
- **도움말 시스템**: HelpTooltip + 온보딩 투어
- **실시간 미리보기**: Markdown + KaTeX + Cloze 렌더링

## 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | Bun |
| 언어 | TypeScript |
| LLM | Gemini 3 Flash Preview |
| 백엔드 | Hono (REST API) |
| 프론트엔드 | React + Vite |
| 스타일링 | Tailwind CSS v4 |
| 상태 관리 | TanStack Query |
| 렌더링 | markdown-it + KaTeX |

## 설치

### 사전 요구사항
- [Bun](https://bun.sh/) 설치
- [Anki](https://apps.ankiweb.net/) + [AnkiConnect](https://ankiweb.net/shared/info/2055492159) 애드온

### 설치 방법

```bash
# 저장소 클론
git clone https://github.com/your-username/anki-claude-code.git
cd anki-claude-code

# 의존성 설치
bun install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 GEMINI_API_KEY, ANKI_SPLITTER_API_KEY, ANKI_SPLITTER_PRIVACY_MODE 설정
```

## 실행

### 웹 GUI (권장)

```bash
# 개발 서버 (서버 + 클라이언트 동시 실행)
bun run dev

# 서버만 (localhost:3000)
bun run dev:server

# 클라이언트만 (localhost:5173)
bun run dev:web
```

### CLI

```bash
# 연결 확인
bun run cli:status

# 분할 미리보기
bun run cli:split

# 분할 적용
bun run cli:split -- --apply

# 특정 카드 분할
bun run cli split --note <noteId>

# 백업/롤백
bun run cli backups
bun run cli rollback <backupId>
```

## 개발 품질 검증

모든 검증은 **루트 디렉터리에서 실행**합니다. 기본 루틴은 아래 두 명령입니다.

```bash
# 빠른 검증 (PR 전 최소 권장)
bun run check:quick

# 전체 검증 (릴리스 전 권장)
bun run check
```

GitHub Pull Request에서도 동일한 검증이 `.github/workflows/ci.yml`의 `quality-gate` 잡으로 자동 실행됩니다.

### 검증 명령 구성

| 명령 | 범위 | 설명 |
|------|------|------|
| `bun run lint` | root + core + server + web | 코드 스타일/정적 규칙 점검 |
| `bun run typecheck` | root + core + server + web | TypeScript 타입 검사 |
| `bun run test` | core + server + web | Bun 테스트 실행 (테스트 없는 패키지는 스캔만 수행) |
| `bun run build` | core + server + web | 패키지 빌드 산출 가능성 검증 |
| `bun run check:quick` | lint + typecheck | 개발 중 반복 실행용 |
| `bun run check` (`check:full`) | lint + typecheck + test + build | 머지/릴리스 전 최종 검증용 |

### 패키지 단독 검증

```bash
bun run --cwd packages/core typecheck
bun run --cwd packages/server typecheck
bun run --cwd packages/web typecheck
```

## 프로젝트 구조

```
anki-claude-code/
├── packages/
│   ├── core/                 # 핵심 로직 (CLI + 웹 공용)
│   │   └── src/
│   │       ├── anki/         # AnkiConnect API 래퍼
│   │       ├── gemini/       # Gemini API 호출 (분할)
│   │       ├── embedding/    # Gemini 임베딩 (유사도)
│   │       ├── parser/       # 텍스트 파싱
│   │       ├── splitter/     # 분할 로직
│   │       ├── validator/    # 카드 검증
│   │       └── utils/        # 유틸리티
│   │
│   ├── server/               # Hono REST API
│   │   └── src/
│   │       ├── index.ts      # 서버 진입점 (localhost:3000)
│   │       └── routes/       # API 라우트
│   │
│   └── web/                  # React 프론트엔드
│       └── src/
│           ├── pages/        # Dashboard, CardBrowser, SplitWorkspace
│           ├── components/   # UI 컴포넌트
│           └── hooks/        # TanStack Query 훅
│
├── src/                      # CLI 진입점
├── output/backups/           # 분할 백업 저장소
├── output/embeddings/        # 임베딩 캐시 파일
└── docs/                     # 문서
    ├── TODO.md               # 진행 상황
    ├── FEATURES.md           # 기능 상세
    └── TROUBLESHOOTING.md    # 문제 해결
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/decks | 덱 목록 |
| GET | /api/decks/:name/stats | 덱 통계 |
| GET | /api/cards/deck/:name | 카드 목록 |
| GET | /api/cards/:noteId | 카드 상세 |
| POST | /api/split/preview | 분할 미리보기 |
| POST | /api/split/apply | 분할 적용 |
| GET | /api/backup | 백업 목록 |
| POST | /api/backup/:id/rollback | 롤백 |
| POST | /api/validate/fact-check | 팩트 체크 |
| POST | /api/validate/freshness | 최신성 검사 |
| POST | /api/validate/similarity | 유사성 검사 |
| POST | /api/validate/context | 문맥 일관성 검사 |
| POST | /api/embedding/generate | 덱 임베딩 생성 |
| GET | /api/privacy/status | 프라이버시 모드/정책 조회 |

## 주의사항

- **Anki 프로필**: 반드시 `test` 프로필에서 작업 (`open -a Anki --args -p test`)
- **AnkiConnect**: `ANKI_CONNECT_URL`에 설정된 주소에서 실행 중이어야 함 (MiniPC headless Anki)
- **API 키**: Soft Split, 검증 기능 사용 시 `GEMINI_API_KEY` 필요
- **API 인증**: 서버는 `ANKI_SPLITTER_API_KEY`가 필요합니다.
- **웹 개발 모드**: 브라우저 번들에는 API 키를 넣지 않고, Vite 프록시(`vite dev`에서만 동작)가 `ANKI_SPLITTER_API_KEY`를 서버 사이드에서 `X-API-Key`로 주입합니다.
- **원격 API 연결**: `VITE_API_URL`을 외부 주소로 지정할 경우, API Key 주입은 리버스 프록시/게이트웨이에서 처리해야 합니다.
- **개발 DX 도구**: `vite dev`에서 LocatorJS + React Scan + React Grab가 기본 활성화됩니다(프로덕션 빌드 미포함).

### 웹 개발 DX 도구

- **LocatorJS**: Option + Click으로 컴포넌트 소스 파일을 에디터에서 엽니다.
- **LocatorJS 소스 매핑**: Vite Babel 체인에 `@locator/babel-jsx`를 연결해 data-id 기반 소스 위치 정보를 주입합니다.
- **React Scan**: 렌더링 병목을 시각화하는 툴바를 표시합니다.
- **React Grab**: 요소를 가리킨 뒤 `Cmd+C`/`Ctrl+C`로 에이전트용 컨텍스트를 복사합니다.
- **기본 에디터 타겟**: `VITE_LOCATOR_TARGET=cursor` (`vscode`로 전환 가능)
- **도구별 비활성화**:
  - `VITE_DISABLE_LOCATOR=true`
  - `VITE_DISABLE_REACT_SCAN=true`
  - `VITE_DISABLE_REACT_GRAB=true`

## 프라이버시 모드

`ANKI_SPLITTER_PRIVACY_MODE`로 외부 전송 정책을 제어합니다.

| 모드 | split(Gemini) | validation(Gemini) | embedding(Gemini) | 기본 마스킹 |
|------|---------------|--------------------|-------------------|------------|
| `standard` | 허용 | 허용 | 허용 | 비활성 |
| `balanced` | 허용 | 허용 | 허용 | 활성 |
| `strict` | 차단 | 차단 | 차단 | 활성 |

### 외부 전송 데이터 정책

| 기능 | 전송 대상 데이터 | 기본 길이 제한 | 마스킹 대상 |
|------|------------------|---------------|------------|
| Split(soft) | 카드 본문, 태그(프롬프트 입력) | `6000`자 (`balanced`) | 이메일/전화/URL/긴 숫자 ID |
| Validation | 카드 본문(정규화 텍스트) | `4000`자 (`balanced`) | 이메일/전화/URL/긴 숫자 ID |
| Embedding | 전처리된 카드 텍스트 | `2000`자 (`balanced`) | 이메일/전화/URL/긴 숫자 ID |

길이 제한은 아래 환경 변수로 조정할 수 있습니다.

- `ANKI_SPLITTER_PRIVACY_SPLIT_MAX_CHARS`
- `ANKI_SPLITTER_PRIVACY_VALIDATION_MAX_CHARS`
- `ANKI_SPLITTER_PRIVACY_EMBEDDING_MAX_CHARS`

## 문서

- [TODO.md](docs/TODO.md) - 진행 상황 및 다음 작업
- [FEATURES.md](docs/FEATURES.md) - 기능 및 기술 상세
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - 문제 해결 기록

## 라이선스

MIT
