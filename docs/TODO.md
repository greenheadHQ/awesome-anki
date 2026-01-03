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
| 웹 API | ✅ 완료 | decks, cards, split, backup 라우트 |
| 웹 GUI | 🔄 진행중 | Phase 3 완료, Phase 4-5 남음 |

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

---

## 진행 중인 작업

### 웹 GUI Phase 4: 롤백 관리 🔄

**목표**: 백업 목록 조회 및 롤백 실행 UI

**필요한 작업**:
1. [ ] BackupManager 페이지 구현
   - [ ] 백업 목록 테이블
   - [ ] 백업 상세 정보 (시간, 원본 noteId, 생성된 카드 수)
   - [ ] 롤백 버튼 + 확인 다이얼로그
   - [ ] 롤백 성공/실패 피드백

2. [ ] App.tsx에서 BackupManager import

**관련 파일**:
- `packages/web/src/pages/BackupManager.tsx` (신규)
- `packages/web/src/hooks/useBackups.ts` (이미 생성됨)
- `packages/server/src/routes/backup.ts` (이미 구현됨)

**API 엔드포인트** (이미 구현됨):
- `GET /api/backup` - 백업 목록
- `POST /api/backup/:id/rollback` - 롤백 실행

---

## 미구현 작업

### 웹 GUI Phase 5: 카드 검증 기능 📋

**목표**: Gemini를 활용한 카드 내용 검증

**요구사항** (사용자 인터뷰에서 확인):
1. 팩트 체크 - 카드 내용의 사실 여부 검증
2. 최신성 검사 - 기술 변화로 인한 outdated 내용 감지
3. 중복/유사성 검사 - 임베딩 기반 유사 카드 탐지
4. 문맥 일관성 검사 - 카드 간 논리적 연결 확인

**필요한 작업**:
1. [ ] packages/core/src/validator/ 모듈 생성
   - [ ] fact-checker.ts
   - [ ] freshness-checker.ts
   - [ ] similarity-checker.ts (임베딩 필요)
   - [ ] context-checker.ts

2. [ ] packages/server/src/routes/validate.ts
   - [ ] POST /api/validate/fact-check
   - [ ] POST /api/validate/freshness
   - [ ] POST /api/validate/similarity
   - [ ] POST /api/validate/context

3. [ ] ValidationPanel 컴포넌트
4. [ ] CardBrowser에 검증 상태 뱃지 추가

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

### 즉시 가능한 작업 (Phase 4)

```typescript
// packages/web/src/pages/BackupManager.tsx 구현

// 1. useBackups 훅 사용 (이미 생성됨)
const { data, isLoading } = useBackups();
const rollback = useRollback();

// 2. 백업 목록 테이블 렌더링
// 3. 롤백 버튼 + 확인 다이얼로그
// 4. App.tsx에서 import 변경
```

### 예상 소요 시간
- Phase 4 (BackupManager): 30분
- Phase 5 (카드 검증): 2-3시간

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
```
