# course-mfe 관리자 과정 폼·회차 명단 화면 설계명세 (FR-03, FR-08 화면)

## Context

관리자가 course-mfe 안에서 과정을 등록·수정·종료하고, 회차 명단에서 수료 처리할 수 있게 한다. 지금 `/admin/courses/new`, `/admin/courses/:courseId/edit`, `/admin/sessions/:sessionId/roster`는 "준비 중" 화면이다(D-54). 백엔드 API는 이미 있다(AdminCourseApi, AdminEnrollmentApi, 생성 클라이언트 반영됨). 백엔드는 고치지 않는다.

D-34는 "관리자 화면은 admin-mfe에 둔다"고 했고 admin-mfe에는 FR-03 화면이 이미 있다. 사용자 결정: **course-mfe에 만들고 D-55로 D-34를 갱신한다**. admin-mfe 코드는 건드리지 않고 폼 검증 규칙만 같게 맞춘다.

## 진행 절차

1. `main`에서 `feature/fr-03-08-admin-ui` 브랜치
2. 설계명세 `docs/design/FR-03-08-admin-ui.md`, 구현계획 `docs/plans/FR-03-08-admin-ui.md`(이 계획을 옮김), `docs/requirements.md`에 D-55 추가
3. 작업마다 implementer → reviewer(심각·경고 수정, 최대 2회) → 끝나면 critical-reviewer

## 결정 사항 (추가)

- **D-55 course-mfe의 관리자 화면**: course-mfe에도 관리자용 과정 등록·수정·종료·회차 추가 화면(`/admin/courses/new`, `/admin/courses/{id}/edit`)과 회차 명단·수료 화면(`/admin/sessions/{sessionId}/roster`)을 둔다. admin-mfe의 FR-03 화면은 그대로 둔다(두 앱에 같은 기능이 있다). 입력 검증은 admin-mfe·백엔드와 같다(제목 200, 분류 50, 설명 2000, 장소 200, 정원 1 이상 정수). 서버 오류는 ProblemDetail의 `detail`을 그대로 보여 준다. 회차 수정·마감은 course-mfe에 두지 않는다 (D-34 갱신, D-54의 "준비 중" 대체)

## 작업 1 — API·훅 (`frontend/apps/course-mfe/src/`)

- `api/adminEnrollmentApi.ts`(신규): 기존 `api/adminCourseApi.ts`처럼 `apiConfig`, `http`로 `AdminEnrollmentApi` 생성
- `hooks/httpStatus.ts`: `problemDetailOf(e)` 추가 — 응답 `detail`이 문자열이면 그것, 아니면 undefined (admin-mfe `api/adminCourseApi.ts`의 `toErrorMessage`와 같은 규칙)
- `hooks/useAdminCourseActions.ts`(신규): `createCourse`, `updateCourse`, `closeCourse`, `createSession`. admin-mfe의 같은 이름 훅과 같은 모양(Promise 반환, 실패는 거부) + `pending` 카운터(T2의 `useEnroll` 방식)
- `hooks/useRoster.ts`(신규): `getRoster({sessionId})` → `{ data, loading, error(kind: forbidden 403 / notFound 404 / error), reload }`. `useMyEnrollments`의 ignore 패턴. sessionId 파싱은 `useCourseDetail`의 양의 정수 규칙
- `hooks/useCompleteEnrollments.ts`(신규): `complete(sessionId, employeeIds)` → `CompletionResponse`, 실패는 kind(`conflict`/`forbidden`/`notFound`/`error`)와 서버 `detail`을 담아 거부, `pending`
- 수정 화면 조회는 기존 `useCourseDetail(courseId, { admin: true })`와 `refresh()`를 그대로 쓴다(제목·분류·설명·closed·회차 제공)
- 테스트: 새 훅들의 단위 테스트(기존 훅 테스트 패턴)

## 작업 2 — 화면·라우트

