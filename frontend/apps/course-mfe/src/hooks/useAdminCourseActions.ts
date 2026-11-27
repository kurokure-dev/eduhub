import type {
  AdminCourseDetailResponse,
  AdminSessionResponse,
  CourseRequest,
  SessionRequest,
} from '@eduhub/api-client';
import { useCallback, useRef, useState } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';
import { failureKindOf, problemDetailOf, type AdminFailureKind } from './httpStatus';

/** 관리자 과정·회차 변경 실패. kind로 문구를 고르고, 서버 사유는 detail에 담긴다 (FR-03, D-55) */
export class AdminActionError extends Error {
  readonly kind: AdminFailureKind;
  readonly detail: string | undefined;
  constructor(kind: AdminFailureKind, detail?: string, cause?: unknown) {
    super(detail ?? `admin action failed: ${kind}`, { cause });
    this.name = 'AdminActionError';
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * 과정 등록·수정·종료와 회차 등록 (FR-03, D-55). 화면은 API를 직접 부르지 않는다.
 * 성공은 응답 data를 돌려주고, 실패는 AdminActionError로 거부한다
 */
export function useAdminCourseActions() {
  const [pending, setPending] = useState(false);
  // 호출이 겹쳐도 먼저 끝난 쪽이 pending을 끄지 않도록 진행 중 호출 수를 센다
  const inFlight = useRef(0);

  const run = useCallback(async <T,>(call: () => Promise<{ data: T }>): Promise<T> => {
    inFlight.current++;
    setPending(true);
    try {
      return (await call()).data;
    } catch (e: unknown) {
      throw new AdminActionError(failureKindOf(e, true), problemDetailOf(e), e);
    } finally {
      inFlight.current--;
      if (inFlight.current === 0) setPending(false);
    }
  }, []);

  const createCourse = useCallback(
    (courseRequest: CourseRequest): Promise<AdminCourseDetailResponse> =>
      run(() => adminCourseApi.createCourse({ courseRequest })),
    [run],
  );
  const updateCourse = useCallback(
    (id: number, courseRequest: CourseRequest): Promise<AdminCourseDetailResponse> =>
      run(() => adminCourseApi.updateCourse({ id, courseRequest })),
    [run],
  );
  const closeCourse = useCallback(
    (id: number): Promise<AdminCourseDetailResponse> => run(() => adminCourseApi.closeCourse({ id })),
    [run],
  );
  const createSession = useCallback(
    (id: number, sessionRequest: SessionRequest): Promise<AdminSessionResponse> =>
      run(() => adminCourseApi.createSession({ id, sessionRequest })),
    [run],
  );

  // 회차 수정·마감 (FR-03, D-56)
  const updateSession = useCallback(
    (id: number, sessionId: number, sessionRequest: SessionRequest): Promise<AdminSessionResponse> =>
      run(() => adminCourseApi.updateSession({ id, sessionId, sessionRequest })),
    [run],
  );
  const closeSession = useCallback(
    (id: number, sessionId: number): Promise<AdminSessionResponse> =>
      run(() => adminCourseApi.closeSession({ id, sessionId })),
    [run],
  );

  return { createCourse, updateCourse, closeCourse, createSession, updateSession, closeSession, pending };
}
