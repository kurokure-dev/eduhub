import type {
  AdminCourseDetailResponse,
  AdminSessionResponse,
  CourseRequest,
  SessionRequest,
} from '@eduhub/api-client';
import { useMemo } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';

/**
 * 과정·회차 등록, 수정, 종료 (FR-03). 화면은 API를 직접 부르지 않고 이 훅의 함수를 쓴다.
 * 실패하면 Promise가 거부되며, 메시지는 toErrorMessage로 꺼낸다
 */
export function useAdminCourseActions() {
  return useMemo(
    () => ({
      createCourse: async (courseRequest: CourseRequest): Promise<AdminCourseDetailResponse> =>
        (await adminCourseApi.createCourse({ courseRequest })).data,
      updateCourse: async (
        id: number,
        courseRequest: CourseRequest,
      ): Promise<AdminCourseDetailResponse> =>
        (await adminCourseApi.updateCourse({ id, courseRequest })).data,
      closeCourse: async (id: number): Promise<AdminCourseDetailResponse> =>
        (await adminCourseApi.closeCourse({ id })).data,
      createSession: async (
        id: number,
        sessionRequest: SessionRequest,
      ): Promise<AdminSessionResponse> =>
        (await adminCourseApi.createSession({ id, sessionRequest })).data,
      updateSession: async (
        id: number,
        sessionId: number,
        sessionRequest: SessionRequest,
      ): Promise<AdminSessionResponse> =>
        (await adminCourseApi.updateSession({ id, sessionId, sessionRequest })).data,
      closeSession: async (id: number, sessionId: number): Promise<AdminSessionResponse> =>
        (await adminCourseApi.closeSession({ id, sessionId })).data,
    }),
    [],
  );
}
