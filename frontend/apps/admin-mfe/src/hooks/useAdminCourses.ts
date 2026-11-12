import type {
  PageResponseAdminCourseSummaryResponse,
  SearchAdminCoursesStatusEnum,
} from '@eduhub/api-client';
import { useCallback, useEffect, useState } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';

export interface AdminCourseSearchParams {
  /** 비어 있으면 종료된 과정까지 모두 조회한다 (D-34) */
  status?: SearchAdminCoursesStatusEnum | '';
  keyword?: string;
  /** 0부터 시작한다 */
  page: number;
  size: number;
}

/** 관리자 과정 목록 (FR-03). 등록·종료 뒤 reload로 다시 불러온다 */
export function useAdminCourses({ status, keyword, page, size }: AdminCourseSearchParams) {
  const [data, setData] = useState<PageResponseAdminCourseSummaryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
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
        if (!ignore) setError(e instanceof Error ? e : new Error(String(e)));
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
