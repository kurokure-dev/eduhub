# FR-06 신청 취소 + 신청·내 신청 화면 설계명세

## Context

course-mfe에 신청 기능을 붙인다. 수강생이 과정 상세에서 회차를 신청하고, 내 신청 내역에서 확인·취소한다.
조사 결과 요청 범위를 그대로는 만들 수 없는 점이 있어 사용자 답을 반영했다.

| 확인한 사실 | 결정 |
|---|---|
| 백엔드에 취소 API(FR-06)가 없다 (`EnrollmentApi`는 `enroll`, `findMine`뿐) | **이번에 취소 API를 백엔드도 같이 만든다** |
| D-26: "행 전체 클릭은 쓰지 않는다" | 행 클릭으로 바꾸고 **D-51**으로 D-26을 대체한다 |
| 공개 상세는 종료 과정을 404로 주고(D-20) 상태 필드가 없다 | **관리자만** `AdminCourseApi.getAdminCourse`로 상태를 받아 "종료"를 표시한다. 일반 사용자는 지금처럼 404 안내 |
| "6-2 확인 표"가 저장소에 없다 | 아래 "브라우저 확인 표 1~6"을 설계명세에 적고 그것으로 검증한다 |
| 신청 응답(`EnrollmentResponse`)에 대기 순번이 없다 | 백엔드를 여는 김에 응답에 `waitingRank`(대기일 때만)를 더한다 (**D-53**). 화면이 다시 조회하지 않아도 "대기 N번"을 보여 줄 수 있다 |

- 요구사항: FR-04(화면), FR-06, FR-07(화면), NFR-03
- 결정 사항: D-51~D-54 (이번에 추가), D-01, D-02, D-29, D-39, D-45, D-46
- 브랜치: `feature/fr-06-enroll-cancel-ui`

## 진행 절차

1. 브랜치: 로그인 커밋(4e902d7)이 아직 main에 없으므로 현재 브랜치에서 `feature/fr-06-enroll-cancel-ui`를 딴다
2. 이 계획을 `docs/design/FR-06-enroll-cancel-ui.md`(설계명세)와 `docs/plans/FR-06-enroll-cancel-ui.md`(작업 목록)로 옮기고, `docs/requirements.md`에 D-51~D-54 추가, D-26·D-41 갱신
3. 작업마다 implementer → reviewer (심각·경고는 수정, 최대 2회), 끝나면 critical-reviewer
4. 백엔드 작업은 `eduhub-api` 스킬 절차를 따른다

## 결정 사항 (추가)

- **D-51 상세로 이동**: 목록 행 전체를 누르면 `/courses/{id}`로 간다(useNavigate). 제목 링크는 키보드·새 탭용으로 남긴다 (D-26 대체)
- **D-52 신청 취소**: `POST /api/me/enrollments/{enrollmentId}/cancel`. 본인 신청만(남의 신청·없는 신청 404, D-45). 확정·대기만 취소, 수료·취소 상태는 409. 마감된 회차는 409(D-02). 회차 행 락 아래에서 처리(D-29). 확정 취소면 자리를 비우고 대기 1순위(`waiting_order` 최소)를 확정으로 승급(FR-06). 대기에서 벗어나는 행은 `waiting_order`를 NULL로(D-46). 뒷순번은 조회 때 계산하므로 자동으로 당겨진다(D-01, D-39). 정원 증감 승급·강등(D-05, D-06), 마감 시 대기 자동 취소(D-04), D-38 해제는 이번 범위가 아니다
- **D-53 신청 응답의 대기 순번**: `EnrollmentResponse`에 `waitingRank`(WAITING일 때만, 아니면 null)를 둔다. 새 대기는 키가 회차 최대값이므로 순번 = 회차의 대기 수 (FR-05의 응답 부분을 앞당김. 강등 키는 FR-05에 남김)
- **D-54 course-mfe의 관리자 표시**: 관리자가 과정 상세를 열면 관리자 상세 API로 조회해 과정 "종료" 칩과 마감 회차를 보여 주고, 종료 과정·마감 회차에는 신청 버튼을 두지 않는다. "과정 수정"(`/admin/courses/{id}/edit`), 회차별 "명단"(`/admin/sessions/{sessionId}/roster`) 링크는 Step 16 전까지 "준비 중" 화면으로 간다
- D-41: 취소가 생겼으므로 배포 제한 사유를 "D-38(정원 변경)만 남음"으로 갱신

