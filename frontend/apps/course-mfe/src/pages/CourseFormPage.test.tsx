import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { AdminActionError, useAdminCourseActions } from '../hooks/useAdminCourseActions';
import { useCourseDetail } from '../hooks/useCourseDetail';
import CourseFormPage from './CourseFormPage';

vi.mock('../auth/AuthContext');
vi.mock('../hooks/useCourseDetail');
vi.mock('../hooks/useAdminCourseActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useAdminCourseActions')>()),
  useAdminCourseActions: vi.fn(),
}));

const actions = {
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  closeCourse: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  closeSession: vi.fn(),
  pending: false,
};
const refresh = vi.fn();

const detail = {
  id: 3,
  title: 'Spring 입문',
  category: '개발',
  description: '설명',
  closed: false,
  sessions: [{ id: 9, startDate: '2026-03-01', place: '본관', capacity: 10, remainingSeats: 4, closed: false }],
};

function mockDetail(data: Partial<typeof detail> = {}) {
  vi.mocked(useCourseDetail).mockReturnValue({
    data: { ...detail, ...data },
    loading: false,
    notFound: false,
    error: undefined,
    refresh,
  });
}

function GoNew() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/admin/courses/new')}>등록 화면으로</button>;
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function GoOther() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/admin/courses/4/edit')}>다른 과정으로</button>;
}

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/courses/new" element={<CourseFormPage />} />
        <Route path="/admin/courses/:courseId/edit" element={<CourseFormPage />} />
      </Routes>
      <Where />
      <GoNew />
      <GoOther />
    </MemoryRouter>
  );
}

function renderAt(path: string) {
  return render(tree(path));
}

