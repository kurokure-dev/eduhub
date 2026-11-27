import type { EnrollmentResponseStatusEnum } from '@eduhub/api-client';
import { useCallback, useRef, useState } from 'react';
import { enrollmentApi } from '../api/enrollmentApi';
import { failureKindOf, type FailureKind } from './httpStatus';

export interface EnrollResult {
  status: EnrollmentResponseStatusEnum | undefined;
  /** 대기일 때만 값이 있다 (D-53) */
  waitingRank: number | null | undefined;
}

/** 신청 실패. kind로 문구를 고른다: 409 conflict, 404 notFound, 그 밖 error (FR-06) */
export class EnrollError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, cause?: unknown) {
    super(`enroll failed: ${kind}`, { cause });
    this.name = 'EnrollError';
    this.kind = kind;
  }
}

/** 회차 신청 (FR-06, D-52). 성공이면 확정·대기 결과를 돌려주고, 실패면 EnrollError를 던진다 */
export function useEnroll() {
  const [pending, setPending] = useState(false);
  // 호출이 겹쳐도 먼저 끝난 쪽이 pending을 끄지 않도록 진행 중 호출 수를 센다
  const inFlight = useRef(0);

  const enroll = useCallback(async (sessionId: number): Promise<EnrollResult> => {
    inFlight.current++;
    setPending(true);
    try {
      const response = await enrollmentApi.enroll({ sessionId });
      return { status: response.data.status, waitingRank: response.data.waitingRank };
    } catch (e: unknown) {
      throw new EnrollError(failureKindOf(e), e);
    } finally {
      inFlight.current--;
      if (inFlight.current === 0) setPending(false);
    }
  }, []);

  return { enroll, pending };
}
