import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentApi } from '../api/enrollmentApi';
import { useEnroll } from './useEnroll';

vi.mock('../api/enrollmentApi', () => ({
  enrollmentApi: { enroll: vi.fn() },
}));

const enrollMock = vi.mocked(enrollmentApi.enroll);
type Result = Awaited<ReturnType<typeof enrollmentApi.enroll>>;

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { response: { status } });
}

describe('useEnroll', () => {
  beforeEach(() => {
    enrollMock.mockReset();
  });

  it('성공하면 상태와 대기 순번을 돌려준다 (D-53)', async () => {
    enrollMock.mockResolvedValue({ data: { id: 1, status: 'WAITING', waitingRank: 3 } } as Result);
    const { result } = renderHook(() => useEnroll());

    let value;
    await act(async () => {
      value = await result.current.enroll(10);
    });

    expect(value).toEqual({ status: 'WAITING', waitingRank: 3 });
    expect(enrollMock).toHaveBeenCalledWith({ sessionId: 10 });
    expect(result.current.pending).toBe(false);
  });

  it.each([
    [409, 'conflict'],
    [404, 'notFound'],
    [500, 'error'],
  ])('HTTP %i 오류는 kind %s로 던진다', async (status, kind) => {
    enrollMock.mockRejectedValue(httpError(status));
    const { result } = renderHook(() => useEnroll());

    await act(async () => {
      await expect(result.current.enroll(10)).rejects.toMatchObject({ kind });
    });
    expect(result.current.pending).toBe(false);
  });

  it('진행 중에는 pending이 true다', async () => {
    let resolve!: (v: Result) => void;
    enrollMock.mockReturnValue(
      new Promise<Result>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useEnroll());

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.enroll(10);
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolve({ data: { status: 'CONFIRMED' } } as Result);
      await promise;
    });
    expect(result.current.pending).toBe(false);
  });

  it('호출이 겹치면 모두 끝난 뒤에야 pending이 false가 된다', async () => {
    const resolvers: Array<(v: Result) => void> = [];
    enrollMock.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof enrollmentApi.enroll>,
    );
    const { result } = renderHook(() => useEnroll());

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.enroll(10);
      p2 = result.current.enroll(11);
    });
    await act(async () => {
      resolvers[0]({ data: { status: 'CONFIRMED' } } as Result);
      await p1;
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolvers[1]({ data: { status: 'CONFIRMED' } } as Result);
      await p2;
    });
    expect(result.current.pending).toBe(false);
  });
});
