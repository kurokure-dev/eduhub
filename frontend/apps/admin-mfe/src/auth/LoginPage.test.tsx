import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/http';
import { AuthProvider } from './AuthContext';
import RequireAdmin from './RequireAdmin';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

const admin: UserResponse = { id: 1, employeeNo: 'DEV-A001', name: '관리자', role: 'ADMIN' };

// 비로그인이면 RequireAdmin이 LoginPage를 보여 준다
function renderPage() {
  return render(
    <AuthProvider>
      <RequireAdmin>
        <p>관리자 화면</p>
      </RequireAdmin>
    </AuthProvider>,
  );
}

async function fillAndSubmit(employeeNo = '  DEV-A001  ') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('사번'), employeeNo);
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

describe('LoginPage (admin-mfe)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
  });

  it('L1 성공하면 login이 사번(앞뒤 공백 제거)·비밀번호로 불리고 관리자 화면이 보인다', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't', user: admin } } as never);
    renderPage();
    await fillAndSubmit();
    expect(authApi.login).toHaveBeenCalledWith({ loginRequest: { employeeNo: 'DEV-A001', password: 'pw' } });
    expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
    expect(tokenStore.get()).toBe('t');
  });

  it('L2 401이면 사번·비밀번호 오류 문장이 나온다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(401));
    renderPage();
    await fillAndSubmit();
    expect(await screen.findByText('사번 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).not.toBeInTheDocument();
  });

  it('L3 401이 아닌 오류면 일반 오류 문장이 나온다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(500));
    renderPage();
    await fillAndSubmit();
    expect(
      await screen.findByText('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });

  it('L4 expired면 만료 안내가 나온다', async () => {
    tokenStore.set('t1', admin);
    vi.mocked(authApi.me).mockResolvedValue({ data: admin } as never);
    renderPage();
    await screen.findByText('관리자 화면');
    await act(async () => {});
    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(await screen.findByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument();
  });

  it('L5 제출 중에는 버튼이 비활성화된다', async () => {
    vi.mocked(authApi.login).mockReturnValue(new Promise(() => {}) as never);
    renderPage();
    await fillAndSubmit();
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
  });

  it('L6 빈 값이면 login을 부르지 않는다', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(authApi.login).not.toHaveBeenCalled();
  });
});
