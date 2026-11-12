import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCourseDetail } from '../hooks/useCourseDetail';
import CourseDetailPage from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail');

const mockedUseCourseDetail = vi.mocked(useCourseDetail);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const base = { data: undefined, loading: false, notFound: false, error: undefined };

describe('CourseDetailPage', () => {
  it('과정 정보와 회차(일정, 장소, 정원, 남은 자리)를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({
      ...base,
      data: {
        id: 1,
        title: 'Spring 입문',
        category: '개발',
        description: '스프링 기초를 배운다',
        sessions: [
          { id: 10, startDate: '2026-12-01', place: '본사 3층', capacity: 20, remainingSeats: 20 },
          { id: 11, startDate: '2026-12-15', place: '온라인', capacity: 30, remainingSeats: 30 },
        ],
      },
    });

    renderAt('/courses/1');

    expect(mockedUseCourseDetail).toHaveBeenCalledWith('1');
    expect(screen.getByRole('heading', { name: 'Spring 입문' })).toBeInTheDocument();
    expect(screen.getByText('개발')).toBeInTheDocument();
    expect(screen.getByText('스프링 기초를 배운다')).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: '모집 중인 회차' })).getAllByRole('row');
    expect(rows).toHaveLength(3); // 헤더 + 회차 2개
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '2026-12-01',
      '본사 3층',
      '20',
      '20',
      '신청',
    ]);
    expect(within(rows[2]).getByText('온라인')).toBeInTheDocument();
  });

  it('신청 버튼은 비활성이다 (D-27)', () => {
    mockedUseCourseDetail.mockReturnValue({
      ...base,
      data: {
        id: 1,
        title: 'Spring 입문',
        sessions: [{ id: 10, startDate: '2026-12-01', place: '본사', capacity: 20, remainingSeats: 20 }],
      },
    });

    renderAt('/courses/1');

    expect(screen.getByRole('button', { name: '신청' })).toBeDisabled();
  });

  it('모집 중인 회차가 없으면 안내 문구를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({
      ...base,
      data: { id: 1, title: 'Spring 입문', sessions: [] },
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

  it('불러오는 중에는 로딩 표시를 보여 준다', () => {
    mockedUseCourseDetail.mockReturnValue({ ...base, loading: true });

    renderAt('/courses/1');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
