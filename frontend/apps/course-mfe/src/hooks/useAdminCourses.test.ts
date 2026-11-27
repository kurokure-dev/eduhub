import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCourseApi } from '../api/adminCourseApi';
import { useAdminCourses } from './useAdminCourses';

vi.mock('../api/adminCourseApi', () => ({
  adminCourseApi: { searchAdminCourses: vi.fn() },
}));

const api = vi.mocked(adminCourseApi);
type Result = Awaited<ReturnType<typeof adminCourseApi.searchAdminCourses>>;

function page(title: string): Result {
  return {
    data: { content: [{ id: 1, title, category: 'c', status: 'OPEN' }], page: 0, size: 10, totalElements: 1 },
  } as unknown as Result;
}

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { response: { status } });
}

describe('useAdminCourses', () => {
  beforeEach(() => {
    api.searchAdminCourses.mockReset();
  });

  it('조건을 API 인자로 전달한다 (D-34)', async () => {
    api.searchAdminCourses.mockResolvedValue(page('a'));
    const { result } = renderHook(() =>
      useAdminCourses({ status: 'CLOSED', keyword: 'java', page: 2, size: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.searchAdminCourses).toHaveBeenCalledWith({ status: 'CLOSED', keyword: 'java', page: 2, size: 5 });
    expect(result.current.data?.content?.[0].title).toBe('a');
  });

  it('빈 status·keyword는 조건 없이 보낸다', async () => {
    api.searchAdminCourses.mockResolvedValue(page('a'));
    const { result } = renderHook(() => useAdminCourses({ status: '', keyword: '', page: 0, size: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.searchAdminCourses).toHaveBeenCalledWith({
      status: undefined,
      keyword: undefined,
      page: 0,
      size: 10,
    });
  });

  it('403은 forbidden, 그 밖은 error로 분류한다', async () => {
    api.searchAdminCourses.mockRejectedValueOnce(httpError(403));
    const first = renderHook(() => useAdminCourses({ page: 0, size: 10 }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.error).toEqual({ kind: 'forbidden' });

    api.searchAdminCourses.mockRejectedValueOnce(httpError(500));
    const second = renderHook(() => useAdminCourses({ page: 0, size: 10 }));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.error).toEqual({ kind: 'error' });
  });

  it('조건이 바뀐 뒤 도착한 이전 응답은 무시한다', async () => {
    const resolvers: Array<(v: Result) => void> = [];
    api.searchAdminCourses.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof adminCourseApi.searchAdminCourses>,
    );
    const { result, rerender } = renderHook((p: { keyword: string }) =>
      useAdminCourses({ keyword: p.keyword, page: 0, size: 10 }),
    { initialProps: { keyword: 'old' } });
    rerender({ keyword: 'new' });

    await act(async () => {
      resolvers[1](page('new'));
    });
    await act(async () => {
      resolvers[0](page('old'));
    });

    expect(result.current.data?.content?.[0].title).toBe('new');
    expect(result.current.loading).toBe(false);
  });

  it('reload는 기존 data를 유지하고 이전 error를 지운다', async () => {
    api.searchAdminCourses.mockResolvedValueOnce(page('a'));
    const { result } = renderHook(() => useAdminCourses({ page: 0, size: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    api.searchAdminCourses.mockRejectedValueOnce(httpError(500));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'error' }));
    expect(result.current.data?.content?.[0].title).toBe('a');

    let resolve!: (v: Result) => void;
    api.searchAdminCourses.mockImplementationOnce(
      () =>
        new Promise<Result>((r) => {
          resolve = r;
        }) as ReturnType<typeof adminCourseApi.searchAdminCourses>,
    );
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.error).toBeUndefined();
    expect(result.current.data?.content?.[0].title).toBe('a');

    await act(async () => {
      resolve(page('b'));
    });
    expect(result.current.data?.content?.[0].title).toBe('b');
    expect(api.searchAdminCourses).toHaveBeenCalledTimes(3);
  });
});
