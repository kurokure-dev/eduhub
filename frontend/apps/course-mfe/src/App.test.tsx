import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { authApi } from './api/clients';
import { tokenStore } from './api/http';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import { useCategories } from './hooks/useCategories';
import { useCourseDetail } from './hooks/useCourseDetail';
import { useCourses } from './hooks/useCourses';

vi.mock('./hooks/useCourses');
vi.mock('./hooks/useCategories');
vi.mock('./hooks/useCourseDetail');
vi.mock('./api/clients', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App 라우팅 (D-24)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(useCategories).mockReturnValue({ data: [], loading: false, error: undefined });
    vi.mocked(useCourses).mockReturnValue({
      data: { content: [{ id: 1, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });
    vi.mocked(useCourseDetail).mockReturnValue({
      data: { id: 1, title: 'Spring 입문 상세', sessions: [] },
      loading: false,
      notFound: false,
      error: undefined,
    });
  });

  it('/ 는 과정 목록으로 보낸다', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });

  it('없는 경로도 과정 목록으로 보낸다', () => {
    renderApp('/nowhere');

    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });

  it('목록에서 제목을 누르면 상세로 가고, 목록 링크로 돌아온다', async () => {
    renderApp('/courses');

    await userEvent.click(screen.getByRole('link', { name: 'Spring 입문' }));
    expect(screen.getByRole('heading', { name: 'Spring 입문 상세' })).toBeInTheDocument();
    expect(useCourseDetail).toHaveBeenLastCalledWith('1');

    await userEvent.click(screen.getByRole('link', { name: /과정 목록/ }));
    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });

  describe('상단 바와 보호 경로 (NFR-03)', () => {
    function loginAs(role: 'EMPLOYEE' | 'ADMIN') {
      const user: UserResponse = { id: 1, employeeNo: 'X', name: '홍길동', role };
      tokenStore.set('t1', user);
      vi.mocked(authApi.me).mockResolvedValue({ data: user } as never);
    }

    it('비로그인 상단 바에는 로그인만 있고 내 신청 내역이 없다', () => {
      renderApp('/courses');

      expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
      expect(screen.queryByText('내 신청 내역')).not.toBeInTheDocument();
      expect(screen.queryByText('과정 등록')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    });

    it('EMPLOYEE 상단 바에는 내 신청 내역이 있고 과정 등록은 없다', async () => {
      loginAs('EMPLOYEE');
      renderApp('/courses');

      expect(await screen.findByRole('link', { name: '내 신청 내역' })).toBeInTheDocument();
      expect(screen.queryByText('과정 등록')).not.toBeInTheDocument();
    });

    it('ADMIN 상단 바에는 과정 등록과 이름, 로그아웃이 있다', async () => {
      loginAs('ADMIN');
      renderApp('/courses');

      expect(await screen.findByRole('link', { name: '과정 등록' })).toBeInTheDocument();
      expect(screen.getByText('홍길동')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    });

    it('상단 바 로그인 링크는 현재 위치를 넘기고, 로그인하면 그 경로로 돌아온다', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        data: { accessToken: 't2', user: { id: 1, employeeNo: 'X', name: '홍길동', role: 'EMPLOYEE' } },
      } as never);
      renderApp('/courses?page=2');

      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: '로그인' }));
      await user.type(await screen.findByLabelText('사번'), 'X');
      await user.type(screen.getByLabelText('비밀번호'), 'pw');
      await user.click(screen.getByRole('button', { name: '로그인' }));

      expect(await screen.findByRole('heading', { name: '교육과정' })).toBeInTheDocument();
      expect(screen.getByText('홍길동')).toBeInTheDocument();
    });

    it('/login에서는 로그인 링크가 from을 넘기지 않아 로그인 뒤 /courses로 간다', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        data: { accessToken: 't2', user: { id: 1, employeeNo: 'X', name: '홍길동', role: 'EMPLOYEE' } },
      } as never);
      renderApp('/login');

      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: '로그인' }));
      await user.type(await screen.findByLabelText('사번'), 'X');
      await user.type(screen.getByLabelText('비밀번호'), 'pw');
      await user.click(screen.getByRole('button', { name: '로그인' }));

      expect(await screen.findByRole('heading', { name: '교육과정' })).toBeInTheDocument();
    });

    it('비로그인으로 /my/enrollments에 가면 로그인 화면이 보인다', async () => {
      renderApp('/my/enrollments');

      expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    });

    it('EMPLOYEE가 /admin/courses/new에 가면 권한 없음이 보인다', async () => {
      loginAs('EMPLOYEE');
      renderApp('/admin/courses/new');

      expect(await screen.findByText('권한이 없습니다.')).toBeInTheDocument();
    });

    it('로그인한 사용자는 /my/enrollments에서 준비 중 화면을 본다', async () => {
      loginAs('EMPLOYEE');
      renderApp('/my/enrollments');

      expect(await screen.findByText('준비 중인 화면입니다.')).toBeInTheDocument();
    });
  });
});
