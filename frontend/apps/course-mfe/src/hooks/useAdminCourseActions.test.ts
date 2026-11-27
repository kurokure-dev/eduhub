import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCourseApi } from '../api/adminCourseApi';
import { useAdminCourseActions } from './useAdminCourseActions';

vi.mock('../api/adminCourseApi', () => ({
  adminCourseApi: {
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    closeCourse: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    closeSession: vi.fn(),
  },
}));

const api = vi.mocked(adminCourseApi);
type Result = Awaited<ReturnType<typeof adminCourseApi.createCourse>>;

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`status ${status}`), { response: { status, data } });
}

const courseRequest = { title: 't', category: 'c', description: 'd' } as never;
const sessionRequest = { startDate: '2026-12-01', place: 'p', capacity: 5 } as never;

describe('useAdminCourseActions', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => m.mockReset());
  });

  it('성공하면 응답 data를 돌려주고 올바른 인자로 부른다', async () => {
    api.createCourse.mockResolvedValue({ data: { id: 1 } } as Result);
    api.updateCourse.mockResolvedValue({ data: { id: 2 } } as Result);
    api.closeCourse.mockResolvedValue({ data: { id: 3 } } as Result);
    api.createSession.mockResolvedValue({ data: { id: 4 } } as never);
    const { result } = renderHook(() => useAdminCourseActions());

    await act(async () => {
      expect(await result.current.createCourse(courseRequest)).toEqual({ id: 1 });
      expect(await result.current.updateCourse(2, courseRequest)).toEqual({ id: 2 });
      expect(await result.current.closeCourse(3)).toEqual({ id: 3 });
      expect(await result.current.createSession(4, sessionRequest)).toEqual({ id: 4 });
    });

    expect(api.createCourse).toHaveBeenCalledWith({ courseRequest });
    expect(api.updateCourse).toHaveBeenCalledWith({ id: 2, courseRequest });
    expect(api.closeCourse).toHaveBeenCalledWith({ id: 3 });
    expect(api.createSession).toHaveBeenCalledWith({ id: 4, sessionRequest });
    expect(result.current.pending).toBe(false);
  });

  it('회차 수정·마감은 성공하면 data를 돌려주고 올바른 인자로 부른다 (D-56)', async () => {
    api.updateSession.mockResolvedValue({ data: { id: 5 } } as never);
    api.closeSession.mockResolvedValue({ data: { id: 6 } } as never);
    const { result } = renderHook(() => useAdminCourseActions());

    await act(async () => {
      expect(await result.current.updateSession(1, 5, sessionRequest)).toEqual({ id: 5 });
      expect(await result.current.closeSession(1, 6)).toEqual({ id: 6 });
    });

    expect(api.updateSession).toHaveBeenCalledWith({ id: 1, sessionId: 5, sessionRequest });
    expect(api.closeSession).toHaveBeenCalledWith({ id: 1, sessionId: 6 });
    expect(result.current.pending).toBe(false);
  });

  it('회차 수정·마감의 409 오류는 kind와 detail을 담아 거부한다 (D-56)', async () => {
    api.updateSession.mockRejectedValue(httpError(409, { detail: '정원이 확정 인원보다 작습니다' }));
    api.closeSession.mockRejectedValue(httpError(409, { detail: '이미 마감된 회차입니다' }));
    const { result } = renderHook(() => useAdminCourseActions());

    await act(async () => {
      await expect(result.current.updateSession(1, 5, sessionRequest)).rejects.toMatchObject({
        kind: 'conflict',
        detail: '정원이 확정 인원보다 작습니다',
      });
      await expect(result.current.closeSession(1, 6)).rejects.toMatchObject({
        kind: 'conflict',
        detail: '이미 마감된 회차입니다',
      });
    });
    expect(result.current.pending).toBe(false);
  });

  it('409 오류는 kind와 서버 detail을 담아 거부한다', async () => {
    api.closeCourse.mockRejectedValue(httpError(409, { detail: '이미 종료된 과정입니다' }));
    const { result } = renderHook(() => useAdminCourseActions());

    await act(async () => {
      await expect(result.current.closeCourse(3)).rejects.toMatchObject({
        kind: 'conflict',
        detail: '이미 종료된 과정입니다',
      });
    });
    expect(result.current.pending).toBe(false);
  });

  it.each([
    [403, 'forbidden'],
    [404, 'notFound'],
    [500, 'error'],
  ])('HTTP %i는 kind %s, detail 없음', async (status, kind) => {
    api.createCourse.mockRejectedValue(httpError(status));
    const { result } = renderHook(() => useAdminCourseActions());

    await act(async () => {
      await expect(result.current.createCourse(courseRequest)).rejects.toMatchObject({
        kind,
        detail: undefined,
      });
    });
  });

  it('호출이 겹치면 모두 끝난 뒤에야 pending이 false가 된다', async () => {
    const resolvers: Array<(v: Result) => void> = [];
    api.createCourse.mockImplementation(
      () =>
        new Promise<Result>((r) => {
          resolvers.push(r);
        }) as ReturnType<typeof adminCourseApi.createCourse>,
    );
    const { result } = renderHook(() => useAdminCourseActions());

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.createCourse(courseRequest);
      p2 = result.current.createCourse(courseRequest);
    });
    expect(result.current.pending).toBe(true);
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
