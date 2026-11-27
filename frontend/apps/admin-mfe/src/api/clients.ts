import { AuthApi } from '@eduhub/api-client';
import { apiConfig, http } from './http';

// AuthApi 인스턴스는 이 파일에서만 만든다 (NFR-03). 토큰 처리는 http 인스턴스의 인터셉터가 맡는다
export const authApi = new AuthApi(apiConfig, undefined, http);
