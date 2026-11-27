# 관리자 앱(admin-mfe)을 course-mfe로 합치기 구현계획

- 설계명세: `docs/design/admin-into-course-mfe.md`
- 브랜치: `feature/admin-into-course-mfe`
- 결정 사항: D-56 (D-34·D-50·D-55 갱신)
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): course-mfe 훅·화면과 앱 하나의 삭제에 걸친다. 삭제 diff가 커서 전체 diff는 1,000줄을 넘는다(대부분 admin-mfe 삭제)

## 공통 규칙

- 명령은 `frontend/apps/course-mfe/`에서 실행한다. MUI만, 생성 클라이언트로만 호출, 화면은 훅만 쓴다 (`frontend/CLAUDE.md`)
- 주석은 한국어, FR·D 번호를 단다. 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 훅 ─ T2 화면·라우트·테스트 ─ T3 admin-mfe 삭제
```

## T1. 훅
- 신규 `hooks/useAdminCourses.ts`와 테스트, `hooks/useAdminCourseActions.ts`에 `updateSession`·`closeSession`과 테스트
- 완료: `npm run build && npm test`

## T2. 화면·라우트·테스트
- 신규 `pages/AdminCourseListPage.tsx`와 테스트
- 변경 `pages/CourseFormPage.tsx`(회차 수정·마감)와 테스트, `App.tsx`(`/admin/courses` 라우트, 상단 바 "과정 관리")와 `App.test.tsx`
- 완료: `npm run build && npm test`

## T3. admin-mfe 삭제
- `frontend/apps/admin-mfe/` 삭제, `frontend`에서 `npm install`(lock 갱신), `.claude/launch.json`의 admin-mfe 항목 제거, 3002 개발 서버 종료
- `docs/requirements.md`에 D-56 추가, D-34·D-50·D-55에 "(D-56으로 갱신)"
- 완료: `frontend`에서 `npm ls --workspaces`가 오류 없고, course-mfe `npm run build && npm test` 통과, 설계명세의 브라우저 확인 표
