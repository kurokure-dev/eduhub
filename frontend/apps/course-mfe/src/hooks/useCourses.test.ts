import type { PageResponseCourseSummaryResponse } from '@eduhub/api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseApi } from '../api/courseApi';
import { useCourses } from './useCourses';

vi.mock('../api/courseApi', () => ({
  courseApi: { search: vi.fn() },
}));

const search = vi.mocked(courseApi.search);

const page: PageResponseCourseSummaryResponse = {
  content: [{ id: 1, title: 'Spring 입문', category: '개발' }],
  page: 2,
  size: 10,
  totalElements: 21,
};

describe('useCourses', () => {
  beforeEach(() => {
    search.mockReset();
  });

  it('목록을 불러오고, 받은 page를 그대로 API에 넘긴다', async () => {
    search.mockResolvedValue({ data: page } as Awaited<ReturnType<typeof courseApi.search>>);

    const { result } = renderHook(() =>
      useCourses({ keyword: '입문', category: '', page: 2, size: 10 }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(page);
    expect(result.current.error).toBeUndefined();
    expect(search).toHaveBeenCalledWith({ keyword: '입문', category: undefined, page: 2, size: 10 });
  });

  it('실패하면 error를 채운다', async () => {
    search.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useCourses({ page: 0, size: 10 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network Error');
    expect(result.current.data).toBeUndefined();
  });
});
