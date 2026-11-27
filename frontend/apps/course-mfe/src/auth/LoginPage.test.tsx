import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/http';
import { AuthProvider } from './AuthContext';
import LoginPage from './LoginPage';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

const employee: UserResponse = { id: 1, employeeNo: 'DEV-E001', name: '홍길동', role: 'EMPLOYEE' };

function PathProbe() {
  const location = useLocation();
  return <p>이동:{location.pathname + location.search}</p>;
}

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('사번'), 'DEV-E001');
  await user.type(screen.getByLabelText('비밀번호'), 'pw');
  await user.click(screen.getByRole('button', { name: '로그인' }));
}

function httpError(status: number) {
  return new AxiosError('fail', String(status), undefined, null, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: {},
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
  });

  it('L1 성공하면 from(pathname+search)으로 이동한다', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't', user: employee } } as never);
    renderAt({ pathname: '/login', state: { from: { pathname: '/my/enrollments', search: '?a=1' } } });
    await fillAndSubmit();
    expect(await screen.findByText('이동:/my/enrollments?a=1')).toBeInTheDocument();
    expect(tokenStore.get()).toBe('t');
  });

  it('L1 from이 없으면 /courses로 이동한다', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't', user: employee } } as never);
    renderAt('/login');
    await fillAndSubmit();
    expect(await screen.findByText('이동:/courses')).toBeInTheDocument();
  });

  it('L1 from이 /login이어도 /courses로 이동한다', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't', user: employee } } as never);
    renderAt({ pathname: '/login', state: { from: { pathname: '/login' } } });
    await fillAndSubmit();
    expect(await screen.findByText('이동:/courses')).toBeInTheDocument();
  });

  it('시작 확인 중에는 이동하지 않고 로딩을 보여 주며, 끝나면 from으로 이동한다', async () => {
    tokenStore.set('t1', employee);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.me).mockReturnValue(new Promise((r) => (resolveMe = r)) as never);
    renderAt({ pathname: '/login', state: { from: { pathname: '/my/enrollments' } } });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/^이동:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('사번')).not.toBeInTheDocument();

    await act(async () => {
      resolveMe({ data: employee });
    });
    expect(await screen.findByText('이동:/my/enrollments')).toBeInTheDocument();
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])('from.pathname이 %s이면 /courses로 이동한다', async (pathname) => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't', user: employee } } as never);
    renderAt({ pathname: '/login', state: { from: { pathname } } });
    await fillAndSubmit();
    expect(await screen.findByText('이동:/courses')).toBeInTheDocument();
  });

  it('L2 401이면 사번·비밀번호 오류 문장이 나온다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(401));
    renderAt('/login');
    await fillAndSubmit();
    expect(await screen.findByText('사번 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
  });

  it('L3 401이 아닌 오류면 일반 오류 문장이 나온다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(500));
    renderAt('/login');
    await fillAndSubmit();
    expect(
      await screen.findByText('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
  });

  it('L4 expired면 만료 안내가 나온다', async () => {
    tokenStore.set('t1', employee);
    vi.mocked(authApi.me).mockResolvedValue({ data: employee } as never);
    renderAt('/courses');
    await screen.findByText('이동:/courses');
    // me() 응답 처리가 끝난 뒤에 이벤트를 보낸다
    await act(async () => {});
    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(await screen.findByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument();
  });

  it('L5 제출 중에는 버튼이 비활성화된다', async () => {
    vi.mocked(authApi.login).mockReturnValue(new Promise(() => {}) as never);
    renderAt('/login');
    await fillAndSubmit();
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
  });

  it('빈 값이면 제출하지 않는다', async () => {
    renderAt('/login');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(authApi.login).not.toHaveBeenCalled();
  });
});
