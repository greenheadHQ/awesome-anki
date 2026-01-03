# Features - 구현된 기능 및 기술 상세

> 이 문서는 현재 구현된 기능과 기술적 세부사항을 설명합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | Bun |
| 언어 | TypeScript |
| LLM | Gemini 3 Flash Preview |
| 백엔드 | Hono (REST API) |
| 프론트엔드 | React + Vite |
| 스타일링 | Tailwind CSS v4 |
| 상태 관리 | TanStack Query |
| 렌더링 | markdown-it + KaTeX |

---

## 아키텍처

### 모노레포 구조
```
anki-claude-code/
├── packages/
│   ├── core/           # 핵심 로직 (CLI + 웹 공용)
│   │   └── src/
│   │       ├── anki/       # AnkiConnect API 래퍼
│   │       ├── gemini/     # Gemini API 호출
│   │       ├── parser/     # 텍스트 파싱
│   │       ├── splitter/   # 분할 로직
│   │       ├── validator/  # 카드 검증 (fact-check, freshness, similarity)
│   │       └── utils/      # 유틸리티
│   │
│   ├── server/         # Hono REST API
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/     # API 라우트
│   │
│   └── web/            # React 프론트엔드
│       └── src/
│           ├── pages/
│           ├── components/
│           └── hooks/
│
├── src/                # CLI 진입점 (하위 호환)
└── output/backups/     # 분할 백업 저장소
```

---

## 핵심 기능

### 1. 카드 분할 (Split)

#### Hard Split (정규식 기반)
- **트리거**: `####` 헤더, `---` 구분선
- **장점**: 빠르고 정확
- **제한**: 명확한 구분자가 있는 경우만

```typescript
// 탐지 패턴
const HARD_SPLIT_PATTERNS = [
  /^####\s+/m,        // #### 헤더
  /^---\s*$/m,        // 구분선
  /^:::.*\n[\s\S]*?\n:::$/gm  // 컨테이너 블록
];
```

#### Soft Split (Gemini 기반)
- **트리거**: Cloze 개수 > 3개, 구분자 없음
- **처리**: Gemini에게 분할 제안 요청
- **제한**: 현재 5개 후보만 분석 (API 비용)

```typescript
// Gemini 분할 요청
const result = await requestCardSplit({
  noteId: 1757399484677,
  text: cardContent,
  tags: ['네트워크', 'DNS']
});
// 결과: 7개 원자적 카드로 분할 제안
```

### 2. nid 승계 전략

- **메인 카드**: `updateNoteFields`로 기존 nid 유지
- **서브 카드**: `addNotes`로 새 nid 생성
- **역링크**: 새 카드에 원본 카드 링크 삽입

```typescript
// 메인 카드 업데이트
await ankiConnect('updateNoteFields', {
  note: { id: originalNoteId, fields: newFields }
});

// 서브 카드 생성
const newNoteIds = await ankiConnect('addNotes', {
  notes: subCards.map(card => ({
    deckName, modelName, fields, tags
  }))
});
```

### 3. 학습 데이터 복제

- **복제 가능**: ease factor
- **복제 불가**: interval, due (AnkiConnect 제한)

```typescript
// ease factor 복제
await ankiConnect('setEaseFactors', {
  cards: newCardIds,
  easeFactors: [originalFactor, originalFactor, ...]
});
```

### 4. 백업/롤백

- **저장 위치**: `output/backups/{timestamp}_{noteId}.json`
- **저장 내용**: 원본 필드, 태그, 생성된 카드 ID
- **롤백**: 원본 복원 + 생성된 카드 삭제

```typescript
interface BackupEntry {
  id: string;
  timestamp: number;
  originalNoteId: number;
  originalFields: NoteFields;
  originalTags: string[];
  createdNoteIds: number[];
  splitType: 'hard' | 'soft';
}
```

---

## 파서 모듈

### Container Parser (상태 머신)
`::: type [title]` 구문 파싱

```typescript
// 지원 타입
type ContainerType = 'tip' | 'warning' | 'error' | 'note' | 'link' | 'toggle';

// 상태 머신
interface ParserState {
  depth: number;
  stack: ContainerBlock[];
  currentBlock: ContainerBlock | null;
}
```

### nid Link Parser
`[제목|nid{13자리}]` 패턴 추출

