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
│   │       ├── anki/           # AnkiConnect API 래퍼
│   │       ├── gemini/         # Gemini API 호출 (분할, cloze-enhancer)
│   │       ├── embedding/      # Gemini 임베딩 API (유사도)
│   │       ├── parser/         # 텍스트 파싱
│   │       ├── splitter/       # 분할 로직
│   │       ├── validator/      # 카드 검증 (fact-check, freshness, similarity, context)
│   │       ├── prompt-version/ # 프롬프트 버전 관리
│   │       └── utils/          # 유틸리티
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
├── output/backups/     # 분할 백업 저장소
└── output/embeddings/  # 임베딩 캐시 파일
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
| POST | /api/validate/similarity | 유사/중복 카드 탐지 (useEmbedding 옵션) |
| POST | /api/validate/context | nid 링크 연결 카드 간 문맥 일관성 검사 |
| POST | /api/validate/all | 전체 검증 (병렬 실행) |

### Embedding
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/embedding/generate | 덱 전체 임베딩 생성 (증분) |
| GET | /api/embedding/status/:deckName | 임베딩 캐시 상태 확인 |
| DELETE | /api/embedding/cache/:deckName | 임베딩 캐시 삭제 |
| POST | /api/embedding/single | 단일 텍스트 임베딩 (디버깅) |

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

**분할 미리보기 캐싱**:
- React Query 캐시 활용 (카드별 독립 캐시 키)
- 페이지 이탈/복귀 시 결과 유지
- Hard Split: 카드 선택 시 자동 미리보기 (정규식, 비용 없음)
- Soft Split: "Gemini 분석 요청" 버튼 클릭 시에만 API 호출 (비용 발생 사전 고지)
- "캐시된 결과" 배지로 사용자에게 시각적 피드백

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

**검증 항목**: 팩트 체크, 최신성, 유사성, 문맥 일관성

---

## Gemini 프롬프트 설계

> SuperMemo's Twenty Rules 기반으로 전면 개편 (2026-01-04)

### 시스템 프롬프트 핵심 원칙

**카드 길이 기준**:
| 타입 | 구성 | 기준 | 최대 |
|------|------|------|------|
| Cloze | 전체 | 40~60자 | 80자 |
| Basic | Front (Q:) | 20~30자 | 40자 |
| Basic | Back (A:) | ~20자 | 30자 |

**필수 원칙 (MUST)**:
1. **Minimum Information**: 카드당 한 가지 사실만
2. **One Answer Only**: 하나의 답만 허용
3. **No Yes/No**: 힌트 필수 (`{{c1::값::옵션1 | 옵션2}}`)
4. **Context-Free**: 중첩 맥락 태그 필수 (`[DNS > Record > A]`)
5. **No Enumerations**: 개별 카드로 분리
6. **No Example Trap**: 역방향 질문 ("X의 예시?" ❌)

**Self-Correction 루프**:
1. 생성 후 글자 수 검토
2. 상한선 초과 시 재작성
3. 그래도 초과 시 추가 분할

### 분할 응답 형식
```typescript
interface SplitResponse {
  shouldSplit: boolean;
  originalNoteId: string;
  mainCardIndex: number;
  splitCards: Array<{
    title: string;
    content: string;
    cardType?: 'cloze' | 'basic';      // NEW
    charCount?: number;                 // NEW
    contextTag?: string;                // NEW (예: "[DNS > Record > A]")
    inheritImages: string[];
    inheritTags: string[];
    preservedLinks: string[];
    backLinks: string[];
  }>;
  splitReason: string;
  splitType: 'hard' | 'soft' | 'none';
  qualityChecks?: {                     // NEW
    allCardsUnder80Chars: boolean;
    allClozeHaveHints: boolean;
    noEnumerations: boolean;
    allContextTagsPresent: boolean;
  };
}
```

---

## Cloze Enhancer 모듈 (gemini/cloze-enhancer.ts)

