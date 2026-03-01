---
name: checking-freshness
description: |
  This skill should be used when users request documentation freshness checks.
  Triggers: "문서 오래됐어", "스킬 최신화", "git log 수정일",
  "코드 문서 동기화", "스킬 업데이트 필요해", "references 최신화".
  Covers documentation freshness checking using git diff mechanism.
---

# 문서 최신성 확인

## 소스-스킬 매핑

| 소스 경로 | 대응 스킬 |
|-----------|-----------|
| `packages/core/src/anki/` | `working-with-anki` |
| `packages/core/src/splitter/` | `splitting-cards` |
| `packages/core/src/parser/` | `splitting-cards` |
| `packages/core/src/validator/` | `validating-cards` |
| `packages/core/src/embedding/` | `managing-embeddings` |
| `packages/core/src/prompt-version/` | `managing-prompts` |
| `packages/core/src/llm/` | `splitting-cards`, `validating-cards` |
| `packages/core/src/gemini/client.ts` | `understanding-project` |
| `packages/core/src/gemini/prompts.ts` | `managing-prompts` |
| `packages/core/src/gemini/cloze-enhancer.ts` | `managing-prompts` |
| `packages/core/src/gemini/validator.ts` | `splitting-cards` |
| `packages/server/src/routes/llm.ts` | `developing-web-api` |
| `packages/server/src/routes/history.ts` | `developing-web-api` |
| `packages/server/src/routes/media.ts` | `developing-web-api` |
| `packages/server/src/` | `developing-web-api` |
| `packages/web/src/` | `developing-web-ui` |

## 전체 스킬 최신성 확인

```bash
# 모든 스킬의 마지막 수정일 확인
for file in .claude/skills/*/SKILL.md; do
  echo "$(basename $(dirname $file)): $(git log -1 --format='%ar' -- "$file")"
done
```

## 오래된 스킬 탐지 (30일 기준)

```bash
find .claude/skills -name "SKILL.md" | while read file; do
  last_commit=$(git log -1 --format="%ct" -- "$file")
  days=$(( ($(date +%s) - last_commit) / 86400 ))
  [ $days -gt 30 ] && echo "$(basename $(dirname $file)): ${days}일 전"
done
```

## 코드-문서 동기화 확인

소스 파일의 최종 변경 시점과 대응 스킬의 마지막 수정 시점을 비교. 코드가 변경되었으나 문서가 업데이트되지 않은 경우 경고.

pre-commit hook (`.claude/scripts/check-docs-freshness.sh`)이 staged 파일 중 `packages/` 소스 변경이 있을 때 대응 스킬의 최종 수정일 확인 (경고만 출력, 블록하지 않음).

## 세션 규칙

소스 코드 변경 시, 대응 스킬의 문서도 함께 최신화. 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록.

## 상세 참조

- `references/git-diff-mechanism.md` — git log 기반 수정일 추출 상세
- `references/troubleshooting.md` — 최신성 점검 시 자주 발생하는 오류 해결