## 작업 1 — 백엔드 취소 API + 신청 응답 순번

경로: `backend/src/main/java/com/example/eduhub/`

- `enrollment/domain/Enrollment.java`: `cancel()`(확정·대기만, 상태 CANCELLED, `waitingOrder=null`), `promote()`(대기→확정, `waitingOrder=null`)
- `course/domain/CourseSession.java`: `releaseSeat()` (`confirmedCount--`, 0 미만 방지). `occupySeat()`와 짝
- `enrollment/repository/EnrollmentRepository.java`:
  - `findSessionIdByIdAndEmployeeId(id, employeeNo)` — 엔티티를 읽지 않는 투영 쿼리. 락 전에 회차 엔티티를 영속성 컨텍스트에 올리지 않기 위해서다 (`EnrollmentService.enroll`의 주의 주석과 같은 이유)
  - `findFirstBySessionIdAndStatusOrderByWaitingOrderAsc` (승급 대상), `countBySessionIdAndStatus` (D-53)
- `enrollment/service/EnrollmentCancelService.java`(신규): 회차 id 조회(없으면 `NotFoundException`) → `SessionLockService.lock` → 신청 로드 → 회차 마감이면 409, 상태 검사 409 → 취소 → 확정이었으면 `releaseSeat` 후 대기 1순위 있으면 `promote` + `occupySeat`
- 예외: 기존 `ConflictException`/`NotFoundException` 하위 클래스로 (`SessionClosedException` 재사용 검토, `EnrollmentNotCancellableException` 신규)
- `enrollment/controller/MyEnrollmentController.java`: `POST /{enrollmentId}/cancel` → 200 `EnrollmentResponse`, OpenAPI 응답 401/404/409 문서화. 경로가 `/api/me/**`라 SecurityConfig 변경 없음(D-43)
- `enrollment/dto/EnrollmentResponse.java` + `EnrollmentService.enroll`: `waitingRank` 추가
- 테스트: `EnrollmentTest`(cancel·promote), 신규 `EnrollmentCancelServiceTest`(확정 취소+승급, 대기 취소 후 순번 당김, 수료·이미 취소 409, 마감 409, 남의 신청 404), `MyEnrollmentControllerTest`(201/200·401·404·409), `EnrollmentServiceTest`(waitingRank), `EnrollmentConcurrencyTest`에 취소와 신청 동시 실행 시 정원 초과 없음 케이스 1개
- 프론트 API 클라이언트 재생성: `npm run generate:api` (스킬 절차대로)

## 작업 2 — course-mfe API·훅

경로: `frontend/apps/course-mfe/src/`

- `api/enrollmentApi.ts`, `api/adminCourseApi.ts`: 기존 `api/courseApi.ts`처럼 `apiConfig`, `http` 인스턴스로 생성 (토큰 인터셉터 재사용)
- `hooks/useEnroll.ts`: `enroll(sessionId)` → `{ status, waitingRank }` 또는 오류. 409/404 구분은 `useCourseDetail.ts`의 `httpStatusOf`를 `hooks/httpStatus.ts`로 빼서 함께 쓴다
- `hooks/useMyEnrollments.ts`: `status` 필터 조회 + `reload()` (`useCourses`의 ignore 패턴)
- `hooks/useCancelEnrollment.ts`: `cancel(enrollmentId)` (진행 중 상태, 오류)
- `hooks/useCourseDetail.ts`: `useCourseDetail(id, { admin })`. 관리자면 `getAdminCourse`를 불러 공통 모양(과정 `closed`, 회차 `closed`·`remainingSeats = capacity - confirmedCount`)으로 맞춘다. 신청 뒤 남은 자리를 갱신하는 `refresh()`(로딩 표시 없이 다시 조회)를 더한다

## 작업 3 — 화면

