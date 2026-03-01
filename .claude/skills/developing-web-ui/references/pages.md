# 웹 UI 페이지 상세

## 1. Dashboard (/)

- 덱 선택 `Select` (shadcn)
- 통계 카드: 총 노트, 분할 후보, 임베딩 커버리지
- 빠른 작업 버튼: Split, Browse, 임베딩 생성
- 페이지 타이틀/서브텍스트는 `typo-h1`, `typo-body` 토큰 사용

## 2. SplitWorkspace (/split)

### 3단 레이아웃

| 영역 | 비율 | 내용 |
|------|------|------|
| 왼쪽 | 3/12 | 분할 후보 목록 + Cloze 수 뱃지 |
| 중앙 | 5/12 | 원본 카드 (ContentRenderer + 검증 패널) |
| 오른쪽 | 4/12 | 분할 미리보기 + 적용 버튼 |

### 헤더 기능
- 덱 선택 `Select`
- **프롬프트 버전 선택 `Select`** (활성 버전 표시)
- **LLM 모델 선택** (프로바이더별 그룹 + `ModelBadge` 표시)
- 분할 후보 수 표시
- 페이지 타이틀/본문은 `typo-h1`, `typo-body` 토큰 사용

### 모바일 UX
- 탭(`후보 목록/원본/미리보기`) 전환 시 fade + slide 애니메이션 적용
- 상단 floating header 높이에 맞춰 컨텐츠 `pt` 조정

### 분할 미리보기 캐싱
- React Query 캐시 활용 (카드별 독립 캐시 키)
- "분석 요청" 버튼 클릭 시에만 API 호출

## 3. CardBrowser (/browse)

| 컬럼 | 설명 |
|------|------|
| 검증 | 상태 아이콘 (✅/⚠️/❌/❓) |
| Note ID | 노트 식별자 |
| 미리보기 | 카드 내용 요약 |
| Cloze | Cloze 개수 |
| 분할 | 분할 가능 여부 뱃지 |

필터 옵션: 전체, 분할 가능, 미검증, 검토 필요 (`Select`)
카드 목록은 shadcn `Table` 사용
- 페이지 타이틀/본문은 `typo-h1`, `typo-body` 토큰 사용

## 4. BackupManager (/backups)

- 백업 목록 카드 UI (시간, 원본 noteId, 생성된 카드 수)
- 롤백 버튼 + 확인/결과 `Dialog` (shadcn)
- 롤백 성공/실패 피드백
- 페이지 타이틀/본문은 `typo-h1`, `typo-body` 토큰 사용

## 5. PromptManager (/prompts)

| 탭 | 기능 |
|------|------|
| 버전 | 버전 목록, 상세 보기, 활성화 |
| 히스토리 | 분할 히스토리 테이블 |
| 실험 | A/B 테스트 목록, 생성 |
| 메트릭 | 전체 통계, 버전별 성능 비교 |

- 히스토리/메트릭 표는 shadcn `Table` 사용
- 페이지 타이틀/본문은 `typo-h1`, `typo-body` 토큰 사용

### 모바일 UX
- 탭(`버전/히스토리/실험/메트릭`) 전환 시 fade + slide 애니메이션 적용

## 6. SplitHistory (/history)

- 분할 히스토리 목록 (필터: 덱, 상태, 날짜 범위)
- 상태 필터: generating, generated, applied, rejected, error, not_split
- 세션 상세 보기: 원본 카드, AI 분할 결과, 비용 정보
- `ModelBadge`로 사용된 LLM 프로바이더/모델 표시
- `formatCostUsd`로 비용 표시
- 쿼리 훅: `useHistoryList`, `useHistoryDetail`, `useHistorySyncHealth`
- 쿼리 키: `queryKeys.history.list(opts)`, `queryKeys.history.detail(sessionId)`, `queryKeys.history.syncHealth`
- 페이지 타이틀/본문은 `typo-h1`, `typo-body` 토큰 사용

## 7. Help (/help)

시작하기, 기능별 가이드, 검증 기능, 임베딩, 프롬프트 버전 관리, A/B 테스트, 메트릭 해석, 용어집, FAQ, 문제 해결.
상단 헤더 타이포그래피는 다른 페이지와 동일한 `typo-h1` 사용.
