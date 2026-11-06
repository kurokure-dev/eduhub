import { Configuration, CourseApi } from '@eduhub/api-client';

// CourseApi 인스턴스는 이 파일에서만 만든다.
// basePath를 비워 같은 출처의 /api로 요청하고, 개발 중에는 Vite 프록시가 백엔드(8080)로 넘긴다
export const courseApi = new CourseApi(new Configuration({ basePath: '' }));
