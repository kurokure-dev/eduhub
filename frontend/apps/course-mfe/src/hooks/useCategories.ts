import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

/** 분류 선택지 조회 (D-23) */
export function useCategories() {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let ignore = false;
    courseApi
      .getCategories()
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
  }, []);

  return { data, loading, error };
}
