# 임베딩 트러블슈팅

## OPENAI_API_KEY 미설정

- **문제**: `OPENAI_API_KEY가 설정되지 않았습니다` 에러
- **해결**: `.env` 파일 또는 agenix 시크릿에 `OPENAI_API_KEY` 설정
  ```bash
  # .env에 직접 추가하거나
  export OPENAI_API_KEY=sk-...
  # agenix로 secrets/openai-api-key.age에서 자동 복호화
  ```

## 429 Rate Limit

- **문제**: OpenAI API rate limit 초과 시 `RATE_LIMITED` 에러
- **해결**:
  - 배치 생성 시 자동으로 10건마다 400ms 대기
  - `RATE_LIMIT_DELAY_MS` 상수로 조절 가능
  - 반복 실패 시 잠시 후 재시도

## 캐시 호환성 (레거시 Gemini → OpenAI 마이그레이션)

- **문제**: 기존 Gemini(gemini-embedding-001, 768차원) 캐시가 남아있어 `provider_mismatch` 또는 `schema_version_mismatch` 감지
- **해결**: 생성 엔드포인트가 비호환 캐시를 자동으로 새 캐시로 교체 (재생성)
  ```bash
  # 수동으로 캐시 삭제 후 재생성
  curl -X DELETE "http://localhost:3000/api/embedding/cache/덱이름"
  curl -X POST "http://localhost:3000/api/embedding/generate" \
    -H 'Content-Type: application/json' \
    -d '{"deckName":"덱이름"}'
  ```

## 임베딩 캐시 위치 혼동

- 캐시 파일: `output/embeddings/{deckNameHash}.json`
- 덱 이름을 **MD5 해시**로 변환하여 파일명 생성
- 직접 확인:
  ```bash
  curl -s "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool
  ```
