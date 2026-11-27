# course-mfe 관리자 과정 폼·회차 명단 화면 구현계획 (FR-03, FR-08 화면)

- 설계명세: `docs/design/FR-03-08-admin-ui.md` (작업별 세부는 설계명세의 "작업 1~3")
- 브랜치: `feature/fr-03-08-admin-ui`
- 결정 사항: D-55 (그 밖에 D-03, D-34, D-47, D-48, D-54)
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 범위: `frontend/apps/course-mfe`만. 백엔드, `packages/`, admin-mfe는 바꾸지 않는다

## 공통 규칙

- 명령은 `frontend/apps/course-mfe/`에서 실행한다. MUI만 쓰고, API 호출은 생성 클라이언트로만, 화면은 훅을 통해서만 서버를 부른다 (`frontend/CLAUDE.md`)
- 문서·주석은 한국어, 관련 FR·D 번호를 단다
- 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 API·훅 ─ T2 화면·라우트·테스트
```

## T1. API·훅 (설계명세 "작업 1")

- 신규: `api/adminEnrollmentApi.ts`, `hooks/useAdminCourseActions.ts`, `hooks/useRoster.ts`, `hooks/useCompleteEnrollments.ts`와 각 테스트
- 변경: `hooks/httpStatus.ts` (`problemDetailOf`)
- 완료: `npm run build && npm test`

## T2. 화면·라우트·테스트 (설계명세 "작업 2·3")

- 신규: `pages/CourseFormPage.tsx`, `enrollment/RosterPage.tsx`, `pages/CourseFormPage.test.tsx`, `enrollment/RosterPage.test.tsx`
- 변경: `App.tsx`, `App.test.tsx` (쓰이지 않으면 `pages/PreparingPage.tsx` 삭제)
- 완료: `npm run build && npm test`, 설계명세의 브라우저 확인 표
