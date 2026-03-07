# AnkiConnect 트러블슈팅

## 연결 실패 (AnkiConnectError)

**증상**: `AnkiConnect에 연결할 수 없습니다` 에러 (502)

**확인 사항**:
1. Anki가 실행 중인지 확인
2. AnkiConnect 애드온 활성화 확인 (도구 > 부가기능 > 2055492159)
3. 포트 8765가 열려 있는지 확인: `lsof -i:8765`

```bash
# 연결 테스트
curl -s $ANKI_CONNECT_URL -X POST -d '{"action":"version","version":6}'
```

## 응답 시간 초과 (TimeoutError)

**증상**: `AnkiConnect 응답 시간 초과 (5000ms)` 에러 (504)

**원인**: Anki가 큰 작업 수행 중이거나 응답 불능 상태

**해결**:
1. Anki UI 확인 -- 동기화 중이거나 다이얼로그가 열려 있지 않은지
2. 배치 작업의 경우 `{ timeout: 30000 }` 옵션으로 타임아웃 증가
3. Anki 재시작 후 재시도

## 프로필 안전

**규칙**: 반드시 `test` 프로필에서만 작업

```bash
# 올바른 실행 방법
open -a Anki --args -p test
```

**위험**: 기본 프로필에서 작업하면 실제 학습 데이터 손상 가능

## cardsInfo vs notesInfo 혼동

- `notesInfo`: 노트 필드, 태그, 모델 정보
- `cardsInfo`: 카드 학습 데이터 (interval, factor, due, reps, lapses)
- 학습 데이터 조회 시 반드시 `cardsInfo` 사용

## 커스텀 Config 액션 에러 (getConfig/setConfig)

**증상**: `AnkiConnect 커스텀 액션 "getConfig"을 사용할 수 없습니다` 에러 (502, code: `UNSUPPORTED_REMOTE_CONFIG_ACTION`)

**원인**: miniPC Anki 서버에 getConfig/setConfig 커스텀 확장이 미설치

**`mapUnsupportedConfigActionError()` 감지 패턴**:
- `"unsupported action"`
- `"unknown action"`
- `"action not found"`
- 에러 메시지가 bare action name과 일치 (예: `"AnkiConnect error: getConfig"`)

**해결**:
1. miniPC Anki 서버에 커스텀 AnkiConnect 확장이 설치되어 있는지 확인
2. AnkiConnect 플러그인이 최신 버전인지 확인
3. 확장이 없으면 해당 기능 사용 불가 -- 대안 경로 필요

**코드 경로**: `packages/core/src/anki/client.ts` -- `getConfig()`, `setConfig()` 내부에서 `mapUnsupportedConfigActionError()`를 호출하여 에러를 래핑한다.
