# course-mfe 로그인 구현계획 (NFR-03 프론트)

- 설계명세: `docs/design/NFR-03-course-login.md`
- 브랜치: `feature/nfr-03-course-login`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다(토큰 처리, 리다이렉트)
- 규모 알림 (CLAUDE.md 개발 절차 5): 신규 파일 8개와 테스트 4개가 생기고, 기존 파일 4개를 고친다. 작업 단위로 나눠 diff를 작게 유지한다

## 공통 규칙 (모든 작업)

- 명령은 `frontend/`에서 실행한다
- 완료 명령은 `npm run build -w apps/course-mfe && npm test -w apps/course-mfe`다(build에 `tsc --noEmit`이 들어 있다)
- `frontend/CLAUDE.md`를 따른다: MUI, 생성 클라이언트만, 서버 조회는 훅, 화면은 API를 직접 부르지 않는다. 기존 `hooks/`·`pages/` 테스트 스타일(describe·it 한국어, `vi.mock`)을 따른다
- `packages/api-client/src/generated`, 백엔드, admin-mfe는 수정하지 않는다
- 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 HTTP·토큰 저장 ─ T2 인증 상태·보호·로그인 화면 ─ T3 상단 바·라우팅·진입점 ─ T4 브라우저 확인
```

---

## T1. HTTP 인스턴스와 토큰 저장 (설계명세 2절)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `apps/course-mfe/package.json` | `dependencies`에 `"axios": "^1.21.0"`. 그다음 `frontend/`에서 `npm install`(lock 갱신) |
| `apps/course-mfe/src/api/http.ts` (신규) | `tokenStore`, `http`, `apiConfig`, 상수 `UNAUTHORIZED_EVENT = 'eduhub:unauthorized'` |
| `apps/course-mfe/src/api/clients.ts` (신규) | `authApi` |
| `apps/course-mfe/src/api/courseApi.ts` | `new CourseApi(apiConfig, undefined, http)`. 주석 갱신 |

**테스트**: `src/api/http.test.ts` (H1~H6)

---

## T2. 인증 상태, 보호, 로그인 화면 (설계명세 3·4절)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `src/auth/AuthContext.tsx` (신규) | `AuthProvider`, `useAuth`. `BrowserRouter`/`MemoryRouter` 안에서 쓴다(`useNavigate`, `useLocation`) |
| `src/auth/RequireAuth.tsx` (신규) | `{ children, admin?: boolean }` |
| `src/auth/LoginPage.tsx` (신규) | 설계명세 4절 문장을 그대로 쓴다 |

**테스트**: `src/auth/AuthContext.test.tsx`(A1~A4), `RequireAuth.test.tsx`(R1~R3), `LoginPage.test.tsx`(L1~L5). `../api/clients`를 `vi.mock`한다. 이벤트는 `window.dispatchEvent`로 흉내 낸다. 상태 변경은 `act`/`waitFor`로 기다린다

---

## T3. 상단 바, 라우팅, 진입점 (설계명세 4절)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `src/theme.ts` (신규) | `export const theme = createTheme();` |
| `src/pages/PreparingPage.tsx` (신규) | `{ title }`, "준비 중인 화면입니다." 안내 |
| `src/App.tsx` | AppBar와 라우트 표(설계명세 4절). 기존 D-24 주석 유지 |
| `src/main.tsx` | Provider 순서(설계명세 4절) |
| `src/App.test.tsx` | `AuthProvider`로 감싸고 상단 바 테스트 2개 추가 |

**완료 명령**: 공통 완료 명령. 기존 31개를 포함해 전체가 통과해야 한다

---

## T4. 브라우저 확인

- 백엔드 bootRun(dev, `.claude/launch.json`의 `backend`)과 `course-mfe`(3001)를 띄운다
- 브라우저 창에서 다음을 확인한다. 비밀번호 입력은 개발자가 한다
  - 비로그인 상태로 `/my/enrollments`에 가면 `/login`으로 간다
  - DEV-E001로 로그인하면 `/my/enrollments`로 돌아가고, 상단 바에 이름과 "내 신청 내역"이 보인다
  - `/admin/courses/new`에 가면 "권한이 없습니다."가 보인다
  - 로그아웃하면 `/courses`로 가고 상단 바에 "로그인"이 보인다
  - localStorage의 토큰을 아무 값으로 바꾸고 새로고침하면 만료 안내와 함께 로그인 화면으로 간다
  - DEV-A001로 로그인하면 "과정 등록"이 보이고 들어갈 수 있다
- 마지막에 `npm test -w apps/admin-mfe`를 돌려 lock 변경이 영향을 주지 않는지 확인한다
