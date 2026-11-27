import type { CourseDetailResponse } from '@eduhub/api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCourseApi } from '../api/adminCourseApi';
import { courseApi } from '../api/courseApi';
import { useCourseDetail } from './useCourseDetail';

vi.mock('../api/courseApi', () => ({
  courseApi: { getDetail: vi.fn() },
}));
vi.mock('../api/adminCourseApi', () => ({
  adminCourseApi: { getAdminCourse: vi.fn() },
}));

const getDetail = vi.mocked(courseApi.getDetail);
const getAdminCourse = vi.mocked(adminCourseApi.getAdminCourse);
type DetailResult = Awaited<ReturnType<typeof courseApi.getDetail>>;
type AdminResult = Awaited<ReturnType<typeof adminCourseApi.getAdminCourse>>;

const detail: CourseDetailResponse = {
  id: 1,
  title: 'Spring 입문',
  category: '개발',
  description: '스프링 기초',
  sessions: [{ id: 10, startDate: '2026-12-01', place: '본사 3층', capacity: 20, remainingSeats: 20 }],
};

/** axios가 HTTP 오류 응답을 받았을 때 던지는 오류 모양 */
function httpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  });
}

describe('useCourseDetail', () => {
  beforeEach(() => {
    getDetail.mockReset();
    getAdminCourse.mockReset();
  });

  it('상세를 불러와 공통 모양으로 바꾸고, 라우트의 id를 숫자로 넘긴다', async () => {
    getDetail.mockResolvedValue({ data: detail } as DetailResult);

    const { result } = renderHook(() => useCourseDetail('1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({
      id: 1,
      title: 'Spring 입문',
      category: '개발',
      description: '스프링 기초',
      closed: false,
      sessions: [
        { id: 10, startDate: '2026-12-01', place: '본사 3층', capacity: 20, remainingSeats: 20, closed: false },
      ],
    });
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(getDetail).toHaveBeenCalledWith({ id: 1 });
    expect(getAdminCourse).not.toHaveBeenCalled();
  });

  it('404이면 error가 아니라 notFound를 채운다', async () => {
    getDetail.mockRejectedValue(httpError(404));

    const { result } = renderHook(() => useCourseDetail('99'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toBeUndefined();
  });

  it('404가 아닌 오류는 error를 채운다', async () => {
    getDetail.mockRejectedValue(httpError(500));

    const { result } = renderHook(() => useCourseDetail('1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Request failed with status code 500');
    expect(result.current.notFound).toBe(false);
  });

  it.each(['abc', '0', '-1', '1.5', '', undefined])(
    '양의 정수가 아닌 id(%s)는 API를 부르지 않고 notFound로 본다',
    (id) => {
      const { result } = renderHook(() => useCourseDetail(id));

      expect(result.current.loading).toBe(false);
      expect(result.current.notFound).toBe(true);
      expect(getDetail).not.toHaveBeenCalled();
    },
  );

  it('id가 바뀌면 다시 조회한다', async () => {
    getDetail.mockResolvedValueOnce({ data: detail } as DetailResult);
    getDetail.mockResolvedValueOnce({ data: { ...detail, id: 2, title: '코칭 기초' } } as DetailResult);

    const { result, rerender } = renderHook(({ id }) => useCourseDetail(id), {
      initialProps: { id: '1' },
    });
    await waitFor(() => expect(result.current.data?.id).toBe(1));

    rerender({ id: '2' });

    await waitFor(() => expect(result.current.data?.title).toBe('코칭 기초'));
    expect(getDetail).toHaveBeenLastCalledWith({ id: 2 });
  });

  it('admin이면 관리자 API를 부르고 status와 남은 자리를 공통 모양으로 맞춘다 (D-53)', async () => {
    getAdminCourse.mockResolvedValue({
      data: {
        id: 1,
        title: 'Spring 입문',
        category: '개발',
        description: '설명',
        status: 'CLOSED',
        sessions: [
          { id: 10, startDate: '2026-12-01', place: 'A', capacity: 20, status: 'CLOSED', confirmedCount: 18 },
          { id: 11, startDate: '2027-01-01', place: 'B', capacity: 5, status: 'OPEN', confirmedCount: 0 },
        ],
      },
    } as AdminResult);

    const { result } = renderHook(() => useCourseDetail('1', { admin: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDetail).not.toHaveBeenCalled();
    expect(getAdminCourse).toHaveBeenCalledWith({ id: 1 });
    expect(result.current.data?.closed).toBe(true);
    expect(result.current.data?.sessions.map((s) => [s.remainingSeats, s.closed])).toEqual([
      [2, true],
      [5, false],
    ]);
  });

  it('refresh는 로딩 표시 없이 다시 조회해 데이터만 바꾼다', async () => {
    getDetail.mockResolvedValueOnce({ data: detail } as DetailResult);
    const { result } = renderHook(() => useCourseDetail('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getDetail.mockResolvedValueOnce({
      data: { ...detail, sessions: [{ ...detail.sessions![0], remainingSeats: 19 }] },
    } as DetailResult);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data?.sessions[0].remainingSeats).toBe(19);
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it('id가 바뀐 뒤 늦게 도착한 이전 id의 응답은 무시한다', async () => {
    let resolveFirst!: (v: DetailResult) => void;
    getDetail.mockReturnValueOnce(
      new Promise<DetailResult>((r) => {
        resolveFirst = r;
      }) as ReturnType<typeof courseApi.getDetail>,
    );
    getDetail.mockResolvedValueOnce({ data: { ...detail, id: 2, title: '코칭 기초' } } as DetailResult);

    const { result, rerender } = renderHook(({ id }) => useCourseDetail(id), {
      initialProps: { id: '1' },
    });
    rerender({ id: '2' });
    await waitFor(() => expect(result.current.data?.id).toBe(2));

    await act(async () => {
      resolveFirst({ data: detail } as DetailResult);
    });

    expect(result.current.data?.id).toBe(2);
  });

  it('refresh를 연달아 부르면 먼저 보낸 응답이 나중 응답을 덮지 않는다', async () => {
    getDetail.mockResolvedValueOnce({ data: detail } as DetailResult);
    const { result } = renderHook(() => useCourseDetail('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const withSeats = (n: number) =>
      ({ data: { ...detail, sessions: [{ ...detail.sessions![0], remainingSeats: n }] } }) as DetailResult;
    let resolveOld!: (v: DetailResult) => void;
    getDetail.mockReturnValueOnce(
      new Promise<DetailResult>((r) => {
        resolveOld = r;
      }) as ReturnType<typeof courseApi.getDetail>,
    );
    getDetail.mockResolvedValueOnce(withSeats(5));

    await act(async () => {
      const first = result.current.refresh();
      await result.current.refresh();
      resolveOld(withSeats(19));
      await first;
    });

    expect(result.current.data?.sessions[0].remainingSeats).toBe(5);
  });

  it('언마운트 뒤에 도착한 refresh 응답은 무시한다', async () => {
    getDetail.mockResolvedValueOnce({ data: detail } as DetailResult);
    const { result, unmount } = renderHook(() => useCourseDetail('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolveLate!: (v: DetailResult) => void;
    getDetail.mockReturnValueOnce(
      new Promise<DetailResult>((r) => {
        resolveLate = r;
      }) as ReturnType<typeof courseApi.getDetail>,
    );
    const pending = result.current.refresh();
    unmount();
    resolveLate({ data: detail } as DetailResult);

    await expect(pending).resolves.toBeUndefined();
    expect(result.current.data?.sessions[0].remainingSeats).toBe(20);
  });

  it('refresh가 실패하면 기존 데이터를 유지한다', async () => {
    getDetail.mockResolvedValueOnce({ data: detail } as DetailResult);
    const { result } = renderHook(() => useCourseDetail('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getDetail.mockRejectedValueOnce(httpError(500));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data?.id).toBe(1);
    expect(result.current.error).toBeUndefined();
  });

  it('enabled가 false면 조회하지 않고 로딩으로 두며, true가 되면 조회한다 (D-53)', async () => {
    getDetail.mockResolvedValue({ data: detail } as DetailResult);

    const { result, rerender } = renderHook(({ enabled }) => useCourseDetail('1', { enabled }), {
      initialProps: { enabled: false },
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(getDetail).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDetail).toHaveBeenCalledWith({ id: 1 });
    expect(result.current.data?.title).toBe('Spring 입문');
  });

  it('admin이어도 enabled가 false인 동안은 관리자 API를 부르지 않는다', async () => {
    getAdminCourse.mockResolvedValue({
      data: { id: 1, title: 'Spring 입문', status: 'CLOSED', sessions: [] },
    } as unknown as AdminResult);

    const { result, rerender } = renderHook(({ enabled }) => useCourseDetail('1', { admin: true, enabled }), {
      initialProps: { enabled: false },
    });

    expect(result.current.loading).toBe(true);
    expect(getAdminCourse).not.toHaveBeenCalled();
    expect(getDetail).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAdminCourse).toHaveBeenCalledWith({ id: 1 });
    expect(getDetail).not.toHaveBeenCalled();
    expect(result.current.data?.closed).toBe(true);
  });
});