- `pages/CourseListPage.tsx`: `TableRow`에 `hover`, `onClick={() => navigate(`/courses/${id}`)}`, `cursor: pointer`. 제목 링크 클릭은 `stopPropagation`으로 중복 이동을 막는다. 기존 테스트는 이미 `MemoryRouter`로 감싸 있으므로 행 클릭 이동 테스트만 더한다
- `pages/CourseDetailPage.tsx`: 라우트 파라미터 `courseId`. 표 열을 시작일·장소·남은 자리/정원(`3/20`)·신청(·관리자면 명단)으로. 회차마다 `<EnrollButton sessionId onEnrolled={refresh} />`(과정·회차 종료면 없음). 관리자면 제목 옆 "과정 수정" 버튼, "종료" 칩. 기존 `CourseDetailPage.test.tsx`는 파라미터 이름과 `useAuth` 모킹을 맞춘다
- `enrollment/EnrollButton.tsx`: `useAuth()`의 `user`가 없으면 "로그인 후 신청" 버튼(RouterLink `/login`, `state={{ from: location }}` — 로그인 뒤 상세로 돌아온다, TopBar와 같은 방식). 있으면 "신청" → 201 확정 "신청이 확정되었습니다", 대기 "대기 N번으로 등록되었습니다", 409 "이미 신청한 회차입니다", 그 밖 "신청 중 오류가 발생했습니다". 결과는 버튼 아래 작은 `Alert`, 성공 뒤 버튼 비활성
- `enrollment/MyEnrollmentsPage.tsx`: `ToggleButtonGroup` 필터(전체·확정·대기·취소·수료 → `status`), 표(과정, 시작일, 장소, 상태 칩 — 대기는 "대기 N번", 취소 버튼). 확정·대기만 "취소" → MUI `Dialog` 확인 → `cancel` → `reload()`. 실패하면 `Alert`(409 마감 등). 로딩·빈 목록·오류 표시는 `CourseListPage`와 같은 방식
- `enrollment/StatusChip.tsx`(작게): 상태별 라벨·색 (확정 primary, 대기 warning, 취소 default, 수료 success)
- `App.tsx`: `/courses/:courseId`, `/my/enrollments` → `<RequireAuth><MyEnrollmentsPage /></RequireAuth>`, 관리자 링크 대상 `/admin/courses/:courseId/edit`, `/admin/sessions/:sessionId/roster` → `<RequireAuth admin><PreparingPage …/></RequireAuth>`. `App.test.tsx`의 "준비 중" 기대값 갱신

## 작업 4 — 테스트 (Vitest)

- `enrollment/EnrollButton.test.tsx` (요청된 3개): `useAuth`, `useEnroll` 모킹, `MemoryRouter`
  1. 로그인 안 함 → "로그인 후 신청" 링크가 `/login`을 가리킨다
  2. 대기 → 신청 클릭 뒤 "대기 3번으로 등록되었습니다"
  3. 409 → "이미 신청한 회차입니다"
- 기존 테스트 갱신: `CourseListPage`(행 클릭), `CourseDetailPage`(파라미터·관리자 버튼·종료 시 버튼 없음), `App`(라우트)

## 브라우저 확인 표 1~6 (설계명세에 그대로 적는다)

| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | 비로그인으로 목록 행 클릭 → 상세 | 상세로 이동, 회차마다 "로그인 후 신청". 누르면 로그인 화면, 로그인 뒤 같은 상세로 돌아온다 |
| 2 | 자리 있는 회차 "신청" | "신청이 확정되었습니다", 남은 자리 1 감소 |
| 3 | 정원 찬 회차 "신청" | "대기 N번으로 등록되었습니다" |
| 4 | 같은 회차 다시 신청 | "이미 신청한 회차입니다" |
| 5 | 내 신청 내역에서 필터 전환 | 상태별로 걸러지고 대기는 "대기 N번" 칩 |
| 6 | 확정 건 취소 → 확인 | 목록이 다시 불려 "취소" 상태, 다른 계정의 대기 1순위가 확정으로 바뀐다 |
| (참고) | 관리자로 상세 | "과정 수정", 회차별 "명단", 종료 과정에 "종료" 칩·신청 버튼 없음 |

## 검증

- `cd backend && ./gradlew test` (포맷 검사 포함, `backend/CLAUDE.md` 명령)
- `cd frontend/apps/course-mfe && npm run build && npm test`
- 백엔드 `./gradlew bootRun` + course-mfe 개발 서버(preview_start, 포트 3001)로 위 표 1~6을 브라우저에서 확인하고 스크린샷을 남긴다. 테스트 계정은 개발 DB의 기존 employee 시드를 쓴다
