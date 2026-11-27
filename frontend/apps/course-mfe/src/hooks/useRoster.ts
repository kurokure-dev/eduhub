import type { RosterResponse } from '@eduhub/api-client';
import { useCallback, useEffect, useState } from 'react';
import { adminEnrollmentApi } from '../api/adminEnrollmentApi';
import { failureKindOf } from './httpStatus';

export interface RosterError {
  kind: 'forbidden' | 'notFound' | 'error';
}

/** 라우트 파라미터를 회차 id로 바꾼다. 양의 정수가 아니면 undefined (D-24) */
function parseSessionId(id: string | undefined): number | undefined {
  if (!id || !/^\d+$/.test(id)) return undefined;
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

const NOT_FOUND: RosterError = { kind: 'notFound' };

/**
 * 회차 명단(확정·대기) 조회 (FR-08, D-55). 잘못된 id는 API를 부르지 않고
 * 404 응답과 같은 error { kind: 'notFound' }, notFound=true로 알린다.
 * 403은 error.kind='forbidden'이다. reload()는 기존 data를 유지한 채 다시 읽고, 시작할 때 이전 error를 지운다
 */
export function useRoster(sessionId: string | undefined) {
  const id = parseSessionId(sessionId);
  // 조회한 id를 함께 저장해, id가 바뀐 첫 렌더에도 이전 회차의 data·error가 새 id 아래 보이지 않게 한다
  const [state, setState] = useState<{ id?: number; data?: RosterResponse; error?: RosterError }>({});
  const [fetching, setFetching] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id === undefined) return;
    let ignore = false;
    setFetching(true);
    setState((s) => (s.id === id ? { ...s, error: undefined } : s));
    adminEnrollmentApi
      .getRoster({ sessionId: id })
      .then((response) => {
        if (!ignore) setState({ id, data: response.data });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        // 실패하면 오래된 명단이 남지 않도록 data를 비운다
        const kind = failureKindOf(e, true);
        setState({ id, error: { kind: kind === 'forbidden' || kind === 'notFound' ? kind : 'error' } });
      })
      .finally(() => {
        if (!ignore) setFetching(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  if (id === undefined) {
    return { data: undefined, loading: false, error: NOT_FOUND as RosterError | undefined, notFound: true, reload };
  }
  const current = state.id === id ? state : undefined;
  const error = current?.error;
  return {
    data: current?.data,
    loading: current === undefined || fetching,
    error,
    notFound: error?.kind === 'notFound',
    reload,
  };
}
