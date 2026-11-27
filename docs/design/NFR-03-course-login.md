# course-mfe 로그인 설계명세 (NFR-03 프론트)

- 요구사항: NFR-03 (로그인한 사용자만 신청). 백엔드 쪽은 D-42~D-45로 끝났다
- 범위: `frontend/apps/course-mfe`. 백엔드, `packages/api-client/src/generated`, admin-mfe는 바꾸지 않는다
- 브랜치: `feature/nfr-03-course-login`

## 1. 범위

**하는 것**
- 사번·비밀번호 로그인 화면, 로그아웃
- 모든 API 호출에 Bearer 토큰 첨부
- 401이면 토큰을 지우고 로그인 화면으로 보낸다
- 로그인이 필요한 화면과 관리자 화면을 보호한다
- 상단 바와 "준비 중" 보호 화면 2개(`/my/enrollments`, `/admin/courses/new`). 사용자 결정에 따라 Step 15·16에서 실제 화면으로 바꾼다

**하지 않는 것**
- 과정 상세의 신청 버튼, 내 신청 화면, 관리자 화면(Step 15·16)
- admin-mfe 토큰 처리(후속 과제. NFR-03 이후 admin-mfe의 관리자 API는 401이다)
- 토큰 갱신(백엔드에 refresh가 없다, D-42)

## 2. 토큰 저장과 HTTP (`src/api/http.ts`)

- `tokenStore`는 localStorage를 쓴다
  - 키는 `eduhub.accessToken`(문자열)과 `eduhub.user`(`UserResponse` JSON)다
  - `get()`, `set(token, user)`, `clear()`, `getUser()`를 제공한다
  - 모든 접근은 try/catch로 감싼다. 저장소를 쓸 수 없으면 비로그인으로 동작하고, JSON 파싱이 실패하면 `getUser()`는 null이다
- `http`: `axios.create()`로 만든 인스턴스다
  - 로그인 요청 판별 `isLoginRequest`: URL을 현재 출처 기준으로 풀어 같은 출처이고 `pathname === '/api/auth/login'`인지 확인한다(쿼리·해시 무시, 정확 일치)
  - 요청 인터셉터: 토큰이 있고, 같은 출처 요청(상대 경로 포함)이며, 로그인 요청이 아닐 때만 `Authorization: Bearer <token>`을 붙인다. 로그인 요청에 붙이지 않는 이유는 만료 토큰이 남아 있으면 백엔드가 permitAll 경로에서도 401을 내 로그인이 계속 실패하기 때문이다. 붙인 토큰은 요청 설정(`eduhubSentToken`)에 기억한다
  - 응답 인터셉터(오류): 401이고, 로그인 요청이 아니며, 요청에 실어 보낸 토큰이 현재 저장 토큰과 같을 때만 `tokenStore.clear()`와 `window.dispatchEvent(new Event('eduhub:unauthorized'))`를 한다. 늦게 도착한 이전 토큰의 401이 새 로그인을 지우지 않게 하기 위해서다. 어느 경우든 원래 오류로 reject한다
  - 403, 응답 없는 오류, 토큰 없이 보낸 요청의 401은 토큰과 이벤트를 건드리지 않는다
- `apiConfig = new Configuration({ basePath: '' })`: 같은 출처의 `/api`로 보내고, 개발 중에는 Vite 프록시가 8080으로 넘긴다
- 생성된 `*Api`는 `src/api` 안에서만 `new XxxApi(apiConfig, undefined, http)`로 만든다
  - `courseApi.ts`: `courseApi`(기존 파일, http를 쓰도록 바꾼다)
  - `clients.ts`: `authApi`. 이후 `enrollmentApi` 등도 여기에 둔다

## 3. 인증 상태 (`src/auth/AuthContext.tsx`)

```ts
interface AuthState {
  user: UserResponse | null;
  initializing: boolean;   // 새로고침 뒤 /api/me 확인 중
  expired: boolean;        // 로그인 상태에서 401을 받아 로그아웃됨
  login(employeeNo: string, password: string): Promise<void>;
  logout(): void;
}
```
- **시작할 때**: `tokenStore.get()`이 있으면 `initializing=true`로 두고 `authApi.me()`를 부른다
  - 성공하면 `user`를 설정하고 tokenStore의 user를 갱신한다
  - 401이면 인터셉터가 토큰을 지우고 이벤트를 낸다. 이 경우는 만료로 처리한다
  - 그 밖의 오류(서버 다운 등)는 저장된 user로 계속 진행하고 로그아웃하지 않는다
  - 마지막에 `initializing=false`로 둔다
  - 토큰이 없으면 바로 `initializing=false`다
