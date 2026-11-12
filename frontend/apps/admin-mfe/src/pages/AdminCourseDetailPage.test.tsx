import type { AdminCourseDetailResponse } from '@eduhub/api-client';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminCourse } from '../hooks/useAdminCourse';
import { useAdminCourseActions } from '../hooks/useAdminCourseActions';
import AdminCourseDetailPage from './AdminCourseDetailPage';

vi.mock('../hooks/useAdminCourse');
vi.mock('../hooks/useAdminCourseActions');

const actions = {
  updateCourse: vi.fn(),
  closeCourse: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  closeSession: vi.fn(),
};
const reload = vi.fn();

const openCourse: AdminCourseDetailResponse = {
  id: 1,
  title: 'Spring 입문',
  category: '개발',
  description: '기초 과정',
  status: 'OPEN',
  sessions: [
    { id: 10, startDate: '2026-12-01', place: '본사 3층', capacity: 20, status: 'OPEN' },
    { id: 11, startDate: '2026-11-01', place: '별관', capacity: 10, status: 'CLOSED' },
  ],
};

function givenCourse(data: AdminCourseDetailResponse) {
  vi.mocked(useAdminCourse).mockReturnValue({ data, loading: false, error: undefined, reload });
}

describe('AdminCourseDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAdminCourseActions).mockReturnValue(
      actions as unknown as ReturnType<typeof useAdminCourseActions>,
    );
    givenCourse(openCourse);
  });

  it('모든 회차를 보여 주고, 마감된 회차에는 수정·마감 버튼이 없다', () => {
    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    const rows = within(screen.getByRole('table', { name: '회차' })).getAllByRole('row');
    expect(within(rows[1]).getByText('모집 중')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(within(rows[2]).getByText('마감')).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('과정 종료를 확인하면 종료하고 다시 불러온다 (D-31)', async () => {
    actions.closeCourse.mockResolvedValue({});
    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '과정 종료' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('모집 중인 회차도 모두 마감');
    await userEvent.click(within(dialog).getByRole('button', { name: '종료' }));

    expect(actions.closeCourse).toHaveBeenCalledWith(1);
    expect(reload).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('회차 정원을 바꾸면 회차 id와 함께 저장한다', async () => {
    actions.updateSession.mockResolvedValue({});
    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = screen.getByRole('dialog');
    const capacity = within(dialog).getByLabelText(/정원/);
    await userEvent.clear(capacity);
    await userEvent.type(capacity, '30');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(actions.updateSession).toHaveBeenCalledWith(1, 10, {
      startDate: '2026-12-01',
      place: '본사 3층',
      capacity: 30,
    });
  });

  it('정원이 0이면 저장할 수 없다', async () => {
    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = screen.getByRole('dialog');
    const capacity = within(dialog).getByLabelText(/정원/);
    await userEvent.clear(capacity);
    await userEvent.type(capacity, '0');

    expect(within(dialog).getByText('1 이상의 정수를 입력하세요')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('서버가 409로 거부하면 대화상자에 사유를 보여 준다 (D-32)', async () => {
    const error = new AxiosError('Request failed with status code 409');
    error.response = {
      status: 409,
      data: { detail: '마감된 회차는 변경할 수 없습니다: 10' },
    } as AxiosResponse;
    actions.closeSession.mockRejectedValue(error);
    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '마감' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '마감' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '마감된 회차는 변경할 수 없습니다: 10',
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('종료된 과정은 수정·종료·회차 등록 버튼을 감춘다 (D-32)', () => {
    givenCourse({ ...openCourse, status: 'CLOSED', sessions: [] });

    render(<AdminCourseDetailPage courseId={1} onBack={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '과정 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '과정 종료' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '회차 등록' })).not.toBeInTheDocument();
    expect(screen.getByText('종료된 과정은 수정하거나 회차를 추가할 수 없습니다.')).toBeInTheDocument();
  });
});
