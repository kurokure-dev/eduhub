import type { CourseDetailResponse } from '@eduhub/api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseApi } from '../api/courseApi';
import { useCourseDetail } from './useCourseDetail';

vi.mock('../api/courseApi', () => ({
  courseApi: { getDetail: vi.fn() },
}));

const getDetail = vi.mocked(courseApi.getDetail);
type DetailResult = Awaited<ReturnType<typeof courseApi.getDetail>>;

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
  });

  it('상세를 불러오고, 라우트의 id를 숫자로 넘긴다', async () => {
    getDetail.mockResolvedValue({ data: detail } as DetailResult);

    const { result } = renderHook(() => useCourseDetail('1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(detail);
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(getDetail).toHaveBeenCalledWith({ id: 1 });
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
});