- **`login`**: `authApi.login({ loginRequest })` 다음 `tokenStore.set`, `user` 설정, `expired=false` 순서다. 실패하면 오류를 그대로 던지고, LoginPage가 문장을 정한다
- **`logout`**: `tokenStore.clear()`, `expired=false`, `navigate('/courses')`를 요청하고, `user=null`은 경로가 실제로 바뀐 뒤(위치 변경 layout effect)에 반영한다. react-router 7은 이동을 transition으로 처리하므로 user를 먼저 비우면 보호 화면의 `RequireAuth`가 `/login`으로 보내 `/courses` 이동을 덮기 때문이다
- **`expired` 해제**: 로그인 성공, 로그아웃, 그리고 `/login`을 벗어날 때 false가 된다(만료 안내는 그 로그인 화면에서 한 번만)
- 시작 확인에서 `me()`가 401이 아닌 오류이고 저장 user도 없으면(깨진 JSON 포함) 토큰을 지운다
- 최신 user·경로는 `useLayoutEffect`로 ref에 동기화한다(렌더 중 대입 금지). 리스너가 즉시 바꾼 상태는 이동 대기 ref로 보존한다
- **다른 탭과 동기화**: `window`의 `storage` 이벤트로 `eduhub.accessToken` 변화를 듣는다. 토큰이 사라지면 이 탭도 로그아웃 상태(user=null, 만료 안내 없음)가 되고, 보호 화면이면 `RequireAuth`가 로그인으로 보낸다. 다른 토큰으로 바뀌면 저장된 user로 교체한다. 단 저장 user가 없거나 깨졌거나, 저장 user의 `employeeNo`가 새 토큰의 `employee_no` 클레임(서명 검증 없는 표시용 디코드)과 다르거나 디코드에 실패하면 `me()`로 확인한다. 동기화용 `me()`가 401이 아닌 오류로 끝나면 공유 토큰은 지우지 않고 이 탭만 비로그인으로 둔다(일시 오류로 모든 탭이 로그아웃되지 않게). 화면에 보이는 사용자와 실제로 보내는 토큰이 항상 같아야 하기 때문이다. `tokenStore.set`은 user를 먼저, 토큰을 마지막에 쓴다(토큰 이벤트 시점에 user가 이미 새 값이도록)
- **저장 실패**: `login`에서 `tokenStore.set` 뒤 `tokenStore.get()`이 받은 토큰과 다르면(저장소 차단·용량 초과) 저장을 되돌리고 일반 오류로 던진다. 로그인 화면에는 일반 오류 문장이 나온다(명세 2절 "저장소를 쓸 수 없으면 비로그인으로 동작")
- **공개 화면에서 만료**: 공개 화면에서 401을 받아도 로그인 화면으로 보낸다(사용자 결정). 백엔드가 permitAll 경로에서도 무효 토큰에 401을 내므로, 만료 토큰을 가진 사용자는 과정 목록을 열 때 로그인 화면으로 간다
- **`eduhub:unauthorized` 수신**
  - `user`가 있었으면(또는 시작 확인 중이었으면) `expired=true`로 두고 `user=null`로 바꾼다
  - 현재 경로가 `/login`이 아니면 `navigate('/login', { replace: true, state: { from: location } })`로 보낸다
  - 이미 `/login`이면 이동하지 않는다. 그래야 두 번째 401이 원래 가려던 곳(`state.from`)을 `/login`으로 덮지 않는다
  - 로그인하지 않은 상태(시작 확인 중도 아님)에서 온 이벤트는 무시한다. 보호 화면은 `RequireAuth`가 이미 로그인으로 보낸다
  - `login` 응답에 `accessToken`이나 `user`가 없으면 오류로 본다(LoginPage는 일반 오류 문장)
- 화면 컴포넌트는 `useAuth()`만 쓰고 API를 직접 부르지 않는다(`frontend/CLAUDE.md`)

## 4. 화면

| 경로 | 컴포넌트 | 보호 |
|---|---|---|
| `/courses`, `/courses/:id` | 기존 | 공개 (D-24, D-43) |
| `/login` | `LoginPage` | 공개. 이미 로그인했으면 `/courses`로 보낸다 |
| `/my/enrollments` | `PreparingPage` "내 신청 내역" | `RequireAuth` |
| `/admin/courses/new` | `PreparingPage` "과정 등록" | `RequireAuth admin` |
| `/`, 그 밖 | `/courses`로 보낸다 | (D-24) |

- **`RequireAuth`**
  - `initializing`이면 로딩(`CircularProgress`)을 보여 준다
  - `user`가 없으면 `<Navigate to="/login" replace state={{ from: location }} />`로 보낸다
  - `admin`인데 `role !== 'ADMIN'`이면 "권한이 없습니다." 안내를 보여 준다(로그아웃하지 않는다)