- `pages/CourseFormPage.tsx`(신규, 한 컴포넌트로 두 모드)
  - 등록(`/admin/courses/new`): 제목·분류·설명 → "등록" → `createCourse` → `navigate('/admin/courses/{id}/edit', { replace: true })`
  - 수정(`/admin/courses/:courseId/edit`): 값을 채운 폼 → "저장" → `updateCourse` → "저장되었습니다". 회차 표(시작일·장소·남은 자리/정원·상태·"명단" 링크), 회차 추가 폼(시작일·장소·정원) → `createSession` → `refresh()`. "과정 종료" → 확인 Dialog → `closeCourse` → `refresh()`. "과정 상세로" 링크
  - 종료된 과정: `Alert "종료된 과정입니다"`, 모든 입력·저장·회차 추가·종료 버튼 비활성
  - 서버 오류(409 등)는 `problemDetailOf` 문구를 그대로 `Alert`로, 없으면 일반 문구. 404면 "과정을 찾을 수 없습니다"
- `enrollment/RosterPage.tsx`(신규, `/admin/sessions/:sessionId/roster`)
  - 머리: 과정명, 시작일(필요하면 정원·마감 여부)
  - 확정자 표: 체크박스(CONFIRMED만), 이름, 사번, 상태(수료자는 "수료" 칩, 체크박스 없음). 전체 선택 체크박스
  - 대기자 표: `waitingRank` 순으로 정렬해 순번·이름·사번
  - "선택한 N명 수료 처리"(0명·pending이면 비활성) → `complete` → `"N명을 수료 처리했습니다."` + 실패 목록(사번 + 사유: WAITING "대기 중", NOT_ENROLLED "신청 내역 없음", ALREADY_COMPLETED "이미 수료") → 선택 해제 + `reload()`
  - 409: 서버 `detail` 그대로(예: 시작일 전), 403(조회·처리 모두): "관리자만 볼 수 있습니다.", 404: "회차를 찾을 수 없습니다"
- `App.tsx`: 세 라우트의 `PreparingPage`를 새 화면으로 교체(모두 `RequireAuth admin` 유지). `PreparingPage.tsx`가 더 쓰이지 않으면 삭제. `App.test.tsx` 갱신

## 작업 3 — 테스트 (Vitest)

- `enrollment/RosterPage.test.tsx`(요청된 3개 + α): 훅 모킹, MemoryRouter
  1. 명단 표시: 과정명·시작일, 확정자 이름·사번·체크박스, 수료자는 "수료"·체크박스 없음, 대기자가 순번 순
  2. 수료 결과: 두 명 선택 → 처리 → "1명을 수료 처리했습니다." + 실패 사번과 사유, reload 호출
  3. 409: 서버 이유 문구가 보인다
  - (+) 403 "관리자만 볼 수 있습니다."
- `pages/CourseFormPage.test.tsx`: 등록 후 수정 화면으로 이동, 종료된 과정이면 입력 비활성·"종료된 과정입니다", 서버 409 메시지 표시, 회차 추가 후 refresh

## 브라우저 확인 표 (설계명세에 적는다)

| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | 관리자로 상단 "과정 등록" → 입력 → 등록 | 수정 화면(`/admin/courses/{id}/edit`)으로 이동 |
| 2 | 제목·설명 수정 → 저장 | "저장되었습니다", 과정 상세에 반영 |
| 3 | 회차 추가(정원 1 이상) | 회차 표에 추가. 잘못된 값이면 버튼 비활성 |
| 4 | 과정 종료 → 확인 | "종료된 과정입니다", 입력·버튼 비활성 |
| 5 | 명단에서 확정자 선택 → 수료 처리 | "N명을 수료 처리했습니다.", 처리 못 한 사원과 사유, 수료자는 "수료" |
| 6 | 시작일 전 회차에서 수료 처리 / 일반 사원으로 관리자 주소 접근 | 서버 이유(409) 표시 / "권한이 없습니다."(RequireAuth) |

## 검증

- `frontend/apps/course-mfe`에서 `npm run build && npm test`
- 브라우저: course-mfe 개발 서버 + 개발 백엔드. 관리자(`DEV-A001`) 로그인은 사용자가 패널에서 직접 한다(비밀번호는 `.env` 값이라 내가 입력하지 않음). 6번의 사원 접근은 `DEV-E001`로 다시 로그인이 필요하다
