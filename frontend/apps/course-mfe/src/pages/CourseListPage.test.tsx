import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCategories } from '../hooks/useCategories';
import { useCourses } from '../hooks/useCourses';
import CourseListPage from './CourseListPage';

vi.mock('../hooks/useCourses');
vi.mock('../hooks/useCategories');

const mockedUseCourses = vi.mocked(useCourses);
const mockedUseCategories = vi.mocked(useCategories);

describe('CourseListPage', () => {
  beforeEach(() => {
    mockedUseCategories.mockReturnValue({ data: ['개발', '리더십'], loading: false, error: undefined });
  });

  it('과정 목록을 표로 보여 준다', () => {
    mockedUseCourses.mockReturnValue({
      data: {
        content: [
          { id: 1, title: 'Spring 입문', category: '개발' },
          { id: 2, title: '코칭 기초', category: '리더십' },
        ],
        page: 0,
        size: 10,
        totalElements: 2,
      },
      loading: false,
      error: undefined,
    });

    render(<CourseListPage />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Spring 입문')).toBeInTheDocument();
    expect(within(table).getByText('코칭 기초')).toBeInTheDocument();
    expect(within(table).getByText('리더십')).toBeInTheDocument();
  });

  it('조회에 실패하면 에러 메시지를 보여 준다', () => {
    mockedUseCourses.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('Network Error'),
    });

    render(<CourseListPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('과정 목록을 불러오지 못했습니다');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 로딩 표시를 보여 준다', () => {
    mockedUseCourses.mockReturnValue({ data: undefined, loading: true, error: undefined });

    render(<CourseListPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('분류 선택지를 보여 준다', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [], page: 0, size: 10, totalElements: 0 },
      loading: false,
      error: undefined,
    });

    render(<CourseListPage />);
    await userEvent.click(screen.getByRole('combobox', { name: '분류' }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: '전체' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '개발' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '리더십' })).toBeInTheDocument();
  });
});
