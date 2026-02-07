# git diff 기반 문서 최신성 확인 메커니즘

## 소스-스킬 매핑

```bash
# packages/core/src/anki/         → working-with-anki
# packages/core/src/splitter/     → splitting-cards
# packages/core/src/parser/       → splitting-cards
# packages/core/src/validator/    → validating-cards
# packages/core/src/embedding/    → managing-embeddings
# packages/core/src/prompt-version/ → managing-prompts
# packages/core/src/gemini/client.ts → understanding-project
# packages/core/src/gemini/prompts.ts → managing-prompts
# packages/core/src/gemini/cloze-enhancer.ts → managing-prompts
# packages/core/src/gemini/validator.ts → splitting-cards
# packages/server/src/            → developing-web-api
# packages/web/src/               → developing-web-ui
```

## 전체 스킬 최신성 확인

```bash
for file in .claude/skills/*/SKILL.md; do
  skill=$(basename $(dirname $file))
  last_modified=$(git log -1 --format='%ar' -- "$file" 2>/dev/null || echo "미추적")
  echo "$skill: $last_modified"
done
```

## 오래된 스킬 탐지 (30일 기준)

```bash
find .claude/skills -name "SKILL.md" | while read file; do
  last_commit=$(git log -1 --format="%ct" -- "$file" 2>/dev/null)
  if [ -n "$last_commit" ]; then
    days=$(( ($(date +%s) - last_commit) / 86400 ))
    [ $days -gt 30 ] && echo "$(basename $(dirname $file)): ${days}일 전"
  fi
done
```

## 코드 변경 후 문서 동기화 확인

```bash
# 특정 소스 파일의 마지막 변경일
git log -1 --format='%ar' -- packages/core/src/embedding/

# 대응 스킬의 마지막 변경일
git log -1 --format='%ar' -- .claude/skills/managing-embeddings/

# 소스가 스킬보다 최근에 변경되었다면 → 문서 업데이트 필요
```

## pre-commit hook

`.claude/scripts/check-docs-freshness.sh`에서 자동 확인:
- staged 파일 중 `packages/` 소스 변경 감지
- 대응 스킬의 마지막 수정일 확인
- 30일 이상이면 경고 출력 (블록하지 않음, exit 0 유지)
