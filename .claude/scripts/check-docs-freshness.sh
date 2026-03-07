#!/usr/bin/env bash
# 소스 파일 변경 시 대응 스킬의 최신성 확인
# pre-commit hook에서 호출 (경고만 출력, 블록하지 않음)

set -euo pipefail

WARN_DAYS=30
SKILL_DIR=".claude/skills"

# 소스 경로 → 스킬 매핑 (활성 스킬만)
get_skill_for_path() {
  local path="$1"
  case "$path" in
    nix/*)                                echo "deploying-server" ;;
    Containerfile|docker-compose*.yml)     echo "deploying-server" ;;
    .claude/skills/*)                     echo "checking-freshness" ;;
    CLAUDE.md)                            echo "checking-freshness" ;;
    *)                                    echo "" ;;
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
