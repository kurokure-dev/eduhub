import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterResponse } from '@eduhub/api-client';
import { CompleteError, useCompleteEnrollments } from '../hooks/useCompleteEnrollments';
import { useRoster } from '../hooks/useRoster';
import RosterPage from './RosterPage';

vi.mock('../hooks/useRoster');
vi.mock('../hooks/useCompleteEnrollments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useCompleteEnrollments')>()),
  useCompleteEnrollments: vi.fn(),
}));

const roster: RosterResponse = {
  sessionId: 7,
  courseTitle: 'Spring 입문',
  sessionStartDate: '2026-03-01',
  capacity: 3,
  sessionStatus: 'CLOSED',
  confirmed: [
    { enrollmentId: 1, employeeNo: 'E001', name: '김하나', status: 'CONFIRMED' },
    { enrollmentId: 2, employeeNo: 'E002', name: '이둘', status: 'CONFIRMED' },
    { enrollmentId: 3, employeeNo: 'E003', name: '박셋', status: 'COMPLETED' },
  ],
  waiting: [
    { enrollmentId: 5, employeeNo: 'W002', name: '대기둘', waitingRank: 2 },
    { enrollmentId: 4, employeeNo: 'W001', name: '대기하나', waitingRank: 1 },
  ],
};

const reload = vi.fn();
const complete = vi.fn();

function mockRoster(over: Partial<ReturnType<typeof useRoster>> = {}) {
  vi.mocked(useRoster).mockReturnValue({
    data: roster,
    loading: false,
    error: undefined,
    notFound: false,
    reload,
    ...over,
  });
}

function pageUi() {
  return (
    <MemoryRouter initialEntries={["/admin/sessions/7/roster"]}>
      <Routes>
        <Route path="/admin/sessions/:sessionId/roster" element={<RosterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderPage() {
  return render(pageUi());
}

describe('RosterPage', () => {
  beforeEach(() => {
    reload.mockReset();
    complete.mockReset();
    vi.mocked(useCompleteEnrollments).mockReturnValue({ complete, pending: false });
    mockRoster();
  });

  it('과정명·시작일, 확정자, 수료자 칩, 대기자 순번 순을 보여 준다', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Spring 입문' })).toBeInTheDocument();
    expect(screen.getByText(/2026-03-01/)).toBeInTheDocument();
    expect(screen.getByText('김하나')).toBeInTheDocument();
    expect(screen.getByText('E001')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '김하나 선택' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '이둘 선택' })).toBeInTheDocument();
    // 수료자는 칩만 있고 체크박스가 없다
    expect(screen.getByText('수료')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '박셋 선택' })).not.toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: '대기자' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('대기하나');
    expect(rows[2]).toHaveTextContent('대기둘');
  });

  it('선택이 없으면 수료 처리 버튼이 비활성이다', () => {
    renderPage();

    expect(screen.getByRole('button', { name: '선택한 0명 수료 처리' })).toBeDisabled();
  });

  it('대기자가 없으면 안내를 보여 준다', () => {
    mockRoster({ data: { ...roster, waiting: [] } });
    renderPage();

    expect(screen.getByText('대기자가 없습니다')).toBeInTheDocument();
  });

  it('두 명을 선택해 처리하면 결과와 실패 사유를 보여 주고 다시 읽는다', async () => {
    complete.mockResolvedValue({ completed: ['E001'], failed: [{ employeeId: 'E002', reason: 'ALREADY_COMPLETED' }] });
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: '김하나 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '이둘 선택' }));
    await user.click(screen.getByRole('button', { name: '선택한 2명 수료 처리' }));

    expect(complete).toHaveBeenCalledWith(7, ['E001', 'E002']);
    expect(await screen.findByText(/1명을 수료 처리했습니다\./)).toBeInTheDocument();
    expect(screen.getByText(/E002.*이미 수료/)).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '선택한 0명 수료 처리' })).toBeDisabled();
  });

  it('409면 서버 이유를 그대로 보여 준다', async () => {
    complete.mockRejectedValue(new CompleteError('conflict', '시작일 전에는 수료 처리할 수 없습니다'));
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: '김하나 선택' }));
    await user.click(screen.getByRole('button', { name: '선택한 1명 수료 처리' }));

    expect(await screen.findByText('시작일 전에는 수료 처리할 수 없습니다')).toBeInTheDocument();
  });

  it('수료 처리 뒤 다시 읽기가 실패해도 결과와 다시 시도 버튼이 남는다', async () => {
    complete.mockImplementation(async () => {
      mockRoster({ data: undefined, error: { kind: 'error' } });
      return { completed: ['E001'], failed: [{ employeeId: 'E002', reason: 'WAITING' }] };
    });
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: '김하나 선택' }));
    await user.click(screen.getByRole('button', { name: '선택한 1명 수료 처리' }));

    expect(await screen.findByText(/1명을 수료 처리했습니다\./)).toBeInTheDocument();
    expect(screen.getByText('이둘(E002) — 대기 중')).toBeInTheDocument();
    reload.mockClear();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('다시 읽은 뒤 수료 상태가 된 사람은 선택 개수에서 빠진다', async () => {
    const view = renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: '김하나 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '이둘 선택' }));
    expect(screen.getByRole('button', { name: '선택한 2명 수료 처리' })).toBeEnabled();

    // 재조회로 이둘이 수료 상태가 됐다
    mockRoster({
      data: {
        ...roster,
        confirmed: roster.confirmed!.map((c) => (c.employeeNo === 'E002' ? { ...c, status: 'COMPLETED' as const } : c)),
      },
    });
    view.rerender(pageUi());

    expect(screen.getByRole('button', { name: '선택한 1명 수료 처리' })).toBeInTheDocument();
    complete.mockResolvedValue({ completed: ['E001'], failed: [] });
    await user.click(screen.getByRole('button', { name: '선택한 1명 수료 처리' }));
    expect(complete).toHaveBeenCalledWith(7, ['E001']);
  });

  it('선택이 200명을 넘으면 버튼이 비활성이고 안내가 보인다', async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      enrollmentId: i + 100,
      employeeNo: `M${i}`,
      name: `사원${i}`,
      status: 'CONFIRMED' as const,
    }));
    mockRoster({ data: { ...roster, confirmed: many } });
    renderPage();

    await userEvent.click(screen.getByRole('checkbox', { name: '전체 선택' }));

    expect(screen.getByText(/최대 200명까지/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택한 201명 수료 처리' })).toBeDisabled();
  });

  it('조회가 403이면 관리자만 볼 수 있다는 안내를 보여 준다', () => {
    mockRoster({ data: undefined, error: { kind: 'forbidden' } });
    renderPage();

    expect(screen.getByText('관리자만 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('회차가 없으면 찾을 수 없다고 알린다', () => {
    mockRoster({ data: undefined, error: { kind: 'notFound' }, notFound: true });
    renderPage();

    expect(screen.getByText('회차를 찾을 수 없습니다')).toBeInTheDocument();
  });
});
