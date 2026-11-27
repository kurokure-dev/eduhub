import type { PageResponseAdminCourseSummaryResponse } from '@eduhub/api-client';
import { useCallback, useEffect, useState } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';
import { failureKindOf } from './httpStatus';

export interface AdminCourseSearchParams {
  /** 비어 있으면 종료된 과정까지 모두 조회한다 (D-34) */
  status?: 'OPEN' | 'CLOSED' | '';
  keyword?: string;
  /** 0부터 시작한다 */
  page: number;
  size: number;
}

export interface AdminCoursesError {
  kind: 'forbidden' | 'error';
}

/**
 * 관리자 과정 목록 (FR-03, D-56, D-34). 빈 status·keyword는 조건 없이 조회한다.
 * 403은 error.kind='forbidden'이다. reload()는 기존 data를 유지한 채 다시 읽고, 시작할 때 이전 error를 지운다
 */
export function useAdminCourses({ status, keyword, page, size }: AdminCourseSearchParams) {
  const [data, setData] = useState<PageResponseAdminCourseSummaryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminCoursesError>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(undefined);
    adminCourseApi
      .searchAdminCourses({
        status: status || undefined,
        keyword: keyword || undefined,
        page,
        size,
      })
      .then((response) => {
        if (!ignore) setData(response.data);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError({ kind: failureKindOf(e, true) === 'forbidden' ? 'forbidden' : 'error' });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [status, keyword, page, size, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, loading, error, reload };
}
