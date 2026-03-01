#!/bin/bash
# PostToolUse hook: Write/Edit 후 oxlint 실행
FILE_PATH=$(jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi
oxlint "$FILE_PATH" 2>&1 | head -20
