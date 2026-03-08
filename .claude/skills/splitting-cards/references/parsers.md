# 파서 모듈 상세

## Container Parser (packages/core/src/parser/container-parser.ts)

`::: type [title]` 구문 파싱. **상태 머신** 방식 (스택 기반 depth 추적).

### 지원 타입

```typescript
type ContainerType = 'tip' | 'warning' | 'error' | 'note' | 'link' | 'toggle';
```

### 상태 머신

```typescript
interface ParserState {
  depth: number;
  stack: Partial<ContainerBlock>[];
  lineNumber: number;
}
```

- `depth`: 현재 중첩 깊이
- `stack`: 미완성 블록 스택 (`Partial<ContainerBlock>[]`)
- `lineNumber`: 현재 처리 중인 줄 번호

### ContainerBlock 인터페이스

```typescript
interface ContainerBlock {
  type: ContainerType;
  toggleType?: string;   // toggle의 경우: tip, warning, error, note, todo
  title?: string;        // toggle의 제목
  content: string;
  startLine: number;
  endLine: number;
  raw: string;           // 원본 텍스트 (:::...:::)
}
```

### 주요 함수

| 함수 | 용도 |
|------|------|
| `parseContainers(content)` | HTML `<br>` 정규화 후 라인별 파싱 |
| `isTodoContainer(block)` | toggle + todo 타입 확인 |
| `isLinkContainer(block)` | link 타입 확인 |
| `extractContainersFromHtml(html)` | 컨테이너 + 외부 텍스트 분리 |

### 설계 결정

- 정규식만으로는 중첩 `::: toggle` 처리 불가
- 스택 기반 상태 머신으로 중첩 depth 정확히 추적
- `<br>` 태그를 `\n`으로 변환 후 처리

### 분할 제외 규칙

- `::: toggle todo` 블록은 분할 대상에서 제외 (미완성 상태)

## nid Link Parser (packages/core/src/parser/nid-parser.ts)

`[제목|nid{13자리}]` 패턴 추출.

```typescript
const NID_LINK_REGEX = /\[([^\]|]+)\|nid(\d{13})\]/g;

interface NidLink {
  title: string;
  nid: string;
  raw: string;          // 원본 텍스트
  startIndex: number;
  endIndex: number;
}
```

### 주요 함수

| 함수 | 용도 |
|------|------|
| `parseNidLinks(content)` | 모든 nid 링크 추출 |
| `hasNidLink(content, nid)` | 특정 nid 존재 확인 |
| `extractUniqueNids(content)` | 고유 nid 목록 |
| `createNidLink(title, nid)` | nid 링크 생성 |
| `createBackLink(originalTitle, originalNid)` | 역링크 생성 (`원문: ` 접두사) |
| `replaceNid(content, oldNid, newNid)` | nid 교체 |
| `isSelfReference(content, noteId)` | 자기 참조 확인 |
| `getNidLinkStats(content)` | 링크 통계 (총 개수, 고유 nid 수, nid별 카운트) |

## Cloze Parser (packages/core/src/parser/cloze-parser.ts)

`{{c숫자::내용::힌트?}}` 구문 분석.

```typescript
const CLOZE_REGEX = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

interface ClozeItem {
  clozeNumber: number;   // c 뒤의 숫자
  content: string;       // :: 사이의 내용
  hint?: string;         // 힌트 (있는 경우)
  raw: string;           // 원본 텍스트
  startIndex: number;
  endIndex: number;
}
```

**정규식 주의사항**: 캡처 그룹 2, 3에 `[^}]*?` (non-greedy, `}` 제외) 사용. `[^:}]+` 이 아님.

### 주요 함수

| 함수 | 용도 |
|------|------|
| `parseClozes(content)` | 모든 Cloze 추출 |
| `getMaxClozeNumber(content)` | 최대 Cloze 번호 |
| `getUsedClozeNumbers(content)` | 사용된 Cloze 번호 목록 (정렬됨) |
| `createCloze(number, content, hint?)` | Cloze 생성 |
| `resetClozesToC1(content)` | 모든 Cloze를 c1으로 리셋 |
| `renumberClozes(content)` | 번호 재정렬 (1부터 순차) |
| `getClozeStats(content)` | 통계 (총 개수, 고유 번호 수, 번호별 카운트) |
| `hasNoCloze(content)` | Cloze 없음 확인 |
| `extractClozeContents(content)` | Cloze 마크업 제거하고 내용만 추출 |

### Cloze 번호 처리 규칙

- 분할 후 모든 카드는 `{{c1::}}`로 리셋 (`resetClozesToC1`)
- 1 Note = 1 Atomic Card 원칙
