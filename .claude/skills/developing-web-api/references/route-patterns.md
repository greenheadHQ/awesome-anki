# API 라우트 패턴

## 라우트 등록 방식

라우트 파일 내부에서는 prefix 없이 상대 경로로 정의하고, `index.ts`에서 `app.route(prefix, router)` 형태로 등록한다.

```typescript
// packages/server/src/index.ts
import { AppError } from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

// Routes -- prefix 기반 등록
app.route("/api/decks", decks);
app.route("/api/cards", cards);
app.route("/api/split", split);
app.route("/api/backup", backup);
app.route("/api/media", media);
app.route("/api/clinic", clinic);
app.route("/api/llm", llm);
app.route("/api/embedding", embedding);
app.route("/api/prompts", prompts);
app.route("/api/history", history);

// /api/health는 별도로 직접 정의 (인증 면제)
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.onError((err, c) => {
  if (err instanceof AppError) {
    console.error(`[${err.statusCode}] ${err.name}:`, err.message);
    return c.json({ error: err.message }, err.statusCode as 400 | 404 | 500 | 502 | 504);
  }
  console.error("Unhandled server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// 서버 시작 -- globalThis로 HMR 이중 바인딩 방지
if (globalThis.__ankiServer) {
  globalThis.__ankiServer.reload({ fetch: app.fetch });
} else {
  globalThis.__ankiServer = Bun.serve({ port, fetch: app.fetch });
}
```

## 새 라우트 추가 패턴

```typescript
// packages/server/src/routes/new-route.ts
import { NotFoundError, ValidationError } from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

// prefix 없이 정의 -- index.ts에서 app.route("/api/new-route", app)로 등록
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const resource = await findResource(id);

  if (!resource) {
    throw new NotFoundError(`리소스 ${id}를 찾을 수 없습니다`);
  }

  return c.json(resource);
});

app.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.name) {
    throw new ValidationError("name이 필요합니다");
  }

  const result = await create(body);
  return c.json(result, 201);
});

export default app;
```

## 주요 패턴

### 페이지네이션 (page 기반)

카드 목록은 **page 기반** 페이지네이션을 사용한다. 기본 limit은 **20**.

```typescript
// packages/server/src/routes/cards.ts
app.get("/deck/:name", async (c) => {
  const deckName = decodeURIComponent(c.req.param("name"));
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const filter = c.req.query("filter") || "all";

  // ...분석 + 필터 적용...

  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return c.json({
    cards: paginated,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit),
  });
});
```

응답 형태:
```json
{
  "cards": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### 텍스트 말줄임 (성능)

카드 목록 API에서 텍스트 200자 제한:
```typescript
text: text.slice(0, 200) + (text.length > 200 ? "..." : "")
```
-> 상세 조회는 별도 `GET /api/cards/:noteId` 사용

### 분할 반려

```typescript
// POST /api/split/reject
// Body: { sessionId: string, rejectionReason: string }
// 둘 다 필수. 히스토리에 rejected 상태 기록 + 프롬프트 메트릭에 rejected 이벤트 기록
```

### 캐시 무효화 주의

분할 적용 후 클라이언트에서 캐시 무효화 필수:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
