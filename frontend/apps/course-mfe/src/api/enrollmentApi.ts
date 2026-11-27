import { EnrollmentApi } from '@eduhub/api-client';
import { apiConfig, http } from './http';

// EnrollmentApi 인스턴스는 이 파일에서만 만든다 (FR-06). 인증 헤더는 http 인스턴스가 붙인다 (NFR-03)
export const enrollmentApi = new EnrollmentApi(apiConfig, undefined, http);
