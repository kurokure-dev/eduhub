import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserResponse } from '@eduhub/api-client';
import { useAuth } from '../auth/AuthContext';
import { EnrollError, useEnroll } from '../hooks/useEnroll';
import EnrollButton from './EnrollButton';

vi.mock('../auth/AuthContext');
vi.mock('../hooks/useEnroll', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useEnroll')>()),
  useEnroll: vi.fn(),
}));

const enroll = vi.fn();

function setUser(user: UserResponse | null) {
  vi.mocked(useAuth).mockReturnValue({ user, initializing: false, expired: false, login: vi.fn(), logout: vi.fn() });
}

function renderButton(onEnrolled?: () => void) {
  return render(
    <MemoryRouter initialEntries={['/courses/1']}>
      <EnrollButton sessionId={10} onEnrolled={onEnrolled} />
    </MemoryRouter>,
  );
}

describe('EnrollButton (FR-06)', () => {
  beforeEach(() => {
    enroll.mockReset();
    vi.mocked(useEnroll).mockReturnValue({ enroll, pending: false });
    setUser({ id: 1, employeeNo: 'X', name: '홍길동', role: 'EMPLOYEE' });
  });

  it('로그인하지 않았으면 로그인 링크를 보여 준다', () => {
    setUser(null);
    renderButton();

    expect(screen.getByRole('link', { name: '로그인 후 신청' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: '신청' })).not.toBeInTheDocument();
  });

  it('대기로 등록되면 대기 순번을 알리고 갱신을 요청한다', async () => {
    enroll.mockResolvedValue({ status: 'WAITING', waitingRank: 3 });
    const onEnrolled = vi.fn();
    renderButton(onEnrolled);

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(enroll).toHaveBeenCalledWith(10);
    expect(await screen.findByText('대기 3번으로 등록되었습니다')).toBeInTheDocument();
    expect(onEnrolled).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '신청' })).toBeDisabled();
  });

  it('대기인데 순번이 없으면 순번 없는 문구로 알린다', async () => {
    enroll.mockResolvedValue({ status: 'WAITING', waitingRank: null });
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(await screen.findByText('대기로 등록되었습니다')).toBeInTheDocument();
  });

  it('확정되면 확정 문구를 보여 준다', async () => {
    enroll.mockResolvedValue({ status: 'CONFIRMED', waitingRank: null });
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(await screen.findByText('신청이 확정되었습니다')).toBeInTheDocument();
  });

  it('이미 신청한 회차면 충돌 문구를 보여 주고 갱신하지 않는다', async () => {
    enroll.mockRejectedValue(new EnrollError('conflict'));
    const onEnrolled = vi.fn();
    renderButton(onEnrolled);

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(await screen.findByText('이미 신청한 회차입니다')).toBeInTheDocument();
    expect(onEnrolled).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '신청' })).toBeEnabled();
  });

  it('로그인 링크는 현재 위치를 넘겨 로그인 뒤 상세로 돌아오게 한다', async () => {
    setUser(null);
    function LoginProbe() {
      const location = useLocation();
      return <output data-testid="from">{(location.state as { from?: { pathname: string } } | null)?.from?.pathname}</output>;
    }
    render(
      <MemoryRouter initialEntries={['/courses/1']}>
        <Routes>
          <Route path="/courses/:courseId" element={<EnrollButton sessionId={10} />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link', { name: '로그인 후 신청' }));

    expect(screen.getByTestId('from')).toHaveTextContent('/courses/1');
  });

  it('로그인 확인 중에는 로그인 링크 대신 비활성 버튼을 보여 준다', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, initializing: true, expired: false, login: vi.fn(), logout: vi.fn() });
    renderButton();

    expect(screen.queryByRole('link', { name: '로그인 후 신청' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청' })).toBeDisabled();
  });

  it('신청 중에는 버튼이 비활성이다', () => {
    vi.mocked(useEnroll).mockReturnValue({ enroll, pending: true });
    renderButton();

    expect(screen.getByRole('button', { name: '신청' })).toBeDisabled();
  });

  it('회차가 없으면 404 문구를 보여 준다', async () => {
    enroll.mockRejectedValue(new EnrollError('notFound'));
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(await screen.findByText('회차를 찾을 수 없습니다')).toBeInTheDocument();
  });

  it('그 밖의 실패는 일반 오류 문구를 보여 준다', async () => {
    enroll.mockRejectedValue(new EnrollError('error'));
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '신청' }));

    expect(await screen.findByText('신청 중 오류가 발생했습니다')).toBeInTheDocument();
  });
});
