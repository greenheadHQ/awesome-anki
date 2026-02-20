---
name: developing-web-api
description: |
  This skill should be used when users request web API implementation or fixes.
  Triggers: "API 라우트 추가", "Hono 엔드포인트", "서버 에러",
  "REST API", "라우트 패턴", "API 응답 형식", "서버 포트".
  Covers the Hono REST API server, route patterns, and error handling.
---

# 웹 API 개발

## 서버 구조

```
packages/server/src/
├── index.ts       # 서버 진입점 (localhost:3000)
└── routes/
    ├── decks.ts      # 덱 관련
    ├── cards.ts      # 카드 관련
    ├── split.ts      # 분할
    ├── backup.ts     # 백업/롤백
    ├── validate.ts   # 검증 4종
    ├── embedding.ts  # 임베딩
    └── prompts.ts    # 프롬프트 버전 관리
```

## 전체 엔드포인트 목록

### Decks & Cards
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/decks | 덱 목록 |
| GET | /api/decks/:name/stats | 덱 통계 (분할 후보 수, 임베딩 커버리지) |
| GET | /api/cards/deck/:name | 카드 목록 (페이지네이션, 필터) |
| GET | /api/cards/:noteId | 카드 상세 |

### Split & Backup
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/split/preview | 분할 미리보기 |
| POST | /api/split/apply | 분할 적용 |
| GET | /api/backup | 백업 목록 |
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

### Prompts — `managing-prompts` 스킬 참조
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/prompts/versions | 버전 목록/생성 |
| GET/PUT/DELETE | /api/prompts/versions/:id | 버전 CRUD |
| POST | /api/prompts/versions/:id/activate | 활성화 |
| GET | /api/prompts/active | 현재 활성 버전 |
| GET/POST | /api/prompts/history | 히스토리 |
| GET | /api/prompts/versions/:id/failure-patterns | 실패 패턴 |
| GET/POST | /api/prompts/experiments | A/B 테스트 |
| POST | /api/prompts/experiments/:id/complete | 실험 완료 |

## 라우트 추가 패턴

```typescript
// packages/server/src/routes/new-route.ts
import { Hono } from 'hono';
const app = new Hono();

app.get('/api/new-endpoint', async (c) => {
  const result = await someOperation();
  return c.json(result);
});

export default app;

// packages/server/src/index.ts에 등록
import newRoute from './routes/new-route.js';
app.route('/', newRoute);
```

## 주의사항

- 카드 목록 API에서 텍스트 200자 제한 (성능) → 상세 조회 별도 필요
- `c.json(result)` 형식으로 응답 반환
- 에러 핸들링 통일 필요 (기술 부채)

## 디버깅

```bash
curl -s http://localhost:3000/api/decks | python3 -m json.tool
curl -s http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool
```

## 상세 참조

- `references/route-patterns.md` — 전체 라우트 패턴, 요청/응답 예시
- `references/error-handling.md` — Hono 에러 핸들러
- `references/troubleshooting.md` — API 디버깅 팁
