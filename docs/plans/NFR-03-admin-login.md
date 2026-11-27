# admin-mfe 로그인 구현계획 (NFR-03 프론트)

- 설계명세: `docs/design/NFR-03-admin-login.md` (결정 D-50)
- 브랜치: `feature/nfr-03-admin-login`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다(토큰 처리, 화면 전환)
- 규모 알림 (CLAUDE.md 개발 절차 5): 신규 파일 5개와 테스트 5개, 기존 파일 3개 수정. 모두 admin-mfe 한 앱 안이다

## 공통 규칙 (모든 작업)

- 명령은 `frontend/`에서 실행한다
- 완료 명령은 `npm run build -w apps/admin-mfe && npm test -w apps/admin-mfe`다(build에 `tsc --noEmit`이 들어 있다)
- 기준 구현은 `apps/course-mfe/src/api/http.ts`, `src/auth/*`와 그 테스트다. 설계명세에 적힌 다른 점 말고는 그대로 따른다
- `frontend/CLAUDE.md`를 따른다: MUI, 생성 클라이언트만, 화면은 API를 직접 부르지 않는다. 테스트는 describe·it 한국어, `vi.mock`
- 백엔드, `packages/`, course-mfe는 수정하지 않는다. 새 의존성을 추가하지 않는다(react-router 포함)
- 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 HTTP·토큰 저장 ─ T2 인증 상태·RequireAdmin·로그인 화면 ─ T3 상단 바·진입점 ─ T4 브라우저 확인
```

---

## T1. HTTP 인스턴스와 토큰 저장 (설계명세 2절)

| 파일 | 내용 |
|---|---|
| `apps/admin-mfe/src/api/http.ts` (신규) | course-mfe `http.ts` 복사. 머리 주석에 "course-mfe `src/api/http.ts`와 같은 규칙이다. 한쪽을 고치면 다른 쪽도 고친다(D-50)"를 단다 |
| `apps/admin-mfe/src/api/clients.ts` (신규) | `authApi` |
| `apps/admin-mfe/src/api/adminCourseApi.ts` | `new AdminCourseApi(apiConfig, undefined, http)`. 주석 갱신 |

**테스트**: `src/api/http.test.ts` (course-mfe 테스트 복사, H1~H6 포함)

---

## T2. 인증 상태, RequireAdmin, 로그인 화면 (설계명세 3·4절)

| 파일 | 내용 |
|---|---|
| `src/auth/AuthContext.tsx` (신규) | `AuthProvider`, `useAuth`. 라우터 훅을 쓰지 않는다. 설계명세 3절 표의 차이만 반영 |
| `src/auth/RequireAdmin.tsx` (신규) | `{ children }`. 로딩 / `LoginPage` / 권한 없음+로그아웃 / children |
| `src/auth/LoginPage.tsx` (신규) | 제목 "관리자 로그인". 리다이렉트 없음 |

**테스트**: `src/auth/AuthContext.test.tsx`(A1~A7), `RequireAdmin.test.tsx`(G1~G3), `LoginPage.test.tsx`(L1~L6). `../api/clients`를 `vi.mock`한다. 이벤트는 `window.dispatchEvent`(storage는 `new StorageEvent('storage', { key })`)로 흉내 낸다. 테스트마다 localStorage를 비운다

---

## T3. 상단 바와 진입점 (설계명세 4절)

| 파일 | 내용 |
|---|---|
| `src/App.tsx` | `TopBar`, `AdminScreens`(기존 courseId 전환 이동), `App` = TopBar + `RequireAdmin(AdminScreens)`. 기존 FR-03 주석 유지 |
| `src/main.tsx` | `AuthProvider`로 감싼다 |
| `src/App.test.tsx` (신규) | 설계명세 5절 2개. `../api/clients`와 `../hooks/useAdminCourses`·`useAdminCourseActions`를 mock |

**완료 명령**: 공통 완료 명령. 기존 테스트를 포함해 전체가 통과해야 한다

---

## T4. 브라우저 확인

- 백엔드 bootRun(dev)과 admin-mfe(3002)를 띄운다. 비밀번호 입력은 개발자가 한다
  - 처음 열면 "관리자 로그인" 화면이다
  - DEV-E001로 로그인하면 "권한이 없습니다."와 로그아웃 버튼이 보이고, 로그아웃하면 로그인 화면이다
  - DEV-A001로 로그인하면 과정 목록이 보이고 상세·명단 등 관리자 API가 200으로 동작한다(네트워크 탭에서 Authorization 확인)
  - localStorage의 토큰을 아무 값으로 바꾸고 새로고침하면 만료 안내와 함께 로그인 화면이다
- 마지막에 `npm test -w apps/course-mfe`도 돌려 영향이 없는지 확인한다
