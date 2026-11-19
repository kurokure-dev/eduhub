#!/usr/bin/env bash
# NFR-05: Claude가 Edit/Write로 고친 파일을 자동 포맷한다 (PostToolUse 훅)
# 포맷 도구가 없거나 실패해도 Claude 작업을 막지 않도록 항상 exit 0으로 끝낸다

# jq가 없으면 아무것도 하지 않는다
command -v jq >/dev/null 2>&1 || exit 0

file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file_path" ] || exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$file_path" in
  *.java)
    # NFR-05: Spotless로 백엔드 포맷
    if [ -f "$project_dir/backend/gradlew" ]; then
      (cd "$project_dir/backend" && ./gradlew spotlessApply -q) >/dev/null 2>&1
    fi
    ;;
  *.ts|*.tsx)
    # NFR-05: 프론트엔드 prettier로 그 파일만 포맷 (설치돼 있을 때만, npx로 내려받지 않는다)
    prettier="$project_dir/frontend/node_modules/.bin/prettier"
    if [ -x "$prettier" ] || [ -f "$prettier" ]; then
      (cd "$project_dir/frontend" && "$prettier" --write "$file_path") >/dev/null 2>&1
    fi
    ;;
esac

exit 0
