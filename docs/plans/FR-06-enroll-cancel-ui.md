# FR-06 신청 취소 + 신청·내 신청 화면 구현계획

- 설계명세: `docs/design/FR-06-enroll-cancel-ui.md` (작업별 세부 내용은 설계명세의 "작업 1~4" 절)
- 브랜치: `feature/fr-06-enroll-cancel-ui`
- 결정 사항: D-51, D-52, D-53, D-54 (그 밖에 D-01, D-02, D-29, D-39, D-45, D-46)
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): 백엔드 도메인~컨트롤러와 프론트 API·훅·화면에 걸친다. 개발자가 계획 승인으로 진행을 지시했다

## 공통 규칙

- 백엔드 명령은 `backend/`에서 실행한다. JDK 21과 루트 `.env`가 필요하다. 패턴은 `.claude/skills/eduhub-api/SKILL.md`와 기존 enrollment·course 패키지를 따른다
- 프론트 명령은 `frontend/apps/course-mfe/`에서 실행한다. MUI만 쓰고, API 호출은 생성 클라이언트로만, 화면은 훅을 통해서만 서버를 부른다 (`frontend/CLAUDE.md`)
- 문서·주석은 한국어, 관련 FR·D 번호를 단다
- 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 백엔드 취소 API·waitingRank + 클라이언트 재생성 ─ T2 course-mfe API·훅 ─ T3 화면·테스트
```

## T1. 백엔드 (설계명세 "작업 1")

- 변경: `Enrollment`(cancel, promote), `CourseSession`(releaseSeat), `EnrollmentRepository`, `EnrollmentCancelService`(신규), 예외, `MyEnrollmentController`(POST cancel), `EnrollmentResponse`·`EnrollmentService`(waitingRank)
- 테스트: `EnrollmentTest`, `EnrollmentCancelServiceTest`(신규), `MyEnrollmentControllerTest`, `EnrollmentServiceTest`, `EnrollmentControllerTest`(응답 필드), `EnrollmentConcurrencyTest`(취소·신청 동시)
- 마지막에 `frontend/`에서 `npm run generate:api`로 클라이언트를 재생성한다 (스킬 절차)
- 완료: `./gradlew spotlessApply spotlessCheck test`

## T2. course-mfe API·훅 (설계명세 "작업 2")

- 신규: `api/enrollmentApi.ts`, `api/adminCourseApi.ts`, `hooks/httpStatus.ts`, `hooks/useEnroll.ts`, `hooks/useMyEnrollments.ts`, `hooks/useCancelEnrollment.ts`
- 변경: `hooks/useCourseDetail.ts` (admin 옵션, refresh)
- 테스트: 새 훅과 바뀐 훅의 단위 테스트 (기존 `useCourseDetail.test.ts` 패턴)
- 완료: `npm run build && npm test`

## T3. 화면·테스트 (설계명세 "작업 3·4")

- 신규: `enrollment/EnrollButton.tsx`, `enrollment/MyEnrollmentsPage.tsx`, `enrollment/StatusChip.tsx`, `enrollment/EnrollButton.test.tsx`
- 변경: `pages/CourseListPage.tsx`, `pages/CourseDetailPage.tsx`, `App.tsx`와 각 기존 테스트
- 완료: `npm run build && npm test`, 설계명세의 브라우저 확인 표 1~6
