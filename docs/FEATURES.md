# Features

## 1. 핵심 기능 개요

| 영역 | 기능 | 설명 |
|------|------|------|
| Split | AI Split | LLM(Gemini/OpenAI) 기반 의미 분할 |
| Split | Preview + Apply | 분할 미리보기 후 명시적 적용 |
| Safety | Backup + Rollback | 분할 전 백업, 실패/수동 롤백 |
| Validation | Fact/Freshness/Context/Similarity | 카드 신뢰도 검증 |
| Prompt Ops | Prompt Version/History/Experiment | 원격 systemPrompt(CAS) + 버전 운영 + 실험 |
| Embedding | 캐시 기반 임베딩 생성 | 유사도 성능 향상 |
| Security | API 인증 | API Key 기반 접근 제어 |

## 2. Split 상세

### AI Split
- LLM(Gemini/OpenAI)을 사용해 비정형 텍스트를 의미 단위로 분할
- 웹 UI에서 프로바이더/모델 선택 가능
- 분석 전 비용 추정 + 예산 가드레일 (서버 사이드 상한)
- 분석 후 실측 비용/토큰 사용량 표시

### 모델 비교
- 동일 카드를 여러 모델로 분석 → 탭 전환으로 결과 비교
- 모델별 비용/시간/카드 수 비교
- 모델 뱃지로 프로바이더 시각 구분 (Gemini=파란, OpenAI=초록)

### Apply 안전장치
- 분할 적용 전 `preBackup`
- 적용 실패 시 자동 롤백
- 적용 성공 후 생성 노트 ID 백업 반영

## 3. Validation 상세

| 검증 | 목적 | 처리 방식 |
|------|------|----------|
| Fact Check | 사실 정확도 확인 | LLM 결과를 정확도 점수로 변환 |
| Freshness | 정보 최신성 확인 | outdated 항목과 심각도 분류 |
| Similarity | 중복 탐지 | Jaccard 기본 + 임베딩 옵션 |
| Context | 링크 카드 일관성 확인 | nid 링크 기반 관련 카드 비교 |

## 4. 백업/롤백 상세

- 백업 저장은 파일 단위 mutex로 직렬화된다.
- 손상 파일은 자동 격리하고 서비스는 계속 동작한다.
- 롤백은 원본 필드/태그를 복원하며, 생성된 노트를 삭제한다.
- 롤백 응답에는 복원 필드/태그 개수 및 경고 메시지가 포함된다.

## 5. 보안 기능

### API 인증
- 서버는 `/api/health` 외 요청에 API Key를 요구한다.
- 웹은 브라우저 번들에 키를 넣지 않고, 개발 시 Vite 프록시가 `ANKI_SPLITTER_API_KEY`를 서버 사이드에서 헤더 주입한다.

## 6. 프롬프트 SoT 정책

- systemPrompt는 `awesomeAnki.prompts.system` 원격 config를 SoT로 사용한다.
- 저장 API는 `expectedRevision` CAS를 강제하고, 충돌 시 `409` + 최신 원격값을 반환한다.
- systemPrompt 수정은 기존 버전 덮어쓰기가 아니라 새 버전 생성 + active 전환으로 처리한다.
- 저장 후 즉시 Anki sync를 수행하며, sync 실패 시 저장 요청은 실패 처리된다.

## 7. UI 주요 페이지

| 페이지 | 경로 | 목적 |
|--------|------|------|
| Dashboard | `/` | 덱/통계/빠른 작업 |
| Split Workspace | `/split` | 후보 선택, 분할 미리보기, 적용 |
| Card Browser | `/browse` | 카드 탐색 및 검증 |
| Backup Manager | `/backups` | 백업 조회, 롤백 실행 |
| Prompt Manager | `/prompts` | 원격 systemPrompt 편집 + 버전/실험 |

## 8. 비기능 특성

- 품질 게이트: `bun run check:quick`, `bun run check`
- CI: GitHub Actions에서 동일 검증 수행
- Prompt system SoT는 원격 config, 로컬 파일은 legacy/migration 용도
