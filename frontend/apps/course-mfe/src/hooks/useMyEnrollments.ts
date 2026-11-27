import type { FindMineStatusEnum, MyEnrollmentResponse } from '@eduhub/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { enrollmentApi } from '../api/enrollmentApi';

/** 내 신청 내역 조회 (FR-06, D-09). status가 없으면 전체. reload()로 다시 조회한다 */
export function useMyEnrollments(status?: FindMineStatusEnum) {
  const [data, setData] = useState<MyEnrollmentResponse[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [version, setVersion] = useState(0);
  const loadedStatus = useRef(status);

  useEffect(() => {
    let ignore = false;
    // 필터가 바뀌면 이전 필터의 목록을 지운다. reload()는 기존 목록을 유지한 채 다시 읽는다
    if (loadedStatus.current !== status) {
      loadedStatus.current = status;
      setData(undefined);
    }
    setLoading(true);
    setError(undefined);
    enrollmentApi
      .findMine({ status })
      .then((response) => {
        if (!ignore) setData(response.data);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        // 실패하면 오래된 목록이 남지 않도록 비운다
        setData(undefined);
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [status, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, loading, error, reload };
}
