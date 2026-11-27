import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminCourses } from '../hooks/useAdminCourses';
import AdminCourseListPage from './AdminCourseListPage';

vi.mock('../hooks/useAdminCourses');

const mockedHook = vi.mocked(useAdminCourses);
const reload = vi.fn();

/** 현재 주소를 화면에 적어 URL 쿼리 변화를 확인한다 */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderList(path = '/admin/courses') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminCourseListPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function mockRows() {
  mockedHook.mockReturnValue({
    data: {
      content: [
        { id: 1, title: 'Spring 입문', category: '개발', status: 'OPEN' },
        { id: 2, title: '지난 과정', category: '리더십', status: 'CLOSED' },
      ],
      page: 0,
      size: 10,
      totalElements: 2,
    },
    loading: false,
    error: undefined,
    reload,
  });
}

describe('AdminCourseListPage (FR-03, D-34, D-56)', () => {
  beforeEach(() => {
    mockedHook.mockReset();
    reload.mockReset();
    mockRows();
  });

  it('종료된 과정까지 표와 상태 칩으로 보여 주고 등록 링크가 있다', () => {
    renderList();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Spring 입문')).toBeInTheDocument();
    expect(within(table).getByText('지난 과정')).toBeInTheDocument();
    expect(within(table).getByText('운영 중')).toBeInTheDocument();
    expect(within(table).getByText('종료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '과정 관리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '과정 등록' })).toHaveAttribute('href', '/admin/courses/new');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: '', keyword: '', page: 0, size: 10 });
  });

  it('URL 쿼리를 훅 인자로 쓰고 잘못된 값은 기본값으로 본다', () => {
    renderList('/admin/courses?keyword=java&status=CLOSED&page=2&size=20');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: 'CLOSED', keyword: 'java', page: 2, size: 20 });

    renderList('/admin/courses?status=BAD&page=-1&size=7');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: '', keyword: '', page: 0, size: 10 });
  });

  it('상태 필터와 검색이 URL과 훅 인자에 반영된다', async () => {
    renderList('/admin/courses?page=3');
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: '상태' }));
    await user.click(await screen.findByRole('option', { name: '종료' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/courses?status=CLOSED');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: 'CLOSED', keyword: '', page: 0, size: 10 });

    fireEvent.change(screen.getByLabelText('검색어'), { target: { value: ' spring ' } });
    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/courses?keyword=spring&status=CLOSED');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: 'CLOSED', keyword: 'spring', page: 0, size: 10 });
  });

  it('행을 누르면 수정 화면으로 가고, 보조 클릭이나 텍스트 선택에서는 가지 않는다 (D-51)', async () => {
    renderList();
    const row = screen.getByText('지난 과정').closest('tr')!;

    fireEvent.click(row, { ctrlKey: true });
    fireEvent.click(row, { button: 1 });
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/courses');
    expect(screen.getByTestId('location')).not.toHaveTextContent('/edit');

    await userEvent.click(screen.getByText('리더십'));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/courses/2/edit');
  });

  it('meta 클릭이나 텍스트 선택 중에는 행을 눌러도 이동하지 않는다 (D-51)', async () => {
    renderList();
    const row = screen.getByText('지난 과정').closest('tr')!;

    fireEvent.click(row, { metaKey: true });
    fireEvent.click(row, { shiftKey: true });
    const spy = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '선택한 글' } as Selection);
    await userEvent.click(screen.getByText('리더십'));
    spy.mockRestore();

    expect(screen.getByTestId('location')).not.toHaveTextContent('/edit');
  });

  it('상태를 바꾸면 입력란에 적어 둔 검색어도 함께 반영한다', async () => {
    renderList();

    fireEvent.change(screen.getByLabelText('검색어'), { target: { value: ' spring ' } });
    await userEvent.click(screen.getByRole('combobox', { name: '상태' }));
    await userEvent.click(await screen.findByRole('option', { name: '운영 중' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/courses?keyword=spring&status=OPEN');
    expect(mockedHook).toHaveBeenLastCalledWith({ status: 'OPEN', keyword: 'spring', page: 0, size: 10 });
  });

  it('제목 링크는 수정 화면 주소를 가진다', () => {
    renderList();

    expect(screen.getByRole('link', { name: 'Spring 입문' })).toHaveAttribute('href', '/admin/courses/1/edit');
  });

  it('빈 목록 안내를 보여 준다', () => {
    mockedHook.mockReturnValue({
      data: { content: [], page: 0, size: 10, totalElements: 0 },
      loading: false,
      error: undefined,
      reload,
    });
    renderList();

    expect(screen.getByText('조회된 과정이 없습니다.')).toBeInTheDocument();
  });

  it('로딩 중에는 표 대신 진행 표시를 보여 준다', () => {
    mockedHook.mockReturnValue({ data: undefined, loading: true, error: undefined, reload });
    renderList();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('403이면 관리자 전용 안내를 보여 주고 다시 시도는 없다', () => {
    mockedHook.mockReturnValue({ data: undefined, loading: false, error: { kind: 'forbidden' }, reload });
    renderList();

    expect(screen.getByText('관리자만 볼 수 있습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('그 밖의 오류는 안내와 다시 시도 버튼을 보여 준다', async () => {
    mockedHook.mockReturnValue({ data: undefined, loading: false, error: { kind: 'error' }, reload });
    renderList();

    expect(screen.getByText('과정 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
