import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CancelError, useCancelEnrollment } from '../hooks/useCancelEnrollment';
import { useMyEnrollments } from '../hooks/useMyEnrollments';
import MyEnrollmentsPage from './MyEnrollmentsPage';

vi.mock('../hooks/useMyEnrollments');
vi.mock('../hooks/useCancelEnrollment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useCancelEnrollment')>()),
  useCancelEnrollment: vi.fn(),
}));

const reload = vi.fn();
const cancel = vi.fn();

const rows = [
  {
    enrollmentId: 1,
    sessionId: 10,
    courseTitle: 'Spring 입문',
    sessionStartDate: '2026-12-01',
    sessionPlace: '본사',
    status: 'WAITING' as const,
    waitingRank: 2,
  },
  {
    enrollmentId: 2,
    sessionId: 11,
    courseTitle: '코칭 기초',
    sessionStartDate: '2026-12-10',
    sessionPlace: '온라인',
    status: 'CANCELLED' as const,
    waitingRank: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MyEnrollmentsPage />
    </MemoryRouter>,
  );
}

describe('MyEnrollmentsPage (FR-06)', () => {
  beforeEach(() => {
    reload.mockReset();
    cancel.mockReset();
    vi.mocked(useMyEnrollments).mockReturnValue({ data: rows, loading: false, error: undefined, reload });
    vi.mocked(useCancelEnrollment).mockReturnValue({ cancel, pending: false });
  });

  it('대기 칩에 순번을 보이고 취소 버튼은 확정·대기에만 있다', () => {
    renderPage();

    expect(screen.getByText('대기 2번')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('button', { name: /신청 취소/ })).toHaveLength(1);
  });

  it('필터를 바꾸면 훅에 상태를 넘긴다', async () => {
    renderPage();
    expect(useMyEnrollments).toHaveBeenLastCalledWith(undefined);

    await userEvent.click(screen.getByRole('button', { name: '확정' }));
    expect(useMyEnrollments).toHaveBeenLastCalledWith('CONFIRMED');

    await userEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(useMyEnrollments).toHaveBeenLastCalledWith(undefined);
  });

  it('취소를 확인하면 cancel을 부르고 다시 조회한다', async () => {
    cancel.mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('신청을 취소할까요?')).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '취소 확정' }));

    expect(cancel).toHaveBeenCalledWith(1);
    expect(await screen.findByText('신청이 취소되었습니다')).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
  });

  it('취소가 충돌로 실패하면 안내 문구를 보여 준다', async () => {
    cancel.mockRejectedValue(new CancelError('conflict'));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소 확정' }));

    expect(await screen.findByText('마감되었거나 취소할 수 없는 신청입니다')).toBeInTheDocument();
  });

  it('취소가 실패해도 다시 조회한다', async () => {
    cancel.mockRejectedValue(new CancelError('conflict'));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소 확정' }));

    await screen.findByText('마감되었거나 취소할 수 없는 신청입니다');
    expect(reload).toHaveBeenCalled();
  });

  it('404와 일반 오류는 각각의 문구를 보여 준다', async () => {
    renderPage();
    const confirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소 확정' }));
    };

    cancel.mockRejectedValueOnce(new CancelError('notFound'));
    await confirm();
    expect(await screen.findByText('신청을 찾을 수 없습니다')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    cancel.mockRejectedValueOnce(new CancelError('error'));
    await confirm();
    expect(await screen.findByText('취소 중 오류가 발생했습니다')).toBeInTheDocument();
  });

  it('확인 창을 닫으면 cancel을 부르지 않는다', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '닫기' }));

    expect(cancel).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('필터를 바꾸면 이전 안내를 지운다', async () => {
    cancel.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소 확정' }));
    await screen.findByText('신청이 취소되었습니다');
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    await userEvent.click(screen.getByRole('button', { name: '확정' }));

    expect(screen.queryByText('신청이 취소되었습니다')).not.toBeInTheDocument();
  });

  it('취소 진행 중이면 행 취소 버튼이 비활성이다', () => {
    vi.mocked(useCancelEnrollment).mockReturnValue({ cancel, pending: true });
    renderPage();

    expect(screen.getByRole('button', { name: 'Spring 입문 신청 취소' })).toBeDisabled();
  });

  it('취소 요청이 끝날 때까지 확인 창이 열려 있고 확인 버튼이 비활성이다', async () => {
    let finish: () => void = () => {};
    cancel.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Spring 입문 신청 취소' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소 확정' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    finish();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(reload).toHaveBeenCalled();
  });

  it('내역이 없으면 안내 문구를 보여 준다', () => {
    vi.mocked(useMyEnrollments).mockReturnValue({ data: [], loading: false, error: undefined, reload });
    renderPage();

    expect(screen.getByText('신청 내역이 없습니다.')).toBeInTheDocument();
  });
});
