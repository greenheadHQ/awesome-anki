# API 라우트 패턴

## 라우트 등록 방식

```typescript
// packages/server/src/index.ts
import { Hono } from 'hono';
import decks from './routes/decks.js';
import cards from './routes/cards.js';
// ...

const app = new Hono();
app.route('/', decks);
app.route('/', cards);
// ...
```

## 새 라우트 추가 패턴

```typescript
// packages/server/src/routes/new-route.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/resource', async (c) => {
  const result = await operation();
  return c.json(result);
});

app.post('/api/resource', async (c) => {
  const body = await c.req.json();
  const result = await create(body);
  return c.json(result, 201);
});

export default app;
```

## 주요 패턴

### 페이지네이션 (cards.ts)

```typescript
app.get('/api/cards/deck/:name', async (c) => {
  const deckName = decodeURIComponent(c.req.param('name'));
  const limit = Number(c.req.query('limit') || '50');
  const offset = Number(c.req.query('offset') || '0');
  // ...
});
```

### 텍스트 말줄임 (성능)

카드 목록 API에서 텍스트 200자 제한:
```typescript
text: text.slice(0, 200) + (text.length > 200 ? '...' : '')
```
→ 상세 조회는 별도 `GET /api/cards/:noteId` 사용

### 캐시 무효화 주의

분할 적용 후 클라이언트에서 캐시 무효화 필수:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```
