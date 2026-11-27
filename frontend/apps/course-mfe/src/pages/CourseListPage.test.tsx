import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCategories } from '../hooks/useCategories';
import { useCourses } from '../hooks/useCourses';
import CourseListPage from './CourseListPage';

function renderList(path = '/courses') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CourseListPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** 현재 주소를 화면에 적어 URL 쿼리 변화를 확인한다 */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

// 행 클릭의 navigate 호출 횟수를 세기 위해 실제 navigate를 감싼다
const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate();
      return ((...args: Parameters<typeof real>) => {
        navigateSpy(...args);
        return real(...args);
      }) as typeof real;
    },
  };
});

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

    renderList();

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

    renderList();

    expect(screen.getByRole('alert')).toHaveTextContent('과정 목록을 불러오지 못했습니다');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 로딩 표시를 보여 준다', () => {
    mockedUseCourses.mockReturnValue({ data: undefined, loading: true, error: undefined });

    renderList();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('분류 선택지를 보여 준다', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [], page: 0, size: 10, totalElements: 0 },
      loading: false,
      error: undefined,
    });

    renderList();
    await userEvent.click(screen.getByRole('combobox', { name: '분류' }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: '전체' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '개발' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '리더십' })).toBeInTheDocument();
  });

  it('과정 제목은 상세 링크다 (D-51)', () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [{ id: 7, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });

    renderList();

    expect(screen.getByRole('link', { name: 'Spring 입문' })).toHaveAttribute('href', '/courses/7');
  });

  it('행의 아무 곳이나 누르면 상세로 이동한다 (D-51)', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [{ id: 7, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });
    renderList();

    await userEvent.click(within(screen.getByRole('table')).getByText('개발'));

    expect(screen.getByTestId('location')).toHaveTextContent('/courses/7');
  });

  it('제목 링크를 눌러도 이동은 한 번만 일어난다 (D-51)', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [{ id: 7, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });
    renderList();
    navigateSpy.mockClear();

    await userEvent.click(screen.getByRole('link', { name: 'Spring 입문' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/courses/7');
    // 링크가 이동하고, 행 onClick의 navigate는 전파가 막혀 호출되지 않는다
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('Ctrl 클릭이나 텍스트 선택 중에는 행 클릭으로 이동하지 않는다 (D-51)', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [{ id: 7, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });
    renderList();
    navigateSpy.mockClear();
    const cell = within(screen.getByRole('table')).getByText('개발');

    fireEvent.click(cell, { ctrlKey: true });
    fireEvent.click(cell, { button: 1 });
    expect(navigateSpy).not.toHaveBeenCalled();

    const spy = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '개발' } as Selection);
    await userEvent.click(cell);
    spy.mockRestore();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('URL 쿼리에서 검색 상태를 읽어 조회한다 (D-25)', () => {
    mockedUseCourses.mockReturnValue({ data: undefined, loading: true, error: undefined });

    renderList('/courses?keyword=입문&category=개발&page=2&size=20');

    expect(mockedUseCourses).toHaveBeenLastCalledWith({ keyword: '입문', category: '개발', page: 2, size: 20 });
    expect(screen.getByRole('textbox', { name: '검색어' })).toHaveValue('입문');
  });

  it('잘못된 쿼리 값은 기본값으로 본다', () => {
    mockedUseCourses.mockReturnValue({ data: undefined, loading: true, error: undefined });

    renderList('/courses?page=-3&size=999');

    expect(mockedUseCourses).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 0, size: 10 });
  });

  it('검색하면 URL 쿼리에 검색어를 남기고 첫 페이지로 간다', async () => {
    mockedUseCourses.mockReturnValue({
      data: { content: [], page: 2, size: 10, totalElements: 0 },
      loading: false,
      error: undefined,
    });

    renderList('/courses?page=2');
    await userEvent.type(screen.getByRole('textbox', { name: '검색어' }), ' 입문 ');
    await userEvent.click(screen.getByRole('button', { name: '검색' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/courses?keyword=${encodeURIComponent('입문')}`,
    );
    expect(mockedUseCourses).toHaveBeenLastCalledWith({ keyword: '입문', category: '', page: 0, size: 10 });
  });
});
