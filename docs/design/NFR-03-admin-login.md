# admin-mfe 로그인 설계명세 (NFR-03 프론트)

- 요구사항: NFR-03. 관리자 API(`/api/v1/admin/**`)는 ADMIN 토큰이 있어야 한다(D-42, D-43). 지금 admin-mfe는 토큰 없이 호출해 모두 401이다
- 결정: D-50 (복사, 라우터 없음, EMPLOYEE는 권한 없음 화면)
- 기준 구현: course-mfe (`docs/design/NFR-03-course-login.md`, PR kurokure-dev/eduhub#16). 이 문서는 그 방식과 **다른 점**을 중심으로 적는다
- 범위: `frontend/apps/admin-mfe`. 백엔드, `packages/`, course-mfe는 바꾸지 않는다
- 브랜치: `feature/nfr-03-admin-login`

## 1. 범위

**하는 것**
- 사번·비밀번호 로그인 화면, 로그아웃, 상단 바
- 모든 관리자 API 호출에 Bearer 토큰 첨부, 401이면 토큰을 지우고 로그인 화면(만료 안내)
- ADMIN이 아닌 사용자는 "권한이 없습니다." 화면

**하지 않는 것**
- 라우터 도입(D-50). URL은 바뀌지 않는다
- 공통 패키지 분리(D-50)
- 토큰 갱신(D-42에 refresh 없음)

## 2. 토큰 저장과 HTTP (`src/api/http.ts`, `src/api/clients.ts`)

course-mfe `src/api/http.ts`를 그대로 복사한다(같은 키 `eduhub.accessToken`·`eduhub.user`, 같은 이벤트 `eduhub:unauthorized`, 같은 규칙).
- 같은 출처 요청이고 로그인 요청이 아닐 때만 `Authorization: Bearer`를 붙이고, 보낸 토큰을 요청 설정 `eduhubSentToken`에 기억한다
- 401이고 로그인 요청이 아니며, 보낸 토큰이 현재 저장 토큰과 같을 때만 `tokenStore.clear()`와 이벤트를 낸다. 403·응답 없음·토큰 없이 보낸 요청의 401은 건드리지 않는다
- `apiConfig = new Configuration({ basePath: '' })`

생성 클라이언트 인스턴스
- `src/api/clients.ts`(신규): `authApi = new AuthApi(apiConfig, undefined, http)`
- `src/api/adminCourseApi.ts`: `new AdminCourseApi(apiConfig, undefined, http)`로 바꾼다. `toErrorMessage`는 그대로 둔다

`axios`는 이미 admin-mfe 의존성이므로 `package.json`·lock은 바뀌지 않는다.

## 3. 인증 상태 (`src/auth/AuthContext.tsx`)

인터페이스는 course-mfe와 같다(`user`, `initializing`, `expired`, `login`, `logout`). 라우터가 없으므로 이동(`navigate`)과 경로(`location`) 처리를 모두 뺀다. 화면 전환은 4절의 `RequireAdmin`이 상태만 보고 한다.

| 항목 | course-mfe | admin-mfe |
|---|---|---|
| 시작 확인(`me()`) | 토큰이 있으면 호출. 401은 만료, 그 밖의 오류는 저장 user로 계속(저장 user가 없으면 토큰 삭제) | 같다 |
| `login` | 저장 → 저장 확인(실패하면 되돌리고 오류) → user, `expired=false` | 같다 |
| `logout` | 토큰 삭제 → `/courses` 이동 → 이동 반영 뒤 user=null | 토큰 삭제, `user=null`, `expired=false`를 바로 한다(이동이 없어 순서 문제가 없다) |
| 401 이벤트 | user가 있거나 시작 확인 중이면 user=null, `expired=true`, `/login`으로 이동 | user=null, `expired=true`. 이동하지 않는다(비로그인이면 `RequireAdmin`이 로그인 화면을 보여 준다). 비로그인·확인 끝남이면 무시 |
| `expired` 해제 | 로그인 성공, 로그아웃, `/login` 이탈 | 로그인 성공, 로그아웃 |
| 다른 탭 storage 동기화 | 토큰 삭제면 비로그인, 다른 토큰이면 저장 user(사번이 토큰 클레임과 같을 때) 또는 `me()` | 같다(`tokenEmployeeNo` 함수 복사) |
| ref 동기화 | `useLayoutEffect`로 user·initializing·navigate·location | `useLayoutEffect`로 user·initializing만 |
| 늦은 응답 | 취소 플래그 + 토큰 비교 | 같다 |

## 4. 화면

**구성 (`main.tsx` → `App.tsx`)**
- `main.tsx`: `StrictMode` → `ThemeProvider` → `CssBaseline` → `AuthProvider` → `App`
- `App`: 상단 바 + `<RequireAdmin><AdminScreens /></RequireAdmin>`
- `AdminScreens`: 지금 `App`의 목록/상세 상태 전환(`courseId`)을 그대로 옮긴 컴포넌트(`App.tsx` 안). 로그아웃·만료로 화면이 바뀌면 언마운트되므로, 다시 로그인하면 목록부터 시작한다(입력 중이던 대화상자 내용은 사라진다. 만료 60분 기준이라 받아들인다)

**`RequireAdmin` (`src/auth/RequireAdmin.tsx`)**
- `initializing`이면 로딩(`CircularProgress`)
- `user`가 없으면 `<LoginPage />`
- `role !== ADMIN`이면 `Alert severity="error"` "권한이 없습니다." 와 안내 "관리자 계정으로 다시 로그인해 주세요.", "로그아웃" 버튼(`logout()`). 토큰은 지우지 않는다(로그아웃을 누를 때만)
- ADMIN이면 `children`

**`LoginPage` (`src/auth/LoginPage.tsx`)**
- course-mfe와 같은 입력·버튼·문장. 빈 값이면 제출하지 않고, 제출 중에는 버튼 비활성화
  - 401: "사번 또는 비밀번호가 올바르지 않습니다."
  - 그 밖: "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
  - `expired`: "로그인이 만료되었습니다. 다시 로그인해 주세요."
- 리다이렉트(`state.from`, `Navigate`)와 `initializing` 분기는 없다(`RequireAdmin`이 맡는다). 성공하면 `user`가 생겨 `RequireAdmin`이 관리자 화면으로 바꾼다
- 제목은 "관리자 로그인"

**상단 바 (`App.tsx`의 `TopBar`, MUI AppBar)**
- 왼쪽: "EduHub 관리자"
- 오른쪽: 로그인했으면 사용자 이름과 "로그아웃". EMPLOYEE도 같다

## 5. 테스트 시나리오 (Vitest)

### `src/api/http.test.ts` (course-mfe 복사)
- H1 토큰이 있으면 `Authorization: Bearer t1`
- H2 토큰이 없으면 헤더 없음
- H3 401이면 토큰·user 삭제, 이벤트 1회, reject
- H4 403이면 토큰 유지, 이벤트 없음
- H5 `/api/auth/login`의 401은 이벤트 없음
- H6 깨진 user JSON이면 `getUser()`는 null
- course-mfe에 있는 나머지(다른 출처, 오래된 토큰의 401 등)도 함께 복사한다

### `src/auth/AuthContext.test.tsx` (`../api/clients` mock)
- A1 로그인 상태에서 401 이벤트가 오면 로그인 화면과 만료 안내가 보인다
- A2 토큰이 있는 상태로 시작하면 `me()`를 부르고, 그동안 로딩이 보이며, 성공하면 관리자 화면이 보인다
- A3 시작 확인의 `me()`가 401이 아닌 오류면 저장 user로 계속한다
- A4 `logout()`이면 토큰이 지워지고 로그인 화면이 보인다(만료 안내 없음)
- A5 비로그인 상태의 401 이벤트는 만료 안내를 만들지 않는다
- A6 다른 탭에서 토큰이 지워지면(storage 이벤트) 로그인 화면이 된다. 다른 토큰으로 바뀌고 저장 user 사번이 클레임과 같으면 그 user로, 다르면 `me()`로 확인한다
- A7 로그인 저장이 실패하면(저장 뒤 `get()`이 다름) 오류를 던지고 비로그인이다

### `src/auth/RequireAdmin.test.tsx`
- G1 비로그인이면 로그인 화면
- G2 EMPLOYEE면 "권한이 없습니다."와 로그아웃 버튼, 토큰은 남는다. 로그아웃을 누르면 로그인 화면이 되고 토큰이 지워진다
- G3 ADMIN이면 children

### `src/auth/LoginPage.test.tsx`
- L1 성공하면 `login`이 사번(앞뒤 공백 제거)·비밀번호로 불린다
- L2 401이면 "사번 또는 비밀번호가 올바르지 않습니다."
- L3 그 밖의 오류면 일반 오류 문장
- L4 `expired`면 만료 안내
- L5 제출 중에는 버튼 비활성화
- L6 빈 값이면 `login`을 부르지 않는다

### `src/App.test.tsx` (신규, 목록 훅 mock)
- 비로그인이면 로그인 화면이고 상단 바에 "로그아웃"이 없다
- ADMIN이면 과정 목록 화면과 이름, "로그아웃"이 보인다

기존 hooks·pages 테스트는 그대로 통과해야 한다.

## 6. 위험 영역
- **토큰 저장(localStorage)**: course-mfe와 같은 위험과 대응(D-42 만료 60분, `dangerouslySetInnerHTML` 금지)
- **두 벌의 코드**: course-mfe의 `http.ts`·인증 상태를 고치면 admin-mfe도 같이 고쳐야 한다. 두 파일 머리 주석에 서로를 가리키는 문장을 단다(admin-mfe 쪽만 이번에 추가하고, course-mfe는 바꾸지 않는다)
- **같은 키 공유**: 같은 출처에 배포되면 한 앱의 로그아웃·만료가 다른 앱도 로그아웃시킨다(D-50). 다른 탭은 storage 이벤트로 맞춘다. 단 나중에 shell이 두 앱을 한 문서에 띄우면 같은 문서에는 storage 이벤트가 오지 않고, 이후 요청은 토큰 없이 가서 401이 나도 만료 처리되지 않는다. shell 통합 때 다룬다
- **이벤트 리스너**: 언마운트 때 해제하고, StrictMode에서 중복되지 않게 한다
