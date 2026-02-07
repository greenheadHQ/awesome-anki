# API 에러 핸들링

## 현재 상태

에러 핸들링이 통일되지 않음 (기술 부채로 추적 중).

## 일반 패턴

```typescript
app.post('/api/resource', async (c) => {
  try {
    const result = await operation();
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});
```

## AnkiConnect 에러

AnkiConnect API가 에러를 반환할 때:
```typescript
const result = await ankiConnect('action', params);
// result가 null이거나 에러 포함 시 처리
```

## Gemini API 에러

- API 키 미설정: `.env`에 `GEMINI_API_KEY` 확인
- 요청 제한: API quota 초과 시 재시도 로직 필요 (미구현)
