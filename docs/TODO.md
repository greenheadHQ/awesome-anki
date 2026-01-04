# TODO - 프로젝트 진행 상황

> 마지막 업데이트: 2026-01-04
>
> 기술 상세는 [FEATURES.md](./FEATURES.md) 참고
> 문제 해결 기록은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 참고

---

## 현재 상태 요약

| 구분 | 상태 | 비고 |
|------|------|------|
| CLI 기능 | ✅ 완료 | status, split, analyze, rollback, backups |
| 웹 API | ✅ 완료 | decks, cards, split, backup, validate, embedding 라우트 |
| 웹 GUI | ✅ 완료 | Phase 1-7 완료, 도움말 시스템 + 온보딩 |
| 임베딩 | ✅ 완료 | Gemini 임베딩 기반 유사성 검사 |
| 도움말 | ✅ 완료 | HelpTooltip, Help 페이지, 온보딩 투어 |

---

## 완료된 작업

### Phase 0: 기반 조사 ✅
- [x] AnkiConnect 설치 및 연결 테스트
- [x] test 프로필로 Anki 실행 확인
- [x] nid 승계 전략 조사 (updateNoteFields vs addNotes)
- [x] 덱/모델 구조 스캐닝
- [x] 학습 이력 복제 방법 조사

### Phase 1: 파서 구축 ✅
- [x] 프로젝트 초기화 (package.json, tsconfig.json)
- [x] AnkiConnect 클라이언트 (src/anki/client.ts)
- [x] 컨테이너 파서 (src/parser/container-parser.ts) - 상태 머신 방식
- [x] nid 링크 파서 (src/parser/nid-parser.ts)
- [x] Cloze 파서 (src/parser/cloze-parser.ts)

### Phase 2: Gemini 연동 ✅
- [x] Gemini 클라이언트 (src/gemini/client.ts)
- [x] 프롬프트 설계 (src/gemini/prompts.ts)
- [x] 응답 검증 (src/gemini/validator.ts) - zod 스키마
- [x] gemini-3-flash-preview 모델 업그레이드

### Phase 3: 분할 엔진 ✅
- [x] Hard Split (정규식 기반)
- [x] Soft Split (Gemini 기반) - 5개 후보 제한
- [x] --apply 플래그로 실제 분할 적용
- [x] --note 플래그로 특정 카드 선택 분할
- [x] nid 링크 리팩토링 (mainCardIndex 카드 nid 유지)

### Phase 4: 안전장치 ✅
- [x] Dry Run 모드 (기본값)
- [x] 스타일 보존 필터 (formatters.ts)
- [x] 백업/롤백 기능 (output/backups/)
- [x] 학습 데이터 복제 (ease factor)

### 웹 GUI Phase 1-2: 기초 인프라 ✅
- [x] 모노레포 설정 (workspaces)
- [x] packages/core - 기존 CLI 로직 분리
- [x] packages/server - Hono REST API
- [x] packages/web - React + Vite + Tailwind
- [x] API 라우트: decks, cards, split, backup
- [x] Dashboard 페이지
- [x] CardBrowser 페이지

### 웹 GUI Phase 3: 분할 기능 ✅
- [x] ContentRenderer (Markdown + KaTeX + Cloze)
- [x] Raw/렌더링 토글
- [x] DiffViewer 컴포넌트
- [x] SplitWorkspace 페이지 (3단 레이아웃)
- [x] useSplitPreview, useSplitApply 훅
- [x] CSS 클래스 충돌 해결 (.container → .callout)

