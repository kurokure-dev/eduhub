import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useCategories } from './hooks/useCategories';
import { useCourseDetail } from './hooks/useCourseDetail';
import { useCourses } from './hooks/useCourses';

vi.mock('./hooks/useCourses');
vi.mock('./hooks/useCategories');
vi.mock('./hooks/useCourseDetail');

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App 라우팅 (D-24)', () => {
  beforeEach(() => {
    vi.mocked(useCategories).mockReturnValue({ data: [], loading: false, error: undefined });
    vi.mocked(useCourses).mockReturnValue({
      data: { content: [{ id: 1, title: 'Spring 입문', category: '개발' }], page: 0, size: 10, totalElements: 1 },
      loading: false,
      error: undefined,
    });
    vi.mocked(useCourseDetail).mockReturnValue({
      data: { id: 1, title: 'Spring 입문 상세', sessions: [] },
      loading: false,
      notFound: false,
      error: undefined,
    });
  });

  it('/ 는 과정 목록으로 보낸다', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });

  it('없는 경로도 과정 목록으로 보낸다', () => {
    renderApp('/nowhere');

    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });

  it('목록에서 제목을 누르면 상세로 가고, 목록 링크로 돌아온다', async () => {
    renderApp('/courses');

    await userEvent.click(screen.getByRole('link', { name: 'Spring 입문' }));
    expect(screen.getByRole('heading', { name: 'Spring 입문 상세' })).toBeInTheDocument();
    expect(useCourseDetail).toHaveBeenLastCalledWith('1');

    await userEvent.click(screen.getByRole('link', { name: /과정 목록/ }));
    expect(screen.getByRole('heading', { name: '교육과정' })).toBeInTheDocument();
  });
});
