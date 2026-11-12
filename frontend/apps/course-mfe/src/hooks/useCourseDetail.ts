import type { CourseDetailResponse } from '@eduhub/api-client';
import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

/** 라우트 파라미터를 과정 id로 바꾼다. 양의 정수가 아니면 undefined (D-24) */
function parseCourseId(id: string | undefined): number | undefined {
  if (!id || !/^\d+$/.test(id)) return undefined;
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** axios 오류의 HTTP 상태를 꺼낸다. 응답이 없는 오류(네트워크 등)는 undefined */
function httpStatusOf(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null || !('response' in e)) return undefined;
  const response = (e as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/**
 * 과정 상세와 모집 중인 회차 조회 (FR-02).
 * 없거나 종료된 과정(404, D-20)과 잘못된 id는 error가 아니라 notFound로 알린다 (D-28)
 */
export function useCourseDetail(id: string | undefined) {
  const courseId = parseCourseId(id);
  const [data, setData] = useState<CourseDetailResponse>();
  const [loading, setLoading] = useState(courseId !== undefined);
  const [notFound, setNotFound] = useState(courseId === undefined);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    setData(undefined);
    setError(undefined);
    if (courseId === undefined) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let ignore = false;
    setNotFound(false);
    setLoading(true);
    courseApi
      .getDetail({ id: courseId })
      .then((response) => {
        if (!ignore) setData(response.data);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        if (httpStatusOf(e) === 404) setNotFound(true);
        else setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [courseId]);

  return { data, loading, notFound, error };
}
