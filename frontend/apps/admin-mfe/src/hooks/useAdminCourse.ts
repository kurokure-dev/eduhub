import type { AdminCourseDetailResponse } from '@eduhub/api-client';
import { useCallback, useEffect, useState } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';

/** 관리자 과정 상세와 모든 회차 (FR-03, D-34). 수정·종료 뒤 reload로 다시 불러온다 */
export function useAdminCourse(id: number) {
  const [data, setData] = useState<AdminCourseDetailResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(undefined);
    adminCourseApi
      .getAdminCourse({ id })
      .then((response) => {
        if (!ignore) setData(response.data);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, loading, error, reload };
}
