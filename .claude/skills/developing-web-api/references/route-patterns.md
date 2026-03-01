# API 라우트 패턴

## 라우트 등록 방식

```typescript
// packages/server/src/index.ts
import { AppError } from "@anki-splitter/core";
import { Hono } from "hono";

const app = new Hono();

// Routes
app.route("/api/decks", decks);
app.route("/api/cards", cards);
app.route("/api/split", split);
app.route("/api/backup", backup);
app.route("/api/media", media);
app.route("/api/validate", validate);
app.route("/api/llm", llm);
app.route("/api/embedding", embedding);
app.route("/api/prompts", prompts);
app.route("/api/history", history);

app.onError((err, c) => {
  if (err instanceof AppError) {
    console.error(`[${err.statusCode}] ${err.name}:`, err.message);
    return c.json({ error: err.message }, err.statusCode as 400 | 404 | 500 | 502 | 504);
  }
  console.error("Unhandled server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// 서버 시작 — globalThis로 HMR 이중 바인딩 방지
// ⚠️ export default { port, fetch } 패턴 사용 금지 (Bun HMR 버그)
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

// try/catch 없이 에러 throw → 글로벌 핸들러가 처리
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

### 페이지네이션 (cards.ts)

```typescript
app.get("/deck/:name", async (c) => {
  const deckName = decodeURIComponent(c.req.param("name"));
  const limit = Number(c.req.query("limit") || "50");
  const offset = Number(c.req.query("offset") || "0");
  // ...
});
```

### 텍스트 말줄임 (성능)

카드 목록 API에서 텍스트 200자 제한:
```typescript
text: text.slice(0, 200) + (text.length > 200 ? "..." : "")
```
→ 상세 조회는 별도 `GET /api/cards/:noteId` 사용

### 캐시 무효화 주의

분할 적용 후 클라이언트에서 캐시 무효화 필수:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
