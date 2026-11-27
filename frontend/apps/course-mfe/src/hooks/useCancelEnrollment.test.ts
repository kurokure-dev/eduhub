import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentApi } from '../api/enrollmentApi';
import { useCancelEnrollment } from './useCancelEnrollment';

vi.mock('../api/enrollmentApi', () => ({
  enrollmentApi: { cancel: vi.fn() },
}));

const cancelMock = vi.mocked(enrollmentApi.cancel);
type Result = Awaited<ReturnType<typeof enrollmentApi.cancel>>;

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { response: { status } });
}

describe('useCancelEnrollment', () => {
  beforeEach(() => {
    cancelMock.mockReset();
  });

  it('취소 요청에 신청 id를 넘긴다', async () => {
    cancelMock.mockResolvedValue({ data: {} } as Result);
    const { result } = renderHook(() => useCancelEnrollment());

    await act(async () => {
      await result.current.cancel(7);
    });

    expect(cancelMock).toHaveBeenCalledWith({ enrollmentId: 7 });
    expect(result.current.pending).toBe(false);
  });

  it.each([
    [409, 'conflict'],
    [404, 'notFound'],
    [500, 'error'],
  ])('HTTP %i 오류는 kind %s로 던진다', async (status, kind) => {
    cancelMock.mockRejectedValue(httpError(status));
    const { result } = renderHook(() => useCancelEnrollment());

    await act(async () => {
      await expect(result.current.cancel(7)).rejects.toMatchObject({ kind });
    });
    expect(result.current.pending).toBe(false);
  });

  it('호출이 겹치면 모두 끝난 뒤에야 pending이 false가 된다', async () => {
    const resolvers: Array<(v: Result) => void> = [];
    cancelMock.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof enrollmentApi.cancel>,
    );
    const { result } = renderHook(() => useCancelEnrollment());

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.cancel(1);
      p2 = result.current.cancel(2);
    });
    await act(async () => {
      resolvers[0]({ data: {} } as Result);
      await p1;
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolvers[1]({ data: {} } as Result);
      await p2;
    });
    expect(result.current.pending).toBe(false);
  });
});
