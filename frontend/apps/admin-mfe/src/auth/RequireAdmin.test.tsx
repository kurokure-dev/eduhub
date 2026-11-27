import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { AuthProvider } from './AuthContext';
import RequireAdmin from './RequireAdmin';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

function renderGuard() {
  return render(
    <AuthProvider>
      <RequireAdmin>
        <p>관리자 화면</p>
      </RequireAdmin>
    </AuthProvider>,
  );
}

function loginAs(role: 'EMPLOYEE' | 'ADMIN') {
  const user: UserResponse = { id: 1, employeeNo: 'X', name: '이름', role };
  tokenStore.set('t1', user);
  vi.mocked(authApi.me).mockResolvedValue({ data: user } as never);
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
  });

  it('G1 비로그인이면 로그인 화면이 보인다', async () => {
    renderGuard();
    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면')).not.toBeInTheDocument();
  });

  it('G2 EMPLOYEE면 권한 없음과 로그아웃 버튼이 보이고 토큰은 남는다. 로그아웃하면 로그인 화면이 되고 토큰이 지워진다', async () => {
    loginAs('EMPLOYEE');
    renderGuard();
    expect(await screen.findByText('권한이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('관리자 계정으로 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBe('t1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it('G3 ADMIN이면 children이 보인다', async () => {
    loginAs('ADMIN');
    renderGuard();
    expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
  });
});