describe('CourseFormPage', () => {
  beforeEach(() => {
    actions.createCourse.mockReset();
    actions.updateCourse.mockReset();
    actions.closeCourse.mockReset();
    actions.createSession.mockReset();
    actions.updateSession.mockReset();
    actions.closeSession.mockReset();
    refresh.mockReset();
    refresh.mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, employeeNo: 'A', name: '관리자', role: 'ADMIN' },
      initializing: false,
      expired: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(useAdminCourseActions).mockReturnValue(actions);
    mockDetail();
  });

  it('등록하면 수정 화면으로 이동한다', async () => {
    actions.createCourse.mockResolvedValue({ id: 3 });
    renderAt('/admin/courses/new');

    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '새 과정' } });
    fireEvent.change(screen.getByLabelText(/분류/), { target: { value: '개발' } });
    await user.click(screen.getByRole('button', { name: '등록' }));

    expect(actions.createCourse).toHaveBeenCalledWith({ title: '새 과정', category: '개발' });
    expect(await screen.findByText('/admin/courses/3/edit')).toBeInTheDocument();
  });

  it('수정 화면은 값을 채우고 저장하면 안내를 보여 준다', async () => {
    actions.updateCourse.mockResolvedValue({});
    renderAt('/admin/courses/3/edit');

    const user = userEvent.setup();
    expect(screen.getByLabelText(/제목/)).toHaveValue('Spring 입문');
    expect(screen.getByRole('link', { name: '과정 상세로' })).toHaveAttribute('href', '/courses/3');
    expect(screen.getByRole('link', { name: '명단' })).toHaveAttribute('href', '/admin/sessions/9/roster');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(actions.updateCourse).toHaveBeenCalledWith(3, { title: 'Spring 입문', category: '개발', description: '설명' });
    expect(await screen.findByText('저장되었습니다')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('종료된 과정이면 입력과 버튼이 비활성이다', () => {
    mockDetail({ closed: true });
    renderAt('/admin/courses/3/edit');

    expect(screen.getByText('종료된 과정입니다')).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toBeDisabled();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '과정 종료' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '회차 추가' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: '과정 상세로' })).not.toBeInTheDocument();
  });

  it('등록 뒤 수정 화면으로 이동하면 서버 값으로 폼이 채워진다', async () => {
    actions.createCourse.mockResolvedValue({ id: 3 });
    // 등록 모드(id 없음)에서는 조회하지 않고, 수정 모드에서 서버 값을 돌려준다
    vi.mocked(useCourseDetail).mockImplementation((id) =>
      id === undefined
        ? { data: undefined, loading: true, notFound: false, error: undefined, refresh }
        : { data: { ...detail, title: '서버 제목', category: '서버 분류' }, loading: false, notFound: false, error: undefined, refresh },
    );
    renderAt('/admin/courses/new');

    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '입력한 제목' } });
    fireEvent.change(screen.getByLabelText(/분류/), { target: { value: '입력한 분류' } });
    await userEvent.click(screen.getByRole('button', { name: '등록' }));

    expect(await screen.findByText('/admin/courses/3/edit')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByLabelText(/제목/)).toHaveValue('서버 제목'));
    expect(screen.getByLabelText(/분류/)).toHaveValue('서버 분류');
  });

  it('저장 뒤 다시 읽기가 실패하면(data 유지) 갱신 실패 안내와 다시 시도를 보여 준다', async () => {
    actions.updateCourse.mockResolvedValue({});
    refresh.mockResolvedValue(false);
    renderAt('/admin/courses/3/edit');

    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장했지만 화면을 갱신하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toHaveValue('Spring 입문');
    refresh.mockResolvedValue(true);
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(screen.queryByText('저장했지만 화면을 갱신하지 못했습니다')).not.toBeInTheDocument());
  });

  it('회차 추가 뒤 다시 읽기가 실패하면 갱신 실패 안내를 보여 준다', async () => {
    actions.createSession.mockResolvedValue({});
    refresh.mockResolvedValue(false);
    renderAt('/admin/courses/3/edit');

    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/장소/), { target: { value: '별관' } });
    fireEvent.change(screen.getByLabelText(/정원/), { target: { value: '20' } });
    await userEvent.click(screen.getByRole('button', { name: '회차 추가' }));

    expect(await screen.findByText('회차를 추가했지만 목록을 갱신하지 못했습니다')).toBeInTheDocument();
  });

  it('과정 종료가 성공하면 refresh가 실패해도 바로 종료 상태로 잠근다', async () => {
    actions.closeCourse.mockResolvedValue({ status: 'CLOSED' });
    refresh.mockResolvedValue(false);
    renderAt('/admin/courses/3/edit');

    await userEvent.click(screen.getByRole('button', { name: '과정 종료' }));
    await userEvent.click(screen.getByRole('button', { name: '종료 확정' }));

    expect(await screen.findByText('종료된 과정입니다')).toBeInTheDocument();
    expect(screen.getByText('과정을 종료했지만 화면을 갱신하지 못했습니다')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeDisabled());
    expect(screen.getByLabelText(/제목/)).toBeDisabled();
  });

  it('수정 화면에서 등록 화면으로 가면 이전 과정의 값과 안내가 남지 않는다', async () => {
    actions.updateCourse.mockResolvedValue({});
    vi.mocked(useCourseDetail).mockImplementation((id) =>
      id === undefined
        ? { data: undefined, loading: true, notFound: false, error: undefined, refresh }
        : { data: detail, loading: false, notFound: false, error: undefined, refresh },
    );
    renderAt('/admin/courses/3/edit');

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장되었습니다')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '등록 화면으로' }));

    expect(await screen.findByRole('heading', { name: '과정 등록' })).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toHaveValue('');
    expect(screen.getByLabelText(/설명/)).toHaveValue('');
    expect(screen.queryByText('저장되었습니다')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
  });

  it('오류 화면에서 다시 시도가 또 실패하면 실패 안내를 보여 준다', async () => {
    refresh.mockResolvedValue(false);
    vi.mocked(useCourseDetail).mockReturnValue({
      data: undefined,
      loading: false,
      notFound: false,
      error: new Error('network'),
      refresh,
    });
    renderAt('/admin/courses/3/edit');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  });

  it('서버 409 detail을 그대로 보여 준다', async () => {
    actions.updateCourse.mockRejectedValue(new AdminActionError('conflict', '이미 종료된 과정입니다'));
    renderAt('/admin/courses/3/edit');

    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 종료된 과정입니다')).toBeInTheDocument();
  });

  it('회차를 추가하면 폼을 비우고 refresh한다', async () => {
    actions.createSession.mockResolvedValue({});
    renderAt('/admin/courses/3/edit');

    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: '회차 추가' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/장소/), { target: { value: '별관' } });
    fireEvent.change(screen.getByLabelText(/정원/), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: '회차 추가' })).toBeDisabled();
    
    fireEvent.change(screen.getByLabelText(/정원/), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: '회차 추가' }));

    expect(actions.createSession).toHaveBeenCalledWith(3, { startDate: '2026-05-01', place: '별관', capacity: 20 });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByLabelText(/장소/)).toHaveValue('');
  });

  it('과정 종료는 확인 뒤에 closeCourse를 부르고 refresh한다', async () => {
    actions.closeCourse.mockResolvedValue({});
    renderAt('/admin/courses/3/edit');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '과정 종료' }));
    expect(actions.closeCourse).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '종료 확정' }));

    expect(actions.closeCourse).toHaveBeenCalledWith(3);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  describe('회차 수정·마감 (FR-03, D-56)', () => {
    it('수정 Dialog는 현재 값으로 채우고 저장하면 updateSession 뒤 refresh한다', async () => {
      actions.updateSession.mockResolvedValue({});
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      const dialog = await screen.findByRole('dialog', { name: '회차 수정' });
      expect(within(dialog).getByLabelText(/시작일/)).toHaveValue('2026-03-01');
      expect(within(dialog).getByLabelText(/장소/)).toHaveValue('본관');
      expect(within(dialog).getByLabelText(/정원/)).toHaveValue(10);

      fireEvent.change(within(dialog).getByLabelText(/장소/), { target: { value: '별관' } });
      fireEvent.change(within(dialog).getByLabelText(/정원/), { target: { value: '0' } });
      expect(within(dialog).getByRole('button', { name: '회차 저장' })).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText(/정원/), { target: { value: '20' } });
      await userEvent.click(within(dialog).getByRole('button', { name: '회차 저장' }));

      expect(actions.updateSession).toHaveBeenCalledWith(3, 9, { startDate: '2026-03-01', place: '별관', capacity: 20 });
      await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
      await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: '회차 수정' })).not.toBeInTheDocument());
    });

    it('수정이 409로 실패하면 서버 detail을 Dialog 안에 그대로 보여 주고 열어 둔다 (D-38)', async () => {
      actions.updateSession.mockRejectedValue(new AdminActionError('conflict', '확정자가 있는 회차는 정원을 바꿀 수 없습니다'));
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      const dialog = await screen.findByRole('dialog', { name: '회차 수정' });
      await userEvent.click(within(dialog).getByRole('button', { name: '회차 저장' }));

      expect(await within(dialog).findByText('확정자가 있는 회차는 정원을 바꿀 수 없습니다')).toBeInTheDocument();
    });

    it('수정 뒤 다시 읽기가 실패하면 갱신 실패 안내와 다시 시도를 보여 준다', async () => {
      actions.updateSession.mockResolvedValue({});
      refresh.mockResolvedValue(false);
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      await userEvent.click(await screen.findByRole('button', { name: '회차 저장' }));

      expect(await screen.findByText('회차를 수정했지만 목록을 갱신하지 못했습니다')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    });

    it('수정이 conflict로 실패하면 서버 detail을 보이고 Dialog는 열어 둔 채 refresh한다', async () => {
      actions.updateSession.mockRejectedValue(new AdminActionError('conflict', '다른 관리자가 먼저 바꿨습니다'));
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      const dialog = await screen.findByRole('dialog', { name: '회차 수정' });
      await userEvent.click(within(dialog).getByRole('button', { name: '회차 저장' }));

      expect(await within(dialog).findByText('다른 관리자가 먼저 바꿨습니다')).toBeInTheDocument();
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('dialog', { name: '회차 수정' })).toBeInTheDocument();
    });

    it('요청 중에는 수정 Dialog의 버튼이 잠기고 Esc로 닫히지 않는다', async () => {
      const { rerender } = renderAt('/admin/courses/3/edit');
      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      const dialog = await screen.findByRole('dialog', { name: '회차 수정' });

      vi.mocked(useAdminCourseActions).mockReturnValue({ ...actions, pending: true });
      rerender(tree('/admin/courses/3/edit'));

      expect(within(dialog).getByRole('button', { name: '회차 저장' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.getByRole('dialog', { name: '회차 수정' })).toBeInTheDocument();
    });

    it('요청 중에는 마감 Dialog의 버튼이 잠기고 Esc로 닫히지 않는다', async () => {
      const { rerender } = renderAt('/admin/courses/3/edit');
      await userEvent.click(screen.getByRole('button', { name: '마감 2026-03-01 회차' }));
      const dialog = await screen.findByRole('dialog', { name: '회차를 마감할까요?' });

      vi.mocked(useAdminCourseActions).mockReturnValue({ ...actions, pending: true });
      rerender(tree('/admin/courses/3/edit'));

      expect(within(dialog).getByRole('button', { name: '마감 확정' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.getByRole('dialog', { name: '회차를 마감할까요?' })).toBeInTheDocument();
    });

    it('다른 과정으로 바뀌면 마감 표시와 Dialog 대상이 초기화된다', async () => {
      actions.closeSession.mockResolvedValue({});
      vi.mocked(useCourseDetail).mockImplementation((id) => ({
        data: { ...detail, id: Number(id), title: '과정 ' + id },
        loading: false,
        notFound: false,
        error: undefined,
        refresh,
      }));
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '마감 2026-03-01 회차' }));
      await userEvent.click(await screen.findByRole('button', { name: '마감 확정' }));
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: '수정 2026-03-01 회차' })).not.toBeInTheDocument());

      await userEvent.click(screen.getByText('다른 과정으로'));
      // 같은 회차 id라도 다른 과정에서는 마감 표시가 남지 않는다
      expect(await screen.findByRole('button', { name: '수정 2026-03-01 회차' })).toBeInTheDocument();
    });

    it('다른 과정으로 바뀌면 열린 수정 Dialog가 닫힌다', async () => {
      vi.mocked(useCourseDetail).mockImplementation((id) => ({
        data: { ...detail, id: Number(id), title: '과정 ' + id },
        loading: false,
        notFound: false,
        error: undefined,
        refresh,
      }));
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '수정 2026-03-01 회차' }));
      expect(await screen.findByRole('dialog', { name: '회차 수정' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('다른 과정으로'));

      await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: '회차 수정' })).not.toBeInTheDocument());
    });

    it('마감은 확인 뒤에 closeSession을 부르고 refresh가 실패해도 마감으로 표시한다', async () => {
      actions.closeSession.mockResolvedValue({});
      refresh.mockResolvedValue(false);
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '마감 2026-03-01 회차' }));
      expect(actions.closeSession).not.toHaveBeenCalled();
      await userEvent.click(await screen.findByRole('button', { name: '마감 확정' }));

      expect(actions.closeSession).toHaveBeenCalledWith(3, 9);
      expect(await screen.findByText('회차를 마감했지만 목록을 갱신하지 못했습니다')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '수정 2026-03-01 회차' })).not.toBeInTheDocument();
      expect(await screen.findByRole('cell', { name: '마감' })).toBeInTheDocument();
    });

    it('마감 실패는 서버 detail을 안내로 보여 준다', async () => {
      actions.closeSession.mockRejectedValue(new AdminActionError('conflict', '이미 마감된 회차입니다'));
      renderAt('/admin/courses/3/edit');

      await userEvent.click(screen.getByRole('button', { name: '마감 2026-03-01 회차' }));
      await userEvent.click(await screen.findByRole('button', { name: '마감 확정' }));

      expect(await screen.findByText('이미 마감된 회차입니다')).toBeInTheDocument();
    });

    it('종료된 과정과 마감된 회차에는 수정·마감 버튼이 없다', () => {
      mockDetail({ closed: true });
      const { unmount } = renderAt('/admin/courses/3/edit');
      expect(screen.queryByRole('button', { name: /^수정 .* 회차$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^마감 .* 회차$/ })).not.toBeInTheDocument();
      unmount();

      mockDetail({ sessions: [{ ...detail.sessions[0], closed: true }] });
      renderAt('/admin/courses/3/edit');
      expect(screen.queryByRole('button', { name: /^수정 .* 회차$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^마감 .* 회차$/ })).not.toBeInTheDocument();
    });
  });
});
