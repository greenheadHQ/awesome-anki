# API 서버 트러블슈팅

## API 키 인증 문제

### 503: Server API key is not configured

- **문제**: `ANKI_SPLITTER_API_KEY`가 설정되지 않은 상태에서 API 요청
- **증상**: `/api/health`를 제외한 모든 요청이 503 반환
- **해결**: 서버 시작 전 `ANKI_SPLITTER_API_KEY` 환경변수 설정
  ```bash
  # agenix로 자동 복호화되는 시크릿 확인
  echo $ANKI_SPLITTER_API_KEY
  ```
- **임시 우회**: `ANKI_SPLITTER_REQUIRE_API_KEY=false`로 인증 비활성화 (격리 환경 전용)

### 401: Unauthorized

- **문제**: API 키가 일치하지 않거나 헤더 형식 오류
- **확인**:
  ```bash
  # X-API-Key 헤더
  curl -s -H "X-API-Key: $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/decks

  # Bearer 토큰
  curl -s -H "Authorization: Bearer $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/decks
  ```
- **주의**: `Bearer` 뒤에 공백 1개 필수, 대소문자 무관 (`bearer`, `Bearer` 모두 허용)

## API 응답 확인

```bash
# 헬스 체크 (인증 불필요)
curl -s http://localhost:3000/api/health | python3 -m json.tool

# 인증이 필요한 엔드포인트
curl -s -H "X-API-Key: $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/decks | python3 -m json.tool

# 카드 상세
curl -s -H "X-API-Key: $ANKI_SPLITTER_API_KEY" http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool

# 임베딩 상태
curl -s -H "X-API-Key: $ANKI_SPLITTER_API_KEY" "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool
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
