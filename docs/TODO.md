# TODO - 작업 진행 상황

> 마지막 업데이트: 2026-01-03
>
> 기술 상세는 [FEATURES.md](./FEATURES.md) 참고
> 문제 해결 기록은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 참고

---

## 현재 상태

| 구분 | 상태 | 진행률 |
|------|------|--------|
| CLI 기능 | ✅ 완료 | 100% |
| 웹 API | ✅ 완료 | 100% |
| 웹 GUI | 🔄 진행중 | 60% (Phase 3/5) |

---

## 완료된 Phase

- [x] **Phase 0**: 기반 조사 (AnkiConnect, 덱/모델 구조)
- [x] **Phase 1**: 파서 구축 (container, nid, cloze)
- [x] **Phase 2**: Gemini 연동
- [x] **Phase 3**: 분할 엔진 (Hard/Soft Split, --apply)
- [x] **Phase 4**: 안전장치 (백업/롤백, 학습 데이터 복제)
- [x] **웹 Phase 1-2**: 모노레포, API 서버, Dashboard, CardBrowser
- [x] **웹 Phase 3**: SplitWorkspace, ContentRenderer, DiffViewer

---

## 다음 작업: 웹 Phase 4 - BackupManager

### 목표
백업 목록 조회 및 롤백 실행 UI 구현

### 체크리스트
- [ ] `packages/web/src/pages/BackupManager.tsx` 생성
  - [ ] 백업 목록 테이블
  - [ ] 백업 상세 (시간, noteId, 생성된 카드 수)
  - [ ] 롤백 버튼 + 확인 다이얼로그
  - [ ] 성공/실패 피드백
- [ ] `App.tsx`에서 BackupManager import 변경

### 이미 준비된 것
- `packages/web/src/hooks/useBackups.ts` ✅
- `packages/server/src/routes/backup.ts` ✅
- API: `GET /api/backup`, `POST /api/backup/:id/rollback` ✅

### 예상 소요
~30분

---

## 이후 작업: 웹 Phase 5 - 카드 검증

### 목표
Gemini를 활용한 카드 내용 검증

### 체크리스트
- [ ] `packages/core/src/validator/` 모듈
  - [ ] fact-checker.ts (팩트 체크)
  - [ ] freshness-checker.ts (최신성 검사)
  - [ ] similarity-checker.ts (중복/유사성)
  - [ ] context-checker.ts (문맥 일관성)
- [ ] `packages/server/src/routes/validate.ts`
- [ ] ValidationPanel 컴포넌트
- [ ] CardBrowser에 검증 상태 뱃지

### 예상 소요
2-3시간

---

## 백로그 (우선순위 낮음)

| 항목 | 설명 |
|------|------|
| 전체 Soft Split | 현재 5개만 → 전체 후보 분석 |
| 다크모드 토글 | CSS 변수 준비됨, 토글 UI 필요 |
| 빈 덱 필터링 | "기본" 덱 등 숨기기 옵션 |
| 파서 단위 테스트 | Jest/Vitest |
| API 문서 | OpenAPI/Swagger |

---

## 빠른 참조

### 개발 서버 실행
```bash
bun run dev           # 서버 + 클라이언트
bun run dev:server    # localhost:3000
bun run dev:web       # localhost:5173
```

### 테스트 카드
- `1757399484677` - 도메인 네임 계층 구조
- `1757400981612` - 네임 서버 계층 구조
- `1757407967676` - DNS 레코드 타입

### 주요 파일 위치
```
packages/web/src/pages/         # 페이지 컴포넌트
packages/web/src/hooks/         # React Query 훅
packages/server/src/routes/     # API 라우트
packages/core/src/              # 핵심 로직
```
