import { AdminEnrollmentApi } from '@eduhub/api-client';
import { apiConfig, http } from './http';

// AdminEnrollmentApi 인스턴스는 이 파일에서만 만든다 (FR-08, D-55). 인증 헤더는 http 인스턴스가 붙인다 (NFR-03)
export const adminEnrollmentApi = new AdminEnrollmentApi(apiConfig, undefined, http);
