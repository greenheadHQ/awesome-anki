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
curl -s http://localhost:8765 -X POST -d '{
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
