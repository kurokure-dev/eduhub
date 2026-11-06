import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseApi } from '../api/courseApi';
import { useCategories } from './useCategories';

vi.mock('../api/courseApi', () => ({
  courseApi: { getCategories: vi.fn() },
}));

const getCategories = vi.mocked(courseApi.getCategories);

describe('useCategories', () => {
  beforeEach(() => {
    getCategories.mockReset();
  });

  it('분류 목록을 불러온다', async () => {
    getCategories.mockResolvedValue({ data: ['개발', '리더십'] } as Awaited<
      ReturnType<typeof courseApi.getCategories>
    >);

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['개발', '리더십']);
  });

  it('실패하면 error를 채운다', async () => {
    getCategories.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network Error');
    expect(result.current.data).toEqual([]);
  });
});
