#!/usr/bin/env bash
# NFR-06: 운영 환경 접속과 되돌릴 수 없는 명령을 Bash 실행 전에 막는다 (PreToolUse 훅)
# 막을 때는 stderr에 이유와 대신 할 일을 쓰고 exit 2 (Claude에게 그대로 전달된다)
# 일반 명령이 느려지지 않도록 명령 문자열에 대한 bash 내장 정규식 검사만 한다 (git 호출 등 외부 조회 없음)

# jq가 없으면 막지 않고 통과한다 (다른 훅과 같은 방식)
command -v jq >/dev/null 2>&1 || exit 0

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0

block() {
  echo "차단: $1" >&2
  echo "대신: $2" >&2
  exit 2
}

# 외부 프로세스(grep)를 띄우지 않고 bash 내장 정규식으로 검사한다 (대소문자 무시)
shopt -s nocasematch
has() { [[ $cmd =~ $1 ]]; }

# 한 명령 구간(; & | 로 나뉘기 전) 안의 git ... push, 그 뒤 인자 구간
git_push='(^|[^[:alnum:]_-])git([[:space:]][^;&|]*)?[[:space:]]push'
push_args="${git_push}([[:space:]][^;&|]*)?[[:space:]]"

# NFR-06: 운영 호스트·DB (팀 명명 규칙)
if has 'eduhub-prod|prod-db'; then
  block "운영 호스트·DB(eduhub-prod, prod-db)에는 Claude가 접속하지 않는다." "운영 작업은 런북 절차에 따라 사람이 직접 실행한다. 확인이 필요하면 개발 DB(SGY_EHUB)에서 재현한다."
fi

# NFR-06: 스키마 전체 삭제
if has 'flywayclean'; then
  block "flywayClean은 스키마를 통째로 지워 되돌릴 수 없다." "새 V 마이그레이션 파일을 추가해 스키마를 바꾼다. 개발 DB 초기화가 꼭 필요하면 사람이 직접 실행한다."
fi

if has "${git_push}([[:space:]]|$)"; then
  # 강제 푸시: --force, --force-with-lease, -f, -uf 같은 묶음 옵션, +refspec
  if has "${push_args}(--force|-[[:alpha:]]*f[[:alpha:]]*([[:space:]]|$)|\+[^[:space:]]+)"; then
    block "강제 푸시는 원격 이력을 덮어써 되돌리기 어렵다." "git pull --rebase로 원격 변경을 합친 뒤 일반 git push를 한다."
  fi
  # main 직접 푸시: main, HEAD:main, refs/heads/main
  if has "${push_args}([^[:space:]]*:)?(refs/heads/)?main([[:space:]]|$)"; then
    block "main에는 직접 푸시하지 않는다." "작업 브랜치(feature/*, fix/*, chore/*, docs/*)를 푸시하고 main으로 PR을 연다."
  fi
fi

exit 0
