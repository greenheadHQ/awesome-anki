# 임베딩 트러블슈팅

## OPENAI_API_KEY 미설정

- **에러**: `OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.`
- **원인**: `openai` 패키지가 API 키 없이 초기화 시도
- **해결**: `.env` 파일에 `OPENAI_API_KEY=sk-...` 추가. agenix로 관리하는 경우 `secrets/*.age`에서 자동 복호화됨.
- **참고**: 임베딩은 LLM 추상화(`ANKI_SPLITTER_DEFAULT_LLM_PROVIDER`)와 독립적이므로, Gemini를 기본 LLM으로 사용하더라도 임베딩용 `OPENAI_API_KEY`는 따로 필요하다.

## Rate Limit 429

- **에러**: OpenAI API에서 429 (Too Many Requests) 응답
- **자동 대응**:
  - `client.ts`: 재시도 최대 2회 (`EMBEDDING_MAX_ATTEMPTS`), 350ms 대기
  - `client.ts` 배치 처리: 배치 간 350ms 딜레이 (`EMBEDDING_BATCH_DELAY_MS`)
  - 서버 라우트 (`/api/embedding/generate`): 10건마다 400ms 딜레이
- **수동 대응**: 대량 임베딩 생성 시 `forceRegenerate: false`로 증분 업데이트 활용

## 캐시 마이그레이션 (Gemini → OpenAI)

- **상황**: 기존에 Gemini(`gemini-embedding-001`, 768차원)로 생성한 캐시가 남아 있음
- **자동 감지**: `getCacheIncompatibilityReason(cache)` → `"provider_mismatch"` 또는 `"model_mismatch"` 반환
- **자동 처리**: 불일치 감지 시 기존 캐시를 버리고 새 OpenAI 캐시 생성
  - 서버 라우트(`/api/embedding/generate`): 응답의 `cache.migration.reason`에 사유 포함
  - 유사성 검사기(`similarity-checker.ts`): 자동으로 새 캐시 생성 후 임베딩 재생성
- **레거시 상수**: `LEGACY_EMBEDDING_PROVIDER = "gemini"`, `LEGACY_EMBEDDING_MODEL = "gemini-embedding-001"` — 파싱 시 기본값으로 사용

## 차원 불일치 (레거시 768 vs 현재 3072)

- **문제**: 레거시 Gemini 캐시는 768차원 벡터, 현재 OpenAI는 3072차원 벡터 → 코사인 유사도 계산 시 차원 불일치 에러
- **원인**: 캐시 호환성 검사 없이 직접 벡터를 비교하려 할 때 발생
- **해결**: 정상 흐름에서는 `getCacheIncompatibilityReason`이 provider/model 불일치를 먼저 감지하여 캐시를 재생성하므로, 이 에러는 발생하지 않는다. 수동으로 캐시를 조작한 경우에만 발생할 수 있다.

## 임베딩 캐시 위치 혼동

- 캐시 파일: `{EMBEDDING_CACHE_DIR}/{deckNameHash}.json`
- 기본 `EMBEDDING_CACHE_DIR`: `output/embeddings/`
- 덱 이름을 **MD5 해시 앞 12자**로 변환하여 파일명 생성
- 직접 확인:
  ```bash
  curl -s "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool
  ```
- 캐시 삭제:
  ```bash
  curl -X DELETE "http://localhost:3000/api/embedding/cache/덱이름"
  ```
