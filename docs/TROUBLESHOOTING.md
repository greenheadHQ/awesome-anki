# Troubleshooting

## 1. 기본 점검 순서

문제가 발생하면 아래 순서로 확인한다.

1. `bun run check:quick`
2. `bun run check`
3. 서버/웹/AnkiConnect 실행 상태 확인
4. `.env`의 API 키/인증 키 확인

---

## 2. 자주 발생하는 문제

### 2.1 `GEMINI_API_KEY가 설정되지 않았습니다`

원인:
- `.env`에 `GEMINI_API_KEY`가 없음
- 쉘 환경에 키가 주입되지 않음

해결:
1. `.env`에 `GEMINI_API_KEY` 설정
2. 서버 재시작

---

### 2.2 API 401 Unauthorized

원인:
- 서버 `ANKI_SPLITTER_API_KEY` 값 불일치
- 개발 모드에서 Vite 프록시가 `X-API-Key`를 주입하지 못함

해결:
1. `.env`에 `ANKI_SPLITTER_API_KEY` 설정
2. `bun run dev`로 서버/웹 재시작 (루트 스크립트가 웹 dev 프로세스에 키 전달)
3. 필요 시 요청 헤더에 `X-API-Key` 또는 Bearer 포함 확인

---

### 2.3 API 503 (인증 설정 오류)

원인:
- 서버에 `ANKI_SPLITTER_API_KEY` 미설정

해결:
1. `ANKI_SPLITTER_API_KEY` 설정

---

### 2.4 AnkiConnect 연결 실패

원인:
- Anki 미실행
- AnkiConnect 애드온 비활성/포트 불일치

해결:
1. Anki 실행
2. AnkiConnect 설치/활성 확인
3. `ANKI_CONNECT_URL` 확인 (`.envrc`에서 MiniPC Tailscale 주소로 설정)

---

### 2.5 롤백 실패 또는 일부 복원 경고

원인:
- 백업 ID 없음/이미 롤백됨
- Anki 노트 상태 불일치

해결:
1. Backup Manager에서 최신 백업 목록 재조회
2. 롤백 응답의 `warning`, `restoredFieldNames`, `restoredTags` 확인
3. 스케줄링 메타데이터는 자동 복원 대상이 아님에 유의

---

### 2.6 백업 파일 손상 메시지

증상:
- `손상된 백업 파일을 격리했습니다: ...corrupt-...`

의미:
- JSON 파싱 실패 파일을 자동 격리했고, 시스템은 정상 동작을 계속한다.

조치:
1. `output/backups/*.corrupt-*` 파일 보관(원인 분석용)
2. 필요 시 수동 복구
3. 반복 발생 시 디스크/프로세스 강제 종료 이력 점검

---

### 2.7 빌드/타입 검사는 통과하는데 런타임에서 실패

원인:
- 환경변수/외부 의존(AnkiConnect, Gemini) 미준비

해결:
1. `bun run check`로 정적 검증 통과 확인
2. `bun run dev` 후 실제 API 호출 점검
3. `bun run cli:status`로 Anki 연결 상태 확인

---

## 3. 운영 체크리스트

- `.env` 필수 값이 설정되어 있는가?
- API 키가 일치하는가?
- AnkiConnect가 응답하는가?
- `bun run check`가 통과하는가?
