/** axios 오류의 HTTP 상태를 꺼낸다. 응답이 없는 오류(네트워크 등)는 undefined */
export function httpStatusOf(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null || !('response' in e)) return undefined;
  const response = (e as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/** 화면이 문구를 고르기 쉽게 오류를 종류로 나눈다 (FR-06) */
export type FailureKind = 'conflict' | 'notFound' | 'error';

/** 409는 conflict(중복·마감 등 상태 충돌), 404는 notFound, 그 밖은 error */
export function failureKindOf(e: unknown): FailureKind {
  const status = httpStatusOf(e);
  if (status === 409) return 'conflict';
  if (status === 404) return 'notFound';
  return 'error';
}