### 웹 GUI Phase 4: 롤백 관리 ✅
- [x] BackupManager 페이지 구현
- [x] 백업 목록 카드 UI (시간, 원본 noteId, 생성된 카드 수)
- [x] 롤백 버튼 + 확인 다이얼로그
- [x] 롤백 성공/실패 피드백
- [x] useBackups, useRollback 훅
- [x] ContentRenderer <br> 태그 처리 개선
- [x] Hard Split 기준 수정 (#### 헤더만, --- 구분선 제외)

### 웹 GUI Phase 5: 카드 검증 기능 ✅
- [x] packages/core/src/validator/ 모듈 생성
  - [x] types.ts - 검증 결과 타입 정의
  - [x] fact-checker.ts - Gemini 기반 팩트 체크
  - [x] freshness-checker.ts - 기술 최신성 검사
  - [x] similarity-checker.ts - Jaccard 유사도 기반 중복 탐지
- [x] packages/server/src/routes/validate.ts
  - [x] POST /api/validate/fact-check
  - [x] POST /api/validate/freshness
  - [x] POST /api/validate/similarity
  - [x] POST /api/validate/all (병렬 실행)
- [x] ValidationPanel 컴포넌트
- [x] SplitWorkspace에 검증 토글 버튼 및 패널 통합

### ContentRenderer 파싱 미스매칭 수정 ✅
- [x] markdown-it + markdown-it-container + highlight.js 적용
- [x] Callout/Toggle 컨테이너 렌더링
- [x] nid 링크 처리
- [x] Cloze 강조 표시
- [x] 이미지 API 프록시
- [x] `<br>` 및 `&lt;br&gt;` 이스케이프 처리
- [x] Header (h1-h6) CSS 스타일 추가
- [x] Bullet point (ul/ol) list-style-type 추가
- [x] Splitter (hr) border-top 스타일 추가

### Phase 7: 도움말 시스템 + 온보딩 ✅

> 완료 (2026-01-03)

**7.1 HelpTooltip 컴포넌트**
- [x] `helpContent.ts` - 도움말 콘텐츠 정의 (용어집, FAQ 포함)
- [x] `HelpTooltip.tsx` - (?) 아이콘 클릭 시 Popover 표시
- [x] `Popover.tsx` - radix-ui/react-popover 기반 shadcn 스타일
- [x] Dashboard에 적용 (분할 후보, Hard/Soft Split, 임베딩)
- [x] cursor: pointer 스타일 추가

**7.2 Help 페이지**
- [x] `/help` 라우트 추가
- [x] 사이드바에 Help 메뉴 추가 (HelpCircle 아이콘)
- [x] 페이지 구성:
  - 시작하기 (Getting Started)
  - 기능별 가이드 (Dashboard, Split, Browse, Backups)
  - 검증 기능 설명 (팩트체크, 최신성, 유사성, 문맥 일관성)
  - 용어집 (Glossary)
  - FAQ
  - 문제 해결 (Troubleshooting)

**7.3 온보딩 투어**
- [x] `react-joyride` 라이브러리 설치
- [x] `useOnboarding.ts` - localStorage 기반 완료 상태 관리
- [x] `OnboardingTour.tsx` - 7단계 투어 구현
  - Step 1: 환영 메시지
  - Step 2: 덱 선택
  - Step 3: 통계 카드
  - Step 4: 빠른 작업
  - Step 5: Split 페이지 안내
  - Step 6: Browse 페이지 안내
  - Step 7: Help 페이지 안내
- [x] Dashboard에 "가이드 다시 보기" 버튼 추가
- [x] data-tour 속성으로 타겟 지정

**생성된 파일**
- `packages/web/src/lib/helpContent.ts`
- `packages/web/src/components/ui/Popover.tsx`
- `packages/web/src/components/help/HelpTooltip.tsx`
- `packages/web/src/pages/Help.tsx`
- `packages/web/src/hooks/useOnboarding.ts`
- `packages/web/src/components/onboarding/OnboardingTour.tsx`

---

## 미구현 작업

### Phase 6: 고급 기능 ✅

**1. CardBrowser 검증 상태 뱃지** ✅
- [x] 검증 결과 캐싱 (localStorage + useSyncExternalStore)
- [x] 카드 목록에 검증 상태 아이콘 표시
- [x] 필터: 검증 필요한 카드만 보기 (미검증, 검토 필요)
- [x] 상세 패널에 검증/재검증 버튼 및 결과 표시

**2. 분할 미리보기 렌더링** ✅
- [x] SplitPreviewCard에 ContentRenderer 적용
- [x] Raw/Rendered 토글 버튼 추가
- [x] KaTeX, Markdown, 테이블 정상 렌더링

**3. 문맥 일관성 검사** ✅
- [x] context-checker.ts 구현 (Gemini 기반)
- [x] 관련 카드 간 논리적 연결 확인
- [x] nid 링크로 연결된 카드 그룹 분석
- [x] 역방향 링크 검색 (다른 카드가 이 카드를 참조하는 경우)
- [x] API 라우트 추가 (POST /api/validate/context)
- [x] ValidationPanel UI 통합

**4. 임베딩 기반 유사성 검사** ✅

> Gemini 임베딩 + 코사인 유사도로 의미 기반 검사 (Jaccard도 유지)

**구현 완료 (2026-01-03)**

**Step 1: 임베딩 모듈 (packages/core/src/embedding/)**
- [x] `client.ts` - Gemini 임베딩 API 클라이언트
  - `getEmbedding(text: string): Promise<number[]>`
  - `getEmbeddings(texts: string[]): Promise<number[][]>` (배치)
  - `preprocessTextForEmbedding()` - Cloze, HTML, 컨테이너 제거
- [x] `cosine.ts` - 코사인 유사도 계산
  - `cosineSimilarity(vec1, vec2): number` (0-100)
  - `normalizeVector()`, `fastCosineSimilarity()` (정규화된 벡터용)
- [x] `cache.ts` - 파일 기반 임베딩 캐시
  - 저장 위치: `output/embeddings/{deckNameHash}.json`
  - 구조: `{ [noteId]: { embedding, textHash, timestamp } }`
  - 증분 업데이트 (텍스트 변경된 카드만 재생성)
- [x] `index.ts` - 모듈 export

**Step 2: similarity-checker.ts 수정**
- [x] `SimilarityCheckOptions`에 `useEmbedding?: boolean` 추가
- [x] 임베딩 기반 검사 로직 구현 (코사인 유사도)
- [x] 기존 Jaccard 로직 유지 (하위 호환)
- [x] threshold 기본값 조정 (임베딩: 85, Jaccard: 70)

**Step 3: API 라우트**
- [x] POST /api/embedding/generate - 덱 전체 임베딩 생성
- [x] GET /api/embedding/status/:deckName - 임베딩 상태 확인
- [x] DELETE /api/embedding/cache/:deckName - 캐시 삭제
- [x] POST /api/embedding/single - 단일 텍스트 임베딩 (디버깅용)
- [x] /api/validate/similarity에 `useEmbedding` 파라미터 추가

**Step 4: 웹 UI** ✅
- [x] 덱 통계에 임베딩 커버리지 표시 (Dashboard)
- [x] 임베딩 생성 버튼 (Dashboard 빠른 작업)
- [x] 검증 옵션에 Jaccard/임베딩 선택 (ValidationPanel)

**테스트 결과**
- 단위 테스트: 25개 모두 통과
- 통합 테스트: DNS 카드끼리 99% 유사도, 다른 주제와 79%
- Jaccard vs 임베딩: 임베딩이 의미적으로 관련된 카드 더 잘 탐지

### 기타 미구현 기능 📋

1. [ ] **전체 Soft Split**
   - 현재: 5개 후보만 분석 (API 비용 고려)
   - 개선: 전체 후보 분석 옵션 추가

2. [ ] **interval/due 복제**
   - AnkiConnect 제한으로 현재 불가
   - 대안: Anki 플러그인 직접 개발?

3. [ ] **"기본" 덱 필터링**
   - 빈 덱(기본 덱 등) 숨기기 옵션

4. [ ] **다크모드**
   - CSS 변수는 이미 설정됨 (.dark 클래스)
   - 토글 버튼 및 시스템 설정 연동 필요

---

## 기술 부채

### 리팩토링 필요
- [ ] ContentRenderer의 컨테이너 파싱 로직을 core 패키지로 이동
- [ ] API 에러 핸들링 통일
- [ ] 로딩 상태 스켈레톤 UI 추가
- [ ] **output/prompts gitignore 예외 추가** - 프롬프트 버전 파일(`v1.0.0.json` 등)이 `output/` gitignore로 인해 추적되지 않음. `.gitignore`에 `!output/prompts/` 예외 추가 필요
- [ ] **bun:test 타입 선언 문제** - `packages/core/src/__tests__/*.ts` 파일에서 `bun:test` 모듈을 찾을 수 없음. tsconfig.json에 `"types": ["bun-types"]` 추가 또는 테스트 파일을 별도 tsconfig로 분리 필요

### 테스트
- [x] 임베딩 모듈 단위 테스트 (25개 통과)
- [ ] 파서 단위 테스트
- [ ] API 통합 테스트
- [ ] E2E 테스트 (Playwright?)

### 문서화
- [x] CLAUDE.md - LLM 가이드
- [x] docs/TROUBLESHOOTING.md - 문제 해결 기록
- [x] docs/TODO.md - 진행 상황
- [x] docs/FEATURES.md - 기능 및 기술 상세
- [ ] API 문서 (OpenAPI/Swagger?)

---

## 다음 세션에서 할 작업

### 이번 세션 완료 (2026-01-03)

**SplitWorkspace 상태 관리 개선**
- [x] 대시보드/Split 페이지 분할 후보 수 불일치 해결 (`canSoftSplit` 필드 추가)
- [x] Soft Split 자동 Gemini API 호출 제거 → 명시적 "Gemini 분석 요청" 버튼으로 변경
- [x] React Query 캐시 기반 카드별 독립 상태 관리 (페이지 이탈/복귀 시 결과 유지)
- [x] 에러 발생 시 상세 메시지 표시 + "다시 시도" 버튼 추가
- [x] "캐시된 결과" 배지로 사용자에게 시각적 피드백

**수정된 파일**:
- `packages/core/src/splitter/atomic-converter.ts` - `canSoftSplit` 필드 추가
- `packages/web/src/hooks/useSplit.ts` - `onSuccess` 캐시 저장, `getCachedSplitPreview` 함수 추가
- `packages/web/src/pages/SplitWorkspace.tsx` - 캐시 기반 상태 관리, 에러 UI 개선
- `docs/TROUBLESHOOTING.md` - 14.5, 14.6, 14.7 섹션 추가

---

### 기타 기능 개선 (낮은 우선순위)

1. **임베딩 생성 진행률 표시**
   - 현재: 단순 로딩 스피너
   - 개선: 실시간 진행률 표시 (WebSocket or polling)

2. **임베딩 기반 자동 중복 탐지**
   - 전체 덱 스캔하여 유사 카드 그룹 자동 탐지
   - 중복 카드 병합/삭제 제안

3. **다크모드**
   - CSS 변수 활용 (.dark 클래스)
   - 시스템 설정 연동 (prefers-color-scheme)
   - 토글 버튼 추가

4. **Gemini 분석 토스트 알림**
   - 분석 요청 시작: "Gemini 분석 중..." 토스트
   - 분석 완료: "분석 완료! N개 카드로 분할 가능" 성공 토스트
   - 분석 실패: 에러 메시지와 함께 실패 토스트
   - 라이브러리: react-hot-toast 또는 sonner

5. **Soft Split 고도화**
   - 프롬프트 고도화: 분할 품질 향상을 위한 시스템 프롬프트 개선
   - 모범 예제 제시: Few-shot learning으로 분할 예시 제공
   - 참고용 템플릿: 분할 결과 템플릿 커스터마이징 옵션
   - 분할 기준 조정: Cloze 개수 임계값, 정보 밀도 기준 설정 UI

6. **반응형 레이아웃**
   - 모바일/태블릿 대응 (breakpoints: sm, md, lg)
   - SplitWorkspace 3단 → 1단 레이아웃 전환
   - 사이드바 햄버거 메뉴화
   - 터치 친화적 UI (버튼 크기, 간격 조정)

---

## 📌 프롬프트 버전 관리 시스템 (진행 중)

> **계획 파일**: `~/.claude/plans/merry-gathering-petal.md`
> **작성일**: 2026-01-04
> **마지막 업데이트**: 2026-01-04

### 배경
- CS 학습용 Anki 카드가 너무 길어서 모바일 학습 어려움
- Soft Split 결과물 품질 불만족
- SuperMemo's Twenty Rules 기반 진정한 Atomic Card 필요

### 구현 단계
| Phase | 작업 | 상태 | 비고 |
|-------|------|------|------|
| 0 | Claude Skill 생성 | ✅ 완료 | `~/.claude/skills/anki-card-creator/SKILL.md` |
| 1 | 프롬프트 개선 | ✅ 완료 | `prompts.ts` 전면 개편 |
| 1.3 | Cloze Enhancer | ✅ 완료 | `cloze-enhancer.ts` 신규 생성 |
| 2 | 버전 관리 인프라 | ✅ 완료 | `prompt-version/` 모듈 |
| 3 | API 확장 | ✅ 완료 | `/api/prompts/*` 라우트 |
| 4 | 웹 UI | ⏳ 대기 | PromptManager, 모바일 시뮬레이터 |
| 5 | Recursive Splitting | ⏳ 대기 | 학습 중 틀린 카드 추가 분할 제안 |

### 이번 세션 완료 (2026-01-04)

**Phase 0: Claude Skill 생성** ✅
- [x] `/skill-creator` 스킬로 `anki-card-creator` 스킬 생성
- [x] SuperMemo's Twenty Rules 기반 카드 생성 규칙 정의
- [x] 스킬 파일: `~/.claude/skills/anki-card-creator/SKILL.md`
- [x] 배포용 패키지: `anki-card-creator.skill`

**Phase 1: 프롬프트 개선** ✅
- [x] `SYSTEM_PROMPT` 전면 개편 (SuperMemo's Twenty Rules 기반)
- [x] 카드 길이 기준 명시: Cloze 40~60자, Basic Front 20~30자
- [x] 필수 원칙 6가지 추가:
  - Minimum Information
  - One Answer Only
  - No Yes/No (힌트 필수)
  - Context-Free (중첩 태그)
  - No Enumerations
  - No Example Trap
- [x] Self-Correction 루프 추가
- [x] 부정형 질문 방지 규칙
- [x] Few-shot 예제 (좋은 예시 3개, 나쁜 예시 3개)
- [x] `buildSplitPrompt` 개선 (cardType, charCount, contextTag, qualityChecks)
- [x] `buildAnalysisPrompt` 개선 (상세 분석 기준)

**Phase 1.3: Cloze Enhancer** ✅
- [x] `cloze-enhancer.ts` 신규 생성
- [x] 이진 패턴 자동 감지 (25개 패턴)
  - 존재/상태: 있다/없다, 가능/불가능, 필요/불필요
  - 방향성: 증가/감소, 상향/하향, 빠르다/느리다
  - 연결/동기화: 동기/비동기, 블로킹/논블로킹, 연결/비연결
  - 상태: 상태/무상태, 영구/임시, 휘발성/비휘발성
  - 계층: 물리/논리, 하드웨어/소프트웨어
  - 평가: 장점/단점, 성공/실패, 허용/금지
- [x] 힌트 자동 추가 함수
- [x] 카드 글자 수 계산 (Cloze 마크업 제외)
- [x] 카드 타입 자동 감지 (cloze vs basic)
- [x] 카드 품질 검사 함수
- [x] `validator.ts` 스키마 확장 (cardType, charCount, contextTag, qualityChecks)

**생성/수정된 파일**
- `~/.claude/skills/anki-card-creator/SKILL.md` (신규)
- `packages/core/src/gemini/prompts.ts` (전면 개편)
- `packages/core/src/gemini/cloze-enhancer.ts` (신규)
- `packages/core/src/gemini/validator.ts` (스키마 확장)
- `packages/core/src/gemini/index.ts` (export 추가)

**Phase 2: 버전 관리 인프라** ✅
- [x] `output/prompts/` 디렉토리 구조 생성 (versions, history, experiments)
- [x] `prompt-version/types.ts` - 11개 타입 정의
  - `PromptVersion` - 프롬프트 버전 메타데이터
  - `PromptConfig` - 카드 길이/규칙 설정
  - `PromptMetrics` - 승인률, 평균 글자 수 등 메트릭
  - `ModificationPatterns` - 실패 패턴 분석용
  - `SplitHistoryEntry` - 분할 히스토리
  - `Experiment` - A/B 테스트
  - `ActiveVersionInfo` - 활성 버전 정보
  - `FewShotExample` - Few-shot 예제
  - 기본값 상수 (`DEFAULT_PROMPT_CONFIG`, `DEFAULT_METRICS`, `DEFAULT_MODIFICATION_PATTERNS`)
- [x] `prompt-version/storage.ts` - 저장소 로직
  - 버전 CRUD (`listVersions`, `getVersion`, `saveVersion`, `deleteVersion`, `createVersion`)
  - 활성 버전 관리 (`getActiveVersion`, `setActiveVersion`, `getActivePrompts`)
  - 히스토리 관리 (`addHistoryEntry`, `getHistory`, `getHistoryByVersion`)
  - 메트릭 자동 업데이트 (`updateVersionMetrics`)
  - A/B 테스트 (`createExperiment`, `listExperiments`, `getExperiment`, `completeExperiment`)
  - 실패 패턴 분석 (`analyzeFailurePatterns`)
- [x] `prompt-version/index.ts` - 모듈 export
- [x] `packages/core/src/index.ts` - cloze-enhancer, prompt-version export 추가
- [x] 초기 버전 `v1.0.0.json` 생성 (output/prompts/versions/)

### 핵심 변경 (구현 완료)
- ✅ Cloze 40~60자, Basic Front 20~30자, Back ~20자
- ✅ Yes/No Cloze 힌트 필수 (자동 감지)
- ✅ 중첩 맥락 태그 `[DNS > Record > A]`
- ✅ Self-Correction 루프 (길이 초과 시 재작성)
- ✅ 버전 관리 인프라 (저장소, 히스토리, 실험)
- ✅ API 확장 (프롬프트 버전, 히스토리, 실험)
- ⏳ A/B 테스트 UI, 품질 추적 대시보드 (Phase 4)

**Phase 3: API 확장** ✅
- [x] `packages/server/src/routes/prompts.ts` 신규 생성
  - GET `/api/prompts/versions` - 버전 목록
  - GET `/api/prompts/versions/:id` - 버전 상세
  - POST `/api/prompts/versions` - 새 버전 생성
  - PUT `/api/prompts/versions/:id` - 버전 업데이트
  - DELETE `/api/prompts/versions/:id` - 버전 삭제
  - POST `/api/prompts/versions/:id/activate` - 활성화
  - GET `/api/prompts/active` - 현재 활성 버전
  - GET `/api/prompts/history` - 분할 히스토리
  - POST `/api/prompts/history` - 히스토리 추가
  - GET `/api/prompts/versions/:id/failure-patterns` - 실패 패턴 분석
  - GET `/api/prompts/experiments` - 실험 목록
  - GET `/api/prompts/experiments/:id` - 실험 상세
  - POST `/api/prompts/experiments` - A/B 테스트 시작
  - POST `/api/prompts/experiments/:id/complete` - 실험 완료
- [x] `packages/server/src/index.ts`에 prompts 라우트 등록
- [x] `packages/core/src/index.ts` 명시적 export (getVersion 충돌 해결)
  - `listVersions` → `listPromptVersions`
  - `getVersion` → `getPromptVersion`
  - `saveVersion` → `savePromptVersion`
  - `deleteVersion` → `deletePromptVersion`
  - `createVersion` → `createPromptVersion`

### 중간 싱크업 결과 (2026-01-04)

| 질문 | 답변 |
|------|------|
| 사용 시나리오 | 둘 다 중요하지만, **기존 카드 분할 위주** 우선 |
| 버전 선택 | **SplitWorkspace에서 선택 가능** (A/B 테스트 지원) |
| 히스토리 기록 | **자동 기록** (분할 적용/취소 시) |
| 모바일 시뮬레이터 | ❌ **불필요** |
| A/B 테스트 방식 | **수동 선택 비교** (실험 대시보드에서 결과 비교) |
| Phase 5 우선순위 | **Phase 4 완료 후 바로** |
| UI 배치 | **헤더에 버전 드롭다운** |

### 다음 작업 (Phase 4: 웹 UI) - 싱크업 반영

1. [ ] **SplitWorkspace 프롬프트 버전 선택**
   - 헤더에 버전 드롭다운 추가
   - 선택된 버전으로 Gemini 분석 요청
   - 파일: `packages/web/src/pages/SplitWorkspace.tsx`

2. [ ] **분할 히스토리 자동 기록**
   - 분할 적용 시 자동으로 `/api/prompts/history` 호출
   - userAction 자동 판별 (approved/modified/rejected)
   - 파일: `packages/web/src/hooks/useSplit.ts`

3. [ ] **PromptManager 페이지**
   - 버전 목록/상세/생성/수정
   - 사이드바에 메뉴 추가
   - 파일: `packages/web/src/pages/PromptManager.tsx`

4. [ ] **실험 대시보드**
   - A/B 테스트 결과 시각화 (승인률, 평균 글자 수)
   - PromptManager 페이지 내 탭으로 구현

5. [ ] **품질 추적 대시보드**
   - 버전별 메트릭, 실패 패턴 시각화
   - PromptManager 페이지 내 탭으로 구현

6. ~~모바일 시뮬레이터~~ (사용자 요청으로 제외)

---

## 참고 정보

### 프로젝트 실행
```bash
# 개발 서버
bun run dev

# CLI
bun run cli:status
bun run cli:split
```

### 테스트 데이터
- 덱: `[책] 이것이 취업을 위한 컴퓨터 과학이다` (262개 노트)
- 테스트 카드 (DNS 관련):
  - 1757399484677
  - 1757400981612
  - 1757407967676

### Git 브랜치
- `main` - 현재 작업 브랜치

### 주요 파일 위치
```
packages/web/src/pages/         # 페이지 컴포넌트
packages/web/src/hooks/         # React Query 훅
packages/server/src/routes/     # API 라우트
packages/core/src/              # 핵심 로직
packages/core/src/validator/    # 검증 모듈
packages/core/src/embedding/    # 임베딩 모듈 (Gemini)
output/embeddings/              # 임베딩 캐시 파일
```

### API 엔드포인트 목록
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/decks | 덱 목록 |
| GET | /api/decks/:name/stats | 덱 통계 |
| GET | /api/cards/deck/:name | 카드 목록 |
| GET | /api/cards/:noteId | 카드 상세 |
| POST | /api/split/preview | 분할 미리보기 |
| POST | /api/split/apply | 분할 적용 |
| GET | /api/backup | 백업 목록 |
| POST | /api/backup/:id/rollback | 롤백 |
| POST | /api/validate/fact-check | 팩트 체크 |
| POST | /api/validate/freshness | 최신성 검사 |
| POST | /api/validate/similarity | 유사성 검사 (useEmbedding 옵션) |
| POST | /api/validate/context | 문맥 일관성 검사 |
| POST | /api/validate/all | 전체 검증 |
| POST | /api/embedding/generate | 덱 전체 임베딩 생성 |
| GET | /api/embedding/status/:deckName | 임베딩 캐시 상태 |
| DELETE | /api/embedding/cache/:deckName | 임베딩 캐시 삭제 |
| POST | /api/embedding/single | 단일 텍스트 임베딩 (디버깅) |
