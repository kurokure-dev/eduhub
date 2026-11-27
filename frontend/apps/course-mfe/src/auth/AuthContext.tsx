import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { TOKEN_KEY, tokenStore, UNAUTHORIZED_EVENT } from '../api/http';

// NFR-03, D-42: 로그인 상태(사용자, 만료 여부)를 앱 전체에 제공한다.
// 화면 컴포넌트는 이 훅(useAuth)만 쓰고 API를 직접 부르지 않는다

interface AuthState {
  user: UserResponse | null;
  initializing: boolean; // 새로고침 뒤 /api/me 확인 중
  expired: boolean; // 로그인 상태에서 401을 받아 로그아웃됨
  login(employeeNo: string, password: string): Promise<void>;
  logout(): void;
}

// JWT payload의 employee_no 클레임. 서명은 검증하지 않는 표시용 대조이며, 디코드에 실패하면 null
function tokenEmployeeNo(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { employee_no?: unknown };
    return typeof claims.employee_no === 'string' ? claims.employee_no : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<UserResponse | null>(() =>
    tokenStore.get() ? tokenStore.getUser<UserResponse>() : null,
  );
  const [initializing, setInitializing] = useState<boolean>(() => tokenStore.get() !== null);
  const [expired, setExpired] = useState(false);

  // 리스너는 한 번만 등록하므로 최신 값은 ref로 읽는다.
  // ref 동기화는 렌더 중이 아니라 layout effect에서 하고, 각 값이 바뀔 때만 갱신한다.
  // 리스너가 즉시 반영한 값(user null, 로그인 이동 중)이 이전 렌더 값으로 되돌려지지 않게 하기 위해서다
  const userRef = useRef(user);
  const initializingRef = useRef(initializing);
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);
  const loginRedirectPendingRef = useRef(false); // /login 이동을 이미 요청했고 아직 반영되지 않음
  // 로그아웃 이동(/courses)이 반영되길 기다리는 중. navigate가 새 location을 만들지 못하면(예: blocker)
  // 다음 위치 변경에서 user가 비워진다. react-router가 같은 URL 이동에도 새 location key를 만드는 성질에 기댄다
  const logoutPendingRef = useRef(false);

  useLayoutEffect(() => {
    userRef.current = user;
  }, [user]);
  useLayoutEffect(() => {
    initializingRef.current = initializing;
  }, [initializing]);
  useLayoutEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // 경로가 실제로 바뀐 뒤에 처리할 것들
  useLayoutEffect(() => {
    locationRef.current = location;
    loginRedirectPendingRef.current = false;
    if (logoutPendingRef.current) {
      // 로그아웃: 이동이 반영된 뒤에 user를 비운다.
      // 먼저 비우면 RequireAuth가 /login으로 보내 /courses 이동을 덮는다(react-router는 이동을 transition으로 처리한다)
      logoutPendingRef.current = false;
      setUser(null);
    }
    // 만료 안내는 로그인 화면에서 한 번만 보여 준다. 로그인 화면을 떠나면 지운다
    if (location.pathname !== '/login') setExpired(false);
  }, [location]);

  useEffect(() => {
    let cancelled = false;

    // 401 알림 리스너는 me() 호출보다 먼저 등록한다
    const onUnauthorized = () => {
      if (!userRef.current && !initializingRef.current) return;
      userRef.current = null;
      setUser(null);
      setExpired(true);
      // 이미 /login이거나 이동을 요청했으면 이동하지 않는다. 두 번째 401이 state.from을 덮지 않게 하기 위해서다
      if (locationRef.current.pathname !== '/login' && !loginRedirectPendingRef.current) {
        loginRedirectPendingRef.current = true;
        navigateRef.current('/login', { replace: true, state: { from: locationRef.current } });
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

    // 다른 탭에서 토큰이 바뀌면 이 탭의 사용자도 맞춘다. 화면의 사용자와 실제로 보내는 토큰이 같아야 한다.
    // 토큰이 사라졌으면 비로그인(만료 안내 없음), 다른 토큰이면 저장된 user로 교체하고 없거나 깨졌으면 me()로 확인한다
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== TOKEN_KEY) return; // key가 null이면 clear() 호출이다
      const newToken = tokenStore.get();
      if (!newToken) {
        userRef.current = null;
        setUser(null);
        return;
      }
      const stored = tokenStore.getUser<UserResponse>();
      // 저장 user의 사번이 토큰 클레임과 다르면(디코드 실패 포함) 신뢰하지 않고 me()로 확인한다
      if (
        stored &&
        typeof stored === 'object' &&
        stored.id != null &&
        stored.role &&
        stored.employeeNo === tokenEmployeeNo(newToken)
      ) {
        userRef.current = stored;
        setUser(stored);
        return;
      }
      // 확인이 끝나기 전에는 이전 사용자를 보여 주지 않는다
      userRef.current = null;
      setUser(null);
      authApi
        .me()
        .then((res) => {
          if (cancelled || tokenStore.get() !== newToken) return;
          tokenStore.set(newToken, res.data);
          userRef.current = res.data;
          setUser(res.data);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // 401은 인터셉터가 처리했다. 그 밖의 오류면 다른 탭과 공유하는 토큰은 지우지 않고
          // 이 탭만 비로그인으로 둔다(user는 이미 null)
        });
    };
    window.addEventListener('storage', onStorage);

    const token = tokenStore.get();
    if (token) {
      authApi
        .me()
        .then((res) => {
          // 늦게 도착한 응답이 언마운트·재시작·재로그인 뒤 상태를 덮지 않게 한다
          if (cancelled || tokenStore.get() !== token) return;
          tokenStore.set(token, res.data);
          setUser(res.data);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // 401은 인터셉터와 위 리스너가 처리했다
          if (isAxiosError(error) && error.response?.status === 401) return;
          // 그 밖의 오류(서버 다운 등)는 저장된 user로 계속한다.
          // 저장된 user가 없으면 쓸 수 없는 토큰이 계속 붙지 않도록 지운다
          if (tokenStore.get() === token && !tokenStore.getUser()) tokenStore.clear();
        })
        .finally(() => {
          if (!cancelled) setInitializing(false);
        });
    } else {
      setInitializing(false);
    }

    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback(async (employeeNo: string, password: string) => {
    const res = await authApi.login({ loginRequest: { employeeNo, password } });
    const { accessToken, user: loggedIn } = res.data;
    if (!accessToken || !loggedIn) throw new Error('로그인 응답이 올바르지 않습니다.');
    tokenStore.set(accessToken, loggedIn);
    // 저장소 차단·용량 초과로 저장되지 않았으면 되돌리고 오류로 던진다(보이는 사용자와 보내는 토큰을 맞춘다)
    if (tokenStore.get() !== accessToken) {
      tokenStore.clear();
      throw new Error('토큰을 저장하지 못했습니다.');
    }
    userRef.current = loggedIn;
    setUser(loggedIn);
    setExpired(false);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    userRef.current = null;
    setExpired(false);
    // 이동을 먼저 요청하고, user는 이동이 반영된 뒤(위 layout effect)에 비운다
    logoutPendingRef.current = true;
    navigateRef.current('/courses', { replace: true });
  }, []);

  const value = useMemo(
    () => ({ user, initializing, expired, login, logout }),
    [user, initializing, expired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