이진 패턴을 자동 감지하여 Yes/No Cloze에 힌트를 추가

### 지원 패턴 (25개)

| 카테고리 | 패턴 예시 | 힌트 |
|----------|----------|------|
| 존재/상태 | 있다/없다, 가능/불가능 | `있다 \| 없다` |
| 방향성 | 증가/감소, 상향/하향 | `증가 ↑ \| 감소 ↓` |
| 연결/동기화 | 동기/비동기, 블로킹/논블로킹 | `Sync \| Async` |
| 상태 | 상태/무상태, 영구/임시 | `Stateful \| Stateless` |
| 계층 | 물리/논리, 하드웨어/소프트웨어 | `Physical \| Logical` |
| 평가 | 장점/단점, 성공/실패 | `Pros ✓ \| Cons ✗` |

### 주요 함수

```typescript
// 텍스트 분석 및 힌트 추가
const analysis = analyzeClozes(cardText);
// 결과: { original, enhanced, enhancedCount, clozeMatches[] }

// 카드 품질 검사
const quality = checkCardQuality(cardText);
// 결과: { charCount, isUnder80Chars, hasHint, needsHint, hasContextTag, cardType, issues[] }

// 이진 패턴 감지
const pattern = detectBinaryPattern("연결 지향적");
// 결과: { pattern, hint: "연결 지향 | 비연결", category: "connection" }
```

---

## 프롬프트 버전 관리 (prompt-version/)

프롬프트 버전 관리, A/B 테스트, 품질 추적 시스템

### 데이터 구조

```typescript
interface PromptVersion {
  id: string;                    // "v1.0.0"
  name: string;                  // "SuperMemo 기반 최적화"
  systemPrompt: string;
  splitPromptTemplate: string;
  examples: FewShotExample[];
  config: PromptConfig;          // 카드 길이/규칙 설정
  status: 'draft' | 'active' | 'archived';
  metrics: PromptMetrics;        // 승인률, 평균 글자 수 등
  modificationPatterns: ModificationPatterns;  // 실패 패턴 분석
}

interface SplitHistoryEntry {
  promptVersionId: string;
  noteId: number;
  originalContent: string;
  splitCards: SplitCard[];
  userAction: 'approved' | 'modified' | 'rejected';
  modificationDetails?: {...};   // 글자 수 줄임, 맥락 추가 등
}

interface Experiment {
  controlVersionId: string;
  treatmentVersionId: string;
  controlResults: { splitCount, approvalRate, avgCharCount };
  treatmentResults: { splitCount, approvalRate, avgCharCount };
  conclusion?: string;
  winnerVersionId?: string;
}
```

### 저장 구조

```
output/prompts/
├── versions/           # 버전 파일
│   └── v1.0.0.json
├── history/            # 분할 히스토리 (날짜별)
│   └── history-2026-01-04.json
├── experiments/        # A/B 테스트
│   └── exp-{timestamp}.json
└── active-version.json # 현재 활성 버전
```

### 주요 기능

```typescript
// 버전 관리
await listVersions();
await getVersion('v1.0.0');
await createVersion({ name, systemPrompt, ... });
await setActiveVersion('v1.0.0');

// 히스토리
await addHistoryEntry({ promptVersionId, noteId, ... });
await getHistory(startDate, endDate);
await getHistoryByVersion('v1.0.0');

// 실패 패턴 분석
const { patterns, insights } = await analyzeFailurePatterns('v1.0.0');
// insights: ["글자 수 초과가 65%: 프롬프트에서 상한선 강조 필요", ...]

// A/B 테스트
await createExperiment('테스트명', 'v1.0.0', 'v1.1.0');
await completeExperiment('exp-id', '결론', 'v1.1.0');
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

---

## 임베딩 모듈 (packages/core/src/embedding/)

Gemini 임베딩 API를 사용한 의미 기반 유사도 검사

### 기술 스택
- **모델**: `gemini-embedding-001` (GA, MTEB 상위권)
- **차원**: 768 (기본값)
- **입력 한도**: 8K 토큰

### 주요 함수

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text);
// 결과: number[] (768차원)

// 의미적 유사도 계산
const similarity = await getSemanticSimilarity(text1, text2);
// 결과: 0-100 (%)

// 유사성 검사 (임베딩 사용)
const result = await checkSimilarity(targetCard, allCards, {
  useEmbedding: true,
  deckName: '덱 이름',
  threshold: 85,
});
```

