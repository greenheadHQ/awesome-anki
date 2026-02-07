#!/usr/bin/env bash
# 소스 파일 변경 시 대응 스킬의 최신성 확인
# pre-commit hook에서 호출 (경고만 출력, 블록하지 않음)

set -euo pipefail

WARN_DAYS=30
SKILL_DIR=".claude/skills"

# 소스 경로 → 스킬 매핑
get_skill_for_path() {
  local path="$1"
  case "$path" in
    packages/core/src/anki/*)           echo "working-with-anki" ;;
    packages/core/src/splitter/*)       echo "splitting-cards" ;;
    packages/core/src/parser/*)         echo "splitting-cards" ;;
    packages/core/src/validator/*)      echo "validating-cards" ;;
    packages/core/src/embedding/*)      echo "managing-embeddings" ;;
    packages/core/src/prompt-version/*) echo "managing-prompts" ;;
    packages/core/src/gemini/prompts.ts)        echo "managing-prompts" ;;
    packages/core/src/gemini/cloze-enhancer.ts) echo "managing-prompts" ;;
    packages/core/src/gemini/validator.ts)      echo "splitting-cards" ;;
    packages/core/src/gemini/client.ts)         echo "understanding-project" ;;
    packages/server/src/*)              echo "developing-web-api" ;;
    packages/web/src/*)                 echo "developing-web-ui" ;;
    *)                                  echo "" ;;
  esac
}

warned_skills=()

for file in "$@"; do
  skill=$(get_skill_for_path "$file")
  [ -z "$skill" ] && continue

  # 이미 경고한 스킬은 건너뜀
  for warned in "${warned_skills[@]+"${warned_skills[@]}"}"; do
    [ "$warned" = "$skill" ] && continue 2
  done

  skill_file="$SKILL_DIR/$skill/SKILL.md"
  [ ! -f "$skill_file" ] && continue

  last_commit=$(git log -1 --format="%ct" -- "$skill_file" 2>/dev/null || echo "")
  [ -z "$last_commit" ] && continue

  days=$(( ($(date +%s) - last_commit) / 86400 ))

  if [ "$days" -gt "$WARN_DAYS" ]; then
    echo "⚠️  스킬 '$skill' 문서가 ${days}일 전에 마지막으로 수정됨 (소스: $file)"
    warned_skills+=("$skill")
  fi
done

# 경고만 출력, 블록하지 않음
exit 0
