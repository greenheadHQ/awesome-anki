---
name: checking-freshness
description: |
  소스 코드가 변경되었는데 대응 스킬 문서가 업데이트되지 않았는지 확인.
  코드-문서 동기화 상태, 오래된 스킬 탐지, pre-commit 최신성 경고 등을 다룬다.
  Triggers: "문서 오래됐어", "스킬 최신화", "git log 수정일",
  "코드 문서 동기화", "스킬 업데이트 필요해", "references 최신화",
  "오래된 스킬", "문서 업데이트 필요", "docs freshness",
  "pre-commit 경고", "소스 변경 후 문서".
  Covers documentation freshness checking using git diff and lefthook pre-commit hook.
---

# 문서 최신성 확인

## 소스-스킬 매핑

| 소스 경로 | 대응 스킬 |
|-----------|-----------|
| `packages/core/src/anki/` (difficulty.ts 포함) | `working-with-anki` |
| `packages/core/src/splitter/` | `splitting-cards` |
| `packages/core/src/parser/` | `splitting-cards` |
| `packages/core/src/validator/` | `validating-cards` |
| `packages/core/src/embedding/` | `managing-embeddings` |
| `packages/core/src/prompt-version/` | `managing-prompts` |
| `packages/core/src/llm/` | `managing-llm`, `splitting-cards`, `validating-cards` |
| `packages/core/src/gemini/client.ts` | `understanding-project` |
| `packages/core/src/gemini/prompts.ts` | `managing-prompts` |
| `packages/core/src/gemini/cloze-enhancer.ts` | `managing-prompts` |
| `packages/core/src/gemini/validator.ts` | `splitting-cards` |
| `packages/server/src/history/` | `developing-web-api` |
| `packages/server/src/lib/` | `developing-web-api` |
| `packages/server/src/routes/` | `developing-web-api` |
| `packages/server/src/` | `developing-web-api` |
| `packages/web/src/lib/markdown-renderer.ts` | `developing-web-ui` |
| `packages/web/src/hooks/` | `developing-web-ui` |
| `packages/web/src/` | `developing-web-ui` |

## 자동화: lefthook pre-commit

`lefthook.yml`의 `docs-freshness` 커맨드가 staged 파일 중 `packages/**/*.{ts,tsx}` 변경 감지 시 `.claude/scripts/check-docs-freshness.sh`를 호출하여 대응 스킬의 최종 수정일 확인 (경고만, 블록하지 않음).

스크립트 내부의 매핑은 `references/git-diff-mechanism.md`에 상세 기술.

## 수동 확인 명령어

상세 스크립트는 `references/git-diff-mechanism.md` 참조. 요약:

```bash
# 전체 스킬 최신성 한 줄 확인
for f in .claude/skills/*/SKILL.md; do echo "$(basename $(dirname $f)): $(git log -1 --format='%ar' -- "$f")"; done

# 30일 이상 된 스킬 탐지
find .claude/skills -name "SKILL.md" | while read f; do
  d=$(( ($(date +%s) - $(git log -1 --format="%ct" -- "$f")) / 86400 ))
  [ $d -gt 30 ] && echo "$(basename $(dirname $f)): ${d}일 전"
done
```

## 세션 규칙

소스 코드 변경 시, 대응 스킬의 문서도 함께 최신화. 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록.

## 상세 참조

- `references/git-diff-mechanism.md` — 소스-스킬 매핑 전체, git log 스크립트, pre-commit hook 상세
- `references/troubleshooting.md` — 최신성 점검 시 자주 발생하는 오류 해결