```typescript
const NID_PATTERN = /\[([^\]|]+)\|nid(\d{13})\]/g;

interface NidLink {
  title: string;
  nid: string;
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}
```

### Cloze Parser
`{{c숫자::내용::힌트?}}` 구문 분석

```typescript
const CLOZE_PATTERN = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;

interface ClozeItem {
  clozeNumber: number;
  content: string;
  hint?: string;
}
```

---

## API 엔드포인트

### Decks
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/decks | 덱 목록 |
| GET | /api/decks/:name/stats | 덱 통계 (총 노트, 분할 후보 수) |

### Cards
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/cards/deck/:name | 덱별 카드 목록 (페이지네이션, 필터) |
| GET | /api/cards/:noteId | 카드 상세 정보 |

### Split
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/split/preview | 분할 미리보기 (Hard/Soft) |
| POST | /api/split/apply | 분할 적용 |

### Backup
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/backup | 백업 목록 |
| POST | /api/backup/:id/rollback | 롤백 실행 |

### Validate
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/validate/fact-check | 카드 내용 팩트 체크 |
| POST | /api/validate/freshness | 기술 최신성 검사 |
| POST | /api/validate/similarity | 유사/중복 카드 탐지 |
| POST | /api/validate/all | 전체 검증 (병렬 실행) |

---

## 웹 GUI 컴포넌트

### ContentRenderer
Markdown + KaTeX + Cloze 렌더링

```tsx
<ContentRenderer
  content={cardText}
  showToggle={true}         // Raw/렌더링 토글
  defaultView="rendered"    // 기본 뷰
/>
```

**처리 순서**:
1. Cloze 구문 → `<span class="cloze">` 변환
2. 컨테이너 구문 → `<div class="callout-*">` 변환
3. Markdown → HTML (markdown-it + highlight.js)
4. KaTeX 수식 렌더링
5. nid 링크 처리
6. 이미지 프록시 (AnkiConnect)

### SplitWorkspace (3단 레이아웃)
| 영역 | 내용 |
|------|------|
| 왼쪽 (3/12) | 분할 후보 목록 + Hard/Soft 뱃지 |
| 중앙 (5/12) | 원본 카드 (ContentRenderer + 검증 패널) |
| 오른쪽 (4/12) | 분할 미리보기 (ContentRenderer + Raw 토글) + 적용 버튼 |

### CardBrowser
| 컬럼 | 설명 |
|------|------|
| 검증 | 검증 상태 아이콘 (✅/⚠️/❌/❓) |
| Note ID | 노트 식별자 |
| 미리보기 | 카드 내용 요약 |
| Cloze | Cloze 개수 |
| 분할 타입 | hard/soft 뱃지 |

**검증 필터 옵션**: 전체, 분할 가능, 미검증, 검토 필요

**검증 캐싱**: localStorage + useSyncExternalStore (24시간 TTL)

---

## Gemini 프롬프트 설계

### 시스템 프롬프트 (페르소나)
```
당신은 **인지 심리학 기반 지식 구조화 전문가**입니다.
컴퓨터 과학(CS) 복잡한 개념을 '원자적 단위(Atomic Units)'로 분할합니다.

핵심 원칙:
1. 한 카드 = 한 개념
2. 구체적 질문
3. 컨텍스트 유지
```

### 분할 응답 형식
```typescript
interface SplitResponse {
  shouldSplit: boolean;
  originalNoteId: number;
  mainCardIndex: number;
  splitCards: Array<{
    title: string;
    content: string;
    inheritImages: string[];
    inheritTags: string[];
    preservedLinks: string[];
    backLinks: string[];
  }>;
  splitReason: string;
  splitType: 'hard' | 'soft';
}
```

---

## CSS 커스텀 스타일

### Cloze 하이라이트
```css
.cloze {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
}
```

### Callout 컨테이너
```css
.callout {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
}

.callout-tip { border-color: hsl(142 76% 36%); }
.callout-warning { border-color: hsl(38 92% 50%); }
.callout-error { border-color: hsl(0 84% 60%); }
```

---

## CLI 명령어

```bash
# 연결 상태 확인
bun run cli:status

# 분할 미리보기 (전체 덱)
bun run cli:split

# 분할 적용
bun run cli:split -- --apply

# 특정 카드 Gemini 분할
bun run cli split --note 1757399484677

# 백업 목록
bun run cli backups

# 롤백
bun run cli rollback [backupId]
```
