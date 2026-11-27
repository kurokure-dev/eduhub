import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/http';
import { AuthProvider, useAuth } from './AuthContext';
import RequireAdmin from './RequireAdmin';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

const admin: UserResponse = { id: 1, employeeNo: 'DEV-A001', name: '관리자', role: 'ADMIN' };

// 서명 없는 테스트용 JWT (payload만 base64url로 인코딩)
function fakeJwt(employeeNo: string): string {
  const payload = btoa(JSON.stringify({ employee_no: employeeNo }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${payload}.s`;
}

function Probe({ onLoginError }: { onLoginError: (e: unknown) => void }) {
  const { expired, user, login, logout } = useAuth();
  return (
    <div>
      <span>expired:{String(expired)}</span>
      <span>user:{user?.name ?? 'none'}</span>
      <button onClick={logout}>로그아웃</button>
      <button onClick={() => login('DEV-A001', 'pw').catch(onLoginError)}>직접로그인</button>
    </div>
  );
}

function renderApp(strict = false, onLoginError: (e: unknown) => void = () => {}) {
  const ui = (
    <AuthProvider>
      <Probe onLoginError={onLoginError} />
      <RequireAdmin>
        <p>관리자 화면</p>
      </RequireAdmin>
    </AuthProvider>
  );
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
}

function fireUnauthorized() {
  act(() => {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  });
}

function fireStorage(key: string | null = 'eduhub.accessToken') {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
}

describe('AuthProvider (admin-mfe)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.me).mockResolvedValue({ data: admin } as never);
  });

  it('A1 로그인 상태에서 401 이벤트가 오면 로그인 화면과 만료 안내가 보인다', async () => {
    tokenStore.set('t1', admin);
    renderApp();
    await screen.findByText('관리자 화면');

    fireUnauthorized();

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(screen.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면')).not.toBeInTheDocument();
  });

  it('A2 토큰이 있으면 me()를 부르고 로딩을 보여 준 뒤 성공하면 관리자 화면이 보인다', async () => {
    tokenStore.set('t1', admin);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);

    renderApp(true);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면')).not.toBeInTheDocument();
    expect(authApi.me).toHaveBeenCalled();

    await act(async () => {
      resolveMe({ data: { ...admin, name: '갱신됨' } });
    });

    expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
    expect(tokenStore.getUser<UserResponse>()?.name).toBe('갱신됨');
  });

  it('A3 시작 확인의 me()가 401이 아닌 오류면 저장된 user로 계속한다', async () => {
    tokenStore.set('t1', admin);
    vi.mocked(authApi.me).mockRejectedValue(new Error('서버 다운'));
    renderApp();
    expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
    expect(tokenStore.get()).toBe('t1');
  });

  it('A3b 토큰은 있는데 저장 user가 깨졌고 me()가 401이 아닌 오류면 토큰을 지우고 로그인 화면이 된다', async () => {
    localStorage.setItem('eduhub.accessToken', 't1');
    localStorage.setItem('eduhub.user', '{broken');
    vi.mocked(authApi.me).mockRejectedValue(new Error('서버 다운'));
    renderApp();
    await screen.findByRole('heading', { name: '관리자 로그인' });
    expect(tokenStore.get()).toBeNull();
  });

  it('A3c 시작 확인 중 로그아웃한 뒤 늦게 온 me() 성공이 user를 되살리지 않는다', async () => {
    tokenStore.set('t1', admin);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(screen.getByText('user:none')).toBeInTheDocument());

    await act(async () => {
      resolveMe({ data: admin });
    });

    expect(screen.getByText('user:none')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
  });

  it('A4 logout()이면 토큰이 지워지고 만료 안내 없이 로그인 화면이 보인다', async () => {
    tokenStore.set('t1', admin);
    renderApp();
    await screen.findByText('관리자 화면');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
    expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
  });

  it('A5 비로그인 상태의 401 이벤트는 만료 안내를 만들지 않는다', async () => {
    renderApp();
    await screen.findByRole('heading', { name: '관리자 로그인' });

    fireUnauthorized();

    expect(screen.getByText('expired:false')).toBeInTheDocument();
    expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
  });

  describe('A6 다른 탭 동기화 (storage 이벤트)', () => {
    it('토큰이 지워지면 로그인 화면이 된다(만료 안내 없음)', async () => {
      tokenStore.set('t1', admin);
      renderApp();
      await screen.findByText('관리자 화면');

      localStorage.clear();
      fireStorage(null);

      await screen.findByRole('heading', { name: '관리자 로그인' });
      expect(screen.getByText('expired:false')).toBeInTheDocument();
    });

    it('다른 토큰으로 바뀌고 저장 user 사번이 클레임과 같으면 그 user로 바뀐다(me() 추가 호출 없음)', async () => {
      tokenStore.set('t1', admin);
      renderApp();
      await screen.findByText('user:관리자');

      tokenStore.set(fakeJwt('DEV-A002'), { id: 2, employeeNo: 'DEV-A002', name: '김관리', role: 'ADMIN' });
      fireStorage();

      expect(await screen.findByText('user:김관리')).toBeInTheDocument();
      expect(authApi.me).toHaveBeenCalledTimes(1);
    });

    it('만료 안내가 뜬 뒤 다른 탭 로그인으로 복구되면 안내가 사라지고, 이어 토큰이 삭제돼도 안내는 없다', async () => {
      tokenStore.set('t1', admin);
      renderApp();
      await screen.findByText('관리자 화면');
      fireUnauthorized();
      await screen.findByText('로그인이 만료되었습니다. 다시 로그인해 주세요.');

      tokenStore.set(fakeJwt('DEV-A002'), { id: 2, employeeNo: 'DEV-A002', name: '김관리', role: 'ADMIN' });
      fireStorage();
      expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
      expect(screen.getByText('expired:false')).toBeInTheDocument();

      localStorage.clear();
      fireStorage(null);
      await screen.findByRole('heading', { name: '관리자 로그인' });
      expect(screen.getByText('expired:false')).toBeInTheDocument();
      expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
    });

    it('저장 user 사번이 클레임과 다르면 me()로 확인한다', async () => {
      tokenStore.set('t1', admin);
      renderApp();
      await screen.findByText('user:관리자');
      vi.mocked(authApi.me).mockResolvedValue({
        data: { id: 2, employeeNo: 'DEV-A002', name: '김관리', role: 'ADMIN' },
      } as never);
      vi.mocked(authApi.me).mockClear();

      tokenStore.set(fakeJwt('DEV-A002'), admin);
      fireStorage();

      expect(await screen.findByText('user:김관리')).toBeInTheDocument();
      expect(authApi.me).toHaveBeenCalledTimes(1);
    });
  });

  it('A8 StrictMode에서 리스너 등록과 해제가 짝이 맞고 살아 있는 등록은 하나이며 401 이벤트는 한 번 처리된다', async () => {
    const adds = vi.spyOn(window, 'addEventListener');
    const removes = vi.spyOn(window, 'removeEventListener');
    try {
      tokenStore.set('t1', admin);
      renderApp(true);
      await screen.findByText('관리자 화면');

      const count = (spy: typeof adds, type: string) => spy.mock.calls.filter((c) => c[0] === type).length;
      for (const type of [UNAUTHORIZED_EVENT, 'storage']) {
        expect(count(adds, type) - count(removes, type)).toBe(1);
      }

      // 리스너가 하나뿐이므로 401 한 번이면 만료 안내가 한 번 뜬다
      fireUnauthorized();
      expect(await screen.findAllByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toHaveLength(1);
    } finally {
      adds.mockRestore();
      removes.mockRestore();
    }
  });

  it('A7 로그인 저장이 실패하면 오류를 던지고 비로그인으로 남는다', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't2', user: admin } } as never);
    const onLoginError = vi.fn();
    renderApp(false, onLoginError);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '직접로그인' }));

      await waitFor(() => expect(onLoginError).toHaveBeenCalledTimes(1));
      expect(screen.getByText('user:none')).toBeInTheDocument();
      expect(tokenStore.get()).toBeNull();
      expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
