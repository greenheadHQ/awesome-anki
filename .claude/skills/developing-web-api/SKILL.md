---
name: developing-web-api
description: |
  Hono REST API 서버의 라우트 추가, 수정, 에러 핸들링, 인증 미들웨어 등
  API 서버 관련 작업이면 반드시 이 스킬을 먼저 확인할 것.
  Triggers: "API 라우트 추가", "Hono 엔드포인트", "서버 에러",
  "REST API", "라우트 패턴", "API 응답 형식", "서버 포트",
  "API 인증", "API key", "CORS", "미들웨어", "health check",
  "split reject", "split 반려", "백업 API", "프롬프트 API",
  "시스템 프롬프트 API", "서버 구조", "라우트 등록".
  Covers the Hono REST API server, route patterns, authentication,
  error handling, and all API endpoints.
---

# 웹 API 개발

## 서버 구조

```
packages/server/src/
├── index.ts              # 서버 진입점 (localhost:3000), 미들웨어, 인증
├── history-sync.ts       # 히스토리 동기화 진입점
├── history/
│   ├── store.ts          # 분할 히스토리 SQLite 저장소
│   ├── store.test.ts     # store 단위 테스트
│   ├── sync.ts           # 히스토리 동기화 로직
│   └── types.ts          # 히스토리 타입 정의
├── lib/
│   └── resolve-model.ts  # provider+model 유효성 검증 및 해석
└── routes/
    ├── decks.ts          # 덱 관련
    ├── cards.ts          # 카드 관련
    ├── split.ts          # 분할 (preview/apply/reject)
    ├── backup.ts         # 백업/롤백
    ├── media.ts          # Anki 미디어 프록시
    ├── validate.ts       # 검증 4종
    ├── llm.ts            # LLM 모델/프로바이더 정보
    ├── embedding.ts      # 임베딩
    ├── prompts.ts        # 프롬프트 버전 관리 + systemPrompt CAS
    └── history.ts        # 분할 히스토리
```

## API 인증 미들웨어

모든 `/api/*` 요청은 인증 미들웨어를 거친다. `/api/health`만 면제.

### 인증 방식 (2가지)

1. **X-API-Key 헤더**: `X-API-Key: <key>`
2. **Bearer 토큰**: `Authorization: Bearer <key>`

둘 다 전달되면 `X-API-Key`가 우선. **timing-safe 비교**로 타이밍 공격 방지.

### 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `ANKI_SPLITTER_API_KEY` | API 키 값 | (없으면 503) |
| `ANKI_SPLITTER_REQUIRE_API_KEY` | 인증 강제 여부 | `"true"` |

- `REQUIRE_API_KEY=true` + `API_KEY` 미설정 -> 모든 API 503 반환 (`/api/health` 제외)
- `REQUIRE_API_KEY=false` -> 인증 비활성화 (Tailscale 등 격리 환경 전용)

### CORS

`CORS_ORIGINS` 환경변수로 허용 origin 제어. 기본: `http://localhost:5173`, `http://127.0.0.1:5173`.
쉼표 구분. 허용 헤더: `Content-Type`, `X-API-Key`, `Authorization`.

## 전체 엔드포인트 목록

### Health
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/health | 헬스 체크. 인증 면제. `{ status: "ok", timestamp }` 반환 |

### Decks & Cards
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/decks | 덱 목록 |
| GET | /api/decks/:name/stats | 덱 통계 (분할 후보 수, 임베딩 커버리지) |
| GET | /api/cards/deck/:name | 카드 목록 (page 기반 페이지네이션, filter) |
| GET | /api/cards/deck/:name/difficult | 학습 데이터 기반 어려운 카드 조회 |
| GET | /api/cards/:noteId | 카드 상세 |

### Split & Backup
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/split/preview | 분할 미리보기 (AI 호출, 비용 가드레일) |
| POST | /api/split/apply | 분할 적용 (자동 백업 + 자동 롤백) |
| POST | /api/split/reject | 분할 반려 (rejectionReason 필수, 프롬프트 메트릭 기록) |
| GET | /api/backup | 백업 목록 |
| GET | /api/backup/latest | 최근 백업 ID 조회 |
| POST | /api/backup/:id/rollback | 롤백 |

