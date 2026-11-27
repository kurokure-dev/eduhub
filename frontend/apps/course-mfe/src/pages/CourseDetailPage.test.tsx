import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { useAuth } from '../auth/AuthContext';
import { useCourseDetail } from '../hooks/useCourseDetail';
import CourseDetailPage from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail');
vi.mock('../auth/AuthContext');
// 신청 버튼 동작은 EnrollButton.test에서 확인한다
vi.mock('../enrollment/EnrollButton', () => ({
  default: ({ sessionId }: { sessionId: number }) => <button>신청 {sessionId}</button>,
}));

const mockedUseCourseDetail = vi.mocked(useCourseDetail);
const mockedUseAuth = vi.mocked(useAuth);

function loginAs(role: 'EMPLOYEE' | 'ADMIN' | null) {
  const user: UserResponse | null = role ? { id: 1, employeeNo: 'X', name: '홍길동', role } : null;
  mockedUseAuth.mockReturnValue({ user, initializing: false, expired: false, login: vi.fn(), logout: vi.fn() });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const base = { data: undefined, loading: false, notFound: false, error: undefined, refresh: vi.fn() };

describe('CourseDetailPage', () => {
  beforeEach(() => loginAs(null));

  it('과정 정보와 회차(일정, 장소, 정원, 남은 자리)를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({
      ...base,
      data: {
        id: 1,
        title: 'Spring 입문',
        category: '개발',
        description: '스프링 기초를 배운다',
        closed: false,
        sessions: [
          { id: 10, startDate: '2026-12-01', place: '본사 3층', capacity: 20, remainingSeats: 20, closed: false },
          { id: 11, startDate: '2026-12-15', place: '온라인', capacity: 30, remainingSeats: 30, closed: false },
        ],
      },
    });

    renderAt('/courses/1');

    expect(mockedUseCourseDetail).toHaveBeenCalledWith('1', { admin: false, enabled: true });
    expect(screen.getByRole('heading', { name: 'Spring 입문' })).toBeInTheDocument();
    expect(screen.getByText('개발')).toBeInTheDocument();
    expect(screen.getByText('스프링 기초를 배운다')).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: '모집 중인 회차' })).getAllByRole('row');
    expect(rows).toHaveLength(3); // 헤더 + 회차 2개
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '2026-12-01',
      '본사 3층',
      '20 / 20',
      '신청 10',
    ]);
    expect(within(rows[2]).getByText('온라인')).toBeInTheDocument();
  });

  const adminData = {
    id: 1,
    title: 'Spring 입문',
    category: '',
    description: '',
    closed: false,
    sessions: [
      { id: 10, startDate: '2026-12-01', place: '본사', capacity: 20, remainingSeats: 3, closed: false },
      { id: 11, startDate: '2026-11-01', place: '온라인', capacity: 20, remainingSeats: 0, closed: true },
    ],
  };

  it('관리자는 admin 옵션으로 조회하고 과정 수정·명단 링크와 마감 표시를 본다 (D-54)', () => {
    loginAs('ADMIN');
    mockedUseCourseDetail.mockReturnValue({ ...base, data: adminData });

    renderAt('/courses/1');

    expect(mockedUseCourseDetail).toHaveBeenCalledWith('1', { admin: true, enabled: true });
    expect(screen.getByRole('link', { name: '과정 수정' })).toHaveAttribute('href', '/admin/courses/1/edit');
    const links = screen.getAllByRole('link', { name: '명단' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/admin/sessions/10/roster',
      '/admin/sessions/11/roster',
    ]);
    expect(screen.getByText('마감')).toBeInTheDocument();
    expect(screen.queryByText('종료')).not.toBeInTheDocument();
    // 마감된 회차에는 신청 버튼이 없다
    expect(screen.getByRole('button', { name: '신청 10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신청 11' })).not.toBeInTheDocument();
  });

  it('일반 사용자에게는 과정 수정·명단이 없다', () => {
    loginAs('EMPLOYEE');
    mockedUseCourseDetail.mockReturnValue({ ...base, data: adminData });

    renderAt('/courses/1');

    expect(screen.queryByRole('link', { name: '과정 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '명단' })).not.toBeInTheDocument();
  });

  it('종료된 과정은 관리자에게 종료 칩이 보이고 신청 버튼이 없다 (D-11)', () => {
    loginAs('ADMIN');
    mockedUseCourseDetail.mockReturnValue({ ...base, data: { ...adminData, closed: true } });

    renderAt('/courses/1');

    expect(screen.getByText('종료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^신청/ })).not.toBeInTheDocument();
  });

  it('모집 중인 회차가 없으면 안내 문구를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({
      ...base,
      data: { id: 1, title: 'Spring 입문', category: '', description: '', closed: false, sessions: [] },
    });

    renderAt('/courses/1');

    expect(screen.getByText('모집 중인 회차가 없습니다.')).toBeInTheDocument();
  });

  it('없는 과정이면 안내와 목록 링크를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({ ...base, notFound: true });

    renderAt('/courses/99');

    expect(screen.getByRole('alert')).toHaveTextContent('과정을 찾을 수 없습니다');
    expect(screen.getByRole('link', { name: /과정 목록/ })).toHaveAttribute('href', '/courses');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('조회에 실패하면 오류 메시지를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({ ...base, error: new Error('Network Error') });

    renderAt('/courses/1');

    expect(screen.getByRole('alert')).toHaveTextContent('과정 정보를 불러오지 못했습니다');
  });

  it('로그인 확인 중에는 로딩을 보이고 조회를 보류한다 (D-54)', () => {
    mockedUseAuth.mockReturnValue({ user: null, initializing: true, expired: false, login: vi.fn(), logout: vi.fn() });
    mockedUseCourseDetail.mockReturnValue({ ...base, loading: true });

    renderAt('/courses/1');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(mockedUseCourseDetail).toHaveBeenLastCalledWith('1', { admin: false, enabled: false });
  });

  it('불러오는 중에는 로딩 표시를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({ ...base, loading: true });

    renderAt('/courses/1');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
