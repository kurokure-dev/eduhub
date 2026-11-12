import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminCourseActions } from '../hooks/useAdminCourseActions';
import { useAdminCourses } from '../hooks/useAdminCourses';
import AdminCourseListPage from './AdminCourseListPage';

vi.mock('../hooks/useAdminCourses');
vi.mock('../hooks/useAdminCourseActions');

const mockedUseAdminCourses = vi.mocked(useAdminCourses);
const createCourse = vi.fn();

describe('AdminCourseListPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAdminCourseActions).mockReturnValue({ createCourse } as unknown as ReturnType<
      typeof useAdminCourseActions
    >);
    mockedUseAdminCourses.mockReturnValue({
      data: {
        content: [
          { id: 1, title: 'Spring 입문', category: '개발', status: 'OPEN' },
          { id: 2, title: 'JPA 심화', category: '개발', status: 'CLOSED' },
        ],
        page: 0,
        size: 10,
        totalElements: 2,
      },
      loading: false,
      error: undefined,
      reload: vi.fn(),
    });
  });

  it('종료된 과정도 상태와 함께 보여 준다 (D-34)', () => {
    render(<AdminCourseListPage onSelect={vi.fn()} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('Spring 입문')).toBeInTheDocument();
    expect(within(rows[1]).getByText('운영 중')).toBeInTheDocument();
    expect(within(rows[2]).getByText('JPA 심화')).toBeInTheDocument();
    expect(within(rows[2]).getByText('종료')).toBeInTheDocument();
  });

  it('상태를 고르면 그 상태로 첫 페이지부터 조회한다', async () => {
    render(<AdminCourseListPage onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: '상태' }));
    await userEvent.click(screen.getByRole('option', { name: '종료' }));

    expect(mockedUseAdminCourses).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'CLOSED', page: 0 }),
    );
  });

  it('행을 누르면 그 과정을 선택한다', async () => {
    const onSelect = vi.fn();
    render(<AdminCourseListPage onSelect={onSelect} />);

    await userEvent.click(screen.getByText('JPA 심화'));

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('과정을 등록하면 등록한 과정의 상세로 간다', async () => {
    createCourse.mockResolvedValue({ id: 3, status: 'OPEN' });
    const onSelect = vi.fn();
    render(<AdminCourseListPage onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: '과정 등록' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: '등록' });
    expect(submit).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/제목/), ' Docker 기초 ');
    await userEvent.type(within(dialog).getByLabelText(/분류/), '인프라');
    await userEvent.click(submit);

    expect(createCourse).toHaveBeenCalledWith({
      title: 'Docker 기초',
      category: '인프라',
      description: undefined,
    });
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('조회에 실패하면 에러 메시지를 보여 준다', () => {
    mockedUseAdminCourses.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('Network Error'),
      reload: vi.fn(),
    });

    render(<AdminCourseListPage onSelect={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('과정 목록을 불러오지 못했습니다');
  });
});