### Validate
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/validate/fact-check | 팩트 체크 |
| POST | /api/validate/freshness | 최신성 검사 |
| POST | /api/validate/similarity | 유사성 검사 (useEmbedding 옵션) |
| POST | /api/validate/context | 문맥 일관성 검사 |
| POST | /api/validate/all | 전체 검증 (병렬) |

### Embedding
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/embedding/generate | 덱 전체 임베딩 생성 |
| GET | /api/embedding/status/:deckName | 캐시 상태 |
| DELETE | /api/embedding/cache/:deckName | 캐시 삭제 |
| POST | /api/embedding/single | 단일 텍스트 임베딩 (디버깅) |

### LLM
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/llm/models | 사용 가능한 프로바이더/모델 목록, 가격 정보, 기본 모델, 서버 예산 캡 |

### History
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/history | 분할 히스토리 목록 (페이지네이션, 필터: deckName, status, startDate, endDate) |
| GET | /api/history/sync/health | 히스토리 동기화 상태 |
| GET | /api/history/:sessionId | 세션 상세 조회 |

### Media
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/media/:filename | Anki 미디어 파일 프록시 (Base64 디코딩, MIME 자동 감지, 24시간 캐시) |

### Prompts -- `managing-prompts` 스킬 참조
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/prompts/system | 원격 systemPrompt 조회 |
| POST | /api/prompts/system | CAS 기반 systemPrompt 저장 (expectedRevision + reason 필수) |
| GET/POST | /api/prompts/versions | 버전 목록/생성 |
| GET/PUT/DELETE | /api/prompts/versions/:id | 버전 CRUD |
| POST | /api/prompts/versions/:id/activate | 활성화 |
| GET | /api/prompts/active | 현재 활성 버전 |
| GET/POST | /api/prompts/history | 히스토리 |
| GET | /api/prompts/versions/:id/failure-patterns | 실패 패턴 |
| GET/POST | /api/prompts/experiments | A/B 테스트 목록/생성 |
| GET | /api/prompts/experiments/:id | 실험 상세 조회 |
| POST | /api/prompts/experiments/:id/complete | 실험 완료 |

## 라우트 추가 패턴

라우트 파일은 prefix 없이 상대 경로로 정의하고, `index.ts`에서 prefix를 부여하는 패턴을 사용한다.

```typescript
// packages/server/src/routes/new-route.ts
// 라우트 내부에서는 prefix 없이 정의
import { NotFoundError, ValidationError } from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const resource = await findResource(id);
  if (!resource) throw new NotFoundError(`리소스 ${id}를 찾을 수 없습니다`);
  return c.json(resource);
});

export default app;

// packages/server/src/index.ts에서 prefix 부여하여 등록
import newRoute from './routes/new-route.js';
app.route('/api/new-route', newRoute);
// -> GET /api/new-route/:id 로 접근 가능
```

## 주의사항

- 카드 목록 API에서 텍스트 200자 제한 (성능) -> 상세 조회 별도 필요
- `c.json(result)` 형식으로 응답 반환
- 에러는 throw -> 글로벌 `app.onError` 핸들러가 중앙 처리 (try/catch 불필요)
- `PUT /api/prompts/versions/:id`에서 `systemPrompt` 필드 수정 차단 -> `/api/prompts/system` 전용

## 디버깅

```bash
# 헬스 체크 (인증 불필요)
curl -s http://localhost:3000/api/health | python3 -m json.tool

# 인증이 필요한 엔드포인트
curl -s -H "X-API-Key: $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/decks | python3 -m json.tool
curl -s -H "Authorization: Bearer $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool
```

## 상세 참조

- `references/route-patterns.md` -- 전체 라우트 패턴, 요청/응답 예시
- `references/error-handling.md` -- Hono 에러 핸들러, 에러 클래스
- `references/troubleshooting.md` -- API 디버깅 팁, 인증 문제 해결
