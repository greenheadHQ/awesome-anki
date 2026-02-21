# API 서버 트러블슈팅

## API 응답 확인

```bash
# 덱 목록
curl -s http://localhost:3000/api/decks | python3 -m json.tool

# 카드 상세
curl -s http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool

# 임베딩 상태
curl -s "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool
```

## AnkiConnect 직접 테스트

```bash
curl -s $ANKI_CONNECT_URL -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```

## 타입체크

```bash
bun run --cwd packages/server tsc --noEmit
```

## 포트 충돌

```bash
lsof -ti:3000 | xargs kill -9
```

## EADDRINUSE: Bun --watch HMR 이중 바인딩

- **문제**: `export default { port, fetch }` 패턴 사용 시 Bun의 `--watch` HMR이 `server.reload()` 호출 후 `Bun.serve()`를 다시 호출하여 포트 이중 바인딩 발생
- **원인**: Bun이 `default export`에서 `fetch` 프로퍼티를 감지하면 자동으로 `Bun.serve()`를 호출하는데, HMR 리로드 시 기존 서버를 닫지 않고 새로 생성 시도
- **해결**: `export default` 제거, `globalThis`로 서버 인스턴스 직접 관리
  ```typescript
  declare global {
    var __ankiServer: ReturnType<typeof Bun.serve> | undefined;
  }
  if (globalThis.__ankiServer) {
    globalThis.__ankiServer.reload({ fetch: app.fetch });
  } else {
    globalThis.__ankiServer = Bun.serve({ port, fetch: app.fetch });
  }
  ```
- **핵심**: Hono `app` 객체도 `.fetch` 메서드가 있으므로 `export default app` 역시 같은 문제 유발 가능
