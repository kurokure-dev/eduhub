/** axios 오류의 HTTP 상태를 꺼낸다. 응답이 없는 오류(네트워크 등)는 undefined */
export function httpStatusOf(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null || !('response' in e)) return undefined;
  const response = (e as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/** 화면이 문구를 고르기 쉽게 오류를 종류로 나눈다 (FR-06) */
export type FailureKind = 'conflict' | 'notFound' | 'error';

/** 관리자 화면용 종류. 403(권한 없음)을 따로 구분한다 (FR-03, FR-08, D-55) */
export type AdminFailureKind = FailureKind | 'forbidden';

/**
 * 409는 conflict(중복·마감 등 상태 충돌), 404는 notFound, 그 밖은 error.
 * withForbidden이 true면 403을 forbidden으로 구분한다. 기본은 구분하지 않아
 * 기존 사용처(신청·취소)의 동작과 타입이 그대로다
 */
export function failureKindOf(e: unknown): FailureKind;
export function failureKindOf(e: unknown, withForbidden: true): AdminFailureKind;
export function failureKindOf(e: unknown, withForbidden?: boolean): AdminFailureKind {
  const status = httpStatusOf(e);
  if (status === 409) return 'conflict';
  if (status === 404) return 'notFound';
  if (withForbidden && status === 403) return 'forbidden';
  return 'error';
}

/** 서버 ProblemDetail의 detail 문자열을 꺼낸다. 없거나 비어 있으면 undefined (FR-03, FR-08, D-55) */
export function problemDetailOf(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null || !('response' in e)) return undefined;
  const data = (e as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== 'object' || data === null) return undefined;
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail.trim() !== '' ? detail : undefined;
}
