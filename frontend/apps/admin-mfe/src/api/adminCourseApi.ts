import { AdminCourseApi, Configuration } from '@eduhub/api-client';
import { isAxiosError } from 'axios';

// AdminCourseApi 인스턴스는 이 파일에서만 만든다.
// basePath를 비워 같은 출처의 /api로 요청하고, 개발 중에는 Vite 프록시가 백엔드로 넘긴다
export const adminCourseApi = new AdminCourseApi(new Configuration({ basePath: '' }));

/** 오류를 화면에 보여 줄 문장으로 바꾼다. 백엔드의 ProblemDetail에 detail이 있으면 그것을 쓴다 */
export function toErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const detail = (e.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return e instanceof Error ? e.message : String(e);
}
