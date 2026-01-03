# TODO - 프로젝트 진행 상황

> 마지막 업데이트: 2026-01-03
>
> 기술 상세는 [FEATURES.md](./FEATURES.md) 참고
> 문제 해결 기록은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 참고

---

## 현재 상태 요약

| 구분 | 상태 | 비고 |
|------|------|------|
| CLI 기능 | ✅ 완료 | status, split, analyze, rollback, backups |
| 웹 API | ✅ 완료 | decks, cards, split, backup, validate, embedding 라우트 |
| 웹 GUI | ✅ 완료 | Phase 1-6 완료, 임베딩 UI 통합 |
| 임베딩 | ✅ 완료 | Gemini 임베딩 기반 유사성 검사 |

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

### Phase 7: 도움말 시스템 + 온보딩 🎯

> 목표: 첫 방문 사용자가 프로젝트의 기능을 쉽게 이해할 수 있도록 도움말 제공

#### 7.1 도움말 페이지 (Help.tsx)

**구현 내용**
- 사이드바에 "Help" 메뉴 추가 (HelpCircle 아이콘)
- `/help` 라우트 생성
- 전체 기능 설명을 한 페이지에서 제공

**페이지 구성**
```
1. 시작하기 (Getting Started)
   - Anki Splitter란?
   - 기본 워크플로우: 덱 선택 → 카드 확인 → 분할 실행

2. 용어 설명 (Glossary)
   - Hard Split: #### 헤더로 명확히 구분된 카드를 자동 분할
   - Soft Split: AI(Gemini)가 의미적으로 판단하여 분할 제안
   - Cloze: Anki의 빈칸 채우기 형식 {{c1::답}}
   - 임베딩: 텍스트를 숫자 벡터로 변환하여 의미 기반 유사도 비교
   - nid: 노트 ID, 카드 간 링크에 사용

3. 기능별 가이드
   - Dashboard: 덱 선택 및 통계 확인
   - Split: 카드 분할 작업
   - Browse: 카드 목록 조회 및 검증
   - Backups: 분할 롤백 관리

4. 검증 기능 설명
   - 팩트 체크: AI가 카드 내용의 사실 여부 확인
   - 최신성 검사: 기술 정보가 최신인지 확인
   - 유사성 검사: 중복/유사 카드 탐지 (Jaccard vs 임베딩)
   - 문맥 일관성: nid로 연결된 카드 간 논리적 일관성

5. FAQ
   - 분할 후 원래대로 되돌릴 수 있나요?
   - 임베딩은 언제 사용하나요?
   - API 비용은 얼마나 드나요?
```

**파일 생성**
- `packages/web/src/pages/Help.tsx`
- `packages/web/src/components/help/HelpSection.tsx`
- `packages/web/src/components/help/GlossaryItem.tsx`

#### 7.2 컨텍스트 도움말 (HelpTooltip 컴포넌트)

**구현 내용**
- 각 기능 옆에 (?) 아이콘 추가
- 클릭 시 해당 기능만 설명하는 팝오버/모달 표시
- shadcn/ui의 Popover 또는 Tooltip 활용

**적용 위치**
```
Dashboard:
- [?] 임베딩 커버리지 (임베딩이 무엇인지, 왜 필요한지)
- [?] Hard Split 개수 (Hard Split이란?)
- [?] Soft Split 개수 (Soft Split이란?)

SplitWorkspace:
- [?] 분할 후보 목록 (어떤 기준으로 선정되는지)
- [?] 분할 미리보기 (분할 결과가 어떻게 적용되는지)

ValidationPanel:
- [?] Jaccard vs 임베딩 (두 방식의 차이점)
- [?] 각 검증 항목별 설명

CardBrowser:
- [?] 검증 상태 아이콘 (각 아이콘의 의미)
```

**컴포넌트 설계**
```tsx
// HelpTooltip.tsx
interface HelpTooltipProps {
  helpKey: string;  // 'embedding' | 'hardSplit' | 'softSplit' | ...
  children?: React.ReactNode;
}

// 도움말 내용은 별도 파일로 관리
// helpContent.ts
export const helpContent = {
  embedding: {
    title: '임베딩이란?',
    description: '텍스트를 768차원의 숫자 벡터로 변환...',
    learnMore: '/help#embedding'
  },
  // ...
};
```

**파일 생성**
- `packages/web/src/components/help/HelpTooltip.tsx`
- `packages/web/src/lib/helpContent.ts`

#### 7.3 온보딩 투어 (첫 방문자 가이드)

**구현 내용**
- 첫 방문 시 단계별 하이라이트 투어
- localStorage로 "투어 완료" 상태 저장
- "다시 보기" 버튼으로 재실행 가능

**라이브러리 선택**
- Option A: `react-joyride` (인기, 기능 풍부)
- Option B: 커스텀 구현 (경량, 의존성 최소화)
- 권장: `react-joyride` (빠른 구현)

**투어 단계**
```
Step 1: 덱 선택
  - 위치: Dashboard 덱 셀렉터
  - 설명: "먼저 작업할 덱을 선택하세요"

Step 2: 통계 확인
  - 위치: Dashboard 통계 카드
  - 설명: "분할 가능한 카드 수를 확인할 수 있습니다"

Step 3: 분할 시작
  - 위치: "분할 시작" 버튼
  - 설명: "이 버튼을 눌러 분할 작업을 시작하세요"

Step 4: 분할 작업 (SplitWorkspace)
  - 위치: 3단 레이아웃
  - 설명: "왼쪽에서 카드 선택, 가운데에서 원본 확인, 오른쪽에서 분할 미리보기"

Step 5: 적용 버튼
  - 위치: "분할 적용" 버튼
  - 설명: "미리보기를 확인한 후 적용하세요. 언제든 Backups에서 롤백 가능합니다"
```

**파일 생성**
- `packages/web/src/components/onboarding/OnboardingTour.tsx`
- `packages/web/src/hooks/useOnboarding.ts`

#### 7.4 구현 순서

1. **HelpTooltip 컴포넌트** (가장 작은 단위, 재사용 가능)
   - helpContent.ts 작성
   - HelpTooltip.tsx 구현
   - Dashboard에 먼저 적용

2. **Help 페이지**
   - 라우트 추가 (/help)
   - 사이드바 메뉴 추가
   - 페이지 콘텐츠 작성

3. **온보딩 투어**
   - react-joyride 설치
   - 투어 단계 정의
   - 첫 방문 감지 로직

#### 7.5 예상 작업량

| 작업 | 예상 파일 수 | 복잡도 |
|------|-------------|--------|
| HelpTooltip | 2개 | 낮음 |
| Help 페이지 | 3-4개 | 중간 |
| 온보딩 투어 | 2개 | 중간 |
| **합계** | **7-8개** | - |

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
