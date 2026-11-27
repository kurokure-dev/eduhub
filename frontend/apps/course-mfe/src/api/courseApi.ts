import { CourseApi } from '@eduhub/api-client';
import { apiConfig, http } from './http';

// CourseApi 인스턴스는 이 파일에서만 만든다.
// 같은 출처의 /api로 요청하고(apiConfig), 인증 헤더는 http 인스턴스가 붙인다 (NFR-03)
export const courseApi = new CourseApi(apiConfig, undefined, http);