### 텍스트 전처리

임베딩 생성 전 텍스트 정리:
- Cloze 구문에서 내용만 추출 (`{{c1::DNS}}` → `DNS`)
- HTML 태그 제거
- 컨테이너 구문 제거 (`::: tip` 등)
- nid 링크에서 제목만 추출

### 캐시

- **저장 위치**: `output/embeddings/{deckNameHash}.json`
- **구조**: `{ [noteId]: { embedding, textHash, timestamp } }`
- **증분 업데이트**: 텍스트 변경된 카드만 재생성
- **변경 감지**: MD5 해시로 텍스트 변경 확인

### Jaccard vs 임베딩

| 비교 항목 | Jaccard | 임베딩 |
|----------|---------|--------|
| 방식 | 단어 집합 + 2-gram | 의미 벡터 |
| 속도 | 빠름 (로컬) | 느림 (API 호출) |
| 정확도 | 표면적 유사도 | 의미적 유사도 |
| 기본 threshold | 70% | 85% |
| 캐시 | 없음 | 파일 기반 |

### 테스트 결과 (DNS 카드 기준)

- **같은 주제 카드**: 99% 유사도
- **다른 주제 카드**: 79% 유사도
- **Jaccard로 못 찾은 관련 카드**: 임베딩으로 탐지 성공

---

## 도움말 시스템

사용자 경험(UX)을 위한 도움말 및 온보딩 기능

### HelpTooltip 컴포넌트

주요 기능 옆에 (?) 아이콘을 표시하고, 클릭 시 Popover로 설명 표시

```tsx
// 사용 예시
<CardTitle className="flex items-center gap-1">
  분할 후보
  <HelpTooltip helpKey="splitCandidate" />
</CardTitle>

// helpContent.ts에서 콘텐츠 정의
export const helpContent = {
  splitCandidate: {
    title: '분할 후보',
    description: 'Hard Split 또는 Soft Split이 가능한 카드의 총 개수입니다.',
    learnMore: '/help#split-candidate'
  },
  // ...
};
```

**적용 위치**:
- Dashboard: 분할 후보, Hard Split, Soft Split, 임베딩 커버리지
- SplitWorkspace: 분할 후보 목록, 분할 미리보기
- ValidationPanel: 각 검증 항목
- CardBrowser: 검증 상태 아이콘

### Help 페이지 (/help)

전체 기능 설명을 제공하는 단일 페이지

**페이지 구성**:
1. 시작하기 (Getting Started)
2. 기능별 가이드 (Dashboard, Split, Browse, Backups)
3. 검증 기능 설명 (팩트체크, 최신성, 유사성, 문맥 일관성)
4. 용어집 (Glossary) - 주요 용어 정의
5. FAQ - 자주 묻는 질문
6. 문제 해결 (Troubleshooting)

### 온보딩 투어

첫 방문 사용자를 위한 단계별 가이드 투어

**라이브러리**: react-joyride

**투어 단계** (7단계):
1. 환영 메시지
2. 덱 선택 (Dashboard)
3. 통계 카드 확인
4. 빠른 작업 버튼
5. Split 페이지 안내
6. Browse 페이지 안내
7. Help 페이지 안내

**상태 관리**:
- localStorage: `anki-splitter-onboarding-completed`
- "가이드 다시 보기" 버튼으로 재실행 가능

**구현 파일**:
- `packages/web/src/hooks/useOnboarding.ts`
- `packages/web/src/components/onboarding/OnboardingTour.tsx`
