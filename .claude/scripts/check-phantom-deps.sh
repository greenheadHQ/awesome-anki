#!/usr/bin/env bash
# check-phantom-deps.sh — import된 패키지가 dependencies에 없는 "유령 의존성" 탐지
#
# Bun/Node는 hoisted node_modules에서 직접 의존하지 않는 패키지도 resolve하므로,
# 로컬에서는 통과하지만 Docker(--frozen-lockfile)에서 crash하는 런타임 에러를 방지한다.
#
# 사용: .claude/scripts/check-phantom-deps.sh [package_dir ...]
#       인자 없으면 packages/core, packages/server를 검사

set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'

check_package() {
  local pkg_dir="$1"
  local pkg_json="$pkg_dir/package.json"
  local src_dir="$pkg_dir/src"
  local errors=0

  if [[ ! -f "$pkg_json" ]] || [[ ! -d "$src_dir" ]]; then
    return 0
  fi

  # package.json에서 dependencies + devDependencies 키 추출
  local declared
  declared=$(python3 -c "
import json, sys
with open('$pkg_json') as f:
    pkg = json.load(f)
deps = set(pkg.get('dependencies', {}).keys())
deps.update(pkg.get('devDependencies', {}).keys())
# workspace protocol
for d in list(deps):
    print(d)
" 2>/dev/null || true)

  # 소스에서 import된 외부 패키지 추출 (node: 내장, ./ ../ 상대경로 제외)
  local imported
  imported=$(
    grep -rhE "^import .+ from ['\"]|^import ['\"]" "$src_dir" 2>/dev/null \
      | sed -E "s/.*from ['\"]([^'\"]+)['\"].*/\1/" \
      | sed -E "s/.*import ['\"]([^'\"]+)['\"].*/\1/" \
      | grep -vE '^\.' \
      | grep -vE '^node:' \
      | grep -vE '^bun:' \
      | sed -E 's|^(@[^/]+/[^/]+).*|\1|; s|^([^@/]+).*|\1|' \
      | sort -u || true
  )

  for pkg in $imported; do
    # 워크스페이스 패키지(@anki-splitter/*)는 건너뜀
    if [[ "$pkg" == @anki-splitter/* ]]; then
      continue
    fi

    if ! echo "$declared" | grep -qx "$pkg"; then
      echo -e "${RED}✗${NC} $pkg_dir: '$pkg' is imported but not in package.json dependencies"
      errors=$((errors + 1))
    fi
  done

  return $errors
}

if [[ $# -gt 0 ]]; then
  dirs=("$@")
else
  dirs=("packages/core" "packages/server")
fi
total_errors=0

for dir in "${dirs[@]}"; do
  if ! check_package "$dir"; then
    total_errors=$((total_errors + 1))
  fi
done

if [[ $total_errors -gt 0 ]]; then
  echo ""
  echo "Phantom dependencies detected. Add them to the package's package.json"
  echo "or remove the import. This prevents Docker runtime crashes."
  exit 1
fi
