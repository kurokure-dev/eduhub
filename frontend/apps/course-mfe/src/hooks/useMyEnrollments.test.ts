import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentApi } from '../api/enrollmentApi';
import { useMyEnrollments } from './useMyEnrollments';

vi.mock('../api/enrollmentApi', () => ({
  enrollmentApi: { findMine: vi.fn() },
}));

const findMine = vi.mocked(enrollmentApi.findMine);
type Result = Awaited<ReturnType<typeof enrollmentApi.findMine>>;

describe('useMyEnrollments', () => {
  beforeEach(() => {
    findMine.mockReset();
  });

  it('상태 없이 전체를 조회한다', async () => {
    findMine.mockResolvedValue({ data: [{ id: 1, status: 'CONFIRMED' }] } as unknown as Result);

    const { result } = renderHook(() => useMyEnrollments());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1, status: 'CONFIRMED' }]);
    expect(findMine).toHaveBeenCalledWith({ status: undefined });
  });

  it('status가 바뀌면 그 값으로 다시 조회한다', async () => {
    findMine.mockResolvedValue({ data: [] } as unknown as Result);
    const { result, rerender } = renderHook(({ s }) => useMyEnrollments(s), {
      initialProps: { s: undefined as 'WAITING' | undefined },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ s: 'WAITING' });

    await waitFor(() => expect(findMine).toHaveBeenLastCalledWith({ status: 'WAITING' }));
  });

  it('reload는 다시 조회한다', async () => {
    findMine.mockResolvedValue({ data: [] } as unknown as Result);
    const { result } = renderHook(() => useMyEnrollments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());

    await waitFor(() => expect(findMine).toHaveBeenCalledTimes(2));
  });

  it('오류는 error에 담는다', async () => {
    findMine.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useMyEnrollments());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeUndefined();
  });

  it('status를 연달아 바꾸면 이전 응답은 무시하고 이전 필터의 목록을 지운다', async () => {
    findMine.mockResolvedValueOnce({ data: [{ id: 1, status: 'CONFIRMED' }] } as unknown as Result);
    const { result, rerender } = renderHook(({ s }) => useMyEnrollments(s), {
      initialProps: { s: undefined as 'CONFIRMED' | 'WAITING' | 'CANCELLED' | undefined },
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const resolvers: Array<(v: Result) => void> = [];
    findMine.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof enrollmentApi.findMine>,
    );
    rerender({ s: 'WAITING' });
    await waitFor(() => expect(result.current.data).toBeUndefined());
    rerender({ s: 'CANCELLED' });

    await act(async () => {
      resolvers[1]({ data: [{ id: 3, status: 'CANCELLED' }] } as unknown as Result);
    });
    await act(async () => {
      resolvers[0]({ data: [{ id: 2, status: 'WAITING' }] } as unknown as Result);
    });

    expect(result.current.data).toEqual([{ id: 3, status: 'CANCELLED' }]);
  });

  it('reload 중에는 기존 목록을 유지한다', async () => {
    findMine.mockResolvedValueOnce({ data: [{ id: 1, status: 'CONFIRMED' }] } as unknown as Result);
    const { result } = renderHook(() => useMyEnrollments());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    findMine.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof enrollmentApi.findMine>);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
