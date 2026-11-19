#!/usr/bin/env bash
# NFR-03, NFR-04, NFR-06: 사람이 관리해야 하는 파일을 Claude가 Edit/Write로 고치지 못하게 막는다 (PreToolUse 훅)
# 막을 때는 stderr에 이유와 대신 할 일을 쓰고 exit 2 (Claude에게 그대로 전달된다)

# jq가 없으면 막지 않고 통과한다 (format.sh와 같은 방식)
command -v jq >/dev/null 2>&1 || exit 0

file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file_path" ] || exit 0

# Windows 경로(C:\...)도 같은 규칙으로 비교하도록 / 로 통일
path="${file_path//\\//}"
name="${path##*/}"

# Windows 파일 시스템은 대소문자를 구분하지 않으므로 비교도 대소문자 무시
shopt -s nocasematch

block() {
  echo "차단: $1" >&2
  echo "대신: $2" >&2
  exit 2
}

case "$name" in
  application-prod.yml)
    # NFR-06: 운영 설정은 사람이 관리
    block "운영 설정은 사람이 PR로만 수정한다." "개발 설정은 backend/src/main/resources/application-dev.yml에서 바꾼다." ;;
  .env.example)
    # 변수 이름만 담는 예시 파일은 허용
    ;;
  .env|.env.*)
    # NFR-03: 비밀 정보 보호
    block "비밀 파일은 수정하지 않는다." ".env.example에 변수 이름만 추가한다." ;;
esac

case "$path" in
  */db/migration/V*.sql)
    # NFR-06: 적용된 마이그레이션은 바꾸지 않는다 (새 파일 작성은 허용)
    if [ -e "$path" ]; then
      block "이미 있는 마이그레이션($name)은 수정하지 않는다." "다음 버전 번호로 새 V파일을 추가한다."
    fi ;;
  */frontend/packages/api-client/src/generated/*)
    # NFR-04: 프론트 클라이언트는 스펙에서 생성
    block "생성 코드라 직접 고치지 않는다." "백엔드 API를 바꾼 뒤 frontend에서 npm run generate:api로 다시 만든다." ;;
esac

exit 0
