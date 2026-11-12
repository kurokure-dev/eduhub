import type { PageResponseAdminCourseSummaryResponse } from '@eduhub/api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCourseApi } from '../api/adminCourseApi';
import { useAdminCourses } from './useAdminCourses';

vi.mock('../api/adminCourseApi', () => ({
  adminCourseApi: { searchAdminCourses: vi.fn() },
}));

const search = vi.mocked(adminCourseApi.searchAdminCourses);

const page: PageResponseAdminCourseSummaryResponse = {
  content: [{ id: 1, title: 'Spring 입문', category: '개발', status: 'CLOSED' }],
  page: 0,
  size: 10,
  totalElements: 1,
};

describe('useAdminCourses', () => {
  beforeEach(() => {
    search.mockReset();
    search.mockResolvedValue({ data: page } as Awaited<ReturnType<typeof search>>);
  });

  it('상태가 비어 있으면 status 없이(전체) 조회한다', async () => {
    const { result } = renderHook(() =>
      useAdminCourses({ status: '', keyword: '', page: 0, size: 10 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(page);
    expect(search).toHaveBeenCalledWith({
      status: undefined,
      keyword: undefined,
      page: 0,
      size: 10,
    });
  });

  it('상태와 검색어를 그대로 넘긴다', async () => {
    const { result } = renderHook(() =>
      useAdminCourses({ status: 'CLOSED', keyword: '입문', page: 1, size: 20 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(search).toHaveBeenCalledWith({ status: 'CLOSED', keyword: '입문', page: 1, size: 20 });
  });

  it('reload하면 다시 조회한다', async () => {
    const { result } = renderHook(() => useAdminCourses({ page: 0, size: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());

    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  });

  it('실패하면 error를 채운다', async () => {
    search.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useAdminCourses({ page: 0, size: 10 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network Error');
  });
});
