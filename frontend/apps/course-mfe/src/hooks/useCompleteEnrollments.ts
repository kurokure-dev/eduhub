import type { CompletionResponse } from '@eduhub/api-client';
import { useCallback, useRef, useState } from 'react';
import { adminEnrollmentApi } from '../api/adminEnrollmentApi';
import { failureKindOf, problemDetailOf, type AdminFailureKind } from './httpStatus';

/** 수료 처리 실패. 409 conflict(마감 전 등), 403 forbidden, 404 notFound, 그 밖 error. 서버 사유는 detail (FR-08, D-55) */
export class CompleteError extends Error {
  readonly kind: AdminFailureKind;
  readonly detail: string | undefined;
  constructor(kind: AdminFailureKind, detail?: string, cause?: unknown) {
    super(detail ?? `complete failed: ${kind}`, { cause });
    this.name = 'CompleteError';
    this.kind = kind;
    this.detail = detail;
  }
}

/** 수료 처리 (FR-08, D-10, D-13). 성공이면 처리·실패 목록을 돌려주고, 실패면 CompleteError를 던진다 */
export function useCompleteEnrollments() {
  const [pending, setPending] = useState(false);
  // 호출이 겹쳐도 먼저 끝난 쪽이 pending을 끄지 않도록 진행 중 호출 수를 센다
  const inFlight = useRef(0);

  const complete = useCallback(
    async (sessionId: number, employeeIds: string[]): Promise<CompletionResponse> => {
      inFlight.current++;
      setPending(true);
      try {
        const response = await adminEnrollmentApi.complete({
          sessionId,
          completionRequest: { employeeIds },
        });
        return response.data;
      } catch (e: unknown) {
        throw new CompleteError(failureKindOf(e, true), problemDetailOf(e), e);
      } finally {
        inFlight.current--;
        if (inFlight.current === 0) setPending(false);
      }
    },
    [],
  );

  return { complete, pending };
}
