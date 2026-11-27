import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminEnrollmentApi } from '../api/adminEnrollmentApi';
import { useCompleteEnrollments } from './useCompleteEnrollments';

vi.mock('../api/adminEnrollmentApi', () => ({
  adminEnrollmentApi: { complete: vi.fn(), getRoster: vi.fn() },
}));

const complete = vi.mocked(adminEnrollmentApi.complete);
type Result = Awaited<ReturnType<typeof adminEnrollmentApi.complete>>;

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`status ${status}`), { response: { status, data } });
}

describe('useCompleteEnrollments', () => {
  beforeEach(() => {
    complete.mockReset();
  });

  it('성공하면 처리·실패 목록을 돌려준다', async () => {
    const body = { completed: ['E1'], failed: [{ employeeId: 'E2', reason: 'WAITING' }] };
    complete.mockResolvedValue({ data: body } as Result);
    const { result } = renderHook(() => useCompleteEnrollments());

    let value;
    await act(async () => {
      value = await result.current.complete(10, ['E1', 'E2']);
    });

    expect(value).toEqual(body);
    expect(complete).toHaveBeenCalledWith({ sessionId: 10, completionRequest: { employeeIds: ['E1', 'E2'] } });
    expect(result.current.pending).toBe(false);
  });

  it('409는 conflict와 서버 detail로 거부한다', async () => {
    complete.mockRejectedValue(httpError(409, { detail: '아직 마감 전입니다' }));
    const { result } = renderHook(() => useCompleteEnrollments());

    await act(async () => {
      await expect(result.current.complete(10, ['E1'])).rejects.toMatchObject({
        kind: 'conflict',
        detail: '아직 마감 전입니다',
      });
    });
  });

  it.each([
    [403, 'forbidden'],
    [404, 'notFound'],
    [500, 'error'],
  ])('HTTP %i는 kind %s', async (status, kind) => {
    complete.mockRejectedValue(httpError(status));
    const { result } = renderHook(() => useCompleteEnrollments());

    await act(async () => {
      await expect(result.current.complete(10, ['E1'])).rejects.toMatchObject({ kind });
    });
    expect(result.current.pending).toBe(false);
  });

  it('호출이 겹치면 모두 끝난 뒤에야 pending이 false가 된다', async () => {
    const resolvers: Array<(v: Result) => void> = [];
    complete.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof adminEnrollmentApi.complete>,
    );
    const { result } = renderHook(() => useCompleteEnrollments());

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.complete(10, ['E1']);
      p2 = result.current.complete(10, ['E2']);
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolvers[0]({ data: { completed: [], failed: [] } } as unknown as Result);
      await p1;
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      resolvers[1]({ data: { completed: [], failed: [] } } as unknown as Result);
      await p2;
    });
    expect(result.current.pending).toBe(false);
  });
});
