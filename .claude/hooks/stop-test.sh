#!/usr/bin/env bash
# NFR-05: Claude가 응답을 마칠 때 백엔드 코드가 바뀌었으면 테스트를 돌린다 (Stop 훅)
# 실패하면 {"decision":"block","reason":...}을 stdout으로 내보내 Claude가 멈추지 않고 고치게 한다
# 도구가 없거나 판단할 수 없으면 막지 않고 exit 0

command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)

# 이미 Stop 훅 때문에 이어서 작업 중이면 다시 막지 않는다 (무한 반복 방지)
[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" = "true" ] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir" || exit 0

# 백엔드 코드가 바뀌지 않았으면 테스트를 돌리지 않는다
[ -n "$(git status --porcelain -- backend/src 2>/dev/null)" ] || exit 0

output=$(cd backend && ./gradlew test -q 2>&1) && exit 0
output=$(tr -d '\r' <<<"$output")

# -q에서는 테스트별 FAILED 줄이 안 나오므로, 테스트가 실행됐다면 JUnit XML 보고서에서 실패 테스트와 메시지를 꺼낸다
details=""
if grep -q 'tests completed' <<<"$output"; then
  details=$(grep -h -B1 '<failure' backend/build/test-results/test/*.xml 2>/dev/null \
    | sed -nE 's/.*<testcase name="([^"]*)" classname="([^"]*)".*/\2 > \1 FAILED/p; s/.*<failure message="([^"]*)".*/    \1/p' \
    | sed -E 's/&#13;//g; s/&#10;/ /g; s/ +/ /g; s/&quot;/"/g; s/&apos;/'"'"'/g; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g')
fi

# 실패 줄만 20줄 고른다. 컴파일 오류(error:)와 단언 실패(AssertionFailedError)도 함께 잡는다
failures=$(printf '%s\n%s\n' "$details" "$(grep -iE 'failed|exception|error' <<<"$output")" | sed '/^$/d' | head -20)
# 고를 줄이 없으면(빌드 도구 오류 등) 마지막 20줄을 그대로 쓴다
[ -n "$failures" ] || failures=$(tail -20 <<<"$output")

reason="백엔드 테스트(./gradlew test)가 실패했다. 원인을 고친 뒤 다시 확인하라.
${failures}"

jq -n --arg r "$reason" '{decision: "block", reason: $r}'
exit 0
