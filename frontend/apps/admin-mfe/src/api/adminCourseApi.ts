import { AdminCourseApi } from '@eduhub/api-client';
import { isAxiosError } from 'axios';
import { apiConfig, http } from './http';

// AdminCourseApi 인스턴스는 이 파일에서만 만든다 (NFR-03).
// 같은 출처의 /api로 요청하고(basePath는 http.ts의 apiConfig), 토큰 처리는 http 인스턴스의 인터셉터가 맡는다
export const adminCourseApi = new AdminCourseApi(apiConfig, undefined, http);

/** 오류를 화면에 보여 줄 문장으로 바꾼다. 백엔드의 ProblemDetail에 detail이 있으면 그것을 쓴다 */
export function toErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const detail = (e.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return e instanceof Error ? e.message : String(e);
}
