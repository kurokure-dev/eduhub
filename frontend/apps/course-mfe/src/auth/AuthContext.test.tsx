import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/http';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './LoginPage';
import RequireAuth from './RequireAuth';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

const employee: UserResponse = { id: 1, employeeNo: 'DEV-E001', name: '홍길동', role: 'EMPLOYEE' };

// 서명 없는 테스트용 JWT (payload만 base64url로 인코딩)
function fakeJwt(employeeNo: string): string {
  const payload = btoa(JSON.stringify({ employee_no: employeeNo }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${payload}.s`;
}

function Probe() {
  const { expired, user } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return (
    <div>
      <span>expired:{String(expired)}</span>
      <span>user:{user?.name ?? 'none'}</span>
      <span>path:{location.pathname + location.search}</span>
      <span>from:{from?.pathname}</span>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={logout}>로그아웃</button>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/courses" element={<LogoutButton />} />
      <Route
        path="/my/enrollments"
        element={
          <RequireAuth>
            <p>내 신청 화면</p>
            <LogoutButton />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Probe />
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

// transition으로 이동을 처리하는 데이터 라우터(BrowserRouter와 같은 갱신 방식)로 그린다
function renderDataRouter(path: string, strict = false) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AuthProvider>
            <Probe />
            <AppRoutes />
          </AuthProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const ui = <RouterProvider router={router} />;
  render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return router;
}

// 이벤트 여러 개를 한 act 안에서 연속으로 보낸다
function fireUnauthorized(times = 1) {
  act(() => {
    for (let i = 0; i < times; i++) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  });
}

async function submitLogin() {
  vi.mocked(authApi.login).mockResolvedValue({
    data: { accessToken: 't2', user: employee },
  } as never);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('사번'), 'DEV-E001');
  await user.type(screen.getByLabelText('비밀번호'), 'pw');
  await user.click(screen.getByRole('button', { name: '로그인' }));
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.me).mockResolvedValue({ data: employee } as never);
  });

  it('A1 보호 경로에서 401 이벤트를 연속으로 두 번 보내도 로그인 화면이고, 로그인하면 원래 경로로 돌아간다', async () => {
    tokenStore.set('t1', employee);
    renderAt('/my/enrollments');
    await screen.findByText('내 신청 화면');

    fireUnauthorized(2);

    await screen.findByRole('heading', { name: '로그인' });
    expect(screen.getByText('path:/login')).toBeInTheDocument();
    expect(screen.getByText('from:/my/enrollments')).toBeInTheDocument();

    await submitLogin();

    await screen.findByText('내 신청 화면');
    expect(screen.getByText('path:/my/enrollments')).toBeInTheDocument();
  });

  it('A1 공개 경로(/courses?page=2)에서 401이 두 번 와도 from이 유지되고 로그인 뒤 그 경로로 돌아간다', async () => {
    tokenStore.set('t1', employee);
    renderAt('/courses?page=2');
    await screen.findByText('expired:false');
    await act(async () => {});

    fireUnauthorized(2);

    await screen.findByRole('heading', { name: '로그인' });
    expect(screen.getByText('from:/courses')).toBeInTheDocument();

    await submitLogin();

    await waitFor(() => expect(screen.getByText('path:/courses?page=2')).toBeInTheDocument());
  });

  it('A2 로그인 상태에서 401 이벤트가 오면 expired=true이고 만료 안내가 보인다', async () => {
    tokenStore.set('t1', employee);
    renderAt('/courses');
    await screen.findByText('expired:false');

    fireUnauthorized();

    expect(await screen.findByText('expired:true')).toBeInTheDocument();
    expect(screen.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument();
  });

  it('만료 안내는 로그인 화면을 떠나면 사라진다', async () => {
    tokenStore.set('t1', employee);
    renderAt('/courses');
    await screen.findByText('expired:false');
    await act(async () => {});
    fireUnauthorized();
    await screen.findByText('expired:true');

    await submitLogin();

    await screen.findByText('path:/courses');
    expect(screen.getByText('expired:false')).toBeInTheDocument();
  });

  it('A3 토큰이 있으면 me()를 부르고 그동안 로딩을 보여 준 뒤 보호 화면을 보여 준다', async () => {
    tokenStore.set('t1', employee);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);

    renderAt('/my/enrollments');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('내 신청 화면')).not.toBeInTheDocument();
    expect(authApi.me).toHaveBeenCalled();

    await act(async () => {
      resolveMe({ data: { ...employee, name: '갱신됨' } });
    });

    expect(await screen.findByText('내 신청 화면')).toBeInTheDocument();
    expect(tokenStore.getUser<UserResponse>()?.name).toBe('갱신됨');
  });

  it('me()가 401이 아닌 오류면 저장된 user로 계속한다', async () => {
    tokenStore.set('t1', employee);
    vi.mocked(authApi.me).mockRejectedValue(new Error('서버 다운'));
    renderAt('/my/enrollments');
    expect(await screen.findByText('내 신청 화면')).toBeInTheDocument();
    expect(tokenStore.get()).toBe('t1');
  });

  it('토큰은 있는데 저장 user가 깨졌고 me()가 401이 아닌 오류면 토큰을 지운다', async () => {
    localStorage.setItem('eduhub.accessToken', 't1');
    localStorage.setItem('eduhub.user', '{broken');
    vi.mocked(authApi.me).mockRejectedValue(new Error('서버 다운'));
    renderAt('/my/enrollments');
    await screen.findByRole('heading', { name: '로그인' });
    expect(tokenStore.get()).toBeNull();
  });

  it('A4 logout()이면 토큰이 지워지고 /courses로 간다', async () => {
    tokenStore.set('t1', employee);
    renderAt('/courses');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(tokenStore.get()).toBeNull());
    expect(screen.getByText('path:/courses')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
    expect(screen.getByText('user:none')).toBeInTheDocument();
  });

  it.each([
    ['MemoryRouter', (path: string) => renderAt(path)],
    ['데이터 라우터', (path: string) => renderDataRouter(path)],
  ])('W1 보호 화면에서 로그아웃하면 최종 /courses이고 만료 안내가 없다 (%s)', async (_name, renderFn) => {
    tokenStore.set('t1', employee);
    renderFn('/my/enrollments');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(tokenStore.get()).toBeNull());
    await act(async () => {});
    expect(screen.getByText('path:/courses')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
    expect(screen.getByText('user:none')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('StrictMode에서도 로딩 뒤 user가 설정되고 401 이벤트 1회에 /login 이동은 한 번이다', async () => {
    tokenStore.set('t1', employee);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);
    const router = renderDataRouter('/my/enrollments', true);
    const navigateSpy = vi.spyOn(router, 'navigate');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await act(async () => {
      resolveMe({ data: employee });
    });
    await screen.findByText('내 신청 화면');

    fireUnauthorized();
    await screen.findByRole('heading', { name: '로그인' });
    const toLogin = navigateSpy.mock.calls.filter(([to]) => to === '/login');
    expect(toLogin).toHaveLength(1);
  });

  it('A1 이벤트 2회를 한 act에 보내도 /login 이동은 1회다(로그인 상태)', async () => {
    tokenStore.set('t1', employee);
    const router = renderDataRouter('/my/enrollments');
    await screen.findByText('내 신청 화면');
    const navigateSpy = vi.spyOn(router, 'navigate');

    fireUnauthorized(2);
    await screen.findByRole('heading', { name: '로그인' });

    expect(navigateSpy.mock.calls.filter(([to]) => to === '/login')).toHaveLength(1);
  });

  it('A1 시작 확인 중에 이벤트 2회가 와도 /login 이동은 1회다 (이동 대기 플래그가 필요한 경우)', async () => {
    tokenStore.set('t1', employee);
    vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}) as never);
    const router = renderDataRouter('/my/enrollments');
    const navigateSpy = vi.spyOn(router, 'navigate');

    fireUnauthorized(2);
    // 시작 확인 중이라 로그인 화면은 로딩을 보여 주므로 경로로 확인한다
    await screen.findByText('path:/login');

    expect(navigateSpy.mock.calls.filter(([to]) => to === '/login')).toHaveLength(1);
  });

  it('시작 확인 중 로그아웃한 뒤 늦게 온 me() 성공이 user를 되살리지 않는다', async () => {
    tokenStore.set('t1', employee);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);
    renderAt('/courses');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(screen.getByText('user:none')).toBeInTheDocument());

    await act(async () => {
      resolveMe({ data: employee });
    });

    expect(screen.getByText('user:none')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  describe('다른 탭 동기화 (storage 이벤트)', () => {
    function fireStorage(key: string | null = 'eduhub.accessToken') {
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key }));
      });
    }

    it('다른 탭에서 토큰이 삭제되면 비로그인이 되고 보호 화면이면 로그인 화면으로 간다(만료 안내 없음)', async () => {
      tokenStore.set('t1', employee);
      renderAt('/my/enrollments');
      await screen.findByText('내 신청 화면');

      localStorage.removeItem('eduhub.accessToken');
      localStorage.removeItem('eduhub.user');
      fireStorage();

      await screen.findByRole('heading', { name: '로그인' });
      expect(screen.getByText('user:none')).toBeInTheDocument();
      expect(screen.getByText('expired:false')).toBeInTheDocument();
      expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
    });

    it('공개 화면에서는 토큰이 삭제되면 user만 비워진다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');

      localStorage.clear();
      fireStorage(null);

      await screen.findByText('user:none');
      expect(screen.getByText('path:/courses')).toBeInTheDocument();
    });

    it('다른 탭에서 다른 사용자로 로그인하면 화면의 사용자가 바뀐다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/my/enrollments');
      await screen.findByText('user:홍길동');

      tokenStore.set(fakeJwt('DEV-E002'), { id: 2, employeeNo: 'DEV-E002', name: '김철수', role: 'EMPLOYEE' });
      fireStorage();

      expect(await screen.findByText('user:김철수')).toBeInTheDocument();
      expect(screen.getByText('내 신청 화면')).toBeInTheDocument();
      expect(authApi.me).toHaveBeenCalledTimes(1); // 시작 확인 1회뿐, 동기화는 저장 user를 신뢰
    });

    it('tokenStore.set은 user를 먼저, 토큰을 마지막에 쓴다', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem');
      try {
        tokenStore.set('t1', employee);
        expect(spy.mock.calls.map(([k]) => k)).toEqual(['eduhub.user', 'eduhub.accessToken']);
      } finally {
        spy.mockRestore();
      }
    });

    it('저장 user의 employeeNo가 토큰 클레임과 다르면 me()로 확인한다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');
      vi.mocked(authApi.me).mockResolvedValue({
        data: { id: 2, employeeNo: 'DEV-E002', name: '김철수', role: 'EMPLOYEE' },
      } as never);
      vi.mocked(authApi.me).mockClear();

      // 저장 user는 홍길동(DEV-E001)인데 토큰은 DEV-E002 것
      tokenStore.set(fakeJwt('DEV-E002'), employee);
      fireStorage();

      expect(await screen.findByText('user:김철수')).toBeInTheDocument();
      expect(authApi.me).toHaveBeenCalledTimes(1);
    });

    it('토큰을 디코드할 수 없으면 me()로 확인한다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');
      vi.mocked(authApi.me).mockResolvedValue({
        data: { id: 2, employeeNo: 'DEV-E002', name: '김철수', role: 'EMPLOYEE' },
      } as never);
      vi.mocked(authApi.me).mockClear();

      tokenStore.set('not-a-jwt', employee);
      fireStorage();

      expect(await screen.findByText('user:김철수')).toBeInTheDocument();
      expect(authApi.me).toHaveBeenCalledTimes(1);
    });

    it('동기화용 me()가 401이 아닌 오류면 토큰은 남기고 이 탭만 비로그인이 된다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');
      vi.mocked(authApi.me).mockRejectedValue(new Error('서버 다운'));

      localStorage.setItem('eduhub.accessToken', 't7');
      localStorage.removeItem('eduhub.user');
      fireStorage();

      await screen.findByText('user:none');
      await act(async () => {});
      expect(tokenStore.get()).toBe('t7');
      expect(screen.getByText('user:none')).toBeInTheDocument();
    });

    it('동기화용 me() 진행 중 토큰이 다시 바뀌면 앞선 결과는 무시한다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');
      let resolveFirst: (v: unknown) => void = () => {};
      vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveFirst = r)) as never);

      localStorage.setItem('eduhub.accessToken', 't7');
      localStorage.removeItem('eduhub.user');
      fireStorage();
      await screen.findByText('user:none');

      // 그 사이 다른 탭이 또 바뀌어 토큰이 삭제됨
      localStorage.clear();
      fireStorage();
      await act(async () => {
        resolveFirst({ data: { id: 2, employeeNo: 'DEV-E002', name: '김철수', role: 'EMPLOYEE' } });
      });

      expect(screen.getByText('user:none')).toBeInTheDocument();
      expect(tokenStore.get()).toBeNull();
    });

    it('저장 user가 깨졌으면 me()로 확인해 사용자를 정한다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');
      vi.mocked(authApi.me).mockResolvedValue({
        data: { id: 3, employeeNo: 'DEV-E003', name: '이영희', role: 'EMPLOYEE' },
      } as never);

      localStorage.setItem('eduhub.accessToken', 't7');
      localStorage.setItem('eduhub.user', '{broken');
      fireStorage();

      expect(await screen.findByText('user:이영희')).toBeInTheDocument();
      expect(tokenStore.getUser<UserResponse>()?.name).toBe('이영희');
    });

    it('관련 없는 키의 변화는 무시한다', async () => {
      tokenStore.set('t1', employee);
      renderAt('/courses');
      await screen.findByText('user:홍길동');

      localStorage.removeItem('eduhub.accessToken');
      fireStorage('other.key');

      expect(screen.getByText('user:홍길동')).toBeInTheDocument();
    });

    it('언마운트하면 storage 리스너를 해제한다', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderAt('/courses');
      unmount();
      expect(removeSpy.mock.calls.some(([type]) => type === 'storage')).toBe(true);
      removeSpy.mockRestore();
    });
  });

  it('저장소에 토큰을 쓸 수 없으면 로그인은 일반 오류가 되고 비로그인으로 남는다', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      renderAt('/login');
      await submitLogin();

      expect(
        await screen.findByText('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
      ).toBeInTheDocument();
      expect(screen.getByText('user:none')).toBeInTheDocument();
      expect(tokenStore.get()).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
