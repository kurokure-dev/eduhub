import { useCallback, useRef, useState } from 'react';
import { enrollmentApi } from '../api/enrollmentApi';
import { failureKindOf, type FailureKind } from './httpStatus';

/** 취소 실패. 409(마감 등 취소할 수 없음) conflict, 404 notFound, 그 밖 error (FR-06, D-45) */
export class CancelError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, cause?: unknown) {
    super(`cancel failed: ${kind}`, { cause });
    this.name = 'CancelError';
    this.kind = kind;
  }
}

/** 신청 취소 (FR-06). 실패면 CancelError를 던진다 */
export function useCancelEnrollment() {
  const [pending, setPending] = useState(false);
  // 호출이 겹쳐도 먼저 끝난 쪽이 pending을 끄지 않도록 진행 중 호출 수를 센다
  const inFlight = useRef(0);

  const cancel = useCallback(async (enrollmentId: number): Promise<void> => {
    inFlight.current++;
    setPending(true);
    try {
      await enrollmentApi.cancel({ enrollmentId });
    } catch (e: unknown) {
      throw new CancelError(failureKindOf(e), e);
    } finally {
      inFlight.current--;
      if (inFlight.current === 0) setPending(false);
    }
  }, []);

  return { cancel, pending };
}
