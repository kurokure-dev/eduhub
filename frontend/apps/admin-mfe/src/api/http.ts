import axios, { AxiosHeaders, type AxiosRequestConfig } from 'axios';
import { Configuration } from '@eduhub/api-client';

// course-mfe `src/api/http.ts`와 같은 규칙이다. 한쪽을 고치면 다른 쪽도 고친다(D-50).
// NFR-03, D-42: 로그인 응답의 HS256 JWT를 localStorage에 두고 모든 API 요청에 Bearer로 붙인다.
// 생성 클라이언트는 이 파일의 axios 인스턴스(http)로만 요청한다.

export const TOKEN_KEY = 'eduhub.accessToken';
const USER_KEY = 'eduhub.user';
const LOGIN_PATH = '/api/auth/login';

// 인증이 만료·무효일 때(401) 화면 쪽(AuthContext)이 로그아웃 처리하도록 알리는 이벤트 이름
export const UNAUTHORIZED_EVENT = 'eduhub:unauthorized';

// localStorage 접근이 막힌 환경(사생활 보호 모드 등)에서도 앱이 죽지 않도록 모두 try/catch로 감싼다
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getUser<T = unknown>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // 깨진 JSON도 저장이 없는 것으로 본다
      return null;
    }
  },
  set(token: string, user: unknown): void {
    try {
      // user를 먼저, 토큰을 마지막에 쓴다. 다른 탭이 토큰 storage 이벤트를 받을 때 user가 이미 새 값이어야 한다
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // 저장 실패는 무시한다(이번 세션에서만 로그인이 유지되지 않는다)
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // 무시
    }
  },
};

// basePath를 비워 같은 출처의 /api로 요청하고, 개발 중에는 Vite 프록시가 백엔드(8080)로 넘긴다
export const apiConfig = new Configuration({ basePath: '' });

export const http = axios.create();

// 요청 시점에 붙인 토큰을 요청 설정에 기억해 두는 사용자 정의 필드 (오래된 401 구분용)
declare module 'axios' {
  interface AxiosRequestConfig {
    eduhubSentToken?: string;
  }
}

// 요청 설정의 baseURL+url을 합친 주소(http.getUri)를 현재 출처 기준 URL로 푼다.
// 상대 경로는 같은 출처가 된다. 요청별 baseURL로 다른 출처가 지정돼도 잡아낸다. 풀 수 없으면 null
function resolveUrl(config: AxiosRequestConfig): URL | null {
  try {
    return new URL(http.getUri(config), window.location.origin);
  } catch {
    return null;
  }
}

function isSameOrigin(config: AxiosRequestConfig): boolean {
  return resolveUrl(config)?.origin === window.location.origin;
}

// 로그인 요청 판별: 쿼리스트링·해시를 뗀 경로가 정확히 /api/auth/login인 같은 출처 요청.
// Spring Security resource server는 permitAll 경로라도 무효·만료 Bearer가 오면 401을 내므로
// 요청·응답 인터셉터가 이 함수를 함께 쓴다
function isLoginRequest(config: AxiosRequestConfig): boolean {
  const url = resolveUrl(config);
  return url !== null && url.origin === window.location.origin && url.pathname === LOGIN_PATH;
}

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  // 로그인 요청과 다른 출처 요청에는 토큰을 붙이지 않는다(토큰 유출 방지)
  if (token && !isLoginRequest(config) && isSameOrigin(config)) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set('Authorization', `Bearer ${token}`);
    config.eduhubSentToken = token;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const config = error?.config;
    // 로그인 요청의 401은 사번·비밀번호 오류이므로 세션 만료로 다루지 않는다. 403 등은 건드리지 않는다.
    // 요청에 실어 보낸 토큰이 지금 저장된 토큰과 같을 때만 만료 처리한다
    // (재로그인 뒤 도착한 오래된 401이 새 토큰을 지우지 않게, 토큰 없이 보낸 요청의 401은 무시)
    if (status === 401 && config && !isLoginRequest(config)) {
      const sent = config.eduhubSentToken;
      if (sent && tokenStore.get() === sent) {
        tokenStore.clear();
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);
