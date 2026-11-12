import { renderHook } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCourseApi, toErrorMessage } from '../api/adminCourseApi';
import { useAdminCourseActions } from './useAdminCourseActions';

vi.mock('../api/adminCourseApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/adminCourseApi')>()),
  adminCourseApi: {
    createCourse: vi.fn(),
    updateSession: vi.fn(),
    closeCourse: vi.fn(),
  },
}));

const api = vi.mocked(adminCourseApi);

describe('useAdminCourseActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('과정 등록은 요청 본문을 넘기고 응답 데이터를 돌려준다', async () => {
    api.createCourse.mockResolvedValue({ data: { id: 1, status: 'OPEN' } } as Awaited<
      ReturnType<typeof api.createCourse>
    >);
    const { result } = renderHook(() => useAdminCourseActions());

    const created = await result.current.createCourse({ title: 'Spring 입문', category: '개발' });

    expect(api.createCourse).toHaveBeenCalledWith({
      courseRequest: { title: 'Spring 입문', category: '개발' },
    });
    expect(created).toEqual({ id: 1, status: 'OPEN' });
  });

  it('회차 수정은 과정 id와 회차 id를 함께 넘긴다', async () => {
    api.updateSession.mockResolvedValue({ data: {} } as Awaited<
      ReturnType<typeof api.updateSession>
    >);
    const { result } = renderHook(() => useAdminCourseActions());
    const request = { startDate: '2026-12-01', place: '본사', capacity: 30 };

    await result.current.updateSession(1, 10, request);

    expect(api.updateSession).toHaveBeenCalledWith({ id: 1, sessionId: 10, sessionRequest: request });
  });

  it('409 응답이면 ProblemDetail의 detail을 오류 메시지로 쓴다', async () => {
    const error = new AxiosError('Request failed with status code 409');
    error.response = {
      status: 409,
      data: { detail: '종료된 과정은 변경할 수 없습니다: 1' },
    } as AxiosResponse;
    api.closeCourse.mockRejectedValue(error);
    const { result } = renderHook(() => useAdminCourseActions());

    const rejected = await result.current.closeCourse(1).catch((e: unknown) => e);

    expect(toErrorMessage(rejected)).toBe('종료된 과정은 변경할 수 없습니다: 1');
  });
});
