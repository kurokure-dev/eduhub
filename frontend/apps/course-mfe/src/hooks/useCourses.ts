import type { PageResponseCourseSummaryResponse } from '@eduhub/api-client';
import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

export interface CourseSearchParams {
  keyword?: string;
  category?: string;
  /** 0부터 시작한다. 백엔드 Pageable과 MUI TablePagination 모두 0부터라 그대로 넘긴다 */
  page: number;
  size: number;
}

/** 과정 목록 조회 (FR-01). 빈 검색어와 분류는 조건 없이 조회한다 */
export function useCourses({ keyword, category, page, size }: CourseSearchParams) {
  const [data, setData] = useState<PageResponseCourseSummaryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(undefined);
    courseApi
      .search({ keyword: keyword || undefined, category: category || undefined, page, size })
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
  }, [keyword, category, page, size]);

  return { data, loading, error };
}
