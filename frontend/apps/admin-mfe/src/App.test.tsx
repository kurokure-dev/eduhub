import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from './api/clients';
import { tokenStore } from './api/http';
import { AuthProvider } from './auth/AuthContext';
import { useAdminCourse } from './hooks/useAdminCourse';
import { useAdminCourseActions } from './hooks/useAdminCourseActions';
import { useAdminCourses } from './hooks/useAdminCourses';
import App from './App';

vi.mock('./api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));
vi.mock('./hooks/useAdminCourses');
vi.mock('./hooks/useAdminCourse');
vi.mock('./hooks/useAdminCourseActions');

const admin: UserResponse = { id: 1, employeeNo: 'DEV-A001', name: '관리자', role: 'ADMIN' };

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
}

describe('App (admin-mfe)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({ data: admin } as never);
    vi.mocked(useAdminCourseActions).mockReturnValue({ createCourse: vi.fn() } as unknown as ReturnType<
      typeof useAdminCourseActions
    >);
    vi.mocked(useAdminCourse).mockReturnValue({
      data: { id: 1, title: 'Spring 입문', category: '개발', description: '기초', status: 'OPEN', sessions: [] },
      loading: false,
      error: undefined,
      reload: vi.fn(),
    });
    vi.mocked(useAdminCourses).mockReturnValue({
      data: {
        content: [{ id: 1, title: 'Spring 입문', category: '개발', status: 'OPEN' }],
        page: 0,
        size: 10,
        totalElements: 1,
      },
      loading: false,
      error: undefined,
      reload: vi.fn(),
    });
  });

  it('비로그인이면 관리자 로그인 화면이고 로그아웃 버튼이 없다', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('EduHub 관리자')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('ADMIN이면 과정 목록 화면과 사용자 이름, 로그아웃이 보인다', async () => {
    tokenStore.set('t1', admin);
    renderApp();

    expect(await screen.findByText('Spring 입문')).toBeInTheDocument();
    const bar = within(screen.getByRole('banner'));
    expect(bar.getByText('관리자')).toBeInTheDocument();
    expect(bar.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('목록에서 과정을 선택하면 상세가 보이고 뒤로 가기를 누르면 목록으로 돌아온다', async () => {
    tokenStore.set('t1', admin);
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Spring 입문'));
    expect(await screen.findByRole('button', { name: '← 목록' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← 목록' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← 목록' })).not.toBeInTheDocument();
  });

  it('상세에서 로그아웃하면 로그인 화면이 되고, 다시 로그인하면 목록이 보인다', async () => {
    tokenStore.set('t1', admin);
    vi.mocked(authApi.login).mockResolvedValue({ data: { accessToken: 't2', user: admin } } as never);
    renderApp();
    const user = userEvent.setup();
    await user.click(await screen.findByText('Spring 입문'));
    await screen.findByRole('button', { name: '← 목록' });

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: '로그아웃' }));
    await screen.findByRole('heading', { name: '관리자 로그인' });

    await user.type(screen.getByLabelText('사번'), 'DEV-A001');
    await user.type(screen.getByLabelText('비밀번호'), 'pw');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← 목록' })).not.toBeInTheDocument();
  });

  it('EMPLOYEE는 상단 바에 이름과 로그아웃이 있고 본문에 권한 없음이 보인다', async () => {
    const employee: UserResponse = { id: 2, employeeNo: 'DEV-E001', name: '홍길동', role: 'EMPLOYEE' };
    tokenStore.set('t1', employee);
    vi.mocked(authApi.me).mockResolvedValue({ data: employee } as never);
    renderApp();

    expect(await screen.findByText('권한이 없습니다.')).toBeInTheDocument();
    const bar = within(screen.getByRole('banner'));
    expect(bar.getByText('홍길동')).toBeInTheDocument();
    expect(bar.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('다른 탭에서 다른 ADMIN으로 바뀌면 상세가 아니라 목록부터 다시 보인다', async () => {
    tokenStore.set('t1', admin);
    renderApp();
    const user = userEvent.setup();
    await user.click(await screen.findByText('Spring 입문'));
    await screen.findByRole('button', { name: '← 목록' });

    // 서명 없는 테스트용 JWT (payload는 base64url, 이 값에는 +, /, = 가 없다)
    const payload = btoa(JSON.stringify({ employee_no: 'DEV-A002' })).replaceAll('=', '');
    tokenStore.set(`h.${payload}.s`, { id: 2, employeeNo: 'DEV-A002', name: '김관리', role: 'ADMIN' });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'eduhub.accessToken' }));
    });

    expect(await screen.findByText('김관리')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← 목록' })).not.toBeInTheDocument();
  });
});