- **`LoginPage`**
  - 입력: 사번(TextField), 비밀번호(`type="password"`). 버튼은 로그인이고, 제출 중에는 비활성화한다. 빈 값이면 제출하지 않는다
  - `user`가 있으면(로그인 성공 직후 포함) `state.from`의 `pathname + search`로 `<Navigate replace>` 한다. `from`이 없거나 `/login`이거나 앱 안 경로가 아니면(`/`로 시작하지 않거나, `//`로 시작하거나, `\`가 들어 있음) `/courses`다(오픈 리다이렉트 방어). 시작 확인(`initializing`) 중에는 이동하지 않고 로딩을 보여 준다(만료 토큰으로 `/login`을 열 때 깜빡임 방지). 상단 바의 "로그인" 링크는 현재 위치를 `state.from`으로 넘긴다. 그래서 "이미 로그인한 사용자가 `/login`에 오면 `/courses`"와 "성공하면 원래 화면으로"가 같은 분기 하나로 처리되고, 두 이동이 경쟁하지 않는다
  - 401이면 "사번 또는 비밀번호가 올바르지 않습니다."를 보여 준다. 그 밖은 "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."다
  - `expired`면 상단에 "로그인이 만료되었습니다. 다시 로그인해 주세요." 안내(Alert)를 보여 준다
- **상단 바 (`App.tsx`, MUI AppBar)**
  - 왼쪽: "교육과정"(`/courses`), 로그인하면 "내 신청 내역", ADMIN이면 "과정 등록"
  - 오른쪽: 로그인하면 사용자 이름과 "로그아웃", 아니면 "로그인"
- `main.tsx`: `StrictMode` → `ThemeProvider(theme)` → `CssBaseline` → `BrowserRouter` → `AuthProvider` → `App`. `theme.ts`는 `createTheme()`를 export한다

## 5. 의존성
- `apps/course-mfe/package.json`에 `axios`(`^1.21.0`, api-client와 같음)를 추가한다. `http.ts`와 `isAxiosError`가 직접 쓰기 때문이다. `package-lock.json`이 바뀐다

## 6. 테스트 시나리오 (Vitest)

### `src/api/http.test.ts`
axios `adapter`를 테스트 함수로 바꿔 요청 설정을 기록하고 상태 코드를 흉내 낸다. 테스트마다 localStorage를 비운다.
- H1 토큰이 있으면 `Authorization: Bearer t1`이 붙는다
- H2 토큰이 없으면 Authorization 헤더가 없다
- H3 401이면 토큰과 user가 지워지고 `eduhub:unauthorized`가 1회 나온다. 호출은 reject된다
- H4 403이면 토큰이 남고 이벤트가 없다
- H5 `/api/auth/login`의 401은 이벤트가 없다
- H6 저장된 user JSON이 깨져 있으면 `getUser()`는 null이다

### `src/auth/AuthContext.test.tsx` (`authApi` mock, MemoryRouter)
- A1 보호 경로 `/my/enrollments`에서 401 이벤트를 두 번 보내도 로그인 화면이고, 로그인에 성공하면 `/my/enrollments`로 돌아간다
- A2 로그인 상태에서 401 이벤트가 오면 `expired=true`이고 만료 안내가 보인다
- A3 토큰이 있는 상태로 시작하면 `me()`를 부르고, 그동안 보호 화면은 로딩을 보여 준다. 성공하면 보호 화면이 보인다
- A4 `logout()`이면 토큰이 지워지고 `/courses`로 간다

### `src/auth/RequireAuth.test.tsx`
- R1 비로그인이면 `/login`으로 가고 `state.from`이 원래 경로다
- R2 EMPLOYEE가 admin 경로에 오면 "권한이 없습니다."가 보이고 토큰은 남는다
- R3 ADMIN이면 통과한다

### `src/auth/LoginPage.test.tsx`
- L1 성공하면 `from`으로 이동한다. `from`이 없으면 `/courses`다
- L2 401이면 "사번 또는 비밀번호가 올바르지 않습니다."가 나온다
- L3 401이 아닌 오류면 일반 오류 문장이 나온다
- L4 `expired`면 만료 안내가 나온다
- L5 제출 중에는 버튼이 비활성화된다

### `src/App.test.tsx` (갱신)
- 기존 라우팅 테스트 3개를 `AuthProvider`로 감싸 유지한다
- 비로그인 상단 바에는 "로그인"만 있고 "내 신청 내역"이 없다
- ADMIN 상단 바에는 "과정 등록"과 이름, "로그아웃"이 있다

## 7. 위험 영역
- **토큰 저장 위치(localStorage)**: XSS가 생기면 탈취될 수 있다. 지시서가 정했고, 화면에서 HTML을 직접 넣지 않는(`dangerouslySetInnerHTML` 금지) 규칙으로 줄인다. 만료는 60분이다(D-42)
- **이벤트 기반 리다이렉트**: 인터셉터는 React 밖에 있으므로 window 이벤트로 알린다. AuthProvider가 언마운트될 때 리스너를 해제한다. StrictMode에서 effect가 두 번 돌아도 리스너가 중복되지 않아야 한다
- **StrictMode와 `me()` 중복 호출**: 개발 모드에서 두 번 부를 수 있다. 결과는 같아 무해하지만, 응답이 늦게 도착해 상태를 덮어쓰지 않도록 취소 플래그를 둔다
- **admin-mfe**: 같은 문제(토큰 없음)가 남는다. 후속 작업이다
