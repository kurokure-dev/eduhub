# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

EduHub는 사내 교육과정 조회 및 수강 신청 시스템이다.
임직원이 회차에 신청하고, 정원이 차면 대기자로 등록된다.

## 디렉터리 지도

- `docs/requirements.md`: 요구사항(FR-01~09, NFR-01~08)과 결정 사항(D-01~13). 요구사항과 업무 규칙의 기준
- `backend/`: Spring Boot 백엔드. 작업 규칙은 `backend/CLAUDE.md`
- `frontend/`: React 18 + TypeScript 프론트엔드 (아직 코드 없음). 작업 규칙은 `frontend/CLAUDE.md`
- `.github/pull_request_template.md`: PR 본문 양식
- `.env.example`: 필요한 환경 변수 이름 (값 없음)

## 실행 명령

- 백엔드 테스트: `cd backend && ./gradlew test`
- 백엔드 로컬 실행: `cd backend && ./gradlew bootRun` (dev 프로필, 개발 DB(SQL Server) 접속 정보가 담긴 루트 `.env` 필요)
- 테스트 하나만 실행, 포맷 검사 같은 세부 명령은 `backend/CLAUDE.md`

## 공통 규칙

- 요구사항은 `docs/requirements.md`를 기준으로 한다 (결정 사항 D-xx 포함). 규칙이 애매하면 짐작으로 쓰지 말고 결정 사항을 먼저 확인하고, 없으면 사용자에게 묻고 답을 D-번호로 추가한다
- 커밋 메시지는 Conventional Commits 형식이다 (예: `feat(backend): ...`, `docs: ...`)
- 브랜치는 작업 성격에 맞는 접두사로 만든다 (`feature/*`, `fix/*`, `chore/*`, `docs/*`). `main`으로 PR을 연다
- 비밀 정보는 코드와 설정 파일에 쓰지 않는다. 환경 변수와 `.env`(커밋 금지)만 쓰고, 새 환경 변수는 `.env.example`에 이름만 추가한다
- 문서, 주석, 커밋 메시지는 한국어로 쓴다. 설정 파일 주석에는 관련 NFR 번호를 단다 (예: `# NFR-02: ...`)
- 줄바꿈은 `.gitattributes`로 LF로 고정한다 (`*.bat`만 CRLF)

## 설계할 때 주의할 업무 규칙

`docs/requirements.md`의 결정 사항 중 설계에 직접 영향을 주는 것:

- **동시성 (NFR-01)**: 100명이 마지막 1자리에 동시 신청해도 정원을 넘으면 안 된다. 신청, 취소에 따른 자동 승급(D-01), 정원 증감에 따른 승급·강등(D-05, D-06), 마감 시 대기 자동 취소(D-04)가 모두 한 회차의 대기열을 바꾸므로 회차 단위로 직렬화해야 한다. course의 회차 행을 비관적 락(UPDLOCK)으로 잡아 직렬화하고, enrollment는 course를 단방향으로만 참조한다(D-29)
- **대기 순번은 신청 시각 순서가 아니다**: 정원 감소로 강등된 확정자는 대기 맨 앞으로 간다(D-12). 그래서 대기열에는 신청 시각과 별개의 정렬 키가 필요하다. 대기자가 취소하면 뒷순번이 당겨지고(D-01), 신청 내역 조회 때 현재 순번을 보여 준다(D-09)
- **"종료"는 모집 마감이다 (D-11)**: 회차의 시작·끝 시점은 관리하지 않는다(D-02). 취소와 정원 변경은 마감 전까지만, 수료 처리는 마감 뒤 언제든 할 수 있다(D-02, D-10, D-13). 별도의 미수료 상태는 없다
- **중복 신청**: 같은 회차에 확정·대기 상태가 동시에 둘일 수 없지만, 취소 후 재신청은 된다(D-07). 같은 과정의 다른 회차는 동시에 신청할 수 있다(D-08)
- **아직 정하지 않은 것**: 인증 방식(NFR-03), CI 플랫폼, 배포 대상. 이 결정이 필요한 작업이면 먼저 사용자에게 묻는다

## 개발 진행 절차 (기능 단위)
1. 시작: /fr-start <요구사항ID> → 설계명세(docs/design/) → 개발자 승인 → 구현계획(docs/plans/) → 개발자 승인
2. 구현: 계획의 작업마다 implementer에게 맡기고, 끝나면 reviewer로 검토한다
   - 심각·경고는 implementer에게 수정시킨다. 수정·재검토는 최대 2회, 넘으면 개발자에게 보고한다
3. 최종 검토: 모든 작업이 끝나면 critical-reviewer에게 설계명세 + 전체 diff + 1차 검토 결과를 넘긴다
4. 서브에이전트를 호출할 때 model은 지정하지 않는다 (정의 파일의 model을 따른다)
5. 3개 이상 파일·여러 계층에 걸친 작업이나 diff 1,000줄 이상은 개발자에게 알리고 지시를 받는다
6. 수량 변경(정원, 대기 순번)에는 반드시 락, 중복 방지는 DB 유일 제약으로 보장한다
