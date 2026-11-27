# 관리자 앱(admin-mfe)을 course-mfe로 합치기 설계명세

- 요구사항: FR-03(관리자 과정 목록·회차 수정·마감 화면), NFR-03(관리자만), NFR-07
- 결정 사항: D-56 (이번에 추가). D-34·D-50·D-55 갱신
- 브랜치: `feature/admin-into-course-mfe`
- 범위: `frontend/apps/course-mfe`, `frontend/apps/admin-mfe`(삭제), `frontend/package-lock.json`, `.claude/launch.json`, `docs/`. 백엔드와 `packages/`는 바꾸지 않는다

## 1. 배경

관리자 화면이 두 앱에 나뉘어 있다. admin-mfe(3002)는 과정 목록·등록·수정·종료·회차 추가·수정·마감을, course-mfe(3001)는 과정 등록·수정·종료·회차 추가·명단·수료(D-55)를 가진다. 출처가 달라 로그인도 따로 유지된다(D-50). 사용자 결정: **관리자 기능을 course-mfe(3001) 하나로 합치고 admin-mfe는 삭제한다.** 옮기는 기능은 관리자로 로그인했을 때만 쓸 수 있다.

## 2. 결정 사항 (`docs/requirements.md`)

| ID | 항목 | 내용 |
|---|---|---|
| D-56 | 관리자 화면 통합 | 관리자 화면은 course-mfe(3001) 하나에 둔다. admin-mfe(3002)는 삭제한다. course-mfe에 관리자 과정 목록(`/admin/courses`, 종료된 과정 포함, 검색어·상태 필터, D-34), 회차 수정·마감을 더한다. 모든 관리자 화면은 `RequireAuth admin` 아래에 있고 서버 권한(D-43)이 최종 판단이다. 화면은 여전히 MFE(course-mfe) 안에 있으므로 NFR-07의 "화면은 MFE로 분리"는 유지된다 (D-34의 화면 위치, D-50, D-55의 "admin-mfe 화면은 그대로 둔다"·"회차 수정·마감은 두지 않는다"를 대체) |

D-34·D-50·D-55 행 끝에 "(D-56으로 갱신)"을 단다.

## 3. 화면

### 관리자 과정 목록 `/admin/courses` (신규 `pages/AdminCourseListPage.tsx`)
- 머리: "과정 관리", "과정 등록" 버튼(`/admin/courses/new`)
- 검색어, 상태(전체·운영 중·종료), 검색 버튼. 표(제목·분류·상태 칩), 페이지 나누기(10·20·50)
- 목록 상태는 URL 쿼리(`keyword`, `status`, `page`, `size`)에 둔다(공개 목록 D-25와 같은 규칙, 기본값은 뺀다)
- 행을 누르면 `/admin/courses/{id}/edit`(D-51과 같은 행 클릭 규칙: 수정키·가운데 클릭·텍스트 선택 시 무시, 제목은 링크)
- 로딩·빈 목록("조회된 과정이 없습니다.")·오류(403 "관리자만 볼 수 있습니다.", 그 밖 일반 문구 + 다시 시도)

### 과정 수정 화면의 회차 수정·마감 (`pages/CourseFormPage.tsx`)
- 회차 표에 "관리" 열: "수정", "마감" 버튼. 과정이 종료됐거나 회차가 마감이면 둘 다 없음
- 수정: Dialog(시작일·장소·정원, 검증은 회차 추가와 같다) → `updateSession` → refresh. 409(확정자가 있는 회차의 정원 변경, D-38) 등은 서버 detail을 Dialog 안에 그대로
- 마감: 확인 Dialog("회차를 마감할까요? 남은 대기 신청은 …" 문구는 D-04가 아직 구현 전이므로 넣지 않는다) → `closeSession` → refresh
- 요청 중에는 Dialog를 닫지 못하고 버튼 비활성. 성공 뒤 refresh 실패면 기존 갱신 실패 안내 방식

### 상단 바 (`App.tsx` TopBar)
- 관리자면 "과정 관리"(`/admin/courses`)를 보인다. 기존 "과정 등록" 링크는 목록 화면의 버튼으로 옮기고 상단 바에서는 뺀다

## 4. API·훅

- `hooks/useAdminCourses.ts`(신규): `searchAdminCourses({status, keyword, page, size})` → `{ data, loading, error(kind forbidden|error), reload }`. ignore 패턴, admin-mfe의 같은 훅을 옮겨 403 분류를 더한다
- `hooks/useAdminCourseActions.ts`: `updateSession(id, sessionId, sessionRequest)`, `closeSession(id, sessionId)` 추가(같은 오류 클래스·pending)

## 5. admin-mfe 삭제

- `frontend/apps/admin-mfe/` 디렉터리 삭제, `frontend`에서 `npm install`로 `package-lock.json`의 admin-mfe 항목 제거
- `.claude/launch.json`의 `admin-mfe` 설정 제거, 실행 중인 3002 개발 서버 종료
- 지난 설계명세·계획(NFR-03-admin-login 등)의 admin-mfe 언급은 기록이므로 고치지 않는다

## 6. 테스트

- `AdminCourseListPage.test.tsx`: 목록 표시(종료 과정 포함, 상태 칩), 상태 필터·검색이 URL 쿼리와 훅 인자로 반영, 행 클릭 → 수정 화면, 403 안내
- `CourseFormPage.test.tsx`: 회차 수정 Dialog 저장 → updateSession·refresh, 409 detail 표시, 회차 마감 확인 → closeSession, 종료 과정·마감 회차에는 버튼 없음
- 훅 테스트: `useAdminCourses`, `useAdminCourseActions`의 새 함수
- `App.test.tsx`: `/admin/courses` 라우트(관리자만), 상단 바 "과정 관리"

## 7. 브라우저 확인 표

| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | 관리자로 상단 "과정 관리" | 종료 과정까지 포함한 목록, 상태 필터·검색 동작 |
| 2 | 목록 행 클릭 | 그 과정의 수정 화면 |
| 3 | 회차 "수정" → 장소·일정 변경 저장 | 표에 반영. 확정자가 있는 회차의 정원 변경은 서버 이유(409) |
| 4 | 회차 "마감" → 확인 | 상태 "마감", 수정·마감 버튼 사라짐 |
| 5 | 사원으로 `/admin/courses` | "권한이 없습니다." |
| 6 | `http://localhost:3002` | 더 이상 열리지 않는다(앱 삭제) |
