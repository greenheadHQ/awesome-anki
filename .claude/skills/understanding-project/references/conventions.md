# 코딩 규칙 및 컨벤션

## export 규칙

`packages/core/src/index.ts`에서 **명시적 named export** 사용.

### 충돌 사례

- `SplitCard`: `anki/operations.ts`와 다른 파일에서 중복
- `validateStylePreservation`: `gemini/validator.ts`와 `utils/formatters.ts`에서 중복

### 해결

```typescript
// ❌ 충돌 발생
export * from './anki/index.js';
export * from './gemini/index.js';

// ✅ 명시적 export
export {
  ankiConnect,
  getVersion,
  // ... 개별 항목 나열
} from './anki/client.js';
```

### prompt-version 접두사 규칙

AnkiConnect의 `getVersion`과 충돌 방지:
- `listVersions` → `listPromptVersions`
- `getVersion` → `getPromptVersion`
- `saveVersion` → `savePromptVersion`
- `deleteVersion` → `deletePromptVersion`
- `createVersion` → `createPromptVersion`

## 실행 방법

```bash
# 개발 서버 (서버 + 클라이언트 동시)
bun run dev

# 개별 실행
bun run dev:server   # localhost:3000
bun run dev:web      # localhost:5173

# CLI
bun run cli:status   # 연결 확인
bun run cli:split    # 분할 미리보기
bun run cli:split -- --apply  # 분할 적용
bun run cli split --note 1757399484677  # 특정 카드

# 타입체크
bun run --cwd packages/web tsc --noEmit
bun run --cwd packages/server tsc --noEmit

# 린트 + 포맷 (oxc)
bun run lint             # 전체 패키지 린트 (oxlint + oxfmt --check)
bunx oxlint src          # 개별 패키지에서 직접 실행
bunx oxfmt --check src   # 포맷 검사
bunx oxfmt src           # 포맷 적용
```

## 모노레포 설정

- bun workspace: `"workspaces": ["packages/*"]`
- `concurrently`로 서버/클라이언트 동시 실행
- 각 패키지 독립 tsconfig.json

## 포트 충돌 해결

```bash
# 포트 사용 프로세스 종료
pkill -f "vite" 2>/dev/null
pkill -f "bun.*server" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# 실행 중인 서버 확인
lsof -i:3000
lsof -i:5173
```
