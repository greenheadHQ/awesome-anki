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
  stack: ContainerBlock[];
  currentBlock: ContainerBlock | null;
}
```

### 설계 결정

- 정규식만으로는 중첩 `::: toggle` 처리 불가
- 스택 기반 상태 머신으로 중첩 depth 정확히 추적

### 분할 제외 규칙

- `::: toggle todo` 블록은 분할 대상에서 제외 (미완성 상태)

## nid Link Parser (packages/core/src/parser/nid-parser.ts)

`[제목|nid{13자리}]` 패턴 추출.

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

## Cloze Parser (packages/core/src/parser/cloze-parser.ts)

`{{c숫자::내용::힌트?}}` 구문 분석.

```typescript
const CLOZE_PATTERN = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;

interface ClozeItem {
  clozeNumber: number;
  content: string;
  hint?: string;
}
```

### Cloze 번호 처리 규칙

- 분할 후 모든 카드는 `{{c1::}}`로 리셋
- 1 Note = 1 Atomic Card 원칙
