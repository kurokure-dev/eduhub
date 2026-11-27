import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminEnrollmentApi } from '../api/adminEnrollmentApi';
import { useRoster } from './useRoster';

vi.mock('../api/adminEnrollmentApi', () => ({
  adminEnrollmentApi: { getRoster: vi.fn(), complete: vi.fn() },
}));

const getRoster = vi.mocked(adminEnrollmentApi.getRoster);
type Result = Awaited<ReturnType<typeof adminEnrollmentApi.getRoster>>;

const roster = (title: string) => ({ data: { courseTitle: title, confirmed: [], waiting: [] } }) as unknown as Result;

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { response: { status } });
}

describe('useRoster', () => {
  beforeEach(() => {
    getRoster.mockReset();
  });

  it('명단을 조회한다', async () => {
    getRoster.mockResolvedValue(roster('A'));
    const { result } = renderHook(() => useRoster('7'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.courseTitle).toBe('A');
    expect(result.current.notFound).toBe(false);
    expect(getRoster).toHaveBeenCalledWith({ sessionId: 7 });
  });

  it.each([[undefined], ['abc'], ['0'], ['-1'], ['1.5'], ['']])(
    '잘못된 id(%s)는 API 호출 없이 notFound',
    async (id) => {
      const { result } = renderHook(() => useRoster(id));

      expect(result.current.notFound).toBe(true);
      expect(result.current.error).toEqual({ kind: 'notFound' });
      expect(result.current.loading).toBe(false);
      expect(getRoster).not.toHaveBeenCalled();
    },
  );

  it.each([
    [403, 'forbidden', false],
    [404, 'notFound', true],
    [500, 'error', false],
  ])('HTTP %i는 error.kind %s', async (status, kind, notFound) => {
    getRoster.mockRejectedValue(httpError(status));
    const { result } = renderHook(() => useRoster('7'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.kind).toBe(kind);
    expect(result.current.notFound).toBe(notFound);
    expect(result.current.data).toBeUndefined();
  });

  it('reload는 기존 데이터를 유지한 채 다시 읽는다', async () => {
    getRoster.mockResolvedValueOnce(roster('A'));
    const { result } = renderHook(() => useRoster('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolve!: (v: Result) => void;
    getRoster.mockReturnValueOnce(
      new Promise<Result>((r) => {
        resolve = r;
      }) as ReturnType<typeof adminEnrollmentApi.getRoster>,
    );
    act(() => result.current.reload());

    expect(result.current.data?.courseTitle).toBe('A');
    await act(async () => {
      resolve(roster('B'));
    });
    await waitFor(() => expect(result.current.data?.courseTitle).toBe('B'));
  });

  it('id가 바뀐 뒤 도착한 늦은 응답은 무시한다', async () => {
    let resolveOld!: (v: Result) => void;
    getRoster.mockReturnValueOnce(
      new Promise<Result>((r) => {
        resolveOld = r;
      }) as ReturnType<typeof adminEnrollmentApi.getRoster>,
    );
    getRoster.mockResolvedValueOnce(roster('NEW'));
    const { result, rerender } = renderHook(({ id }) => useRoster(id), { initialProps: { id: '1' } });

    rerender({ id: '2' });
    await waitFor(() => expect(result.current.data?.courseTitle).toBe('NEW'));
    await act(async () => {
      resolveOld(roster('OLD'));
    });

    expect(result.current.data?.courseTitle).toBe('NEW');
    expect(result.current.loading).toBe(false);
  });

  it('id가 바뀐 첫 렌더에 이전 회차의 data를 노출하지 않는다', async () => {
    getRoster.mockResolvedValueOnce(roster('OLD'));
    getRoster.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof adminEnrollmentApi.getRoster>);
    const seen: Array<{ id: string; title?: string; loading: boolean }> = [];
    const { result, rerender } = renderHook(
      ({ id }) => {
        const r = useRoster(id);
        seen.push({ id, title: r.data?.courseTitle, loading: r.loading });
        return r;
      },
      { initialProps: { id: '1' } },
    );
    await waitFor(() => expect(result.current.data?.courseTitle).toBe('OLD'));

    rerender({ id: '2' });

    const forNew = seen.filter((s) => s.id === '2');
    expect(forNew.length).toBeGreaterThan(0);
    expect(forNew.every((s) => s.title === undefined && s.loading)).toBe(true);
  });

  it('id가 바뀐 첫 렌더에 이전 회차의 error를 노출하지 않는다', async () => {
    getRoster.mockRejectedValueOnce(httpError(403));
    getRoster.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof adminEnrollmentApi.getRoster>);
    const seen: Array<{ id: string; kind?: string }> = [];
    const { result, rerender } = renderHook(
      ({ id }) => {
        const r = useRoster(id);
        seen.push({ id, kind: r.error?.kind });
        return r;
      },
      { initialProps: { id: '1' } },
    );
    await waitFor(() => expect(result.current.error?.kind).toBe('forbidden'));

    rerender({ id: '2' });

    const forNew = seen.filter((s) => s.id === '2');
    expect(forNew.length).toBeGreaterThan(0);
    expect(forNew.every((s) => s.kind === undefined)).toBe(true);
  });

  it('reload 시작 시 이전 error를 지운다', async () => {
    getRoster.mockRejectedValueOnce(httpError(500));
    const { result } = renderHook(() => useRoster('7'));
    await waitFor(() => expect(result.current.error?.kind).toBe('error'));

    getRoster.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof adminEnrollmentApi.getRoster>);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.error).toBeUndefined());
    expect(result.current.loading).toBe(true);
  });

  it('언마운트 뒤 도착한 응답은 무시한다', async () => {
    let resolve!: (v: Result) => void;
    getRoster.mockReturnValueOnce(
      new Promise<Result>((r) => {
        resolve = r;
      }) as ReturnType<typeof adminEnrollmentApi.getRoster>,
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useRoster('7'));
    unmount();

    await act(async () => {
      resolve(roster('LATE'));
    });

    expect(result.current.data).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
