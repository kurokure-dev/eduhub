import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { AuthProvider } from './AuthContext';
import RequireAuth from './RequireAuth';

vi.mock('../api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <p>로그인 화면 from:{from?.pathname}</p>;
}

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/courses/new']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/admin/courses/new"
            element={
              <RequireAuth admin>
                <p>관리자 화면</p>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function loginAs(role: 'EMPLOYEE' | 'ADMIN') {
  const user: UserResponse = { id: 1, employeeNo: 'X', name: '이름', role };
  tokenStore.set('t1', user);
  vi.mocked(authApi.me).mockResolvedValue({ data: user } as never);
}

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
  });

  it('R1 비로그인이면 /login으로 가고 state.from이 원래 경로다', async () => {
    renderAdminRoute();
    expect(await screen.findByText('로그인 화면 from:/admin/courses/new')).toBeInTheDocument();
  });

  it('R2 EMPLOYEE가 admin 경로에 오면 권한 없음이 보이고 토큰은 남는다', async () => {
    loginAs('EMPLOYEE');
    renderAdminRoute();
    expect(await screen.findByText('권한이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBe('t1');
  });

  it('R3 ADMIN이면 통과한다', async () => {
    loginAs('ADMIN');
    renderAdminRoute();
    expect(await screen.findByText('관리자 화면')).toBeInTheDocument();
  });
});
