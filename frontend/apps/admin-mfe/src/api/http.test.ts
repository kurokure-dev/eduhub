import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { http, tokenStore, UNAUTHORIZED_EVENT } from './http';

let recorded: InternalAxiosRequestConfig | undefined;

// 실제 네트워크 대신 요청 config를 기록하고 지정한 상태 코드를 흉내 낸다
function mockStatus(status: number): void {
  const adapter: AxiosAdapter = (config) => {
    recorded = config;
    const response = { data: {}, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      return Promise.reject(
        new AxiosError('fail', String(status), config, null, response),
      );
    }
    return Promise.resolve(response);
  };
  http.defaults.adapter = adapter;
}

describe('http', () => {
  const onUnauthorized = vi.fn();
  const user = { employeeNo: 'E1' };

  beforeEach(() => {
    localStorage.clear();
    recorded = undefined;
    onUnauthorized.mockClear();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    mockStatus(200);
  });

  afterEach(() => {
    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  });

  it('H1 토큰이 있으면 Bearer 헤더가 붙는다', async () => {
    tokenStore.set('t1', user);
    await http.get('/api/courses');
    expect(recorded?.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('H2 토큰이 없으면 Authorization 헤더가 없다', async () => {
    await http.get('/api/courses');
    expect(recorded?.headers.get('Authorization')).toBeFalsy();
  });

  it('H3 401이면 토큰과 user가 지워지고 이벤트가 1회 나오며 원 오류로 reject된다', async () => {
    tokenStore.set('t1', user);
    mockStatus(401);
    await expect(http.get('/api/enrollments/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(tokenStore.get()).toBeNull();
    expect(tokenStore.getUser()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('H4 403이면 토큰이 남고 이벤트가 없다', async () => {
    tokenStore.set('t1', user);
    mockStatus(403);
    await expect(http.get('/api/admin/x')).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(tokenStore.get()).toBe('t1');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('H5 로그인 요청에는 Authorization이 없고, 로그인 401은 이벤트·토큰 삭제가 없다', async () => {
    tokenStore.set('t1', user);
    mockStatus(401);
    await expect(http.post('/api/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(recorded?.headers.get('Authorization')).toBeFalsy();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(tokenStore.get()).toBe('t1');
  });

  it('H6 저장된 user JSON이 깨져 있으면 getUser는 null이다', () => {
    localStorage.setItem('eduhub.user', '{broken');
    expect(tokenStore.getUser()).toBeNull();
  });

  it('응답 없는 네트워크 오류면 토큰이 남고 이벤트가 없다', async () => {
    tokenStore.set('t1', user);
    http.defaults.adapter = (config) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    await expect(http.get('/api/courses')).rejects.toBeTruthy();
    expect(tokenStore.get()).toBe('t1');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('쿼리스트링에 로그인 경로가 든 다른 URL의 401은 만료 처리된다', async () => {
    tokenStore.set('t1', user);
    mockStatus(401);
    await expect(http.get('/api/x?next=/api/auth/login')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(tokenStore.get()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('쿼리스트링·해시가 붙은 로그인 요청도 로그인으로 판별한다', async () => {
    tokenStore.set('t1', user);
    mockStatus(401);
    await expect(http.post('/api/auth/login?a=1#h', {})).rejects.toBeTruthy();
    expect(recorded?.headers.get('Authorization')).toBeFalsy();
    expect(tokenStore.get()).toBe('t1');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('다른 출처 절대 URL 요청에는 Authorization이 없다', async () => {
    tokenStore.set('t1', user);
    await http.get('https://other.example.com/api/courses');
    expect(recorded?.headers.get('Authorization')).toBeFalsy();
  });

  it('요청별 baseURL이 다른 출처이면 상대 url이어도 Authorization이 없다', async () => {
    tokenStore.set('t1', user);
    await http.get('/api/courses', { baseURL: 'https://other.example' });
    expect(recorded?.headers.get('Authorization')).toBeFalsy();
  });

  it('같은 출처 절대 URL 요청에는 Authorization이 붙는다', async () => {
    tokenStore.set('t1', user);
    await http.get(`${window.location.origin}/api/courses`);
    expect(recorded?.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('토큰 없이 보낸 요청의 401은 이벤트가 없다', async () => {
    mockStatus(401);
    await expect(http.get('/api/courses')).rejects.toBeTruthy();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('요청 뒤 토큰이 바뀐 상태에서 온 오래된 401은 새 토큰을 지우지 않는다', async () => {
    tokenStore.set('old', user);
    http.defaults.adapter = (config) => {
      tokenStore.set('new', user);
      const response = { data: {}, status: 401, statusText: '', headers: {}, config };
      return Promise.reject(new AxiosError('fail', '401', config, null, response));
    };
    await expect(http.get('/api/courses')).rejects.toBeTruthy();
    expect(tokenStore.get()).toBe('new');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
